export type VaultCategory =
  | "Work"
  | "Goals"
  | "Personal"
  | "Health"
  | "Finance"
  | "Study"
  | "Relationships"
  | "Preferences";

export const VAULT_COLORS: Record<VaultCategory, string> = {
  Work: "#378ADD",
  Goals: "#7F77DD",
  Personal: "#5DCAA5",
  Health: "#E05C5C",
  Finance: "#EF9F27",
  Study: "#D4537E",
  Relationships: "#5DCAA5",
  Preferences: "#888780",
};

export type NodeType = "memory" | "sticky";

/** Canvas node kind (DB `node_kind_v2`); distinct from graph hub `GraphNodeKind`. */
export type NodeKind = "memory" | "master" | "sticky" | "file";

export type EdgeStyle =
  | "orthogonal-dashed"
  | "orthogonal-dotted"
  | "curved-dashed"
  | "curved-dotted";

export type KanbanStatus = "todo" | "doing" | "done";

export interface MemoryNode {
  id: string;
  userId: string;
  vaultId: string;
  vaultName: VaultCategory | string;
  title: string;
  value: string;
  confidence: number;
  source:
    | "chat"
    | "share_link"
    | "manual"
    | "import"
    | "extension"
    | "canvas-drop";
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  /** Canvas this node belongs to (multi-canvas workspace) */
  canvasId?: string | null;
  /** Populated in master graph view for labelling */
  canvasEmoji?: string | null;
  canvasName?: string | null;
  /** FK to `kanban_columns` — primary board placement when set */
  kanbanColumnId?: string | null;
  /** Non-null when node is on the Kanban board */
  kanbanStatus?: KanbanStatus | null;
  kanbanOrder?: number;
  customBgColor?: string | null;
  customAccentColor?: string | null;
  customTextColor?: string | null;
  nodeType?: NodeType;

  // File node fields (nodeKindV2 === "file")
  nodeKindV2?: "memory" | "sticky" | "file";
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
  thumbnailUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogSiteName?: string | null;
  /** Persisted graph coordinates (world space); null until first layout/drag save */
  posX?: number | null;
  posY?: number | null;
}

export interface NodeEdge {
  id: string;
  userId: string;
  sourceNodeId: string;
  targetNodeId: string;
  strength: number;
  label?: string;
  /** Per-connection stroke override; null/undefined uses global or vault colour */
  color?: string | null;
  canvasId?: string | null;
  sourceAttachmentId?: string | null;
  targetAttachmentId?: string | null;
}

export type FileType =
  | "image"
  | "video"
  | "pdf"
  | "doc"
  | "spreadsheet"
  | "presentation"
  | "audio"
  | "link"
  | "other";

export type AttachmentSource = "url" | "googledrive" | "dropbox" | "onedrive";

export interface NodeAttachment {
  id: string;
  userId: string;
  nodeId?: string | null;
  fileUrl: string;
  fileName: string;
  fileType: FileType;
  mimeType?: string | null;
  thumbnailUrl?: string | null;
  source: AttachmentSource;
  sourceFileId?: string | null;
  fileSizeBytes?: number | null;
  title?: string | null;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
}

/** Per-appearance vault colours (light vs dark). Persisted as `color_overrides` JSONB. */
export interface VaultModeColorSlice {
  pillFill?: string | null;
  pillText?: string | null;
  cardBg?: string | null;
  cardText?: string | null;
  cardAccent?: string | null;
}

export interface VaultColorOverrides {
  light?: VaultModeColorSlice;
  dark?: VaultModeColorSlice;
}

export type VaultThemeMode = "light" | "dark";

export interface NodeHistory {
  id: string;
  nodeId: string;
  oldValue: string | null;
  newValue: string;
  oldTitle: string | null;
  newTitle: string;
  changeSummary: string;
  triggeredBy: "user" | "ai_extract" | "import";
  createdAt: string;
}

export interface CategoryVault {
  id: string;
  userId: string;
  name: string;
  color: string;
  isCustom: boolean;
  isActive: boolean;
  displayOrder: number;
  isLocked?: boolean;
  pinHash?: string | null;
  isExportable?: boolean;
  defaultCardAccent?: string | null;
  defaultCardBg?: string | null;
  defaultCardText?: string | null;
  /** Vault header pill fill (hex); null uses tinted `color` */
  pillFillBg?: string | null;
  /** Vault header pill stroke (hex) */
  pillBorderColor?: string | null;
  /** Vault header title / control tint (hex) */
  pillTextColor?: string | null;
  /** Lucide icon name (PascalCase), e.g. Target, Flag */
  iconKey?: string | null;
  /** Optional per light/dark overrides; legacy `pill_*` / `default_card_*` used when absent */
  colorOverrides?: VaultColorOverrides | null;
  /** Master graph: show this vault’s column on each linked canvas even with zero memories */
  showEmptyInMaster?: boolean;
}

