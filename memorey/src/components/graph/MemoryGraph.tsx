"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapNodeRow, useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import { toast } from "sonner";
import { screenToWorld } from "./interaction/coordinates";
import type { MemoryGraphRefs } from "./hooks/useMemoryGraphRefs";
import {
  useGraphCanvasEvents,
  useKeyboardShortcuts,
  useMemoryGraphLifecycle,
  useMemoryGraphRefs,
  useMemoryGraphUiState,
  useMemoryGraphEngine,
  useMemoryGraphChromeProps,
} from "./hooks";
import { MemoryGraphChrome } from "./ui/MemoryGraphChrome";
import { DropVaultPickerModal } from "./ui/DropVaultPickerModal";
import { vaultGroupKeyForNode } from "./layout/masterLayout";

function placeFileNodeAtWorld(
  refs: MemoryGraphRefs,
  nodeId: string,
  vaultId: string,
  wx: number,
  wy: number,
  canvasId?: string | null
) {
  const isMaster = useCanvasStore.getState().isMasterView;
  const vk = vaultGroupKeyForNode(canvasId, vaultId, isMaster);
  const gp = vk ? refs.vaultGroupPositionsRef.current.get(vk) : undefined;
  if (gp) {
    refs.nodeRelativePositionsRef.current.set(nodeId, {
      dx: wx - gp.x,
      dy: wy - gp.y,
    });
  } else {
    refs.nodeRelativePositionsRef.current.set(nodeId, { dx: 0, dy: 0 });
  }
  refs.nodePositionsRef.current.set(nodeId, { x: wx, y: wy });
}

