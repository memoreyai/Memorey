// Graph exports
export { MemoryGraph } from "./graph/MemoryGraph.js";
export { DEFAULT_VAULTS } from "./graph/types.js";
export type {
  MemoryNode,
  MemoryEdge,
  MemoryGraphData,
  MemorySource,
  Vault,
  DefaultVault,
  VaultDefinition,
  ApprovalStatus,
  ChangelogEntry,
} from "./graph/types.js";

// Extraction exports
export { ExtractionEngine } from "./extraction/ExtractionEngine.js";
export { extractByRules } from "./extraction/local-rules.js";
export { buildExtractionPrompt, buildConflictDetectionPrompt } from "./extraction/prompts.js";
export type {
  ConversationExchange,
  ExtractedFact,
  ExtractionResult,
} from "./extraction/types.js";

// Reconciliation exports
export { ReconciliationEngine, detectConflictType } from "./reconciliation/ReconciliationEngine.js";
export { DEFAULT_CONFIG as DEFAULT_RECONCILIATION_CONFIG } from "./reconciliation/types.js";
export type {
  ReconciliationAction,
  ReconciliationResult,
  ReconciliationConfig,
  ConflictType,
} from "./reconciliation/types.js";
export {
  cosineSimilarity,
  jaccardSimilarity,
  factSimilarity,
  extractKeyTerms,
} from "./reconciliation/similarity.js";

// Briefing exports
export { BriefingGenerator } from "./briefing/BriefingGenerator.js";
export { DEFAULT_BRIEFING_CONFIG } from "./briefing/types.js";
export type { BriefingConfig, Briefing } from "./briefing/types.js";
export {
  formatSystemPrompt,
  formatMarkdown,
  formatStructuredJson,
} from "./briefing/templates.js";

// Search exports
export { SearchEngine } from "./search/SearchEngine.js";
export { LocalEmbeddings, buildVocabulary, tfidfVector, cosineSimilarityVec } from "./search/local-embeddings.js";
export { OpenAIEmbeddings } from "./search/embeddings.js";
export type { SearchResult, SearchOptions, EmbeddingProvider, MatchType } from "./search/types.js";

// Event exports
export { EventBus } from "./events/EventBus.js";
export type { MemoreyEvent, EventHandler } from "./events/types.js";

// Storage exports
export { JsonStorage } from "./storage/JsonStorage.js";

// Pipeline exports
export { MemoreyPipeline } from "./pipeline/MemoreyPipeline.js";
export type {
  PipelineConfig,
  ExchangeResult,
  ConversationResult,
  PipelineStats,
} from "./pipeline/types.js";

// Import exports
export { ImportEngine } from "./import/ImportEngine.js";
export { ChatGPTParser } from "./import/parsers/ChatGPTParser.js";
export { ClaudeParser } from "./import/parsers/ClaudeParser.js";
export { PlainTextParser } from "./import/parsers/PlainTextParser.js";
export { JsonParser } from "./import/parsers/JsonParser.js";
export { MarkdownParser } from "./import/parsers/MarkdownParser.js";
export type { ConversationParser, ImportResult } from "./import/types.js";

// Export exports
export { ExportEngine } from "./export/ExportEngine.js";
