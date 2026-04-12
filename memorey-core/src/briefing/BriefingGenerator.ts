import type { MemoryGraph } from "../graph/MemoryGraph.js";
import type { MemoryNode, VaultDefinition } from "../graph/types.js";
import type { Briefing, BriefingConfig } from "./types.js";
import { DEFAULT_BRIEFING_CONFIG } from "./types.js";
import {
  formatSystemPrompt,
  formatMarkdown,
  formatStructuredJson,
  type ChangeHistoryEntry,
} from "./templates.js";

/** Rough token estimate: ~4 chars per token for English text */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

function computeRecencyScore(node: MemoryNode, recencyBias: number): number {
  const now = Date.now();
  const updatedAt = new Date(node.updatedAt).getTime();
  const ageMs = now - updatedAt;
  const ageHours = ageMs / (1000 * 60 * 60);
  // Decay over 30 days — recent facts get a boost up to recencyBias
  const decay = Math.exp(-ageHours / (30 * 24));
  return decay * recencyBias;
}

function computeConnectionScore(
  node: MemoryNode,
  graph: MemoryGraph
): number {
  const related = graph.getRelated(node.id);
  // More connections → higher score, capped at 0.2
  return Math.min(related.length * 0.05, 0.2);
}

function computeTaskRelevance(
  node: MemoryNode,
  taskContext: string | undefined
): number {
  if (!taskContext) return 0;

  const taskLower = taskContext.toLowerCase();
  const factLower = node.fact.toLowerCase();
  const taskWords = taskLower.split(/\s+/).filter((w) => w.length > 2);

  let matchCount = 0;
  for (const word of taskWords) {
    if (factLower.includes(word)) matchCount++;
  }

  // Also check tags
  for (const tag of node.tags) {
    if (taskLower.includes(tag.toLowerCase())) matchCount++;
  }

  // Normalize: up to 0.3 boost
  return Math.min((matchCount / Math.max(taskWords.length, 1)) * 0.3, 0.3);
}

function scoreNode(
  node: MemoryNode,
  graph: MemoryGraph,
  config: BriefingConfig
): number {
  const confidenceScore = node.confidence;
  const recencyScore = computeRecencyScore(node, config.recencyBias);
  const connectionScore = config.includeRelationships
    ? computeConnectionScore(node, graph)
    : 0;
  const taskScore = computeTaskRelevance(node, config.taskContext);

  return confidenceScore + recencyScore + connectionScore + taskScore;
}

export class BriefingGenerator {
  constructor(private graph: MemoryGraph) {}

  generate(config?: Partial<BriefingConfig>): Briefing {
    const fullConfig: BriefingConfig = { ...DEFAULT_BRIEFING_CONFIG, ...config };
    return this.buildBriefing(fullConfig);
  }

  generateForTask(
    taskDescription: string,
    config?: Partial<BriefingConfig>
  ): Briefing {
    const fullConfig: BriefingConfig = {
      ...DEFAULT_BRIEFING_CONFIG,
      ...config,
      taskContext: taskDescription,
    };
    return this.buildBriefing(fullConfig);
  }

  private buildBriefing(config: BriefingConfig): Briefing {
    const vaultDefs = this.graph.getVaults();
    const vaultIdToName = new Map<string, string>();
    for (const v of vaultDefs) {
      vaultIdToName.set(v.id, v.name);
    }

    // 1. Collect candidate nodes
    const allNodes = config.onlyApproved
      ? this.graph.getActiveNodes()
      : this.getAllNonSupersededNodes();

    // 2. Filter by vault config
    const filteredNodes = this.filterByVaults(allNodes, config, vaultDefs);

    // 3. Score each fact
    const scored = filteredNodes.map((node) => ({
      node,
      score: scoreNode(node, this.graph, config),
    }));

    // 4. Rank by score
    scored.sort((a, b) => b.score - a.score);

    // 5. Cut by token budget
    const { included, excluded } = this.applyTokenBudget(
      scored.map((s) => s.node),
      config.maxTokens
    );

    // 6. Group by vault (using display names)
    const grouped = this.groupByVault(included, vaultIdToName);

    // 7. Build change history if needed
    const changeHistory = config.includeChangeHistory
      ? this.getChangeHistory(vaultIdToName)
      : [];

    // 8. Format
    const content = this.formatContent(
      config.format,
      grouped,
      changeHistory,
      vaultIdToName
    );

    // Build vault breakdown
    const vaultBreakdown: Record<string, number> = {};
    for (const [vaultName, nodes] of grouped) {
      if (nodes.length > 0) {
        vaultBreakdown[vaultName] = nodes.length;
      }
    }

    return {
      content,
      factsIncluded: included.length,
      factsExcluded: excluded,
      vaultBreakdown,
      estimatedTokens: estimateTokens(content),
      generatedAt: new Date().toISOString(),
    };
  }

