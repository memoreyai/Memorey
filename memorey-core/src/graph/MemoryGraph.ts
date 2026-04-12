import { generateId } from "../utils/ids.js";
import type {
  MemoryNode,
  MemoryEdge,
  MemoryGraphData,
  Vault,
  VaultDefinition,
  ApprovalStatus,
  ChangelogEntry,
} from "./types.js";
import { DEFAULT_VAULTS } from "./types.js";
import { SearchEngine } from "../search/SearchEngine.js";
import type { SearchResult, SearchOptions, EmbeddingProvider } from "../search/types.js";
import type { EventBus } from "../events/EventBus.js";

const DEFAULT_VAULT_DEFINITIONS: Omit<VaultDefinition, "id" | "createdAt">[] = [
  { name: "Identity", description: "Who the user is — name, age, location, roles", isDefault: true },
  { name: "Work", description: "Job, company, projects, professional context", isDefault: true },
  { name: "Preferences", description: "Likes, dislikes, communication style, tool preferences", isDefault: true },
  { name: "Knowledge", description: "What the user knows, skills, expertise areas", isDefault: true },
  { name: "Relationships", description: "People the user mentions, teams, connections", isDefault: true },
  { name: "Projects", description: "Active projects, goals, deadlines", isDefault: true },
  { name: "History", description: "Past events, decisions, milestones", isDefault: true },
  { name: "Context", description: "Current situation, mood, recent focus areas", isDefault: true },
];

