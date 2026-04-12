"use client";

import { useEffect, useRef, type MutableRefObject, type RefObject } from "react";
import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import type { Transform } from "../types/canvas.types";
import type { CanvasDims } from "../types/canvas.types";
import type { GraphNode, MemoryNode } from "@/types/memorey";
import type { EdgeStyle } from "../types/canvas.types";
import {
  isDarkTheme,
  vaultColorForNode,
  CANVAS_MAIN_BG_DARK,
  CANVAS_MAIN_BG_LIGHT,
} from "../constants/colors";
import { resolveVaultDefaultCard } from "@/lib/vaultThemeResolve";
import { useCanvasStore } from "@/store/canvasStore";
import {
  drawGrid,
  drawEdge,
  drawMasterCanvasRegions,
  computeDynamicMasterCanvasRegions,
  drawMemoryNode,
  drawStickyNote,
  drawMasterNode,
  drawVirtualCanvasMaster,
  drawVaultGroupBackground,
  drawVaultGroupHeader,
  getVaultGroupBounds,
  drawMasterToVaultLines,
  drawMasterToVaultLinesFromHub,
  drawConnectPreview,
  drawMinimap,
  drawFileNode,
} from "../canvas";
import { isFileGraphNode } from "../lib/fileNodeHelpers";
import {
  MINIMAP_W,
  MINIMAP_H,
  MINIMAP_RIGHT,
  MINIMAP_BOTTOM,
  NODE_H,
  NODE_W,
  NODE_R,
  STICKY_W,
  STICKY_H,
  STICKY_R,
  FILE_NODE_H,
  FILE_NODE_W,
  FILE_NODE_R,
} from "../constants/dimensions";
import type { MasterProfile } from "../types/graph.types";
import type { VaultLayoutRefs } from "../layout/types";
import { masterVaultKey, parseMasterVaultKey } from "../layout/masterLayout";

