import type { Vault, MemorySource } from "../graph/types.js";

/** A single exchange from a conversation (what we process) */
export interface ConversationExchange {
  userMessage: string;
  assistantMessage: string;
  platform: string;             // "chatgpt" | "claude" | "gemini" | "other"
  timestamp: string;            // ISO string
  conversationId?: string;
}

/** What the extraction engine produces before graph insertion */
export interface ExtractedFact {
  fact: string;                  // clean atomic statement in third person
  originalExcerpt: string;       // the raw text this was extracted from
  vault: Vault;                  // classified vault
  confidence: number;            // 0-1
  entities: string[];            // people, places, companies mentioned
  relationships: Array<{
    targetFact: string;          // another fact this relates to (may match existing graph node)
    relation: string;            // relationship type
  }>;
}

export interface ExtractionResult {
  facts: ExtractedFact[];
  source: MemorySource;
}
