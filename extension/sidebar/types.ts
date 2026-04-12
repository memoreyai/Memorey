export type ApprovalStatus = "pending" | "approved" | "auto_approved" | "rejected";

export interface ChangelogEntry {
  id: string;
  timestamp: string;
  changeType:
    | "created"
    | "updated"
    | "superseded"
    | "confidence_changed"
    | "vault_changed"
    | "approved"
    | "rejected"
    | "tags_changed"
    | "fact_edited";
  changedBy: "user" | "system";
  previousValue?: string;
  newValue?: string;
}

export interface MemoryNode {
  id: string;
  fact: string;
  vault: string;
  confidence: number;
  status: ApprovalStatus;
  tags: string[];
  source: {
    platform: string;
    timestamp: string;
    conversationId?: string;
    rawExcerpt?: string;
  };
  createdAt: string;
  updatedAt: string;
  changelog: ChangelogEntry[];
  supersededBy: string | null;
}

export interface VaultDefinition {
  id: string;
  name: string;
  description: string;
  color?: string;
}

export interface MemoryEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  strength: number;
  createdAt?: string;
}

export interface Canvas {
  id: string;
  name: string;
  emoji: string | null;
  is_active: boolean;
  display_order: number;
  user_id: string;
  created_at: string;
}

export interface PendingProposal {
  id: string;
  user_id: string;
  proposed_value: string;
  proposed_title: string | null;
  proposed_vault_id: string | null;
  proposed_vault_name: string | null;
  source: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}

export interface Stats {
  totalFacts: number;
  activeFacts: number;
  pendingCount: number;
  vaultBreakdown: Record<string, number>;
}
