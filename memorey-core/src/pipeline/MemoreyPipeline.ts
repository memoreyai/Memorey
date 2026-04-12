import { MemoryGraph } from "../graph/MemoryGraph.js";
import { ExtractionEngine } from "../extraction/ExtractionEngine.js";
import { ReconciliationEngine } from "../reconciliation/ReconciliationEngine.js";
import { BriefingGenerator } from "../briefing/BriefingGenerator.js";
import { JsonStorage } from "../storage/JsonStorage.js";
import { SearchEngine } from "../search/SearchEngine.js";
import { OpenAIEmbeddings } from "../search/embeddings.js";
import { DEFAULT_CONFIG } from "../reconciliation/types.js";
import { EventBus } from "../events/EventBus.js";
import type { MemoreyEvent, EventHandler } from "../events/types.js";
import type { ConversationExchange } from "../extraction/types.js";
import type { SearchResult, SearchOptions } from "../search/types.js";
import type {
  MemoryNode,
  MemoryGraphData,
  VaultDefinition,
  ChangelogEntry,
  Vault,
  ReconciliationAction,
  BriefingConfig,
  Briefing,
  PipelineConfig,
  ExchangeResult,
  ConversationResult,
  PipelineStats,
} from "./types.js";

export class MemoreyPipeline {
  private graph!: MemoryGraph;
  private extractor!: ExtractionEngine;
  private reconciler!: ReconciliationEngine;
  private briefer!: BriefingGenerator;
  private searchEngine!: SearchEngine;
  private storage: JsonStorage;
  private storagePath: string;
  private config: PipelineConfig;
  private pendingConflicts: ReconciliationAction[] = [];
  private eventBus: EventBus = new EventBus();

  constructor(config: PipelineConfig) {
    this.config = config;
    this.storagePath = config.storagePath;
    this.storage = new JsonStorage();
  }

  async init(userId: string): Promise<void> {
    this.graph = new MemoryGraph(userId, this.eventBus);

    // Try loading existing graph
    try {
      const data = await this.storage.load(this.storagePath);
      this.graph.loadSnapshot(data);
      this.eventBus.emit({ type: "graph:loaded" });
    } catch {
      // No existing file — start fresh
    }

    const reconciliationConfig = {
      ...DEFAULT_CONFIG,
      ...this.config.reconciliation,
    };

    this.extractor = new ExtractionEngine({
      useLLM: !!this.config.llm,
      llmProvider: this.config.llm,
      vaults: this.graph.getVaults(),
    });

    this.reconciler = new ReconciliationEngine(this.graph, reconciliationConfig);
    this.briefer = new BriefingGenerator(this.graph);

    // Initialize search engine — use API embeddings if LLM config is available
    const useApi = !!this.config.llm;
    this.searchEngine = new SearchEngine(this.graph, {
      useApiEmbeddings: useApi,
      embeddingProvider: useApi
        ? new OpenAIEmbeddings({
            apiKey: this.config.llm!.apiKey,
            baseUrl: this.config.llm!.baseUrl,
          })
        : undefined,
    });
  }

  // ── Processing ──────────────────────────────────────────────

  async processExchange(exchange: ConversationExchange): Promise<ExchangeResult> {
    // Sync vault definitions to the extractor
    this.extractor.setVaults(this.graph.getVaults());

    // Get existing facts for deduplication context
    const existingFacts = this.graph
      .getActiveNodes()
      .map((n) => n.fact);

    // Extract
    const extracted = await this.extractor.extract(exchange, existingFacts);
    this.eventBus.emit({ type: "extraction:complete", result: extracted });

    // Reconcile
    const reconciliation = this.reconciler.reconcile(extracted);
    this.eventBus.emit({ type: "reconciliation:complete", result: reconciliation });

    // Apply auto actions (adds, updates, duplicates — not conflicts)
    const { applied, pendingConflicts } =
      this.reconciler.applyAutoActions(reconciliation);

    // Emit conflict:detected for each pending conflict
    for (const conflict of pendingConflicts) {
      this.eventBus.emit({ type: "conflict:detected", action: conflict });
    }

    // Track pending conflicts
    this.pendingConflicts.push(...pendingConflicts);

    // Index newly added nodes in the search engine
    for (const node of applied) {
      this.searchEngine.indexNode(node);
    }

    // Gather pending approval nodes
    const pendingApproval = applied.filter((n) => n.status === "pending");

    return {
      extracted,
      reconciliation,
      pendingApproval,
      pendingConflicts,
    };
  }

