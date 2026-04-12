import type {
  MemoryNode,
  MemoryGraphData,
  VaultDefinition,
  ChangelogEntry,
  Vault,
} from "../graph/types.js";
import type { ExtractionResult } from "../extraction/types.js";
import type {
  ReconciliationResult,
  ReconciliationAction,
  ReconciliationConfig,
} from "../reconciliation/types.js";
import type { BriefingConfig, Briefing } from "../briefing/types.js";

/** Configuration for the MemoreyPipeline */
export interface PipelineConfig {
  storagePath: string;
  llm?: {
    apiKey: string;
    model: string;
    baseUrl?: string;
  };
  reconciliation?: Partial<ReconciliationConfig>;
}

/** Result of processing a single exchange */
export interface ExchangeResult {
  extracted: ExtractionResult;
  reconciliation: ReconciliationResult;
  pendingApproval: MemoryNode[];
  pendingConflicts: ReconciliationAction[];
}

/** Aggregate result of processing a full conversation */
export interface ConversationResult {
  totalExtracted: number;
  totalAdded: number;
  totalAutoApproved: number;
  totalPendingApproval: number;
  totalDuplicates: number;
  pendingConflicts: ReconciliationAction[];
}

/** Pipeline stats snapshot */
export interface PipelineStats {
  totalFacts: number;
  activeFacts: number;
  pendingFacts: number;
  rejectedFacts: number;
  supersededFacts: number;
  edges: number;
  vaultBreakdown: Record<string, number>;
  oldestFact: string;
  newestFact: string;
}

export type {
  MemoryNode,
  MemoryGraphData,
  VaultDefinition,
  ChangelogEntry,
  Vault,
  ExtractionResult,
  ReconciliationResult,
  ReconciliationAction,
  ReconciliationConfig,
  BriefingConfig,
  Briefing,
};
