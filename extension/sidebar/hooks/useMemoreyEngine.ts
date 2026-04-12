import { useCallback, useEffect, useRef, useState } from "react";
import { MemoreyPipeline } from "memorey-core";
import { useMemoreyDispatch } from "../store/memoreyStore";
import { SyncService } from "../services/SyncService";
import type { SyncStatus } from "../services/SyncService";

const STORAGE_KEY = "memorey_graph_data";
const TOKEN_KEY = "memorey_access_token";
const AUTO_SYNC_KEY = "memorey_auto_sync";

export function useMemoreyEngine() {
  const [pipeline, setPipeline] = useState<MemoreyPipeline | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useMemoreyDispatch();
  const initRef = useRef(false);
  const syncRef = useRef<SyncService | null>(null);

  const refreshState = useCallback(
    (p: MemoreyPipeline) => {
      const stats = p.getStats();
      const graphData = p.exportGraph();
      const allNodes = [...graphData.nodes];
      const recentFacts = [...allNodes]
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, 10);
      const pendingNodes = p.getPendingNodes();
      const pendingConflicts = p.getPendingConflicts();
      const vaults = p.getVaults();

      dispatch({
        type: "REFRESH_ALL",
        payload: {
          stats,
          allNodes,
          recentFacts,
          pendingNodes,
          pendingConflicts,
          vaults,
        },
      });
    },
    [dispatch]
  );

  const save = useCallback(
    async (p: MemoreyPipeline) => {
      const data = p.exportGraph();
      await chromeStorageSet(STORAGE_KEY, JSON.stringify(data));
      dispatch({ type: "SET_LAST_SYNC", time: new Date().toISOString() });
    },
    [dispatch]
  );

  // Initialize SyncService with a saved token
  const initSync = useCallback(
    async (p: MemoreyPipeline, token: string) => {
      const svc = new SyncService(p, token, {
        onStatusChange: (status: SyncStatus) => {
          dispatch({ type: "SET_SYNC_STATUS", status });
        },
        onSyncComplete: (result) => {
          dispatch({
            type: "SET_LAST_SYNC",
            time: result.timestamp,
          });
          refreshState(p);
        },
      });

      const authed = await svc.authenticate();
      if (!authed) {
        svc.disconnect();
        return null;
      }

      syncRef.current = svc;

      // Initial pull
      await svc.pull();
      refreshState(p);

      // Start auto-sync if enabled
      const autoSyncRaw = await chromeStorageGet(AUTO_SYNC_KEY);
      const autoSyncEnabled = autoSyncRaw !== "false";
      dispatch({ type: "SET_AUTO_SYNC", enabled: autoSyncEnabled });
      if (autoSyncEnabled) {
        svc.startAutoSync();
      }

      return svc;
    },
    [dispatch, refreshState]
  );

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        const p = new MemoreyPipeline({
          storagePath: "memorey-graph.json",
        });

        const stored = await chromeStorageGet(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            await p.importGraph(data);
          } catch {
            console.warn(
              "Memorey: could not load saved graph, starting fresh"
            );
          }
        }

        await p.init("extension-user");

        setPipeline(p);
        refreshState(p);
        setIsReady(true);

        // Check for saved access token and attempt sync connection
        const savedToken = await chromeStorageGet(TOKEN_KEY);
        if (savedToken) {
          await initSync(p, savedToken);
        }
      } catch (err) {
        console.error("Memorey: failed to initialize pipeline", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        dispatch({ type: "SET_LOADING", isLoading: false });
      }
    }

    init();
  }, [dispatch, refreshState, initSync]);

  // ── Sync methods exposed to UI ────────────────────────────────────

  const connectSync = useCallback(
    async (token: string): Promise<boolean> => {
      if (!pipeline) return false;

      const svc = new SyncService(pipeline, token, {
        onStatusChange: (status: SyncStatus) => {
          dispatch({ type: "SET_SYNC_STATUS", status });
        },
        onSyncComplete: (result) => {
          dispatch({ type: "SET_LAST_SYNC", time: result.timestamp });
          refreshState(pipeline);
        },
      });

      const authed = await svc.authenticate();
      if (!authed) {
        svc.disconnect();
        return false;
      }

      // Persist token
      await chromeStorageSet(TOKEN_KEY, token);
      syncRef.current = svc;

      // Initial sync
      await svc.sync();
      refreshState(pipeline);
      await save(pipeline);

      // Start auto-sync
      svc.startAutoSync();
      dispatch({ type: "SET_AUTO_SYNC", enabled: true });

      return true;
    },
    [pipeline, dispatch, refreshState, save]
  );

  const disconnectSync = useCallback(async () => {
    syncRef.current?.disconnect();
    syncRef.current = null;
    await chromeStorageSet(TOKEN_KEY, "");
    dispatch({ type: "SET_SYNC_STATUS", status: "not_connected" });
  }, [dispatch]);

  const syncNow = useCallback(async () => {
    if (!syncRef.current || !pipeline) return;
    await syncRef.current.sync();
    refreshState(pipeline);
    await save(pipeline);
  }, [pipeline, refreshState, save]);

  const toggleAutoSync = useCallback(
    async (enabled: boolean) => {
      dispatch({ type: "SET_AUTO_SYNC", enabled });
      await chromeStorageSet(AUTO_SYNC_KEY, String(enabled));
      if (syncRef.current) {
        if (enabled) {
          syncRef.current.startAutoSync();
        } else {
          syncRef.current.stopAutoSync();
        }
      }
    },
    [dispatch]
  );

  const exportGraph = useCallback(() => {
    if (!pipeline) return;
    const data = pipeline.exportGraph();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memorey-graph-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pipeline]);

  const clearLocalData = useCallback(async () => {
    await chromeStorageSet(STORAGE_KEY, "");
    if (pipeline) {
      const empty = { nodes: [], edges: [], vaultDefinitions: [], metadata: { userId: "extension-user", createdAt: new Date().toISOString(), lastUpdated: new Date().toISOString(), version: "1.0.0" } };
      await pipeline.importGraph(empty);
      refreshState(pipeline);
    }
  }, [pipeline, refreshState]);

  return {
    pipeline,
    isReady,
    error,
    refreshState,
    save,
    connectSync,
    disconnectSync,
    syncNow,
    toggleAutoSync,
    exportGraph,
    clearLocalData,
  };
}

// ── Chrome storage helpers ─────────────────────────────────────────

function chromeStorageGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null);
      });
    } else {
      resolve(localStorage.getItem(key));
    }
  });
}

function chromeStorageSet(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    } else {
      localStorage.setItem(key, value);
      resolve();
    }
  });
}
