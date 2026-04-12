"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  type MutableRefObject,
  type RefObject,
} from "react";
import { useGraphStore } from "@/store/graphStore";
import type { CategoryVault, GraphNode } from "@/types/memorey";
import { isFileGraphNode } from "../lib/fileNodeHelpers";
import type { Transform } from "../types/canvas.types";
import type { SelectionBox, DragState, PointerDownRecord } from "../types/canvas.types";
import type {
  ContextMenuState,
  EdgeContextMenuState,
  VaultSettingsState,
} from "../types/graph.types";
import type { EdgeStyle } from "../types/canvas.types";
import { screenToWorld, worldToScreen } from "../interaction/coordinates";
import {
  nodeAt,
  edgeAt,
  vaultHeaderAt,
  gearIconAt,
  collapseButtonAt,
  emptyVaultAddButtonAt,
  vaultPlusButtonAt,
  plusZoneAt,
} from "../interaction/hitTest";
import { handleWheel } from "../interaction/wheel";
import {
  createPanDrag,
  createNodeDrag,
  updateDragMoved,
  isClickGesture,
} from "../interaction/drag";
import { useCanvasStore } from "@/store/canvasStore";
import {
  parseMasterVaultKey,
  vaultGroupKeyForNode,
  canvasIdAtWorld,
} from "../layout/masterLayout";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { MemoryNode } from "@/types/memorey";
import type { MasterCanvasRegion, VaultLayoutRefs } from "../layout/types";
import { applyRegionOffsetsToRefs } from "../layout/masterLayout";
import { getDynamicMasterCanvasRegionsForInteraction } from "../canvas/canvasGroups";
import {
  schedulePersistNodePositionAfterDrag,
  persistAllGraphNodePositionsFromRefs,
} from "@/lib/graph/persistNodePositions";

export type GraphCanvasEventsOpts = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  transformRef: MutableRefObject<Transform>;
  userId: string | null;
  vaults: CategoryVault[];
  contextMenu: ContextMenuState | null;
  setContextMenu: (v: ContextMenuState | null) => void;
  edgeContextMenu: EdgeContextMenuState | null;
  setEdgeContextMenu: (v: EdgeContextMenuState | null) => void;
  edgeStyleRef: MutableRefObject<EdgeStyle>;
  connectModeRef: MutableRefObject<boolean>;
  handleConnectClick: (n: GraphNode | null) => Promise<void>;
  minimapBoundsRef: MutableRefObject<{ x: number; y: number; w: number; h: number }>;
  handleMinimapClick: (clientX: number, clientY: number) => void;
  openAddMemoryModal: (id?: string | null) => void;
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  vaultGroupPositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  nodeRelativePositionsRef: MutableRefObject<Map<string, { dx: number; dy: number }>>;
  collapsedVaultsRef: MutableRefObject<Set<string>>;
  setCollapsedVaults: (s: Set<string>) => void;
  selectedNodesRef: MutableRefObject<Set<string>>;
  setSelectedNodes: (s: Set<string>) => void;
  peekNodeIdRef: MutableRefObject<string | null>;
  setPeekNodeId: (id: string | null) => void;
  cursorWorldRef: MutableRefObject<{ x: number; y: number } | null>;
  selectionBoxRef: MutableRefObject<SelectionBox | null>;
  dragStateRef: MutableRefObject<DragState | null>;
  pointerDownRef: MutableRefObject<PointerDownRecord | null>;
  vaultDragRef: MutableRefObject<{
    vaultKey: string;
    g0: { x: number; y: number };
    p0: { sx: number; sy: number };
  } | null>;
  draggingVaultIdRef: MutableRefObject<string | null>;
  hoveredNodeIdRef: MutableRefObject<string | null>;
  emptyVaultHoverIdRef: MutableRefObject<string | null>;
  gearHoverIdRef: MutableRefObject<string | null>;
  vaultPlusHoverIdRef: MutableRefObject<string | null>;
  setQuickCreate: (v: {
    open: boolean;
    x: number;
    y: number;
    vaultId: string;
    canvasId?: string | null;
  }) => void;
  canvasRegionsRef: MutableRefObject<Map<string, MasterCanvasRegion>>;
  placeMasterLayout: () => void;
  masterLastCanvasIdRef: MutableRefObject<string | null>;
  setVaultPopover: (v: VaultSettingsState | null) => void;
  setMasterEditorOpen: (v: boolean) => void;
  selectNode: (id: string | null) => void;
  masterHasBioRef: MutableRefObject<boolean>;
  isShiftHeld: MutableRefObject<boolean>;
  vaultLayoutRefs: VaultLayoutRefs;
  regionDragRef: MutableRefObject<{
    canvasId: string;
    start: { sx: number; sy: number };
    offset0: { dx: number; dy: number };
  } | null>;
  setMasterEditorCanvasId: (id: string | null) => void;
};

