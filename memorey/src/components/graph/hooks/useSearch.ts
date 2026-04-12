"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type RefObject,
  type MutableRefObject,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useGraphStore } from "@/store/graphStore";
import type { SearchMode } from "../types/canvas.types";
import { useTrack } from "@/hooks/useTrack";
import { useCanvasStore } from "@/store/canvasStore";

function fuzzyScore(q: string, title: string, value: string): number {
  const s = `${title} ${value}`.toLowerCase();
  const needle = q.toLowerCase().trim();
  if (!needle) return 1;
  if (s.includes(needle)) return 2;
  let idx = 0;
  for (const ch of needle) {
    const j = s.indexOf(ch, idx);
    if (j < 0) return 0;
    idx = j + 1;
  }
  return 1;
}

export function useSearch(userId: string | null): {
  searchQuery: string;
  searchMode: SearchMode;
  searchExpanded: boolean;
  searchResultCount: number;
  semanticLoading: boolean;
  searchMatchesRef: MutableRefObject<Set<string>>;
  searchModeRef: MutableRefObject<SearchMode>;
  searchQueryRef: MutableRefObject<string>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  handleSearchChange: (v: string) => void;
  handleSearchSubmit: () => Promise<void>;
  clearSearch: () => void;
  setSearchExpanded: (v: boolean) => void;
  setSearchQuery: (v: string) => void;
  setSearchMode: (m: SearchMode) => void;
} {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchMode, setSearchMode] = useState<SearchMode>("idle");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [lockedIds, setLockedIds] = useState<string[]>([]);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchMatchesRef = useRef<Set<string>>(new Set());
  const searchModeRef = useRef<SearchMode>("idle");
  const searchQueryRef = useRef("");
  const keywordTrackedRef = useRef<string | null>(null);
  const { track } = useTrack();
  searchModeRef.current = searchMode;
  searchQueryRef.current = searchQuery;

  const nodes = useGraphStore((s) => s.nodes);
  const setSearchHighlights = useGraphStore((s) => s.setSearchHighlights);
  const setSemanticSearchActive = useGraphStore((s) => s.setSemanticSearchActive);

  const liveMatches = useMemo(() => {
    const q = searchQuery.trim();
    const next = new Set<string>();
    if (!q || searchMode !== "live") return next;
    for (const n of nodes) {
      if (!n.isActive) continue;
      if (fuzzyScore(q, n.title, n.value) > 0) next.add(n.id);
    }
    return next;
  }, [nodes, searchQuery, searchMode]);

  useEffect(() => {
    if (searchMode === "live" && searchQuery.trim()) {
      const arr = [...liveMatches];
      searchMatchesRef.current = new Set(arr);
      setSearchHighlights(arr);
    } else if (searchMode === "idle" && !searchQuery.trim()) {
      searchMatchesRef.current = new Set();
      setSearchHighlights([]);
    }
  }, [searchMode, searchQuery, liveMatches, setSearchHighlights]);

  useEffect(() => {
    if (searchMode === "locked") {
      searchMatchesRef.current = new Set(lockedIds);
      setSearchHighlights(lockedIds);
    }
  }, [searchMode, lockedIds, setSearchHighlights]);

  useEffect(() => {
    if (searchMode !== "live" || !userId) {
      keywordTrackedRef.current = null;
      return;
    }
    const q = searchQuery.trim();
    if (q.length < 1) {
      keywordTrackedRef.current = null;
      return;
    }
    const t = window.setTimeout(() => {
      if (keywordTrackedRef.current === q) return;
      keywordTrackedRef.current = q;
      track("search_performed", { type: "keyword" });
    }, 600);
    return () => window.clearTimeout(t);
  }, [searchQuery, searchMode, userId, track]);

  const searchResultCount =
    searchMode === "locked" ? lockedIds.length : liveMatches.size;

  const handleSearchChange = useCallback(
    (v: string) => {
      setSearchQuery(v);
      searchQueryRef.current = v;
      if (searchMode === "locked") {
        setSearchMode("live");
        searchModeRef.current = "live";
      }
      if (v.trim() && searchMode === "idle") {
        setSearchMode("live");
        searchModeRef.current = "live";
      }
    },
    [searchMode]
  );

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    searchQueryRef.current = "";
    setSearchMode("idle");
    searchModeRef.current = "idle";
    setLockedIds([]);
    searchMatchesRef.current = new Set();
    setSearchHighlights([]);
    setSemanticSearchActive(false);
    setSearchExpanded(false);
  }, [setSearchHighlights, setSemanticSearchActive]);

  const handleSearchSubmit = useCallback(async () => {
    const q = searchQueryRef.current.trim();
    if (!q || !userId) return;
    setSemanticLoading(true);
    setSemanticSearchActive(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const { isMasterView, activeCanvasId } = useCanvasStore.getState();
      const body: {
        query: string;
        userId: string;
        canvasId?: string;
      } = { query: q, userId };
      if (!isMasterView && activeCanvasId) {
        body.canvasId = activeCanvasId;
      }
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) return;
      const json = (await res.json()) as { relevantNodeIds?: string[] };
      const ids = json.relevantNodeIds ?? [];
      setLockedIds(ids);
      searchMatchesRef.current = new Set(ids);
      setSearchHighlights(ids);
      setSearchMode("locked");
      searchModeRef.current = "locked";
      track("search_performed", { type: "semantic" });
    } finally {
      setSemanticLoading(false);
      setSemanticSearchActive(false);
    }
  }, [userId, setSearchHighlights, setSemanticSearchActive, track]);

  return {
    searchQuery,
    searchMode,
    searchExpanded,
    searchResultCount,
    semanticLoading,
    searchMatchesRef,
    searchModeRef,
    searchQueryRef,
    searchInputRef,
    handleSearchChange,
    handleSearchSubmit,
    clearSearch,
    setSearchExpanded,
    setSearchQuery,
    setSearchMode,
  };
}