  async processConversation(
    exchanges: ConversationExchange[]
  ): Promise<ConversationResult> {
    let totalExtracted = 0;
    let totalAdded = 0;
    let totalAutoApproved = 0;
    let totalPendingApproval = 0;
    let totalDuplicates = 0;
    const allPendingConflicts: ReconciliationAction[] = [];

    for (const exchange of exchanges) {
      const result = await this.processExchange(exchange);

      totalExtracted += result.extracted.facts.length;
      totalDuplicates += result.reconciliation.duplicates;

      // Count applied nodes
      const addedCount =
        result.reconciliation.actions.filter(
          (a) => a.type === "add" || a.type === "update"
        ).length - result.reconciliation.duplicates;
      totalAdded += Math.max(0, addedCount);

      totalAutoApproved += result.reconciliation.autoApproved;
      totalPendingApproval += result.reconciliation.pending;
      allPendingConflicts.push(...result.pendingConflicts);
    }

    return {
      totalExtracted,
      totalAdded,
      totalAutoApproved,
      totalPendingApproval,
      totalDuplicates,
      pendingConflicts: allPendingConflicts,
    };
  }

  // ── Approval flow ───────────────────────────────────────────

  getPendingNodes(): MemoryNode[] {
    return this.graph.getNodesByStatus("pending");
  }

  approveNode(nodeId: string): MemoryNode {
    return this.graph.approveNode(nodeId);
  }

  rejectNode(nodeId: string): MemoryNode {
    return this.graph.rejectNode(nodeId);
  }

  approveAll(): MemoryNode[] {
    const pending = this.graph.getNodesByStatus("pending");
    return pending.map((n) => this.graph.approveNode(n.id));
  }

  // ── Node editing ────────────────────────────────────────────

  updateNodeConfidence(nodeId: string, confidence: number): MemoryNode {
    return this.graph.updateNodeConfidence(nodeId, confidence, "user");
  }

  changeNodeVault(nodeId: string, vault: Vault): MemoryNode {
    return this.graph.changeNodeVault(nodeId, vault, "user");
  }

  editNodeFact(nodeId: string, newFact: string): MemoryNode {
    return this.graph.editNodeFact(nodeId, newFact, "user");
  }

  getNodeHistory(nodeId: string): ChangelogEntry[] {
    return this.graph.getNodeHistory(nodeId);
  }

  // ── Vault management ───────────────────────────────────────

  createVault(name: string, description: string, icon?: string): VaultDefinition {
    const vault = this.graph.addVault({ name, description, icon });
    // Sync to extractor
    this.extractor.setVaults(this.graph.getVaults());
    return vault;
  }

  getVaults(): VaultDefinition[] {
    return this.graph.getVaults();
  }

  removeVault(vaultId: string): void {
    this.graph.removeVault(vaultId);
    this.extractor.setVaults(this.graph.getVaults());
  }

  // ── Conflict resolution ─────────────────────────────────────

  getPendingConflicts(): ReconciliationAction[] {
    return [...this.pendingConflicts];
  }

  resolveConflict(
    conflictAction: ReconciliationAction,
    resolution: "keep_existing" | "use_new" | "keep_both",
    userConfidence?: number
  ): void {
    if (conflictAction.type !== "conflict") {
      throw new Error("Action is not a conflict");
    }
    this.reconciler.resolveConflict(
      conflictAction as ReconciliationAction & { type: "conflict" },
      resolution,
      userConfidence
    );
    // Remove from pending conflicts
    const idx = this.pendingConflicts.indexOf(conflictAction);
    if (idx !== -1) {
      this.pendingConflicts.splice(idx, 1);
    }
    this.eventBus.emit({ type: "conflict:resolved", action: conflictAction, resolution });
  }