export function useDrawLoop(opts: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  transformRef: MutableRefObject<Transform>;
  dimsRef: MutableRefObject<CanvasDims>;
  frameCountRef: MutableRefObject<number>;
  vaultLayoutRefs: VaultLayoutRefs;
  edgeStyleRef: MutableRefObject<EdgeStyle>;
  edgeColorRef: MutableRefObject<string | null>;
  masterLineStyleRef: MutableRefObject<string>;
  masterLineColorRef: MutableRefObject<string | null>;
  masterHasBioRef: MutableRefObject<boolean>;
  collapsedVaultsRef: MutableRefObject<Set<string>>;
  hoveredNodeIdRef: MutableRefObject<string | null>;
  selectedNodeIdRef: MutableRefObject<string | null>;
  selectedNodesRef: MutableRefObject<Set<string>>;
  peekNodeIdRef: MutableRefObject<string | null>;
  connectModeRef: MutableRefObject<boolean>;
  connectSourceRef: MutableRefObject<GraphNode | null>;
  cursorWorldRef: MutableRefObject<{ x: number; y: number } | null>;
  selectionBoxRef: MutableRefObject<import("../types/canvas.types").SelectionBox | null>;
  userIdRef: MutableRefObject<string | null>;
  profileRef: MutableRefObject<MasterProfile | null>;
  avatarImageRef: MutableRefObject<CanvasImageSource | null>;
  quickCreateOpenRef: MutableRefObject<boolean>;
  emptyVaultHoverIdRef: MutableRefObject<string | null>;
  gearHoverIdRef: MutableRefObject<string | null>;
  vaultPlusHoverIdRef: MutableRefObject<string | null>;
  draggingVaultIdRef: MutableRefObject<string | null>;
  applyLayoutAnimation: () => void;
  applyFitAnimation: () => void;
}): {
  minimapBoundsRef: MutableRefObject<{ x: number; y: number; w: number; h: number }>;
} {
  const minimapBoundsRef = useRef({ x: 0, y: 0, w: MINIMAP_W, h: MINIMAP_H });
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const opts = optsRef.current;
      const canvas = opts.canvasRef.current;
      if (!canvas) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        raf = requestAnimationFrame(tick);
        return;
      }

      opts.applyLayoutAnimation();
      opts.applyFitAnimation();
      opts.frameCountRef.current += 1;
      const frame = opts.frameCountRef.current;
      const { W, H } = opts.dimsRef.current;
      const tr = opts.transformRef.current;
      const dark = isDarkTheme();

      const graph = useGraphStore.getState();
      const nodes = graph.graphData.nodes;
      const edgesStore = graph.edges;
      const muted = graph.mutedVaultIds;
      const highlights = graph.searchHighlightIds;
      const semantic = graph.semanticSearchActive;
      const searchActive = highlights.size > 0 || semantic;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = dark ? CANVAS_MAIN_BG_DARK : CANVAS_MAIN_BG_LIGHT;
      ctx.fillRect(0, 0, W, H);
      drawGrid(ctx, W, H, tr.x, tr.y, tr.scale, dark);

      ctx.save();
      ctx.translate(tr.x, tr.y);
      ctx.scale(tr.scale, tr.scale);

      const isMasterView = useCanvasStore.getState().isMasterView;
      const vaults = useVaultStore.getState().vaults;
      const vg = opts.vaultLayoutRefs.vaultGroupPositionsRef.current;
      const np = opts.vaultLayoutRefs.nodePositionsRef.current;
      const edgeStyle = opts.edgeStyleRef.current;
      const edgeColorOverride = opts.edgeColorRef.current;
      const masterLineStyle = opts.masterLineStyleRef.current;
      const masterLineColor = opts.masterLineColorRef.current;
      const masterHasBio = opts.masterHasBioRef.current;

      const collapsedSet = opts.collapsedVaultsRef.current;
      const staticRegions = opts.vaultLayoutRefs.canvasRegionsRef.current;
      const regions =
        isMasterView && staticRegions.size > 0
          ? computeDynamicMasterCanvasRegions(staticRegions, nodes, np)
          : staticRegions;
      if (isMasterView && regions.size > 0) {
        drawMasterCanvasRegions(ctx, regions);
      }
      if (isMasterView) {
        for (const [key, gp] of vg) {
          const parsed = parseMasterVaultKey(key);
          if (!parsed) continue;
          const v = vaults.find((x) => x.id === parsed.vaultId);
          if (!v?.isActive) continue;
          const vaultNodes = nodes.filter(
            (n) =>
              n.vaultId === v.id &&
              n.canvasId === parsed.canvasId &&
              n.nodeKind !== "category"
          );
          const isCollapsed = collapsedSet.has(v.id);
          const bounds = getVaultGroupBounds(gp, vaultNodes, np, isCollapsed, v);
          drawVaultGroupBackground(ctx, v, gp, bounds, { isCollapsed });
        }
      } else {
        for (const v of vaults) {
          if (!v.isActive) continue;
          const gp = vg.get(v.id);
          if (!gp) continue;
          const vaultNodes = nodes.filter(
            (n) => n.vaultId === v.id && n.nodeKind !== "category"
          );
          const isCollapsed = collapsedSet.has(v.id);
          const bounds = getVaultGroupBounds(gp, vaultNodes, np, isCollapsed, v);
          drawVaultGroupBackground(ctx, v, gp, bounds, { isCollapsed });
        }
      }

      if (!isMasterView) {
        drawMasterToVaultLines(
          ctx,
          vaults,
          vg,
          frame,
          edgeStyle,
          edgeColorOverride,
          masterLineStyle,
          masterLineColor,
          masterHasBio
        );
      } else if (isMasterView && staticRegions.size > 0) {
        for (const [, reg] of regions) {
          const hubBio = Boolean((reg.masterNodeBio ?? "").trim());
          drawMasterToVaultLinesFromHub(
            ctx,
            reg.masterHubX,
            reg.masterHubY,
            reg.canvasId,
            vaults,
            vg,
            frame,
            masterLineStyle,
            masterLineColor,
            hubBio
          );
        }
      }

      const gpForVaultCollapsed = (
        vaultId: string,
        canvasId: string | null | undefined
      ) => {
        if (isMasterView && canvasId) {
          return (
            vg.get(masterVaultKey(canvasId, vaultId)) ?? vg.get(vaultId)
          );
        }
        return vg.get(vaultId);
      };

      for (const e of edgesStore) {
        const sourceNode = nodes.find((n) => n.id === e.sourceNodeId);
        const targetNode = nodes.find((n) => n.id === e.targetNodeId);
        if (!sourceNode || !targetNode) continue;
        if (
          sourceNode.nodeKind === "person" ||
          sourceNode.nodeKind === "category" ||
          targetNode.nodeKind === "person" ||
          targetNode.nodeKind === "category" ||
          sourceNode.id.startsWith("cat:") ||
          targetNode.id.startsWith("cat:")
        )
          continue;

        const sv = sourceNode.vaultId ?? "";
        const tv = targetNode.vaultId ?? "";
        if (muted.has(sv) || muted.has(tv)) continue;

        const isCrossVault = sv !== tv;
        if (!isCrossVault && collapsedSet.has(sv)) continue;

        const sourceCollapsed = isCrossVault && collapsedSet.has(sv);
        const targetCollapsed = isCrossVault && collapsedSet.has(tv);
        if (sourceCollapsed && targetCollapsed) continue;

        let drawSx: number;
        let drawSy: number;
        let drawTx: number;
        let drawTy: number;

        if (sourceCollapsed) {
          const gp = gpForVaultCollapsed(sv, sourceNode.canvasId);
          if (!gp) continue;
          drawSx = gp.x;
          drawSy = gp.y;
        } else {
          const sp = np.get(e.sourceNodeId);
          if (!sp) continue;
          drawSx = sp.x;
          drawSy = sp.y;
        }

        if (targetCollapsed) {
          const gp = gpForVaultCollapsed(tv, targetNode.canvasId);
          if (!gp) continue;
          drawTx = gp.x;
          drawTy = gp.y;
        } else {
          const tp = np.get(e.targetNodeId);
          if (!tp) continue;
          drawTx = tp.x;
          drawTy = tp.y;
        }

        const isDimmed = sourceCollapsed || targetCollapsed;
        const isHighlighted =
          opts.hoveredNodeIdRef.current === e.sourceNodeId ||
          opts.hoveredNodeIdRef.current === e.targetNodeId;
        const col = vaultColorForNode(sourceNode);
        const resolvedEdgeColor =
          e.color ??
          edgeColorOverride ??
          undefined;
        const sCanvas = sourceNode.canvasId ?? "";
        const tCanvas = targetNode.canvasId ?? "";
        const isCrossCanvas =
          isMasterView && Boolean(sCanvas && tCanvas && sCanvas !== tCanvas);
        const edgeStyleUse = isCrossCanvas ? "orthogonal-dashed" : edgeStyle;
        const overrideUse = isCrossCanvas ? "#64748B" : resolvedEdgeColor;
        drawEdge(
          ctx,
          drawSx,
          drawSy,
          drawTx,
          drawTy,
          e.strength,
          edgeStyleUse,
          frame,
          col,
          isHighlighted,
          isDimmed,
          overrideUse,
          isCrossCanvas
        );
      }

      if (isMasterView) {
        for (const [key, gp] of vg) {
          const parsed = parseMasterVaultKey(key);
          if (!parsed) continue;
          const v = vaults.find((x) => x.id === parsed.vaultId);
          if (!v?.isActive) continue;
          const vaultNodes = nodes.filter(
            (n) =>
              n.vaultId === v.id &&
              n.canvasId === parsed.canvasId &&
              n.nodeKind !== "category"
          );
          drawVaultGroupHeader(ctx, v, gp, {
            vaultNodes,
            isCollapsed: collapsedSet.has(v.id),
            isDragging: opts.draggingVaultIdRef.current === v.id,
            nodePositions: np,
            emptyVaultHoverId: opts.emptyVaultHoverIdRef.current,
            gearHoverId: opts.gearHoverIdRef.current,
            vaultPlusHoverId: opts.vaultPlusHoverIdRef.current,
            frameCount: frame,
          });
        }
      } else {
        for (const v of vaults) {
          if (!v.isActive) continue;
          const gp = vg.get(v.id);
          if (!gp) continue;
          const vaultNodes = nodes.filter(
            (n) => n.vaultId === v.id && n.nodeKind !== "category"
          );
          drawVaultGroupHeader(ctx, v, gp, {
            vaultNodes,
            isCollapsed: collapsedSet.has(v.id),
            isDragging: opts.draggingVaultIdRef.current === v.id,
            nodePositions: np,
            emptyVaultHoverId: opts.emptyVaultHoverIdRef.current,
            gearHoverId: opts.gearHoverIdRef.current,
            vaultPlusHoverId: opts.vaultPlusHoverIdRef.current,
            frameCount: frame,
          });
        }
      }

      const uid = opts.userIdRef.current;
      if (uid && !isMasterView) {
        drawMasterNode(ctx, 0, 0, {
          isHovered: opts.hoveredNodeIdRef.current === `master-${uid}`,
          profile: opts.profileRef.current,
          avatarImage: opts.avatarImageRef.current,
          frameCount: frame,
        });
      }
      if (isMasterView && regions.size > 0) {
        for (const [, reg] of regions) {
          drawVirtualCanvasMaster(ctx, reg, {
            isHovered:
              opts.hoveredNodeIdRef.current === `master-canvas-${reg.canvasId}`,
            frameCount: frame,
          });
        }
      }

      for (const node of nodes) {
        if (node.nodeKind === "person" || node.nodeKind === "category") continue;
        if (node.id.startsWith("cat:")) continue;
        const pos = np.get(node.id);
        if (!pos) continue;
        if (muted.has(node.vaultId ?? "")) continue;
        if (collapsedSet.has(node.vaultId ?? "")) continue;

        const locked =
          vaults.find((x) => x.id === node.vaultId)?.isLocked === true;
        const unlocked =
          typeof sessionStorage !== "undefined" &&
          node.vaultId &&
          sessionStorage.getItem(`vault-unlocked-${node.vaultId}`) === "1";
        const vaultDim = locked && !unlocked;

        let hideSearch = false;
        if (searchActive && highlights.size > 0 && node.nodeKind === "memory") {
          hideSearch = !highlights.has(node.id);
        }

        const isHovered = opts.hoveredNodeIdRef.current === node.id;
        const isSel =
          opts.selectedNodeIdRef.current === node.id ||
          opts.selectedNodesRef.current.has(node.id);
        const vaultForNode = vaults.find((x) => x.id === node.vaultId);
        const vaultCard =
          vaultForNode != null
            ? resolveVaultDefaultCard(vaultForNode, dark)
            : null;
        const resolvedAccent =
          node.customAccentColor ??
          vaultCard?.accent ??
          vaultForNode?.color ??
          vaultColorForNode(node);
        const resolvedBg =
          node.customBgColor ?? vaultCard?.bg ?? undefined;
        const resolvedText =
          node.customTextColor ?? vaultCard?.text ?? undefined;
        const nodeForDraw: GraphNode = {
          ...node,
          customBgColor: resolvedBg ?? node.customBgColor,
          customTextColor: resolvedText ?? node.customTextColor,
        };
        const accent = resolvedAccent;
        const dim = Boolean(vaultDim) || hideSearch;

        if (isFileGraphNode(node)) {
          drawFileNode(ctx, node as unknown as MemoryNode, pos.x, pos.y, {
            isHovered,
            isSelected: isSel,
            isHighlighted: highlights.has(node.id),
            isMuted: dim,
            accentColor: accent,
            fillColor: resolvedBg,
            frameCount: frame,
            requestRedraw: () => {},
          });
          if (opts.selectedNodesRef.current.has(node.id)) {
            const hw = FILE_NODE_W / 2;
            const hh = FILE_NODE_H / 2;
            ctx.save();
            ctx.strokeStyle = "rgba(255,102,0,0.75)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.roundRect(
              pos.x - hw - 3,
              pos.y - hh - 3,
              hw * 2 + 6,
              hh * 2 + 6,
              FILE_NODE_R + 3
            );
            ctx.stroke();
            ctx.restore();
          }
          if (vaultDim && node.nodeKind === "memory") {
            ctx.font = "14px system-ui";
            ctx.fillText("●", pos.x - 8, pos.y - FILE_NODE_H / 2 - 4);
          }
        } else if (node.nodeType === "sticky") {
          if (dim) ctx.globalAlpha = 0.32;
          drawStickyNote(ctx, node, pos.x, pos.y, isHovered, isSel);
          if (opts.selectedNodesRef.current.has(node.id)) {
            ctx.save();
            ctx.strokeStyle = "rgba(255,102,0,0.7)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.roundRect(
              pos.x - STICKY_W / 2 - 3,
              pos.y - STICKY_H / 2 - 3,
              STICKY_W + 6,
              STICKY_H + 6,
              STICKY_R + 3
            );
            ctx.stroke();
            ctx.restore();
          }
          if (dim) ctx.globalAlpha = 1;
        } else {
          const peekId = opts.peekNodeIdRef.current;
          const isPeek = peekId === node.id;
          drawMemoryNode(ctx, nodeForDraw, pos.x, pos.y, {
            isHovered,
            isSelected: isSel || isPeek,
            isHighlighted: highlights.has(node.id),
            isMuted: dim,
            accentColor: accent,
            inConnectMode: Boolean(opts.connectModeRef.current),
            crossVaultLabel: undefined,
            frameCount: frame,
            showOgImagePreview: isPeek,
            requestRedraw: () => {
              opts.frameCountRef.current += 1;
            },
          });
          if (opts.selectedNodesRef.current.has(node.id)) {
            ctx.save();
            ctx.strokeStyle = "rgba(255,102,0,0.7)";
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            ctx.beginPath();
            ctx.roundRect(
              pos.x - NODE_W / 2 - 3,
              pos.y - NODE_H / 2 - 3,
              NODE_W + 6,
              NODE_H + 6,
              NODE_R + 3
            );
            ctx.stroke();
            ctx.restore();
          }
          if (vaultDim && node.nodeKind === "memory") {
            ctx.font = "14px system-ui";
            ctx.fillText("●", pos.x - 8, pos.y - NODE_H / 2 - 4);
          }
        }
      }

      const sb = opts.selectionBoxRef.current;
      if (sb?.active) {
        const bx = Math.min(sb.startX, sb.currentX);
        const by = Math.min(sb.startY, sb.currentY);
        const bw = Math.abs(sb.currentX - sb.startX);
        const bh = Math.abs(sb.currentY - sb.startY);
        const rr = 2 / tr.scale;
        ctx.save();
        ctx.fillStyle = "rgba(255,102,0,0.06)";
        ctx.strokeStyle = "rgba(255,102,0,0.55)";
        ctx.lineWidth = 1 / tr.scale;
        ctx.setLineDash([4 / tr.scale, 3 / tr.scale]);
        ctx.beginPath();
        ctx.roundRect(bx, by, bw, bh, rr);
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      if (
        opts.connectModeRef.current &&
        opts.connectSourceRef.current &&
        opts.cursorWorldRef.current
      ) {
        drawConnectPreview(
          ctx,
          opts.connectSourceRef.current,
          opts.cursorWorldRef.current,
          np,
          nodes,
          frame
        );
      }

      ctx.restore();

      const mmX = W - MINIMAP_W - MINIMAP_RIGHT;
      const mmY = H - MINIMAP_H - MINIMAP_BOTTOM;
      minimapBoundsRef.current = { x: mmX, y: mmY, w: MINIMAP_W, h: MINIMAP_H };
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, mmX, mmY);
      drawMinimap(ctx, MINIMAP_W, MINIMAP_H, {
        nodePositions: np,
        nodes,
        edges: edgesStore,
        vaults,
        vaultGroupPositions: vg,
        collapsedVaultIds: new Set(opts.collapsedVaultsRef.current),
        mutedVaultIds: new Set(muted),
        transform: tr,
        canvasDims: { W, H },
        selectedNodeIds: new Set([
          ...(opts.selectedNodeIdRef.current
            ? [opts.selectedNodeIdRef.current]
            : []),
          ...opts.selectedNodesRef.current,
        ]),
        isDark: dark,
        userId: uid,
        edgeStyle: opts.edgeStyleRef.current,
        edgeColorOverride: opts.edgeColorRef.current,
        frameCount: frame,
      });
      ctx.restore();
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return { minimapBoundsRef };
}
