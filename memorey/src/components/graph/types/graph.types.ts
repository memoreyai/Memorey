export interface MasterProfile {
  display_name?: string | null;
  full_name?: string | null;
  master_node_bio?: string | null;
  avatar_url?: string | null;
  master_node_color?: string | null;
}

export interface ContextMenuState {
  x: number;
  y: number;
  nodeId: string;
  node: import("@/types/memorey").GraphNode;
}

export interface EdgeContextMenuState {
  edge: import("@/types/memorey").NodeEdge;
  x: number;
  y: number;
}

export interface VaultSettingsState {
  vaultId: string;
  vault: import("@/types/memorey").CategoryVault;
  x: number;
  y: number;
}
