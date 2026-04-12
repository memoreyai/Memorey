"use client";

import { mapNodeRow, useGraphStore } from "@/store/graphStore";
import type { MemoryNode } from "@/types/memorey";
import type { CategoryVault } from "@/types/memorey";
import { setNodeInVaultGroup } from "../layout/positions";
import type { MemoryGraphChromeProps } from "../ui/MemoryGraphChrome";
import type { CanvasDims } from "../types/canvas.types";
import type { MemoryGraphRefs } from "./useMemoryGraphRefs";
import type { MemoryGraphUiState } from "./useMemoryGraphUiState";
import { createClient } from "@/lib/supabase/client";
import { useCanvasStore } from "@/store/canvasStore";
import { useVaultStore } from "@/store/vaultStore";
import { BRAND_ORANGE } from "../constants/colors";
import { toast } from "sonner";
import { vaultGroupKeyForNode } from "../layout/masterLayout";
import { nodeAt } from "../interaction/hitTest";
import { getDynamicMasterCanvasRegionsForInteraction } from "../canvas/canvasGroups";
import { screenToWorld } from "../interaction/coordinates";
type Engine = ReturnType<typeof import("./useMemoryGraphEngine").useMemoryGraphEngine>;

function getDefaultFileVault(): string {
  const vaults = useVaultStore.getState().vaults.filter((v) => v.isActive);
  return (
    vaults.find((v) => /files|media/i.test(v.name))?.id ??
    vaults.find((v) => /personal/i.test(v.name))?.id ??
    vaults[0]?.id ??
    ""
  );
}

type ChromeBindings = {
  r: MemoryGraphRefs;
  canvasDims: CanvasDims;
  ui: MemoryGraphUiState;
  eng: Engine;
  activeCanvasId: string | null;
  vaults: CategoryVault[];
  selectedNodeId: string | null;
  selectNode: (id: string | null) => void;
  addNode: (n: MemoryNode) => void;
  addMemoryModalOpen: boolean;
  addMemoryParentNodeId: string | null;
  openAddMemoryModal: (id?: string | null) => void;
  closeAddMemoryModal: () => void;
  onPointerDown: MemoryGraphChromeProps["onPointerDown"];
  onPointerMove: MemoryGraphChromeProps["onPointerMove"];
  onPointerUp: MemoryGraphChromeProps["onPointerUp"];
  onContextMenu: MemoryGraphChromeProps["onContextMenu"];
  currentView: MemoryGraphChromeProps["currentView"];
  onViewChange: MemoryGraphChromeProps["onViewChange"];
  legendOpen: boolean;
  setLegendOpen: (v: boolean | ((p: boolean) => boolean)) => void;
  onCanvasDrop: MemoryGraphChromeProps["onCanvasDrop"];
  onCanvasDragOver: MemoryGraphChromeProps["onCanvasDragOver"];
  onCanvasDragLeave: MemoryGraphChromeProps["onCanvasDragLeave"];
};

