/** Vault is now a string so users can create custom vaults */
export type Vault = string;

/** The 8 default vaults matching Memorey's brand identity */
export const DEFAULT_VAULTS = [
  "identity",       // who the user is — name, age, location, roles
  "work",           // job, company, projects, professional context
  "preferences",    // likes, dislikes, communication style, tool preferences
  "knowledge",      // what the user knows, skills, expertise areas
  "relationships",  // people the user mentions, teams, connections
  "projects",       // active projects, goals, deadlines
  "history",        // past events, decisions, milestones
  "context",        // current situation, mood, recent focus areas
] as const;

export type DefaultVault = typeof DEFAULT_VAULTS[number];

/** Custom vault definition */
export interface VaultDefinition {
  id: string;                    // slug, e.g. "health", "finances"
  name: string;                  // display name
  description: string;           // what belongs here
  icon?: string;                 // emoji or icon name
  isDefault: boolean;            // true for the 8 defaults
  createdAt: string;
}

/** Approval status for extracted facts */
export type ApprovalStatus = "pending" | "approved" | "rejected" | "auto_approved";

/** Changelog entry — tracks every change to a node */
export interface ChangelogEntry {
  id: string;
  timestamp: string;
  changeType: "created" | "updated" | "superseded" | "confidence_changed" | "vault_changed" | "approved" | "rejected" | "tags_changed" | "fact_edited";
  previousValue?: string;
  newValue?: string;
  changedBy: "system" | "user";
  reason?: string;
}

/** Where a memory fact was extracted from */
export interface MemorySource {
  platform: string;
  conversationId?: string;
  timestamp: string;
  rawExcerpt?: string;
}

/** A single atomic fact extracted from a conversation */
export interface MemoryNode {
  id: string;
  fact: string;
  originalFact?: string;
  vault: Vault;
  confidence: number;
  status: ApprovalStatus;
  source: MemorySource;
  createdAt: string;
  updatedAt: string;
  supersededBy: string | null;
  tags: string[];
  changelog: ChangelogEntry[];
}

/** Relationship between two memory nodes */
export interface MemoryEdge {
  id: string;
  fromId: string;
  toId: string;
  relation: string;
  weight: number;
  createdAt: string;
}

/** The full serializable graph */
export interface MemoryGraphData {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  vaultDefinitions: VaultDefinition[];
  metadata: {
    userId: string;
    createdAt: string;
    lastUpdated: string;
    version: string;
  };
}