export interface ProposedNode {
  tempId: string;
  category: string;
  title: string;
  newValue: string;
  oldValue?: string;
  oldTitle?: string;
  confidence: number;
  isNew: boolean;
  nodeId?: string;
  /** Row id in pending_proposals — removed from queue after confirm */
  pendingProposalId?: string;
}

export interface DiffProposal {
  proposals: ProposedNode[];
  summary: string;
  /** Cap visible rows in diff modal (default 8) */
  maxVisibleNodes?: number;
  sourceUrl?: string;
  /** ISO timestamp — shown when fromShareLink */
  deletedAt?: string;
  /** Share-link flow: show “Link deleted at …” badge */
  fromShareLink?: boolean;
  totalExtracted?: number;
  /** Persisted on insert (default chat) */
  memorySource?: MemoryNode["source"];
  /** Target canvas for inserts when in master / ambiguous context */
  canvasId?: string | null;
}

export type GraphNodeKind =
  | "person"
  | "category"
  | "memory"
  | "attachment"
  | "master";

export interface GraphNode {
  id: string;
  category: string;
  title: string;
  value: string;
  color: string;
  val: number;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
  /** person | category hub | memory | file attachment (standalone on graph) | master */
  nodeKind?: GraphNodeKind;
  vaultId?: string;
  /** Vault is muted in filter bar → graph elements at 10% opacity */
  muted?: boolean;
  initials?: string;
  /** Active attachments on this memory node (for graph badge) */
  attachmentCount?: number;
  /** Populated when nodeKind === "attachment" */
  attachment?: NodeAttachment;
  customBgColor?: string | null;
  customAccentColor?: string | null;
  customTextColor?: string | null;
  nodeType?: NodeType;

  /** Mirrors `MemoryNode.nodeKindV2` for canvas file cards */
  nodeKindV2?: "memory" | "sticky" | "file";
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  storagePath?: string | null;
  thumbnailUrl?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  ogSiteName?: string | null;
  /** Master graph: which canvas this memory belongs to */
  canvasId?: string | null;
  canvasEmoji?: string | null;
  canvasName?: string | null;
}

export interface GraphLink {
  source: string;
  target: string;
  strength: number;
  label?: string;
  /** Hex color for edge tint (source-derived) */
  edgeColor?: string;
}

export interface GraphData {
  nodes: GraphNode[];
  links: GraphLink[];
}

/** App shape for `subscriptions`; DB uses snake_case (`dodo_customer_id`, `current_period_end`, `user_id`). */
export interface Subscription {
  userId: string;
  plan: "free" | "pro" | "enterprise";
  dodoCustomerId?: string;
  currentPeriodEnd?: string;
}

/** User segment from onboarding step 1 — stored in profiles.segment */
export type UserSegment = "founder" | "developer" | "consultant" | "researcher" | "student" | "designer" | "other";

/** Multi-select from onboarding step 2 — stored in profiles.ai_use_cases */
export type AIUseCase =
  | "strategic_thinking"
  | "writing_content"
  | "coding_technical"
  | "research"
  | "decision_making";

export const USER_SEGMENT_LABELS: Record<UserSegment, string> = {
  founder: "Founder",
  developer: "Developer",
  consultant: "Consultant",
  researcher: "Researcher",
  student: "Student",
  designer: "Designer",
  other: "Other",
};

export const AI_USE_CASE_LABELS: Record<AIUseCase, string> = {
  strategic_thinking: "Strategic thinking",
  writing_content: "Writing & content",
  coding_technical: "Coding & technical",
  research: "Research",
  decision_making: "Decision making",
};

export type PlanTier = "free" | "pro" | "enterprise";

/** Context export formats (API + ExportPanel). */
export type ExportFormat = "markdown" | "json" | "toml" | "text";

export interface ExportApiResponse {
  content: string;
  format: ExportFormat;
  nodeCount: number;
  filename: string;
}

/** Onboarding step 3 — stored in profiles.memory_goals */
export type MemoryGoalId =
  | "decisions"
  | "ideas"
  | "goals"
  | "knowledge"
  | "tasks"
  | "people";

/** Onboarding step 4 — stored in profiles.primary_use_case */
export type PrimaryUseCaseId =
  | "personal_productivity"
  | "work_projects"
  | "learning"
  | "health_wellness"
  | "building"
  | "team_collaboration";

/** Row shape for public.profiles (Supabase). Plan tier lives on subscriptions.plan. */
export interface UserProfile {
  id: string;
  display_name?: string | null;
  full_name: string | null;
  avatar_url: string | null;
  segment: UserSegment | null;
  ai_use_cases: AIUseCase[];
  memory_goals: MemoryGoalId[];
  primary_use_case: PrimaryUseCaseId | null;
  onboarding_step: number;
  onboarding_completed: boolean;
  updated_at?: string;
}
