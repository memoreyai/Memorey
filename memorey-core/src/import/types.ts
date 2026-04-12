import type { ConversationExchange } from "../extraction/types.js";

/** Parser interface — each format implements this */
export interface ConversationParser {
  /** Auto-detect if this parser handles the format */
  canParse(content: string): boolean;
  /** Parse content into conversation exchanges */
  parse(content: string): ConversationExchange[];
}

/** Result of an import operation */
export interface ImportResult {
  exchangesParsed: number;
  factsExtracted: number;
  factsAdded: number;
  factsAutoApproved: number;
  factsPending: number;
  duplicates: number;
  conflicts: number;
  errors: string[];
}
