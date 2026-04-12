import { useEffect, useRef, useState } from "react";
import { MemoreyPipeline } from "memorey-core";
import { useMemoreyDispatch } from "../store/memoreyStore";

/**
 * Chrome storage adapter — wraps chrome.storage.local to work as the
 * persistence layer for MemoreyPipeline. Since MemoreyPipeline expects
 * a storagePath (file-based), we use chrome.storage.local with a
 * known key to store the serialized graph JSON.
 */
const STORAGE_KEY = "memorey_graph_data";

/**
 * Initializes and provides access to the MemoreyPipeline instance.
 * The pipeline uses chrome.storage.local for persistence.
 */
export function useMemoreyEngine() {
  const [pipeline, setPipeline] = useState<MemoreyPipeline | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dispatch = useMemoreyDispatch();
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    async function init() {
      try {
        // Create pipeline with a placeholder storage path.
        // In the browser extension context, we override persistence
        // by manually saving/loading via chrome.storage.local.
        const p = new MemoreyPipeline({
          storagePath: "memorey-graph.json",
        });

        // Try loading existing graph from chrome.storage.local
        const stored = await chromeStorageGet(STORAGE_KEY);
        if (stored) {
          try {
            const data = JSON.parse(stored);
            await p.importGraph(data);
          } catch {
            // Corrupted data — start fresh
            console.warn("Memorey: could not load saved graph, starting fresh");
          }
        }

        await p.init("extension-user");

        setPipeline(p);
        refreshState(p);
        setIsReady(true);
      } catch (err) {
        console.error("Memorey: failed to initialize pipeline", err);
        setError(err instanceof Error ? err.message : "Unknown error");
        dispatch({ type: "SET_LOADING", isLoading: false });
      }
    }

    init();
  }, [dispatch]);

  function refreshState(p: MemoreyPipeline) {
    const stats = p.getStats();
    const graphData = p.exportGraph();
    const allNodes = [...graphData.nodes];
    const recentFacts = [...allNodes]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
    const pendingNodes = p.getPendingNodes();
    const pendingConflicts = p.getPendingConflicts();
    const vaults = p.getVaults();

    dispatch({
      type: "REFRESH_ALL",
      payload: { stats, allNodes, recentFacts, pendingNodes, pendingConflicts, vaults },
    });
  }

  async function save(p: MemoreyPipeline) {
    const data = p.exportGraph();
    await chromeStorageSet(STORAGE_KEY, JSON.stringify(data));
    dispatch({ type: "SET_LAST_SYNC", time: new Date().toISOString() });
  }

  return { pipeline, isReady, error, refreshState, save };
}

// --- Chrome storage helpers ---

function chromeStorageGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key] ?? null);
      });
    } else {
      // Fallback for non-extension environments (dev/testing)
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