export function MemoryGraph() {
  const r = useMemoryGraphRefs();
  const ui = useMemoryGraphUiState();
  const [currentView, setCurrentView] = useState<
    "graph" | "plain" | "tree"
  >("graph");
  const [legendOpen, setLegendOpen] = useState(false);
  const [pendingCanvasDrop, setPendingCanvasDrop] = useState<{
    files: File[];
    urls: string[];
    worldPos: { x: number; y: number };
  } | null>(null);
  /** Avoid calling import inside setState (React 18 Strict Mode runs updaters twice → duplicate nodes). */
  const pendingCanvasDropRef = useRef<{
    files: File[];
    urls: string[];
    worldPos: { x: number; y: number };
  } | null>(null);

  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const graphNodeCount = useGraphStore((s) => s.graphData.nodes.length);
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const addNode = useGraphStore((s) => s.addNode);
  const addMemoryModalOpen = useGraphStore((s) => s.addMemoryModalOpen);
  const addMemoryParentNodeId = useGraphStore((s) => s.addMemoryParentNodeId);
  const openAddMemoryModal = useGraphStore((s) => s.openAddMemoryModal);
  const closeAddMemoryModal = useGraphStore((s) => s.closeAddMemoryModal);
  const allVaults = useVaultStore((s) => s.vaults);
  const vaults = useMemo(
    () => allVaults.filter((v) => v.isActive),
    [allVaults]
  );
  const eng = useMemoryGraphEngine({
    r,
    canvasReady: ui.canvasReady,
    activeCanvasId,
    graphNodeCount,
    vaultCount: vaults.length,
    setSelectedNodes: ui.setSelectedNodes,
    setBulkMoveOpen: ui.setBulkMoveOpen,
  });
  const isMasterView = eng.isMasterView;

  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const profileForCanvas = useMemo(() => {
    const p = eng.profile;
    if (!p) return null;
    return {
      ...p,
      master_node_bio: activeCanvas?.masterNodeBio ?? p.master_node_bio,
      master_node_color:
        activeCanvas?.masterNodeColor ?? p.master_node_color,
    };
  }, [eng.profile, activeCanvas]);

  useMemoryGraphLifecycle(
    {
      userId: eng.userId,
      profile: profileForCanvas,
      selectedNodeId,
      selectedNodes: ui.selectedNodes,
      peekNodeId: ui.peekNodeId,
      collapsedVaults: ui.collapsedVaults,
      contextMenu: ui.contextMenu,
      edgeContextMenu: ui.edgeContextMenu,
      searchExpanded: eng.searchExpanded,
      quickCreateOpen: !!ui.quickCreate?.open,
    },
    {
      userIdRef: r.userIdRef,
      profileRef: r.profileRef,
      masterHasBioRef: r.masterHasBioRef,
      selectedNodeIdRef: r.selectedNodeIdRef,
      selectedNodesRef: r.selectedNodesRef,
      peekNodeIdRef: r.peekNodeIdRef,
      collapsedVaultsRef: r.collapsedVaultsRef,
      contextMenuOpenRef: r.contextMenuOpenRef,
      searchExpandedRef: r.searchExpandedRef,
      quickCreateOpenRef: r.quickCreateOpenRef,
    },
    eng.profile?.avatar_url,
    r.avatarImageRef,
    ui.setCanvasReady
  );

  useKeyboardShortcuts({
    canvasDimsRef: r.dimsRef,
    transformRef: r.transformRef,
    selectedNodesRef: r.selectedNodesRef,
    setSelectedNodes: ui.setSelectedNodes,
    connectModeRef: eng.connectModeRef,
    enterConnectMode: eng.enterConnectMode,
    exitConnectMode: eng.exitConnectMode,
    searchInputRef: eng.searchInputRef,
    setSearchExpanded: eng.setSearchExpanded,
    searchModeRef: eng.searchModeRef,
    clearSearch: eng.clearSearch,
    triggerAutoLayout: eng.triggerAutoLayout,
    fitCanvasToNodes: eng.fitCanvasToNodes,
    openQuickCreate: (pos, vaultId) => {
      const canvas = r.canvasRef.current;
      const rect = canvas?.getBoundingClientRect();
      if (!rect) return;
      const cs = useCanvasStore.getState();
      const defaultCanvas =
        r.masterLastCanvasIdRef.current ??
        cs.activeCanvasId ??
        cs.canvases[0]?.id ??
        null;
      ui.setQuickCreate({
        open: true,
        x: rect.left + pos.left,
        y: rect.top + pos.top,
        vaultId: vaultId || vaults[0]?.id || "",
        canvasId: isMasterView ? defaultCanvas : undefined,
      });
    },
    copySelectedNodes: eng.copySelectedNodes,
    pasteNodes: eng.pasteNodes,
    handleBulkDelete: eng.handleBulkDelete,
    toggleView: () =>
      setCurrentView((v) => {
        if (v === "graph") return "plain";
        if (v === "plain") return "tree";
        return "graph";
      }),
    peekNodeId: ui.peekNodeId,
    setPeekNodeId: ui.setPeekNodeId,
    shortcutsOpen: ui.shortcutsOpen,
    setShortcutsOpen: ui.setShortcutsOpen,
    contextMenuOpenRef: r.contextMenuOpenRef,
    closeContextMenu: () => {
      ui.setContextMenu(null);
      ui.setEdgeContextMenu(null);
    },
    closeModals: () => {
      ui.setShortcutsOpen(false);
      ui.setChatOpen(false);
      ui.setMasterEditorOpen(false);
      ui.setVaultPopover(null);
      ui.setExportModalOpen(false);
      ui.setExportModalSelectedIds(null);
      ui.setEdgeContextMenu(null);
      closeAddMemoryModal();
    },
    isShiftHeld: r.isShiftHeld,
  });

  useEffect(() => {
    function onOpenHistory(e: Event) {
      const { nodeId } = (e as CustomEvent<{ nodeId?: string }>).detail ?? {};
      if (nodeId) ui.setHistoryNodeId(nodeId);
    }
    window.addEventListener("memorey:open-history", onOpenHistory);
    return () =>
      window.removeEventListener("memorey:open-history", onOpenHistory);
  }, [ui.setHistoryNodeId]);

  const { onPointerDown, onPointerMove, onPointerUp, onContextMenu } =
    useGraphCanvasEvents(
      {
        canvasRef: r.canvasRef,
        transformRef: r.transformRef,
        userId: eng.userId,
        vaults,
        contextMenu: ui.contextMenu,
        setContextMenu: ui.setContextMenu,
        edgeContextMenu: ui.edgeContextMenu,
        setEdgeContextMenu: ui.setEdgeContextMenu,
        edgeStyleRef: eng.edgeStyleRef,
        connectModeRef: eng.connectModeRef,
        handleConnectClick: eng.handleConnectClick,
        minimapBoundsRef: eng.minimapBoundsRef,
        handleMinimapClick: eng.handleMinimapClick,
        openAddMemoryModal,
        nodePositionsRef: r.nodePositionsRef,
        vaultGroupPositionsRef: r.vaultGroupPositionsRef,
        canvasRegionsRef: r.canvasRegionsRef,
        placeMasterLayout: eng.placeMasterLayout,
        masterLastCanvasIdRef: r.masterLastCanvasIdRef,
        nodeRelativePositionsRef: r.nodeRelativePositionsRef,
        collapsedVaultsRef: r.collapsedVaultsRef,
        setCollapsedVaults: ui.setCollapsedVaults,
        selectedNodesRef: r.selectedNodesRef,
        setSelectedNodes: ui.setSelectedNodes,
        peekNodeIdRef: r.peekNodeIdRef,
        setPeekNodeId: ui.setPeekNodeId,
        cursorWorldRef: r.cursorWorldRef,
        selectionBoxRef: r.selectionBoxRef,
        dragStateRef: r.dragStateRef,
        pointerDownRef: r.pointerDownRef,
        vaultDragRef: r.vaultDragRef,
        draggingVaultIdRef: r.draggingVaultIdRef,
        hoveredNodeIdRef: r.hoveredNodeIdRef,
        emptyVaultHoverIdRef: r.emptyVaultHoverIdRef,
        gearHoverIdRef: r.gearHoverIdRef,
        vaultPlusHoverIdRef: r.vaultPlusHoverIdRef,
        setQuickCreate: ui.setQuickCreate,
        setVaultPopover: ui.setVaultPopover,
        setMasterEditorOpen: ui.setMasterEditorOpen,
        selectNode,
        masterHasBioRef: r.masterHasBioRef,
        isShiftHeld: r.isShiftHeld,
        vaultLayoutRefs: r.vaultLayoutRefs,
        regionDragRef: r.regionDragRef,
        setMasterEditorCanvasId: ui.setMasterEditorCanvasId,
      },
      ui.canvasReady
    );

  const onCanvasDragOver = useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      ev.preventDefault();
      ev.stopPropagation();
      ui.setCanvasDragOver(true);
    },
    [ui.setCanvasDragOver]
  );

  const onCanvasDragLeave = useCallback(
    (ev: React.DragEvent<HTMLDivElement>) => {
      if (!ev.currentTarget.contains(ev.relatedTarget as Node)) {
        ui.setCanvasDragOver(false);
      }
    },
    [ui.setCanvasDragOver]
  );

  const processCanvasImport = useCallback(
    async (
      vaultId: string,
      files: File[],
      urls: string[],
      wp: { x: number; y: number }
    ) => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        return;
      }

      for (let fi = 0; fi < files.length; fi++) {
        const file = files[fi];
        const tid = `drop-${fi}-${Date.now()}`;

        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 50MB)`);
          continue;
        }

        const wx = wp.x + fi * 200;
        const wy = wp.y;

        toast.loading(`Uploading ${file.name}…`, { id: tid });

        try {
          const { uploadAttachment } = await import("@/lib/uploadAttachment");
          const uploadResult = await uploadAttachment(file, session.user.id);

          const res = await fetch("/api/nodes/create-file", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              vaultId,
              canvasId:
                (isMasterView
                  ? r.masterLastCanvasIdRef.current ??
                    useCanvasStore.getState().activeCanvasId ??
                    useCanvasStore.getState().canvases[0]?.id
                  : activeCanvasId) ?? null,
              fileUrl: uploadResult.publicUrl,
              fileName: uploadResult.fileName,
              fileType: uploadResult.fileType,
              fileSize: uploadResult.fileSize,
              storagePath: uploadResult.storagePath,
              posX: wx,
              posY: wy,
            }),
          });

          const resText = await res.text();

          if (!res.ok) {
            toast.error(`Server error ${res.status}`, { id: tid });
            continue;
          }

          let resJson: { node?: Record<string, unknown> };
          try {
            resJson = JSON.parse(resText);
          } catch {
            toast.error("Invalid server response", { id: tid });
            continue;
          }

          const savedRow = resJson.node;
          if (!savedRow) {
            toast.error("Node not saved", { id: tid });
            continue;
          }

          const mapped = mapNodeRow(savedRow as never);
          addNode(mapped);
          placeFileNodeAtWorld(
            r,
            mapped.id,
            mapped.vaultId,
            wx,
            wy,
            mapped.canvasId
          );

          toast.success(`${file.name} added to canvas`, { id: tid });
        } catch (err) {
          toast.error(
            `Failed: ${err instanceof Error ? err.message : "Unknown error"}`,
            { id: tid }
          );
        }
      }

      for (const url of urls.slice(0, 3)) {
        try {
          const meta = await fetch("/api/attachments/extract-meta", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url }),
          }).then((resp) => (resp.ok ? resp.json() : null));
          const res = await fetch("/api/nodes/create-file", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({
              vaultId,
              canvasId:
                (isMasterView
                  ? r.masterLastCanvasIdRef.current ??
                    useCanvasStore.getState().activeCanvasId ??
                    useCanvasStore.getState().canvases[0]?.id
                  : activeCanvasId) ?? null,
              fileUrl: url,
              fileName: (meta?.title as string) ?? url.split("/").pop() ?? "Link",
              fileType: (meta?.fileType as string) ?? "link",
              ogTitle: meta?.title as string | undefined,
              ogDescription: meta?.description as string | undefined,
              ogImage: meta?.image as string | undefined,
              ogSiteName: meta?.siteName as string | undefined,
              posX: wp.x,
              posY: wp.y,
            }),
          });
          if (res.ok) {
            const { node: savedNode } = (await res.json()) as {
              node: Record<string, unknown>;
            };
            if (savedNode) {
              const mapped = mapNodeRow(savedNode as never);
              addNode(mapped);
              placeFileNodeAtWorld(
                r,
                mapped.id,
                mapped.vaultId,
                wp.x,
                wp.y,
                mapped.canvasId
              );
              toast.success("Link added to canvas");
            }
          }
        } catch {
          toast.error("Failed to add link");
        }
      }
    },
    [activeCanvasId, addNode, r, isMasterView]
  );

  const handleCanvasDrop = useCallback(
    async (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      ui.setCanvasDragOver(false);

      const rawFiles = Array.from(e.dataTransfer.files);
      const uriList = e.dataTransfer.getData("text/uri-list") ?? "";
      const urls = uriList
        .split("\n")
        .map((u) => u.trim())
        .filter((u) => u.startsWith("http"));

      const files = rawFiles.filter((f) => f.size <= 50 * 1024 * 1024);
      for (const f of rawFiles) {
        if (f.size > 50 * 1024 * 1024) {
          toast.error(`${f.name} is too large (max 50MB)`);
        }
      }

      if (files.length === 0 && urls.length === 0) {
        return;
      }

      const canvasEl = r.canvasRef.current;
      if (!canvasEl) return;
      const rect = canvasEl.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const wp = screenToWorld(mx, my, r.transformRef.current);

      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Please sign in");
        return;
      }

      if (vaults.length === 0) {
        toast.error("No vaults available — create a vault first");
        return;
      }

      const payload = { files, urls, worldPos: wp };
      pendingCanvasDropRef.current = payload;
      setPendingCanvasDrop(payload);
    },
    [r, ui.setCanvasDragOver, vaults.length]
  );

  const confirmCanvasDrop = useCallback(
    (vaultId: string) => {
      const pending = pendingCanvasDropRef.current;
      pendingCanvasDropRef.current = null;
      setPendingCanvasDrop(null);
      if (pending) {
        void processCanvasImport(
          vaultId,
          pending.files,
          pending.urls,
          pending.worldPos
        );
      }
    },
    [processCanvasImport]
  );

  const chrome = useMemoryGraphChromeProps({
    r,
    canvasDims: eng.canvasDims,
    ui,
    eng,
    activeCanvasId,
    vaults,
    selectedNodeId,
    selectNode,
    addNode,
    addMemoryModalOpen,
    addMemoryParentNodeId,
    openAddMemoryModal,
    closeAddMemoryModal,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onContextMenu,
    currentView,
    onViewChange: setCurrentView,
    legendOpen,
    setLegendOpen,
    onCanvasDrop: handleCanvasDrop,
    onCanvasDragOver,
    onCanvasDragLeave,
  });

  return (
    <>
      {pendingCanvasDrop ? (
        <DropVaultPickerModal
          vaults={vaults}
          fileCount={pendingCanvasDrop.files.length}
          urlCount={pendingCanvasDrop.urls.length}
          onCancel={() => {
            pendingCanvasDropRef.current = null;
            setPendingCanvasDrop(null);
          }}
          onConfirm={(vaultId) => void confirmCanvasDrop(vaultId)}
        />
      ) : null}
      <MemoryGraphChrome {...chrome} />
    </>
  );
}