  private getAllNonSupersededNodes(): MemoryNode[] {
    // Get all nodes that are not superseded (regardless of approval status)
    const snapshot = this.graph.getSnapshot();
    return snapshot.nodes.filter((n) => n.supersededBy === null);
  }

  private filterByVaults(
    nodes: MemoryNode[],
    config: BriefingConfig,
    _vaultDefs: VaultDefinition[]
  ): MemoryNode[] {
    // If includeVaults is non-empty, only include those vaults
    if (config.includeVaults.length > 0) {
      const includeSet = new Set(config.includeVaults);
      return nodes.filter((n) => includeSet.has(n.vault));
    }

    // Exclude specified vaults
    if (config.excludeVaults.length > 0) {
      const excludeSet = new Set(config.excludeVaults);
      return nodes.filter((n) => !excludeSet.has(n.vault));
    }

    return nodes;
  }

  private applyTokenBudget(
    rankedNodes: MemoryNode[],
    maxTokens: number
  ): { included: MemoryNode[]; excluded: number } {
    const included: MemoryNode[] = [];
    let currentTokens = 0;
    // Reserve tokens for template overhead (headers, notes, etc.)
    const overhead = 100;
    const budget = maxTokens - overhead;

    for (const node of rankedNodes) {
      const factTokens = estimateTokens(node.fact);
      if (currentTokens + factTokens <= budget) {
        included.push(node);
        currentTokens += factTokens;
      }
    }

    return {
      included,
      excluded: rankedNodes.length - included.length,
    };
  }

  private groupByVault(
    nodes: MemoryNode[],
    vaultIdToName: Map<string, string>
  ): Map<string, MemoryNode[]> {
    const grouped = new Map<string, MemoryNode[]>();

    for (const node of nodes) {
      const vaultName = vaultIdToName.get(node.vault) ?? node.vault;
      if (!grouped.has(vaultName)) {
        grouped.set(vaultName, []);
      }
      grouped.get(vaultName)!.push(node);
    }

    return grouped;
  }

  private getChangeHistory(
    vaultIdToName: Map<string, string>
  ): ChangeHistoryEntry[] {
    const snapshot = this.graph.getSnapshot();
    const entries: ChangeHistoryEntry[] = [];

    // Find nodes that supersede other nodes
    for (const edge of snapshot.edges) {
      if (edge.relation === "supersedes") {
        const newNode = snapshot.nodes.find((n) => n.id === edge.fromId);
        const oldNode = snapshot.nodes.find((n) => n.id === edge.toId);
        if (newNode && oldNode) {
          entries.push({
            previousFact: oldNode.fact,
            currentFact: newNode.fact,
          });
        }
      }
    }

    // Sort by most recent first (based on edge creation)
    return entries;
  }

  private formatContent(
    format: BriefingConfig["format"],
    grouped: Map<string, MemoryNode[]>,
    changeHistory: ChangeHistoryEntry[],
    vaultIdToName: Map<string, string>
  ): string {
    switch (format) {
      case "system_prompt":
        return formatSystemPrompt(grouped, changeHistory);
      case "markdown":
        return formatMarkdown(grouped, changeHistory);
      case "structured_json":
        return formatStructuredJson(grouped, vaultIdToName, changeHistory);
    }
  }
}
