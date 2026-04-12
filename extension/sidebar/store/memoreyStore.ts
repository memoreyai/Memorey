import React, { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { MemoryNode, PipelineStats, VaultDefinition, ReconciliationAction } from "memorey-core";
import type { SyncStatus } from "../services/SyncService";

// --- View types ---
export type View = "dashboard" | "nodes" | "node-detail" | "pending" | "kanban" | "canvas" | "conflicts" | "import" | "settings";

// --- State ---
export interface MemoreyState {
  currentView: View;
  previousView: View | null;
  selectedNodeId: string | null;
  stats: PipelineStats | null;
  allNodes: MemoryNode[];
  recentFacts: MemoryNode[];
  pendingNodes: MemoryNode[];
  pendingConflicts: ReconciliationAction[];
  vaults: VaultDefinition[];
  isLoading: boolean;
  lastSyncTime: string | null;
  syncStatus: SyncStatus;
  isAutoSync: boolean;
}

const initialState: MemoreyState = {
  currentView: "dashboard",
  previousView: null,
  selectedNodeId: null,
  stats: null,
  allNodes: [],
  recentFacts: [],
  pendingNodes: [],
  pendingConflicts: [],
  vaults: [],
  isLoading: true,
  lastSyncTime: null,
  syncStatus: "not_connected",
  isAutoSync: true,
};

// --- Actions ---
export type MemoreyAction =
  | { type: "SET_VIEW"; view: View }
  | { type: "NAVIGATE_TO_NODE"; nodeId: string; from: View }
  | { type: "NAVIGATE_BACK" }
  | { type: "SET_STATS"; stats: PipelineStats }
  | { type: "SET_ALL_NODES"; nodes: MemoryNode[] }
  | { type: "SET_RECENT_FACTS"; facts: MemoryNode[] }
  | { type: "SET_PENDING_NODES"; nodes: MemoryNode[] }
  | { type: "SET_PENDING_CONFLICTS"; conflicts: ReconciliationAction[] }
  | { type: "SET_VAULTS"; vaults: VaultDefinition[] }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_LAST_SYNC"; time: string }
  | { type: "SET_SYNC_STATUS"; status: SyncStatus }
  | { type: "SET_AUTO_SYNC"; enabled: boolean }
  | { type: "UPDATE_NODE"; node: MemoryNode }
  | { type: "REMOVE_PENDING_NODE"; nodeId: string }
  | { type: "REFRESH_ALL"; payload: {
      stats: PipelineStats;
      allNodes: MemoryNode[];
      recentFacts: MemoryNode[];
      pendingNodes: MemoryNode[];
      pendingConflicts: ReconciliationAction[];
      vaults: VaultDefinition[];
    }};

// --- Reducer ---
function memoreyReducer(state: MemoreyState, action: MemoreyAction): MemoreyState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, currentView: action.view, previousView: null, selectedNodeId: null };
    case "NAVIGATE_TO_NODE":
      return { ...state, currentView: "node-detail", previousView: action.from, selectedNodeId: action.nodeId };
    case "NAVIGATE_BACK":
      return { ...state, currentView: state.previousView ?? "nodes", previousView: null, selectedNodeId: null };
    case "SET_STATS":
      return { ...state, stats: action.stats };
    case "SET_ALL_NODES":
      return { ...state, allNodes: action.nodes };
    case "SET_RECENT_FACTS":
      return { ...state, recentFacts: action.facts };
    case "SET_PENDING_NODES":
      return { ...state, pendingNodes: action.nodes };
    case "SET_PENDING_CONFLICTS":
      return { ...state, pendingConflicts: action.conflicts };
    case "SET_VAULTS":
      return { ...state, vaults: action.vaults };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "SET_LAST_SYNC":
      return { ...state, lastSyncTime: action.time };
    case "SET_SYNC_STATUS":
      return { ...state, syncStatus: action.status };
    case "SET_AUTO_SYNC":
      return { ...state, isAutoSync: action.enabled };
    case "UPDATE_NODE": {
      const updated = action.node;
      return {
        ...state,
        allNodes: state.allNodes.map((n) => (n.id === updated.id ? updated : n)),
        recentFacts: state.recentFacts.map((n) => (n.id === updated.id ? updated : n)),
        pendingNodes: updated.status === "pending"
          ? state.pendingNodes.map((n) => (n.id === updated.id ? updated : n))
          : state.pendingNodes.filter((n) => n.id !== updated.id),
      };
    }
    case "REMOVE_PENDING_NODE":
      return {
        ...state,
        pendingNodes: state.pendingNodes.filter((n) => n.id !== action.nodeId),
      };
    case "REFRESH_ALL":
      return {
        ...state,
        ...action.payload,
        isLoading: false,
        lastSyncTime: new Date().toISOString(),
      };
    default:
      return state;
  }
}

// --- Context ---
const MemoreyStateContext = createContext<MemoreyState>(initialState);
const MemoreyDispatchContext = createContext<Dispatch<MemoreyAction>>(() => {});

export function MemoreyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(memoreyReducer, initialState);

  return React.createElement(
    MemoreyStateContext.Provider,
    { value: state },
    React.createElement(
      MemoreyDispatchContext.Provider,
      { value: dispatch },
      children
    )
  );
}

export function useMemoreyState(): MemoreyState {
  return useContext(MemoreyStateContext);
}

export function useMemoreyDispatch(): Dispatch<MemoreyAction> {
  return useContext(MemoreyDispatchContext);
}
