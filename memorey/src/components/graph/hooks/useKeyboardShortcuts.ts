"use client";

import { useEffect, useLayoutEffect, useRef, type MutableRefObject } from "react";
import { useGraphStore } from "@/store/graphStore";
import type { SearchMode } from "../types/canvas.types";

export type KeyboardShortcutsOpts = {
  canvasDimsRef: MutableRefObject<{ W: number; H: number }>;
  transformRef: MutableRefObject<{ x: number; y: number; scale: number }>;
  selectedNodesRef: MutableRefObject<Set<string>>;
  setSelectedNodes: (s: Set<string>) => void;
  connectModeRef: MutableRefObject<boolean>;
  enterConnectMode: () => void;
  exitConnectMode: () => void;
  searchInputRef: MutableRefObject<HTMLInputElement | null>;
  setSearchExpanded: (v: boolean) => void;
  searchModeRef: MutableRefObject<SearchMode>;
  clearSearch: () => void;
  triggerAutoLayout: () => void;
  fitCanvasToNodes: () => void;
  openQuickCreate: (pos: { left: number; top: number }, vaultId: string) => void;
  copySelectedNodes: () => void;
  pasteNodes: () => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  toggleView: () => void;
  peekNodeId: string | null;
  setPeekNodeId: (id: string | null) => void;
  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;
  contextMenuOpenRef: MutableRefObject<boolean>;
  closeContextMenu: () => void;
  closeModals: () => void;
  isShiftHeld: MutableRefObject<boolean>;
};

export function useKeyboardShortcuts(o: KeyboardShortcutsOpts): void {
  const r = useRef(o);
  useLayoutEffect(() => {
    r.current = o;
  });
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const opts = r.current;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      const meta = e.metaKey || e.ctrlKey;

      // ── Copy / Paste ───────────────────────────────────────────────
      if (meta && e.key === "c") {
        e.preventDefault();
        if (opts.selectedNodesRef.current.size > 0) {
          opts.copySelectedNodes();
        }
        return;
      }

      if (meta && e.key === "v") {
        e.preventDefault();
        void opts.pasteNodes();
        return;
      }

      // ── Select all ─────────────────────────────────────────────────
      if (meta && e.key === "a") {
        e.preventDefault();
        const liveNodes = useGraphStore.getState().graphData.nodes;
        const all = new Set(
          liveNodes
            .filter(
              (n) =>
                n.nodeKind === "memory" && !String(n.id).startsWith("cat:")
            )
            .map((n) => n.id)
        );
        opts.selectedNodesRef.current = all;
        opts.setSelectedNodes(new Set(all));
        return;
      }

      // ── Auto layout ────────────────────────────────────────────────
      if (e.key === "a" || e.key === "A") {
        if (!meta) {
          e.preventDefault();
          opts.triggerAutoLayout();
          return;
        }
      }

      // ── Fit to screen ──────────────────────────────────────────────
      if (e.key === "f" || e.key === "F") {
        if (!meta) {
          e.preventDefault();
          opts.fitCanvasToNodes();
          return;
        }
      }

      // ── New memory node ────────────────────────────────────────────
      if (e.key === "n" || e.key === "N") {
        if (!meta) {
          e.preventDefault();
          const { W, H } = opts.canvasDimsRef.current;
          opts.openQuickCreate(
            { left: W / 2 - 130, top: H / 2 - 114 },
            ""
          );
          return;
        }
      }

      // ── Connect mode ───────────────────────────────────────────────
      if (e.key === "c" || e.key === "C") {
        if (!meta) {
          e.preventDefault();
          if (opts.connectModeRef.current) opts.exitConnectMode();
          else opts.enterConnectMode();
          return;
        }
      }

      // ── Search ─────────────────────────────────────────────────────
      if (meta && e.key === "k") {
        e.preventDefault();
        opts.setSearchExpanded(true);
        setTimeout(() => opts.searchInputRef.current?.focus(), 50);
        return;
      }

      // ── Reset zoom ─────────────────────────────────────────────────
      if (meta && e.key === "0") {
        e.preventDefault();
        const { W, H } = opts.canvasDimsRef.current;
        opts.transformRef.current = { x: W / 2, y: H / 2, scale: 1 };
        return;
      }

      // ── Toggle view ────────────────────────────────────────────────
      if (e.key === "p" || e.key === "P") {
        if (!meta) {
          e.preventDefault();
          opts.toggleView();
          return;
        }
      }

      // ── Delete selected ────────────────────────────────────────────
      if (
        (e.key === "Delete" || e.key === "Backspace") &&
        opts.selectedNodesRef.current.size > 0
      ) {
        void opts.handleBulkDelete();
        return;
      }

      // ── Escape ─────────────────────────────────────────────────────
      if (e.key === "Escape") {
        if (opts.peekNodeId) {
          opts.setPeekNodeId(null);
          return;
        }
        if (opts.searchModeRef.current !== "idle") {
          opts.clearSearch();
          return;
        }
        if (opts.selectedNodesRef.current.size > 0) {
          opts.selectedNodesRef.current = new Set();
          opts.setSelectedNodes(new Set());
          return;
        }
        if (opts.connectModeRef.current) {
          opts.exitConnectMode();
          return;
        }
        if (opts.contextMenuOpenRef.current) {
          opts.closeContextMenu();
          return;
        }
        if (opts.shortcutsOpen) {
          opts.setShortcutsOpen(false);
          return;
        }
        opts.closeModals();
        return;
      }

      // ── Shortcuts modal ────────────────────────────────────────────
      if (e.key === "?") {
        e.preventDefault();
        opts.setShortcutsOpen(!opts.shortcutsOpen);
        return;
      }

      // ── Shift tracking ─────────────────────────────────────────────
      if (e.key === "Shift") opts.isShiftHeld.current = true;
    }

    function onKeyUp(e: KeyboardEvent) {
      if (e.key === "Shift") r.current.isShiftHeld.current = false;
    }

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, []);
}