export function useMemoryGraphChromeProps(b: ChromeBindings): MemoryGraphChromeProps {
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const canvases = useCanvasStore((s) => s.canvases);
  const {
    r,
    canvasDims,
    ui,
    eng,
    activeCanvasId,
    vaults,
    selectedNodeId,
    selectNode,
    addNode,
  } = b;

  function placeFileNodeAtWorld(
    nodeId: string,
    vaultId: string,
    wx: number,
    wy: number,
    canvasId?: string | null
  ) {
    const isMaster = useCanvasStore.getState().isMasterView;
    const vk = vaultGroupKeyForNode(canvasId, vaultId, isMaster);
    const gp = vk ? r.vaultGroupPositionsRef.current.get(vk) : undefined;
    if (gp) {
      r.nodeRelativePositionsRef.current.set(nodeId, {
        dx: wx - gp.x,
        dy: wy - gp.y,
      });
    } else {
      r.nodeRelativePositionsRef.current.set(nodeId, { dx: 0, dy: 0 });
    }
    r.nodePositionsRef.current.set(nodeId, { x: wx, y: wy });
  }

  async function handleAddFileNode(files: FileList | null) {
    if (!files?.length || !eng.userId) return;
    const session = (await createClient().auth.getSession()).data.session;
    if (!session) {
      toast.error("Please sign in");
      return;
    }
    const vaultId = getDefaultFileVault();
    if (!vaultId) {
      toast.error("No vault available");
      return;
    }
    const cs = useCanvasStore.getState();
    const targetCanvasId = eng.isMasterView
      ? r.masterLastCanvasIdRef.current ?? cs.activeCanvasId ?? cs.canvases[0]?.id
      : activeCanvasId;
    if (eng.isMasterView && !targetCanvasId) {
      toast.error("Pick a canvas by interacting with the graph first.");
      return;
    }
    const { W, H } = r.dimsRef.current;
    const tr = r.transformRef.current;
    const nFiles = files.length;
    for (let i = 0; i < nFiles; i++) {
      const file = files[i];
      const wx =
        (0 - tr.x) / tr.scale +
        W / 2 / tr.scale +
        (i - (nFiles - 1) / 2) * 180;
      const wy = (0 - tr.y) / tr.scale + H / 2 / tr.scale;
      if (file.size > 50 * 1024 * 1024) {
        toast.error(`${file.name} too large`);
        continue;
      }
      try {
        const { uploadAttachment } = await import("@/lib/uploadAttachment");
        const result = await uploadAttachment(file, eng.userId);
        const res = await fetch("/api/nodes/create-file", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            vaultId,
            canvasId: targetCanvasId,
            fileUrl: result.publicUrl,
            fileName: result.fileName,
            fileType: result.fileType,
            fileSize: result.fileSize,
            storagePath: result.storagePath,
            posX: wx,
            posY: wy,
          }),
        });
        if (res.ok) {
          const { node: saved } = (await res.json()) as {
            node: Record<string, unknown>;
          };
          if (saved) {
            const mapped = mapNodeRow(saved as never);
            addNode(mapped);
            const added = useGraphStore
              .getState()
              .nodes.find(
                (n) =>
                  n.fileUrl === result.publicUrl ||
                  n.storagePath === result.storagePath
              );
            if (added) {
              r.nodePositionsRef.current.set(added.id, { x: wx, y: wy });
              r.nodeRelativePositionsRef.current.set(added.id, {
                dx: 0,
                dy: 0,
              });
            } else {
              placeFileNodeAtWorld(
                mapped.id,
                mapped.vaultId,
                wx,
                wy,
                mapped.canvasId
              );
            }
          }
        } else {
          toast.error(`Failed to add ${file.name}`);
        }
      } catch {
        toast.error(`Failed to add ${file.name}`);
      }
    }
  }

  return {
      currentView: b.currentView,
      onViewChange: b.onViewChange,
      containerRef: r.containerRef,
      canvasRef: r.canvasRef,
      dimsRef: r.dimsRef,
      canvasDims,
      onPointerDown: b.onPointerDown,
      onPointerMove: b.onPointerMove,
      onPointerUp: b.onPointerUp,
      onPointerLeave: () => {
        r.hoveredNodeIdRef.current = null;
        r.emptyVaultHoverIdRef.current = null;
        r.gearHoverIdRef.current = null;
        r.vaultPlusHoverIdRef.current = null;
      },
      onContextMenu: b.onContextMenu,
      onCanvasDoubleClick: (e) => {
        const canvas = r.canvasRef.current;
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const masterRegs =
          useCanvasStore.getState().isMasterView
            ? getDynamicMasterCanvasRegionsForInteraction(
                r.canvasRegionsRef.current,
                useGraphStore.getState().graphData.nodes,
                r.nodePositionsRef.current
              )
            : r.canvasRegionsRef.current;
        const hitNode = nodeAt(
          mx,
          my,
          r.transformRef.current,
          useGraphStore.getState().graphData.nodes,
          r.nodePositionsRef.current,
          r.collapsedVaultsRef.current,
          useGraphStore.getState().mutedVaultIds,
          eng.userId,
          r.masterHasBioRef.current,
          masterRegs
        );
        if (hitNode && hitNode.nodeKind !== "master") {
          selectNode(hitNode.id);
          ui.setPeekNodeId(null);
          return;
        }
        if (hitNode?.nodeKind === "master") {
          if (hitNode.id.startsWith("master-canvas-")) {
            ui.setMasterEditorCanvasId(
              hitNode.id.slice("master-canvas-".length)
            );
          } else {
            ui.setMasterEditorCanvasId(null);
          }
          ui.setMasterEditorOpen(true);
          return;
        }
        const canvasRect = r.canvasRef.current?.getBoundingClientRect();
        if (!canvasRect) return;
        const formW = 260;
        const formH = 228;
        const left = Math.min(
          e.clientX - canvasRect.left,
          canvasRect.width - formW - 16
        );
        const top = Math.min(
          e.clientY - canvasRect.top,
          canvasRect.height - formH - 16
        );
        const { x: wx, y: wy } = screenToWorld(mx, my, r.transformRef.current);
        r.pendingNodeDropRef.current = { x: wx, y: wy };
        const cs = useCanvasStore.getState();
        const defaultCanvas =
          r.masterLastCanvasIdRef.current ??
          cs.activeCanvasId ??
          cs.canvases[0]?.id ??
          null;
        ui.setQuickCreate({
          open: true,
          x: Math.max(8, left) + canvasRect.left,
          y: Math.max(8, top) + canvasRect.top,
          vaultId: vaults[0]?.id ?? "",
          canvasId: eng.isMasterView ? defaultCanvas : undefined,
        });
      },
      connectMode: eng.connectMode,
      connectSource: eng.connectSource,
      edgeStyle: eng.edgeStyle,
      onToggleConnect: () => {
        if (eng.connectModeRef.current) eng.exitConnectMode();
        else eng.enterConnectMode();
      },
      onFit: eng.fitCanvasToNodes,
      onLayout: eng.triggerAutoLayout,
      onAddMemory: () => {
        b.openAddMemoryModal(null);
      },
      onChatBuilder: () => ui.setChatOpen(true),
      onEdgeStyleChange: eng.handleEdgeStyleChange,
      edgeColor: eng.edgeColor,
      onEdgeColorChange: (c) => void eng.handleEdgeColorChange(c),
      masterLineStyle: eng.masterLineStyle,
      onMasterLineStyleChange: (s) => void eng.handleMasterLineStyleChange(s),
      masterLineColor: eng.masterLineColor,
      onMasterLineColorChange: (c) =>
        void eng.handleMasterLineColorChange(c),
      onShortcuts: () => ui.setShortcutsOpen(true),
      onRenameCanvas: async (canvasId, updates) => {
        await useCanvasStore.getState().updateCanvas(canvasId, updates);
      },
      searchExpanded: eng.searchExpanded,
      searchQuery: eng.searchQuery,
      searchMode: eng.searchMode,
      searchResultCount: eng.searchResultCount,
      semanticLoading: eng.semanticLoading,
      searchInputRef: eng.searchInputRef,
      onSearchExpand: () => {
        eng.setSearchExpanded(true);
        eng.setSearchMode("live");
      },
      onSearchChange: eng.handleSearchChange,
      onSearchSubmit: () => void eng.handleSearchSubmit(),
      onSearchClear: eng.clearSearch,
      selectedNodes: ui.selectedNodes,
      onBulkSelectAll: () => {
        const ids = useGraphStore
          .getState()
          .graphData.nodes.filter((n) => n.nodeKind === "memory")
          .map((n) => n.id);
        r.selectedNodesRef.current = new Set(ids);
        ui.setSelectedNodes(new Set(ids));
      },
      onBulkExport: () => {
        ui.setExportModalSelectedIds(new Set(ui.selectedNodes));
        ui.setExportModalOpen(true);
      },
      onBulkMove: eng.handleBulkMove,
      onBulkDelete: eng.handleBulkDelete,
      onBulkDeselect: () => {
        r.selectedNodesRef.current = new Set();
        ui.setSelectedNodes(new Set());
      },
      contextMenu: ui.contextMenu,
      onContextMenuClose: () => ui.setContextMenu(null),
      edgeContextMenu: ui.edgeContextMenu,
      onEdgeContextMenuClose: () => ui.setEdgeContextMenu(null),
      onContextEdit: (id) => selectNode(id),
      onContextViewHistory: (id) => {
        ui.setHistoryNodeId(id);
        selectNode(id);
      },
      onContextConnect: (id) => {
        const n = useGraphStore.getState().graphData.nodes.find((x) => x.id === id);
        if (n) {
          eng.enterConnectMode();
          void eng.handleConnectClick(n);
        }
      },
      onContextCopyTitle: (id) => {
        const n = useGraphStore.getState().nodes.find((x) => x.id === id);
        if (n?.title) void navigator.clipboard.writeText(n.title);
      },
      onContextExportNode: (node) => {
        ui.setExportModalSelectedIds(new Set([node.id]));
        ui.setExportModalOpen(true);
      },
      onContextAddToKanban: (id) => void eng.handleAddToKanban(id),
      onContextMoveToVault: (id, vid) => void eng.handleMoveToVault(id, vid),
      onContextDelete: (id) => void eng.handleDeleteNode(id),
      vaultPopover: ui.vaultPopover,
      onVaultPopoverClose: () => ui.setVaultPopover(null),
      bulkMoveOpen: ui.bulkMoveOpen,
      onBulkMoveApply: (vid) => {
        for (const id of r.selectedNodesRef.current) {
          void eng.handleMoveToVault(id, vid);
        }
      },
      onBulkMoveClose: () => ui.setBulkMoveOpen(false),
      quickCreate: ui.quickCreate,
      onQuickCreateClose: () => ui.setQuickCreate(null),
      onQuickCreateSaved: (node: MemoryNode) => {
        addNode(node);
        r.pendingNodeDropRef.current = null;
        if (eng.isMasterView) {
          eng.placeMasterLayout();
        } else {
          setNodeInVaultGroup(node.id, node.vaultId ?? "", r.vaultLayoutRefs);
        }
      },
      addMemoryModalOpen: b.addMemoryModalOpen,
      addMemoryParentNodeId: b.addMemoryParentNodeId,
      canvasIdForMemoryCreate: eng.isMasterView
        ? (activeCanvasId ?? canvases[0]?.id ?? null)
        : activeCanvasId,
      isMasterView: eng.isMasterView,
      onAddMemoryClose: b.closeAddMemoryModal,
      onAddMemorySaved: (node) => {
        addNode(node);
        if (eng.isMasterView) eng.placeMasterLayout();
        else setNodeInVaultGroup(node.id, node.vaultId, r.vaultLayoutRefs);
      },
      masterEditorOpen: ui.masterEditorOpen,
      masterEditorBio: (() => {
        const ec =
          ui.masterEditorCanvasId != null
            ? canvases.find((c) => c.id === ui.masterEditorCanvasId)
            : null;
        return (
          ec?.masterNodeBio ??
          activeCanvas?.masterNodeBio ??
          eng.profile?.master_node_bio ??
          ""
        );
      })(),
      masterEditorColor: (() => {
        const ec =
          ui.masterEditorCanvasId != null
            ? canvases.find((c) => c.id === ui.masterEditorCanvasId)
            : null;
        return (
          ec?.masterNodeColor ??
          activeCanvas?.masterNodeColor ??
          eng.profile?.master_node_color ??
          BRAND_ORANGE
        );
      })(),
      onMasterEditorClose: () => {
        ui.setMasterEditorOpen(false);
        ui.setMasterEditorCanvasId(null);
      },
      onMasterEditorSave: async (bio, color) => {
        if (!eng.userId) return;
        const targetCanvasId =
          ui.masterEditorCanvasId ??
          useCanvasStore.getState().activeCanvasId;
        if (targetCanvasId) {
          await useCanvasStore.getState().updateCanvas(targetCanvasId, {
            masterNodeBio: bio,
            masterNodeColor: color,
          });
        } else {
          const supabase = createClient();
          await supabase
            .from("profiles")
            .update({
              master_node_bio: bio,
              master_node_color: color,
            })
            .eq("id", eng.userId);
        }
        eng.setProfile((prev) =>
          prev
            ? {
                ...prev,
                master_node_bio: bio,
                master_node_color: color,
              }
            : prev
        );
        ui.setMasterEditorOpen(false);
        ui.setMasterEditorCanvasId(null);
        toast.success("Master node updated");
      },
      shortcutsOpen: ui.shortcutsOpen,
      onShortcutsClose: () => ui.setShortcutsOpen(false),
      chatOpen: ui.chatOpen,
      onChatClose: () => ui.setChatOpen(false),
      onChatNodesAdded: (rows) => {
        for (const row of rows) {
          const v = vaults.find((x) => x.id === (row.vault_id as string));
          const ks = row.kanban_status as string | undefined;
          const kanbanStatus =
            ks === "todo" || ks === "doing" || ks === "done" ? ks : null;
          const node: MemoryNode = {
            id: row.id as string,
            userId: row.user_id as string,
            vaultId: row.vault_id as string,
            vaultName: (v?.name ?? "Personal") as MemoryNode["vaultName"],
            title: row.title as string,
            value: row.value as string,
            confidence: (row.confidence as number) ?? 1,
            source: "chat",
            isActive: true,
            createdAt: row.created_at as string,
            updatedAt: row.updated_at as string,
            canvasId: (row.canvas_id as string) ?? undefined,
            kanbanStatus,
            kanbanOrder: (row.kanban_order as number) ?? 0,
          };
          addNode(node);
          if (!eng.isMasterView) {
            setNodeInVaultGroup(node.id, node.vaultId, r.vaultLayoutRefs);
          }
        }
        if (eng.isMasterView) eng.placeMasterLayout();
      },
      selectedNodeId,
      userId: eng.userId,
      historyNodeId: ui.historyNodeId,
      onClearHistoryNode: () => ui.setHistoryNodeId(null),
      vaults,
      activeCanvasId,
      onBriefAnAI: () => {
        ui.setExportModalSelectedIds(null);
        ui.setExportModalOpen(true);
      },
      exportModalOpen: ui.exportModalOpen,
      exportModalSelectedIds: ui.exportModalSelectedIds,
      onCloseExportModal: () => {
        ui.setExportModalOpen(false);
        ui.setExportModalSelectedIds(null);
      },
      canvasDragOver: ui.canvasDragOver,
      onCanvasDragOver: b.onCanvasDragOver,
      onCanvasDragLeave: b.onCanvasDragLeave,
      onCanvasDrop: b.onCanvasDrop,
      fileNodeInputRef: r.fileNodeInputRef,
      onAddFileNode: (fl) => void handleAddFileNode(fl),
      peekNodeId: ui.peekNodeId,
      onClosePeek: () => ui.setPeekNodeId(null),
      transformRef: r.transformRef,
      nodePositionsRef: r.nodePositionsRef,
      legendOpen: b.legendOpen,
      onLegendToggle: () => b.setLegendOpen((o) => !o),
      onLegendClose: () => b.setLegendOpen(false),
    };
}
