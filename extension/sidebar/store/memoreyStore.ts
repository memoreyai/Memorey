import React, { createContext, useContext, useReducer, type Dispatch, type ReactNode } from "react";
import type { MemoryNode, VaultDefinition, MemoryEdge, Stats } from "../types";

export type View = "dashboard" | "nodes" | "node-detail" | "pending" | "kanban" | "canvas" | "conflicts" | "import" | "settings";

export interface MemoreyState {
  currentView: View;
  previousView: View | null;
  selectedNodeId: string | null;
  stats: Stats | null;
  allNodes: MemoryNode[];
  recentFacts: MemoryNode[];
  pendingNodes: MemoryNode[];
  vaults: VaultDefinition[];
  edges: MemoryEdge[];
  isLoading: boolean;
}

const initialState: MemoreyState = {
  currentView: "dashboard",
  previousView: null,
  selectedNodeId: null,
  stats: null,
  allNodes: [],
  recentFacts: [],
  pendingNodes: [],
  vaults: [],
  edges: [],
  isLoading: true,
};

export type MemoreyAction =
  | { type: "SET_VIEW"; view: View }
  | { type: "NAVIGATE_TO_NODE"; nodeId: string; from: View }
  | { type: "NAVIGATE_BACK" }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "UPDATE_NODE"; node: MemoryNode }
  | { type: "REMOVE_PENDING_NODE"; nodeId: string }
  | {
      type: "REFRESH_ALL";
      payload: {
        stats: Stats;
        allNodes: MemoryNode[];
        recentFacts: MemoryNode[];
        pendingNodes: MemoryNode[];
        vaults: VaultDefinition[];
        edges: MemoryEdge[];
      };
    };

function memoreyReducer(state: MemoreyState, action: MemoreyAction): MemoreyState {
  switch (action.type) {
    case "SET_VIEW":
      return { ...state, currentView: action.view, previousView: state.currentView, selectedNodeId: null };
    case "NAVIGATE_TO_NODE":
      return { ...state, currentView: "node-detail", previousView: action.from, selectedNodeId: action.nodeId };
    case "NAVIGATE_BACK":
      return { ...state, currentView: state.previousView ?? "nodes", previousView: null, selectedNodeId: null };
    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };
    case "UPDATE_NODE": {
      const updated = action.node;
      return {
        ...state,
        allNodes: state.allNodes.map((n) => (n.id === updated.id ? updated : n)),
        recentFacts: state.recentFacts.map((n) => (n.id === updated.id ? updated : n)),
        pendingNodes: state.pendingNodes.filter((n) => n.id !== updated.id),
      };
    }
    case "REMOVE_PENDING_NODE":
      return { ...state, pendingNodes: state.pendingNodes.filter((n) => n.id !== action.nodeId) };
    case "REFRESH_ALL":
      return { ...state, ...action.payload, isLoading: false };
    default:
      return state;
  }
}

const MemoreyStateContext = createContext<MemoreyState>(initialState);
const MemoreyDispatchContext = createContext<Dispatch<MemoreyAction>>(() => {});

export function MemoreyProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(memoreyReducer, initialState);

  return React.createElement(
    MemoreyStateContext.Provider,
    { value: state },
    React.createElement(MemoreyDispatchContext.Provider, { value: dispatch }, children)
  );
}

export function useMemoreyState(): MemoreyState {
  return useContext(MemoreyStateContext);
}

export function useMemoreyDispatch(): Dispatch<MemoreyAction> {
  return useContext(MemoreyDispatchContext);
}