function makeChangelogEntry(
  overrides: Omit<ChangelogEntry, "id" | "timestamp">
): ChangelogEntry {
  return {
    id: generateId(),
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

export class MemoryGraph {
  private nodes: Map<string, MemoryNode> = new Map();
  private edges: Map<string, MemoryEdge> = new Map();
  private vaultDefs: Map<string, VaultDefinition> = new Map();
  private userId: string;
  private createdAt: string;
  private version = "0.2.0";
  private eventBus?: EventBus;

  constructor(userId: string, eventBus?: EventBus) {
    this.userId = userId;
    this.eventBus = eventBus;
    this.createdAt = new Date().toISOString();
    this.initDefaultVaults();
  }

  private initDefaultVaults(): void {
    const now = new Date().toISOString();
    DEFAULT_VAULTS.forEach((slug, i) => {
      const def = DEFAULT_VAULT_DEFINITIONS[i];
      this.vaultDefs.set(slug, {
        id: slug,
        name: def.name,
        description: def.description,
        isDefault: true,
        createdAt: now,
      });
    });
  }

  addNode(
    input: Omit<MemoryNode, "id" | "createdAt" | "updatedAt" | "status" | "changelog"> & {
      status?: ApprovalStatus;
      changelog?: ChangelogEntry[];
    }
  ): MemoryNode {
    const now = new Date().toISOString();
    const status = input.status ?? "auto_approved";
    const node: MemoryNode = {
      ...input,
      id: generateId(),
      status,
      createdAt: now,
      updatedAt: now,
      changelog: input.changelog ?? [
        makeChangelogEntry({
          changeType: "created",
          newValue: input.fact,
          changedBy: "system",
        }),
      ],
    };
    this.nodes.set(node.id, node);
    this.eventBus?.emit({ type: "node:created", node });
    return node;
  }

  addEdge(input: Omit<MemoryEdge, "id" | "createdAt">): MemoryEdge {
    if (!this.nodes.has(input.fromId)) {
      throw new Error(`Node not found: ${input.fromId}`);
    }
    if (!this.nodes.has(input.toId)) {
      throw new Error(`Node not found: ${input.toId}`);
    }

    const edge: MemoryEdge = {
      ...input,
      id: generateId(),
      createdAt: new Date().toISOString(),
    };
    this.edges.set(edge.id, edge);
    this.eventBus?.emit({ type: "edge:created", edge });
    return edge;
  }

  getNode(id: string): MemoryNode | null {
    return this.nodes.get(id) ?? null;
  }

  getNodesByVault(vault: Vault): MemoryNode[] {
    return [...this.nodes.values()].filter((n) => n.vault === vault);
  }

  getActiveNodes(): MemoryNode[] {
    return [...this.nodes.values()].filter(
      (n) =>
        n.supersededBy === null &&
        (n.status === "approved" || n.status === "auto_approved")
    );
  }

  getNodesByStatus(status: ApprovalStatus): MemoryNode[] {
    return [...this.nodes.values()].filter((n) => n.status === status);
  }

  getRelated(nodeId: string): { node: MemoryNode; edge: MemoryEdge }[] {
    const results: { node: MemoryNode; edge: MemoryEdge }[] = [];

    for (const edge of this.edges.values()) {
      let otherId: string | null = null;
      if (edge.fromId === nodeId) otherId = edge.toId;
      else if (edge.toId === nodeId) otherId = edge.fromId;

      if (otherId !== null) {
        const node = this.nodes.get(otherId);
        if (node) {
          results.push({ node, edge });
        }
      }
    }

    return results;
  }

  supersede(
    oldNodeId: string,
    newInput: Omit<MemoryNode, "id" | "createdAt" | "updatedAt" | "status" | "changelog"> & {
      status?: ApprovalStatus;
      changelog?: ChangelogEntry[];
    }
  ): MemoryNode {
    const oldNode = this.nodes.get(oldNodeId);
    if (!oldNode) {
      throw new Error(`Node not found: ${oldNodeId}`);
    }

    const newNode = this.addNode(newInput);

    const now = new Date().toISOString();
    oldNode.supersededBy = newNode.id;
    oldNode.updatedAt = now;
    oldNode.changelog.push(
      makeChangelogEntry({
        changeType: "superseded",
        newValue: newNode.id,
        changedBy: "system",
        reason: `Superseded by node ${newNode.id}`,
      })
    );

    this.addEdge({
      fromId: newNode.id,
      toId: oldNode.id,
      relation: "supersedes",
      weight: 1,
    });

    this.eventBus?.emit({ type: "node:superseded", oldNode, newNode });
    return newNode;
  }

  updateNodeConfidence(
    nodeId: string,
    newConfidence: number,
    changedBy: "system" | "user"
  ): MemoryNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const oldConfidence = node.confidence;
    node.confidence = newConfidence;
    node.updatedAt = new Date().toISOString();
    node.changelog.push(
      makeChangelogEntry({
        changeType: "confidence_changed",
        previousValue: String(oldConfidence),
        newValue: String(newConfidence),
        changedBy,
      })
    );

    this.eventBus?.emit({ type: "node:confidence_changed", node, oldConfidence, newConfidence });
    return node;
  }

  changeNodeVault(
    nodeId: string,
    newVault: Vault,
    changedBy: "system" | "user"
  ): MemoryNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const oldVault = node.vault;
    node.vault = newVault;
    node.updatedAt = new Date().toISOString();
    node.changelog.push(
      makeChangelogEntry({
        changeType: "vault_changed",
        previousValue: oldVault,
        newValue: newVault,
        changedBy,
      })
    );

    this.eventBus?.emit({ type: "node:vault_changed", node, oldVault, newVault });
    return node;
  }

  editNodeFact(
    nodeId: string,
    newFact: string,
    changedBy: "system" | "user"
  ): MemoryNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const oldFact = node.fact;
    node.fact = newFact;
    node.updatedAt = new Date().toISOString();
    node.changelog.push(
      makeChangelogEntry({
        changeType: "fact_edited",
        previousValue: oldFact,
        newValue: newFact,
        changedBy,
      })
    );

    this.eventBus?.emit({ type: "node:fact_edited", node, oldFact, newFact });
    return node;
  }

  approveNode(nodeId: string): MemoryNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    node.status = "approved";
    node.updatedAt = new Date().toISOString();
    node.changelog.push(
      makeChangelogEntry({
        changeType: "approved",
        changedBy: "user",
      })
    );

    this.eventBus?.emit({ type: "node:approved", node });
    return node;
  }

  rejectNode(nodeId: string): MemoryNode {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    node.status = "rejected";
    node.updatedAt = new Date().toISOString();
    node.changelog.push(
      makeChangelogEntry({
        changeType: "rejected",
        changedBy: "user",
      })
    );

    this.eventBus?.emit({ type: "node:rejected", node });
    return node;
  }

  getNodeHistory(nodeId: string): ChangelogEntry[] {
    const node = this.nodes.get(nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }
    return [...node.changelog].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  // Vault management

  addVault(
    input: Omit<VaultDefinition, "id" | "createdAt" | "isDefault">
  ): VaultDefinition {
    const id = input.name.toLowerCase().replace(/\s+/g, "_");
    if (this.vaultDefs.has(id)) {
      throw new Error(`Vault already exists: ${id}`);
    }

    const vault: VaultDefinition = {
      ...input,
      id,
      isDefault: false,
      createdAt: new Date().toISOString(),
    };
    this.vaultDefs.set(id, vault);
    this.eventBus?.emit({ type: "vault:created", vault });
    return vault;
  }

  getVaults(): VaultDefinition[] {
    return [...this.vaultDefs.values()];
  }

  removeVault(vaultId: string): void {
    const vault = this.vaultDefs.get(vaultId);
    if (!vault) {
      throw new Error(`Vault not found: ${vaultId}`);
    }
    if (vault.isDefault) {
      throw new Error(`Cannot remove default vault: ${vaultId}`);
    }
    this.vaultDefs.delete(vaultId);
    this.eventBus?.emit({ type: "vault:removed", vaultId });
  }

  search(query: string): MemoryNode[] {
    const lower = query.toLowerCase();
    return [...this.nodes.values()].filter(
      (n) =>
        n.fact.toLowerCase().includes(lower) ||
        n.tags.some((t) => t.toLowerCase().includes(lower))
    );
  }

  /** Semantic search using SearchEngine (TF-IDF or API embeddings) */
  async semanticSearch(
    query: string,
    options?: SearchOptions & {
      embeddingProvider?: EmbeddingProvider;
    }
  ): Promise<SearchResult[]> {
    const engine = new SearchEngine(this, {
      useApiEmbeddings: !!options?.embeddingProvider,
      embeddingProvider: options?.embeddingProvider,
    });
    return engine.search(query, options);
  }

  getSnapshot(): MemoryGraphData {
    return {
      nodes: [...this.nodes.values()],
      edges: [...this.edges.values()],
      vaultDefinitions: [...this.vaultDefs.values()],
      metadata: {
        userId: this.userId,
        createdAt: this.createdAt,
        lastUpdated: new Date().toISOString(),
        version: this.version,
      },
    };
  }

  loadSnapshot(data: MemoryGraphData): void {
    this.nodes.clear();
    this.edges.clear();
    this.vaultDefs.clear();

    for (const node of data.nodes) {
      this.nodes.set(node.id, node);
    }
    for (const edge of data.edges) {
      this.edges.set(edge.id, edge);
    }
    for (const vault of data.vaultDefinitions) {
      this.vaultDefs.set(vault.id, vault);
    }

    this.userId = data.metadata.userId;
    this.createdAt = data.metadata.createdAt;
    this.version = data.metadata.version;
  }
}
