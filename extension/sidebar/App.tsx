import React, { useCallback, useEffect, useRef } from "react";
import { Layout } from "./components/Layout";
import { DashboardView } from "./views/DashboardView";
import { NodesListView } from "./views/NodesListView";
import { NodeDetailView } from "./views/NodeDetailView";
import { PendingView } from "./views/PendingView";
import { ConflictsView } from "./views/ConflictsView";
import { KanbanView } from "./views/KanbanView";
import { CanvasView } from "./views/CanvasView";
import { ImportView } from "./views/ImportView";
import { SettingsView } from "./views/SettingsView";
import { LoginView } from "./views/LoginView";
import { useMemoreyState, useMemoreyDispatch } from "./store/memoreyStore";
import { useAuth, AuthContext } from "./hooks/useAuth";
import { createSupabaseClient } from "./utils/supabase";
import type { MemoryNode, VaultDefinition, MemoryEdge, Stats } from "./types";

function AuthenticatedApp() {
  const { currentView } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const { token, userId } = useAuth();
  const loadedRef = useRef(false);

  const loadData = useCallback(async () => {
    if (!token || !userId) return;

    const supabase = createSupabaseClient(token);
    if (!supabase) return;

    dispatch({ type: "SET_LOADING", isLoading: true });

    try {
      const [vaultRes, nodeRes, edgeRes] = await Promise.all([
        supabase
          .from("category_vaults")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true)
          .order("display_order"),
        supabase
          .from("memory_nodes")
          .select("*")
          .eq("user_id", userId)
          .order("created_at", { ascending: false }),
        supabase
          .from("node_edges")
          .select("*")
          .eq("user_id", userId),
      ]);

      const vaults: VaultDefinition[] = (vaultRes.data ?? []).map(
        (v: Record<string, unknown>) => ({
          id: v.id as string,
          name: v.name as string,
          description: (v.slug as string) ?? "",
          color: (v.color as string) ?? undefined,
        })
      );

      const allNodes: MemoryNode[] = (nodeRes.data ?? []).map(
        (r: Record<string, unknown>) => ({
          id: r.id as string,
          fact: (r.value as string) || (r.title as string),
          vault: r.vault_id as string,
          confidence: (r.confidence as number) ?? 1,
          status: (r.is_active as boolean) !== false ? "approved" : "rejected",
          tags: [],
          source: {
            platform: (r.source as string) ?? "web",
            timestamp: r.created_at as string,
          },
          createdAt: r.created_at as string,
          updatedAt: (r.updated_at as string) ?? (r.created_at as string),
          changelog: [],
          supersededBy: null,
        })
      );

      const edges: MemoryEdge[] = (edgeRes.data ?? []).map(
        (e: Record<string, unknown>) => ({
          id: e.id as string,
          fromId: e.source_node_id as string,
          toId: e.target_node_id as string,
          relation: (e.label as string) ?? "related",
          strength: (e.strength as number) ?? 1,
          createdAt: (e.created_at as string) ?? undefined,
        })
      );

      const activeNodes = allNodes.filter((n) => n.status !== "rejected");
      const recentFacts = allNodes.slice(0, 10);
      const vaultBreakdown: Record<string, number> = {};
      activeNodes.forEach((n) => {
        const vName = vaults.find((v) => v.id === n.vault)?.name ?? "Unknown";
        vaultBreakdown[vName] = (vaultBreakdown[vName] ?? 0) + 1;
      });

      const stats: Stats = {
        totalFacts: allNodes.length,
        activeFacts: activeNodes.length,
        vaultBreakdown,
      };

      dispatch({
        type: "REFRESH_ALL",
        payload: { stats, allNodes, recentFacts, pendingNodes: [], vaults, edges },
      });
    } catch (err) {
      console.error("Memorey: failed to load data", err);
      dispatch({ type: "SET_LOADING", isLoading: false });
    }
  }, [token, userId, dispatch]);

  useEffect(() => {
    if (loadedRef.current) return;
    loadedRef.current = true;
    void loadData();
  }, [loadData]);

  return (
    <DataReloadContext.Provider value={loadData}>
      <Layout>
        {currentView === "dashboard" && <DashboardView />}
        {currentView === "nodes" && <NodesListView />}
        {currentView === "node-detail" && <NodeDetailView />}
        {currentView === "pending" && <PendingView />}
        {currentView === "conflicts" && <ConflictsView />}
        {currentView === "kanban" && <KanbanView />}
        {currentView === "canvas" && <CanvasView />}
        {currentView === "import" && <ImportView />}
        {currentView === "settings" && <SettingsView />}
      </Layout>
    </DataReloadContext.Provider>
  );
}

import { createContext, useContext } from "react";

const DataReloadContext = createContext<() => Promise<void>>(async () => {});
export function useDataReload() {
  return useContext(DataReloadContext);
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