function masterRegionsForPointer(
  o: GraphCanvasEventsOpts
): Map<string, MasterCanvasRegion> {
  if (!useCanvasStore.getState().isMasterView) {
    return o.canvasRegionsRef.current;
  }
  return getDynamicMasterCanvasRegionsForInteraction(
    o.canvasRegionsRef.current,
    useGraphStore.getState().graphData.nodes,
    o.nodePositionsRef.current
  );
}

function isSelectableGraphNode(n: GraphNode): boolean {
  if (n.nodeKind === "master" || n.id.startsWith("master-")) return false;
  return (
    n.nodeKind === "memory" ||
    n.nodeType === "sticky" ||
    isFileGraphNode(n)
  );
}

export function useGraphCanvasEvents(
  opts: GraphCanvasEventsOpts,
  canvasReady: boolean
): {
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
} {
  const optsRef = useRef(opts);
  useLayoutEffect(() => {
    optsRef.current = opts;
  });
  const getHidden = () => useGraphStore.getState().mutedVaultIds;

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const o = optsRef.current;
    const canvas = o.canvasRef.current;
    if (!canvas) return;
    if (e.button !== 0) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const tr = o.transformRef.current;
    if (o.contextMenu) {
      o.setContextMenu(null);
      return;
    }
    if (o.edgeContextMenu) {
      o.setEdgeContextMenu(null);
      return;
    }
    if (
      sx >= o.minimapBoundsRef.current.x &&
      sy >= o.minimapBoundsRef.current.y
    ) {
      o.handleMinimapClick(e.clientX, e.clientY);
      return;
    }

    const hit = nodeAt(
      sx,
      sy,
      tr,
      useGraphStore.getState().graphData.nodes,
      o.nodePositionsRef.current,
      o.collapsedVaultsRef.current,
      getHidden(),
      o.userId,
      o.masterHasBioRef.current,
      masterRegionsForPointer(o)
    );
    const w = screenToWorld(sx, sy, tr);

    if (e.shiftKey && e.button === 0 && hit && isSelectableGraphNode(hit)) {
      e.preventDefault();
      const next = new Set(o.selectedNodesRef.current);
      if (next.has(hit.id)) next.delete(hit.id);
      else next.add(hit.id);
      o.selectedNodesRef.current = next;
      o.setSelectedNodes(new Set(next));
      return;
    }

    if (e.shiftKey && e.button === 0 && !hit) {
      e.preventDefault();
      o.selectionBoxRef.current = {
        startX: w.x,
        startY: w.y,
        currentX: w.x,
        currentY: w.y,
        active: true,
      };
      canvas.style.cursor = "crosshair";
      canvas.setPointerCapture(e.pointerId);
      return;
    }

    if (o.connectModeRef.current) {
      const n = nodeAt(
        sx,
        sy,
        tr,
        useGraphStore.getState().graphData.nodes,
        o.nodePositionsRef.current,
        o.collapsedVaultsRef.current,
        getHidden(),
        o.userId,
        o.masterHasBioRef.current,
        masterRegionsForPointer(o)
      );
      void o.handleConnectClick(n);
      return;
    }

    if (hit) {
      if (hit.canvasId) {
        o.masterLastCanvasIdRef.current = hit.canvasId;
      }
      const mp = o.nodePositionsRef.current.get(hit.id);
      if (
        hit.nodeKind === "memory" &&
        mp &&
        plusZoneAt(w.x, w.y, mp) &&
        !isFileGraphNode(hit)
      ) {
        o.openAddMemoryModal(hit.id);
        return;
      }
      if (hit.nodeKind === "master" || hit.id.startsWith("master-")) {
        o.pointerDownRef.current = { nodeId: hit.id, plus: false, x: sx, y: sy };
        o.dragStateRef.current = createPanDrag(sx, sy, tr.x, tr.y);
        return;
      }
      o.pointerDownRef.current = { nodeId: hit.id, plus: false, x: sx, y: sy };
      const p = o.nodePositionsRef.current.get(hit.id)!;
      o.dragStateRef.current = createNodeDrag(sx, sy, hit.id, p.x, p.y);
      return;
    }
    const vg = o.vaultGroupPositionsRef.current;
    const liveNodes = useGraphStore.getState().graphData.nodes;
    const np = o.nodePositionsRef.current;
    const collapsedSet = o.collapsedVaultsRef.current;
    const isMaster = useCanvasStore.getState().isMasterView;

    const countAt = (vaultId: string, canvasId?: string) =>
      liveNodes.filter(
        (n) =>
          n.vaultId === vaultId &&
          (canvasId === undefined || n.canvasId === canvasId) &&
          n.nodeKind !== "category" &&
          np.has(n.id)
      ).length;

    if (isMaster) {
      for (const [key, gp] of vg) {
        const parsed = parseMasterVaultKey(key);
        if (!parsed) continue;
        const v = o.vaults.find((x) => x.id === parsed.vaultId);
        if (!v?.isActive) continue;
        const positionCount = countAt(v.id, parsed.canvasId);
        if (vaultPlusButtonAt(w.x, w.y, v, gp, positionCount)) {
          const scr = worldToScreen(gp.x, gp.y, tr);
          o.setQuickCreate({
            open: true,
            x: scr.x + rect.left,
            y: scr.y + rect.top,
            vaultId: v.id,
            canvasId: parsed.canvasId,
          });
          return;
        }
        if (
          !collapsedSet.has(v.id) &&
          !liveNodes.some(
            (n) =>
              n.vaultId === v.id &&
              n.canvasId === parsed.canvasId &&
              n.nodeKind === "memory"
          ) &&
          emptyVaultAddButtonAt(w.x, w.y, v.id, gp)
        ) {
          const scr = worldToScreen(gp.x, gp.y, tr);
          o.setQuickCreate({
            open: true,
            x: scr.x + rect.left,
            y: scr.y + rect.top,
            vaultId: v.id,
            canvasId: parsed.canvasId,
          });
          return;
        }
        if (gearIconAt(w.x, w.y, v, gp, positionCount)) {
          o.setVaultPopover({
            vaultId: v.id,
            vault: v,
            x: sx + rect.left,
            y: sy + rect.top,
          });
          return;
        }
        if (collapseButtonAt(w.x, w.y, v, gp, positionCount)) {
          const next = new Set(o.collapsedVaultsRef.current);
          if (next.has(v.id)) next.delete(v.id);
          else next.add(v.id);
          o.collapsedVaultsRef.current = next;
          o.setCollapsedVaults(next);
          return;
        }
      }
    } else {
      for (const v of o.vaults) {
        const gp = vg.get(v.id);
        if (!gp) continue;
        const positionCount = countAt(v.id);
        if (vaultPlusButtonAt(w.x, w.y, v, gp, positionCount)) {
          const scr = worldToScreen(gp.x, gp.y, tr);
          o.setQuickCreate({
            open: true,
            x: scr.x + rect.left,
            y: scr.y + rect.top,
            vaultId: v.id,
          });
          return;
        }
        if (
          !collapsedSet.has(v.id) &&
          !liveNodes.some(
            (n) => n.vaultId === v.id && n.nodeKind === "memory"
          ) &&
          emptyVaultAddButtonAt(w.x, w.y, v.id, gp)
        ) {
          const scr = worldToScreen(gp.x, gp.y, tr);
          o.setQuickCreate({
            open: true,
            x: scr.x + rect.left,
            y: scr.y + rect.top,
            vaultId: v.id,
          });
          return;
        }
        if (gearIconAt(w.x, w.y, v, gp, positionCount)) {
          o.setVaultPopover({
            vaultId: v.id,
            vault: v,
            x: sx + rect.left,
            y: sy + rect.top,
          });
          return;
        }
        if (collapseButtonAt(w.x, w.y, v, gp, positionCount)) {
          const next = new Set(o.collapsedVaultsRef.current);
          if (next.has(v.id)) next.delete(v.id);
          else next.add(v.id);
          o.collapsedVaultsRef.current = next;
          o.setCollapsedVaults(next);
          return;
        }
      }
    }
    const vh = vaultHeaderAt(sx, sy, tr, vg, o.vaults, (vaultId, canvasId) =>
      countAt(vaultId, canvasId)
    );
    if (vh) {
      const gp = vg.get(vh);
      if (gp) {
        o.vaultDragRef.current = {
          vaultKey: vh,
          g0: { x: gp.x, y: gp.y },
          p0: { sx, sy },
        };
        const parsed = parseMasterVaultKey(vh);
        o.draggingVaultIdRef.current = parsed?.vaultId ?? vh;
      }
      return;
    }
    if (useCanvasStore.getState().isMasterView) {
      const cid = canvasIdAtWorld(w.x, w.y, masterRegionsForPointer(o));
      if (cid) {
        o.regionDragRef.current = {
          canvasId: cid,
          start: { sx, sy },
          offset0: {
            ...(o.vaultLayoutRefs.canvasRegionOffsetsRef.current.get(cid) ?? {
              dx: 0,
              dy: 0,
            }),
          },
        };
        return;
      }
    }
    o.selectNode(null);
    o.setPeekNodeId(null);
    o.selectedNodesRef.current = new Set();
    o.setSelectedNodes(new Set());
    o.dragStateRef.current = createPanDrag(sx, sy, tr.x, tr.y);
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const o = optsRef.current;
    const canvas = o.canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const tr = o.transformRef.current;
    const w = screenToWorld(sx, sy, tr);
    o.cursorWorldRef.current = w;
    if (o.selectionBoxRef.current?.active) {
      o.selectionBoxRef.current.currentX = w.x;
      o.selectionBoxRef.current.currentY = w.y;
      canvas.style.cursor = "crosshair";
      return;
    }
    const rd = o.regionDragRef.current;
    if (rd) {
      const dx = (sx - rd.start.sx) / tr.scale;
      const dy = (sy - rd.start.sy) / tr.scale;
      o.vaultLayoutRefs.canvasRegionOffsetsRef.current.set(rd.canvasId, {
        dx: rd.offset0.dx + dx,
        dy: rd.offset0.dy + dy,
      });
      applyRegionOffsetsToRefs(o.vaultLayoutRefs);
      canvas.style.cursor = "grabbing";
      return;
    }
    if (o.connectModeRef.current) {
      canvas.style.cursor = "crosshair";
      return;
    }
    const drag = o.dragStateRef.current;
    if (drag) updateDragMoved(drag, sx, sy);
    const vd = o.vaultDragRef.current;
    if (vd) {
      const dx = (sx - vd.p0.sx) / tr.scale;
      const dy = (sy - vd.p0.sy) / tr.scale;
      const ngx = vd.g0.x + dx;
      const ngy = vd.g0.y + dy;
      o.vaultGroupPositionsRef.current.set(vd.vaultKey, { x: ngx, y: ngy });
      const parsed = parseMasterVaultKey(vd.vaultKey);
      const vaultIdPart = parsed?.vaultId ?? vd.vaultKey;
      for (const n of useGraphStore.getState().graphData.nodes) {
        if (n.vaultId !== vaultIdPart) continue;
        if (parsed && n.canvasId !== parsed.canvasId) continue;
        const rel = o.nodeRelativePositionsRef.current.get(n.id);
        if (rel) {
          o.nodePositionsRef.current.set(n.id, {
            x: ngx + rel.dx,
            y: ngy + rel.dy,
          });
        }
      }
      return;
    }
    if (drag?.type === "pan") {
      canvas.style.cursor = "grabbing";
      tr.x = drag.startOx + (sx - drag.startMx);
      tr.y = drag.startOy + (sy - drag.startMy);
      return;
    }
    if (drag?.type === "node" && drag.nodeId) {
      canvas.style.cursor = "grabbing";
      const dx = (sx - drag.startMx) / tr.scale;
      const dy = (sy - drag.startMy) / tr.scale;
      const nx = (drag.startNx ?? 0) + dx;
      const ny = (drag.startNy ?? 0) + dy;
      o.nodePositionsRef.current.set(drag.nodeId, { x: nx, y: ny });
      const mem = useGraphStore
        .getState()
        .graphData.nodes.find((x) => x.id === drag.nodeId);
      if (mem?.vaultId) {
        const isMaster = useCanvasStore.getState().isMasterView;
        const gk = vaultGroupKeyForNode(mem.canvasId, mem.vaultId, isMaster);
        const gp = gk ? o.vaultGroupPositionsRef.current.get(gk) : undefined;
        if (gp) {
          o.nodeRelativePositionsRef.current.set(drag.nodeId, {
            dx: nx - gp.x,
            dy: ny - gp.y,
          });
        }
      }
      return;
    }
    const n = nodeAt(
      sx,
      sy,
      tr,
      useGraphStore.getState().graphData.nodes,
      o.nodePositionsRef.current,
      o.collapsedVaultsRef.current,
      getHidden(),
      o.userId,
      o.masterHasBioRef.current,
      masterRegionsForPointer(o)
    );
    o.hoveredNodeIdRef.current = n?.id ?? null;
    let ev: string | null = null;
    let plusHov: string | null = null;
    const liveNodes = useGraphStore.getState().graphData.nodes;
    const np = o.nodePositionsRef.current;
    const collapsedSet = o.collapsedVaultsRef.current;
    const isMaster = useCanvasStore.getState().isMasterView;

    const countAt = (vaultId: string, canvasId?: string) =>
      liveNodes.filter(
        (x) =>
          x.vaultId === vaultId &&
          (canvasId === undefined || x.canvasId === canvasId) &&
          x.nodeKind !== "category" &&
          np.has(x.id)
      ).length;

    if (isMaster) {
      for (const [key, gp] of o.vaultGroupPositionsRef.current) {
        const parsed = parseMasterVaultKey(key);
        if (!parsed) continue;
        const v = o.vaults.find((x) => x.id === parsed.vaultId);
        if (!v?.isActive) continue;
        const positionCount = countAt(v.id, parsed.canvasId);
        if (vaultPlusButtonAt(w.x, w.y, v, gp, positionCount)) {
          plusHov = v.id;
        }
        if (
          emptyVaultAddButtonAt(w.x, w.y, v.id, gp) &&
          !collapsedSet.has(v.id)
        )
          ev = v.id;
      }
    } else {
      for (const v of o.vaults) {
        const gp = o.vaultGroupPositionsRef.current.get(v.id);
        if (!gp) continue;
        const positionCount = countAt(v.id);
        if (vaultPlusButtonAt(w.x, w.y, v, gp, positionCount)) {
          plusHov = v.id;
        }
        if (
          emptyVaultAddButtonAt(w.x, w.y, v.id, gp) &&
          !collapsedSet.has(v.id)
        )
          ev = v.id;
      }
    }
    o.emptyVaultHoverIdRef.current = ev;
    o.vaultPlusHoverIdRef.current = plusHov;
    const gh = vaultHeaderAt(sx, sy, tr, o.vaultGroupPositionsRef.current, o.vaults, (vaultId, canvasId) =>
      countAt(vaultId, canvasId)
    );
    o.gearHoverIdRef.current = gh
      ? parseMasterVaultKey(gh)?.vaultId ?? gh
      : null;

    if (gh) {
      canvas.style.cursor = "pointer";
      return;
    }
    if (
      n &&
      (n.nodeKind === "memory" ||
        n.nodeType === "sticky" ||
        isFileGraphNode(n))
    ) {
      canvas.style.cursor = "pointer";
      return;
    }
    canvas.style.cursor = "default";
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const o = optsRef.current;
    const canvas = o.canvasRef.current;
    if (canvas) canvas.releasePointerCapture(e.pointerId);
    if (e.button !== 0) return;
    const drag = o.dragStateRef.current;
    if (o.selectionBoxRef.current?.active) {
      const sb = o.selectionBoxRef.current;
      o.selectionBoxRef.current = null;
      if (canvas) canvas.style.cursor = "default";
      const minX = Math.min(sb.startX, sb.currentX);
      const maxX = Math.max(sb.startX, sb.currentX);
      const minY = Math.min(sb.startY, sb.currentY);
      const maxY = Math.max(sb.startY, sb.currentY);

      if (maxX - minX > 8 || maxY - minY > 8) {
        const liveNodes = useGraphStore.getState().graphData.nodes;
        const newSel = new Set<string>();
        for (const n of liveNodes) {
          if (n.nodeKind === "master") continue;
          if (!isSelectableGraphNode(n)) continue;
          const p = o.nodePositionsRef.current.get(n.id);
          if (!p) continue;
          if (
            p.x >= minX &&
            p.x <= maxX &&
            p.y >= minY &&
            p.y <= maxY
          ) {
            newSel.add(n.id);
          }
        }
        if (e.shiftKey || o.isShiftHeld.current) {
          o.selectedNodesRef.current.forEach((id) => newSel.add(id));
        }
        o.selectedNodesRef.current = newSel;
        o.setSelectedNodes(new Set(newSel));
      }
      o.vaultDragRef.current = null;
      o.draggingVaultIdRef.current = null;
      o.regionDragRef.current = null;
      o.dragStateRef.current = null;
      o.pointerDownRef.current = null;
      return;
    }

    let skipDebouncedPosAfterCrossCanvasMove = false;
    if (
      drag?.type === "node" &&
      drag.nodeId &&
      useCanvasStore.getState().isMasterView &&
      !isClickGesture(drag)
    ) {
      const gn = useGraphStore.getState().graphData.nodes.find(
        (x) => x.id === drag.nodeId
      );
      const p = o.nodePositionsRef.current.get(drag.nodeId);
      if (gn?.canvasId && p) {
        const target = canvasIdAtWorld(p.x, p.y, masterRegionsForPointer(o));
        if (target && target !== gn.canvasId) {
          skipDebouncedPosAfterCrossCanvasMove = true;
          const storeNode = useGraphStore.getState().nodes.find(
            (x) => x.id === drag.nodeId
          ) as MemoryNode | undefined;
          void (async () => {
            const supabase = createClient();
            const {
              data: { user },
            } = await supabase.auth.getUser();
            if (!user) return;
            const { error } = await supabase
              .from("memory_nodes")
              .update({ canvas_id: target })
              .eq("id", drag.nodeId!)
              .eq("user_id", user.id);
            if (error) {
              toast.error("Could not move memory to another canvas");
              return;
            }
            const tc = useCanvasStore
              .getState()
              .canvases.find((c) => c.id === target);
            useGraphStore.getState().updateNode(drag.nodeId!, {
              canvasId: target,
              canvasEmoji: tc?.emoji ?? undefined,
              canvasName: tc?.name ?? undefined,
            });
            toast.success(
              `"${storeNode?.title ?? "Memory"}" moved to ${tc?.name ?? "canvas"}`
            );
            o.placeMasterLayout();
            void persistAllGraphNodePositionsFromRefs(o.vaultLayoutRefs);
          })();
        }
      }
    }

    o.vaultDragRef.current = null;
    o.draggingVaultIdRef.current = null;
    o.regionDragRef.current = null;
    if (
      !skipDebouncedPosAfterCrossCanvasMove &&
      drag?.type === "node" &&
      drag.nodeId &&
      !isClickGesture(drag)
    ) {
      const pos = o.nodePositionsRef.current.get(drag.nodeId);
      if (pos) schedulePersistNodePositionAfterDrag(drag.nodeId, pos.x, pos.y);
    }
    o.dragStateRef.current = null;
    o.pointerDownRef.current = null;
    if (!drag) return;
    if (!isClickGesture(drag)) return;

    const canvasEl = o.canvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const tr = o.transformRef.current;
    const hitNow = nodeAt(
      sx,
      sy,
      tr,
      useGraphStore.getState().graphData.nodes,
      o.nodePositionsRef.current,
      o.collapsedVaultsRef.current,
      getHidden(),
      o.userId,
      o.masterHasBioRef.current,
      masterRegionsForPointer(o)
    );

    if (hitNow?.nodeKind === "master") {
      if (hitNow.id.startsWith("master-canvas-")) {
        o.setMasterEditorCanvasId(hitNow.id.slice("master-canvas-".length));
      } else {
        o.setMasterEditorCanvasId(null);
      }
      o.setMasterEditorOpen(true);
      o.setPeekNodeId(null);
      return;
    }

    if (hitNow && isSelectableGraphNode(hitNow)) {
      if (o.peekNodeIdRef.current === hitNow.id) {
        o.setPeekNodeId(null);
      } else {
        o.setPeekNodeId(hitNow.id);
        o.selectNode(null);
      }
    }
  }, []);

  const onContextMenu = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const o = optsRef.current;
    const canvas = o.canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const hit = nodeAt(
      sx,
      sy,
      o.transformRef.current,
      useGraphStore.getState().graphData.nodes,
      o.nodePositionsRef.current,
      o.collapsedVaultsRef.current,
      getHidden(),
      o.userId,
      o.masterHasBioRef.current,
      masterRegionsForPointer(o)
    );
    if (hit?.nodeKind === "memory") {
      o.setPeekNodeId(null);
      o.setEdgeContextMenu(null);
      o.setContextMenu({
        x: e.clientX,
        y: e.clientY,
        nodeId: hit.id,
        node: hit,
      });
      return;
    }

    const hitEdge = edgeAt(
      sx,
      sy,
      o.transformRef.current,
      useGraphStore.getState().edges,
      useGraphStore.getState().graphData.nodes,
      o.nodePositionsRef.current,
      o.vaultGroupPositionsRef.current,
      o.collapsedVaultsRef.current,
      getHidden(),
      o.edgeStyleRef.current
    );
    if (hitEdge) {
      o.setContextMenu(null);
      o.setEdgeContextMenu({
        edge: hitEdge,
        x: e.clientX,
        y: e.clientY,
      });
    }
  }, []);

  useEffect(() => {
    if (!canvasReady) return;
    const c = optsRef.current.canvasRef.current;
    if (!c) return;
    const w = (ev: WheelEvent) => {
      ev.preventDefault();
      handleWheel(ev, c.getBoundingClientRect(), optsRef.current.transformRef.current);
    };
    c.addEventListener("wheel", w, { passive: false });
    return () => c.removeEventListener("wheel", w);
  }, [canvasReady]);

  return { onPointerDown, onPointerMove, onPointerUp, onContextMenu };
}
