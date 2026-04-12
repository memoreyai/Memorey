import type { MemoryNode, MemoryEdge, VaultDefinition, ChangelogEntry, Vault } from "../graph/types.js";
import type { ReconciliationAction } from "../reconciliation/types.js";
import type { ExtractionResult } from "../extraction/types.js";
import type { ReconciliationResult } from "../reconciliation/types.js";

export type MemoreyEvent =
  | { type: "node:created"; node: MemoryNode }
  | { type: "node:approved"; node: MemoryNode }
  | { type: "node:rejected"; node: MemoryNode }
  | { type: "node:superseded"; oldNode: MemoryNode; newNode: MemoryNode }
  | { type: "node:updated"; node: MemoryNode; changes: ChangelogEntry }
  | { type: "node:confidence_changed"; node: MemoryNode; oldConfidence: number; newConfidence: number }
  | { type: "node:vault_changed"; node: MemoryNode; oldVault: Vault; newVault: Vault }
  | { type: "node:fact_edited"; node: MemoryNode; oldFact: string; newFact: string }
  | { type: "edge:created"; edge: MemoryEdge }
  | { type: "vault:created"; vault: VaultDefinition }
  | { type: "vault:removed"; vaultId: string }
  | { type: "conflict:detected"; action: ReconciliationAction }
  | { type: "conflict:resolved"; action: ReconciliationAction; resolution: string }
  | { type: "extraction:complete"; result: ExtractionResult }
  | { type: "reconciliation:complete"; result: ReconciliationResult }
  | { type: "graph:saved" }
  | { type: "graph:loaded" };

export type EventHandler<T extends MemoreyEvent["type"]> =
  (event: Extract<MemoreyEvent, { type: T }>) => void;
