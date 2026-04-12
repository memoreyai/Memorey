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

export interface Stats {
  totalFacts: number;
  activeFacts: number;
  vaultBreakdown: Record<string, number>;
}
