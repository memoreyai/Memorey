import React, { useEffect, useRef, createContext, useContext } from "react";
import { Layout } from "./components/Layout";
import { DashboardView } from "./views/DashboardView";
import { NodesListView } from "./views/NodesListView";
import { NodeDetailView } from "./views/NodeDetailView";
import { PendingView } from "./views/PendingView";
import { ConflictsView } from "./views/ConflictsView";
import { KanbanView } from "./views/KanbanView";
import { CanvasView } from "./views/CanvasView";
import { BriefView } from "./views/BriefView";
import { ImportView } from "./views/ImportView";
import { SettingsView } from "./views/SettingsView";
import { LoginView } from "./views/LoginView";
import { useMemoreyState, useMemoreyDispatch } from "./store/memoreyStore";
import { useAuth, AuthContext } from "./hooks/useAuth";
import { useSupabaseData } from "./hooks/useSupabaseData";
import { createSupabaseClient } from "./utils/supabase";

const DataReloadContext = createContext<() => Promise<void>>(async () => {});
export function useDataReload() {
  return useContext(DataReloadContext);
}

function AuthenticatedApp() {
  const { currentView, isLoading, error } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const { token, userId } = useAuth();
  const loadedRef = useRef(false);

  const supabase = token ? createSupabaseClient(token) : null;
  const data = useSupabaseData(supabase, userId);

  useEffect(() => {
    if (loadedRef.current) return;
    if (!data.loading && data.nodes !== undefined) {
      loadedRef.current = true;
    }

    dispatch({
      type: "REFRESH_ALL",
      payload: {
        stats: data.stats,
        allNodes: data.nodes,
        recentFacts: data.recentFacts,
        pendingNodes: [],
        pendingProposals: data.pendingProposals,
        vaults: data.vaults,
        edges: data.edges,
        canvases: data.canvases,
      },
    });

    if (data.error) {
      dispatch({ type: "SET_ERROR", error: data.error });
    }
    if (data.loading) {
      dispatch({ type: "SET_LOADING", isLoading: true });
    }
  }, [
    data.nodes,
    data.vaults,
    data.edges,
    data.canvases,
    data.pendingProposals,
    data.stats,
    data.recentFacts,
    data.loading,
    data.error,
    dispatch,
  ]);

  if (isLoading && !loadedRef.current) {
    return (
      <div className="memorey-loading">
        <div className="memorey-loading__spinner" />
        <span>Loading your memories...</span>
      </div>
    );
  }

  if (error && !loadedRef.current) {
    return (
      <div className="memorey-error-state">
        <div className="memorey-error-state__icon">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--memorey-error)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>
        <div className="memorey-error-state__title">Failed to load data</div>
        <div className="memorey-error-state__text">{error}</div>
        <button className="memorey-error-state__retry" onClick={() => data.refresh()}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <DataReloadContext.Provider value={data.refresh}>
      <Layout>
        {currentView === "dashboard" && <DashboardView />}
        {currentView === "nodes" && <NodesListView />}
        {currentView === "node-detail" && <NodeDetailView />}
        {currentView === "pending" && <PendingView />}
        {currentView === "conflicts" && <ConflictsView />}
        {currentView === "brief" && <BriefView />}
        {currentView === "kanban" && <KanbanView />}
        {currentView === "canvas" && <CanvasView />}
        {currentView === "import" && <ImportView />}
        {currentView === "settings" && <SettingsView />}
      </Layout>
    </DataReloadContext.Provider>
  );
}

export function App() {
  const auth = useAuth();

  if (!auth.isReady) {
    return (
      <div className="memorey-loading">
        <div className="memorey-loading__spinner" />
        <span>Loading Memorey...</span>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={auth}>
      {auth.isAuthenticated ? <AuthenticatedApp /> : <LoginView />}
    </AuthContext.Provider>
  );
}
