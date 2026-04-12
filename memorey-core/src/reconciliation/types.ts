import type { ExtractedFact } from "../extraction/types.js";
import type { ApprovalStatus } from "../graph/types.js";

export type ReconciliationAction =
  | { type: "add"; fact: ExtractedFact; suggestedStatus: ApprovalStatus }
  | { type: "update"; existingNodeId: string; fact: ExtractedFact; suggestedStatus: ApprovalStatus }
  | { type: "duplicate"; existingNodeId: string }
  | { type: "conflict"; existingNodeId: string; fact: ExtractedFact; reason: string };

export interface ReconciliationResult {
  actions: ReconciliationAction[];
  pending: number;
  autoApproved: number;
  conflicts: number;
  duplicates: number;
}

export interface ReconciliationConfig {
  duplicateThreshold: number;
  conflictThreshold: number;
  autoApproveMinConfidence: number;
  // Note: conflicts always require approval by design
  requireApprovalForConflicts: boolean;
}

export const DEFAULT_CONFIG: ReconciliationConfig = {
  duplicateThreshold: 0.85,
  conflictThreshold: 0.5,
  autoApproveMinConfidence: 0.85,
  requireApprovalForConflicts: true,
};

export type ConflictType = "contradiction" | "evolution" | "addition" | "none";
