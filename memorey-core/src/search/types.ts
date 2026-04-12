import type { MemoryNode, Vault, ApprovalStatus } from "../graph/types.js";

/** How a search result was found */
export type MatchType = "exact" | "semantic" | "related";

/** A single search result with scoring metadata */
export interface SearchResult {
  node: MemoryNode;
  score: number; // 0-1 relevance score
  matchType: MatchType;
}

/** Options for filtering and ranking search results */
export interface SearchOptions {
  limit?: number; // default: 10
  vaults?: Vault[]; // filter by vault
  minConfidence?: number; // minimum confidence threshold
  includeSuperseded?: boolean; // default: false
  statusFilter?: ApprovalStatus[]; // default: ["approved", "auto_approved"]
}

/** Provider interface for embedding-based similarity */
export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>;
  embedBatch(texts: string[]): Promise<number[][]>;
}