  // ── Briefing ────────────────────────────────────────────────

  generateBriefing(config?: Partial<BriefingConfig>): Briefing {
    return this.briefer.generate(config);
  }

  generateTaskBriefing(
    task: string,
    config?: Partial<BriefingConfig>
  ): Briefing {
    return this.briefer.generateForTask(task, config);
  }

  // ── Search ────────────────────────────────────────────────────

  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    return this.searchEngine.search(query, options);
  }

  async findRelated(
    nodeId: string,
    limit?: number
  ): Promise<SearchResult[]> {
    return this.searchEngine.findRelated(nodeId, limit);
  }

  // ── Persistence ─────────────────────────────────────────────

  async save(): Promise<void> {
    await this.storage.save(this.graph, this.storagePath);
    this.eventBus.emit({ type: "graph:saved" });
  }

  // ── Stats ───────────────────────────────────────────────────

  getStats(): PipelineStats {
    const snapshot = this.graph.getSnapshot();
    const nodes = snapshot.nodes;
    const edges = snapshot.edges;

    const activeFacts = nodes.filter(
      (n) =>
        n.supersededBy === null &&
        (n.status === "approved" || n.status === "auto_approved")
    ).length;

    const pendingFacts = nodes.filter((n) => n.status === "pending").length;
    const rejectedFacts = nodes.filter((n) => n.status === "rejected").length;
    const supersededFacts = nodes.filter(
      (n) => n.supersededBy !== null
    ).length;

    // Vault breakdown (active facts only)
    const vaultBreakdown: Record<string, number> = {};
    const vaultIdToName = new Map<string, string>();
    for (const v of snapshot.vaultDefinitions) {
      vaultIdToName.set(v.id, v.name);
    }
    for (const n of nodes) {
      if (
        n.supersededBy === null &&
        (n.status === "approved" || n.status === "auto_approved")
      ) {
        const vaultName = vaultIdToName.get(n.vault) ?? n.vault;
        vaultBreakdown[vaultName] = (vaultBreakdown[vaultName] ?? 0) + 1;
      }
    }

    // Oldest and newest
    const sortedByDate = nodes
      .filter((n) => n.supersededBy === null)
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );

    const oldestFact = sortedByDate.length > 0 ? sortedByDate[0].createdAt : "";
    const newestFact =
      sortedByDate.length > 0
        ? sortedByDate[sortedByDate.length - 1].createdAt
        : "";

    return {
      totalFacts: nodes.length,
      activeFacts,
      pendingFacts,
      rejectedFacts,
      supersededFacts,
      edges: edges.length,
      vaultBreakdown,
      oldestFact,
      newestFact,
    };
  }

  exportGraph(): MemoryGraphData {
    return this.graph.getSnapshot();
  }

  async importGraph(data: MemoryGraphData): Promise<void> {
    this.graph.loadSnapshot(data);
    this.extractor.setVaults(this.graph.getVaults());
    this.reconciler = new ReconciliationEngine(this.graph, {
      ...DEFAULT_CONFIG,
      ...this.config.reconciliation,
    });
    this.briefer = new BriefingGenerator(this.graph);
    this.searchEngine.rebuildIndex();
    this.pendingConflicts = [];
    this.eventBus.emit({ type: "graph:loaded" });
  }

  // ── Events ──────────────────────────────────────────────────

  on<T extends MemoreyEvent["type"]>(type: T, handler: EventHandler<T>): () => void {
    return this.eventBus.on(type, handler);
  }

  onAny(handler: (event: MemoreyEvent) => void): () => void {
    return this.eventBus.onAny(handler);
  }
}
