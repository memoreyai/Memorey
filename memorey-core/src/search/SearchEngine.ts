import type { MemoryGraph } from "../graph/MemoryGraph.js";
import type { MemoryNode } from "../graph/types.js";
import type { EmbeddingProvider, SearchResult, SearchOptions } from "./types.js";
import { LocalEmbeddings, cosineSimilarityVec } from "./local-embeddings.js";

interface SearchEngineConfig {
  useApiEmbeddings: boolean;
  embeddingProvider?: EmbeddingProvider;
}

export class SearchEngine {
  private graph: MemoryGraph;
  private config: SearchEngineConfig;
  private localEmbeddings: LocalEmbeddings;
  private apiEmbeddingCache: Map<string, number[]> = new Map();

  constructor(graph: MemoryGraph, config: SearchEngineConfig) {
    this.graph = graph;
    this.config = config;
    this.localEmbeddings = new LocalEmbeddings();
    this.rebuildIndex();
  }

  /** Rebuild the full index from current graph state */
  rebuildIndex(): void {
    const nodes = this.getIndexableNodes();
    const documents = nodes.map((n) => n.fact);
    this.localEmbeddings.build(documents);
    this.apiEmbeddingCache.clear();
  }

  /** Add a single node to the index (called after new node added) */
  indexNode(node: MemoryNode): void {
    this.localEmbeddings.addDocument(node.fact);
    this.apiEmbeddingCache.delete(node.id);
  }

  /** Search with ranking */
  async search(
    query: string,
    options?: SearchOptions
  ): Promise<SearchResult[]> {
    const limit = options?.limit ?? 10;
    const vaults = options?.vaults;
    const minConfidence = options?.minConfidence ?? 0;
    const includeSuperseded = options?.includeSuperseded ?? false;
    const statusFilter = options?.statusFilter ?? [
      "approved",
      "auto_approved",
    ];

    // Get candidate nodes with filters applied
    let candidates = this.getCandidateNodes(
      vaults,
      minConfidence,
      includeSuperseded,
      statusFilter
    );

    if (candidates.length === 0) return [];

    // Score each candidate
    const results: SearchResult[] = [];

    if (this.config.useApiEmbeddings && this.config.embeddingProvider) {
      // API-based embedding search
      const queryEmbedding = await this.config.embeddingProvider.embed(query);

      // Batch-embed any uncached candidates
      const uncached = candidates.filter(
        (n) => !this.apiEmbeddingCache.has(n.id)
      );
      if (uncached.length > 0) {
        const embeddings = await this.config.embeddingProvider.embedBatch(
          uncached.map((n) => n.fact)
        );
        for (let i = 0; i < uncached.length; i++) {
          this.apiEmbeddingCache.set(uncached[i].id, embeddings[i]);
        }
      }

      for (const node of candidates) {
        const nodeEmbedding = this.apiEmbeddingCache.get(node.id)!;
        const semanticScore = cosineSimilarityVec(queryEmbedding, nodeEmbedding);
        const exactScore = this.exactMatchScore(query, node);
        const score = Math.max(semanticScore, exactScore);
        const matchType = exactScore >= semanticScore ? "exact" : "semantic";
        results.push({ node, score, matchType });
      }
    } else {
      // Local TF-IDF search
      const queryVec = this.localEmbeddings.embed(query);

      for (const node of candidates) {
        const nodeVec = this.localEmbeddings.embed(node.fact);
        const semanticScore = cosineSimilarityVec(queryVec, nodeVec);
        const exactScore = this.exactMatchScore(query, node);
        const score = Math.max(semanticScore, exactScore);
        const matchType = exactScore >= semanticScore ? "exact" : "semantic";
        results.push({ node, score, matchType });
      }
    }

    // Sort by score descending, take top N
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /** Find facts related to a given node (graph walk + similarity) */
  async findRelated(
    nodeId: string,
    limit: number = 10
  ): Promise<SearchResult[]> {
    const sourceNode = this.graph.getNode(nodeId);
    if (!sourceNode) return [];

    const results: SearchResult[] = [];
    const seen = new Set<string>([nodeId]);

    // 1. Direct graph connections (highest priority)
    const related = this.graph.getRelated(nodeId);
    for (const { node, edge } of related) {
      seen.add(node.id);
      results.push({
        node,
        score: edge.weight,
        matchType: "related",
      });
    }

    // 2. Semantic similarity to all other active nodes
    const activeNodes = this.getIndexableNodes().filter(
      (n) => !seen.has(n.id)
    );

    if (activeNodes.length > 0) {
      const sourceVec = this.localEmbeddings.embed(sourceNode.fact);

      for (const node of activeNodes) {
        const nodeVec = this.localEmbeddings.embed(node.fact);
        const score = cosineSimilarityVec(sourceVec, nodeVec);
        if (score > 0.1) {
          results.push({ node, score, matchType: "semantic" });
        }
      }
    }

    // Sort by score descending, take top N
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, limit);
  }

  /** Exact/substring match score — 1.0 for exact, 0.8 for substring */
  private exactMatchScore(query: string, node: MemoryNode): number {
    const q = query.toLowerCase();
    const fact = node.fact.toLowerCase();

    if (fact === q) return 1.0;
    if (fact.includes(q) || q.includes(fact)) return 0.8;

    // Tag match
    if (node.tags.some((t) => t.toLowerCase().includes(q))) return 0.7;

    return 0;
  }

  /** Get all nodes that should be in the index */
  private getIndexableNodes(): MemoryNode[] {
    return this.graph.getActiveNodes();
  }

  /** Get candidate nodes after applying filters */
  private getCandidateNodes(
    vaults?: string[],
    minConfidence?: number,
    includeSuperseded?: boolean,
    statusFilter?: string[]
  ): MemoryNode[] {
    const snapshot = this.graph.getSnapshot();
    return snapshot.nodes.filter((node) => {
      // Status filter
      if (statusFilter && !statusFilter.includes(node.status)) return false;
      // Superseded filter
      if (!includeSuperseded && node.supersededBy !== null) return false;
      // Vault filter
      if (vaults && vaults.length > 0 && !vaults.includes(node.vault))
        return false;
      // Confidence filter
      if (minConfidence !== undefined && node.confidence < minConfidence)
        return false;
      return true;
    });
  }
}
