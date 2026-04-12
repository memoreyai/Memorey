import { screenToWorld } from "./coordinates";
import type { Transform } from "../types/canvas.types";
import type { EdgeStyle } from "../types/canvas.types";
import type { CategoryVault, GraphNode, NodeEdge } from "@/types/memorey";
import {
  NODE_W,
  NODE_H,
  MASTER_W,
  MASTER_H_WITH_BIO,
  MASTER_H_WITHOUT_BIO,
  VAULT_HEADER_H,
  ATTACH_W,
  ATTACH_H,
  STICKY_W,
  STICKY_H,
  FILE_NODE_W,
  FILE_NODE_H,
} from "../constants/dimensions";
import { isFileGraphNode } from "../lib/fileNodeHelpers";
import { buildOrthogonalPath, buildCurvedPath } from "../canvas/edge";
import { useCanvasStore } from "@/store/canvasStore";
import { masterVaultKey, parseMasterVaultKey } from "../layout/masterLayout";
import {
  computeVaultHeaderLayout,
  estimateVaultCountChipWidth,
  getVaultHeaderRects,
  pointInVaultRect,
} from "../canvas/vaultHeaderLayout";
import type { MasterCanvasRegion } from "../layout/types";

function skipGraphNode(node: GraphNode): boolean {
  const k = node.nodeKind;
  if (k === "master" || k === "person" || k === "category") return true;
  if (node.id.startsWith("cat:")) return true;
  return false;
}

function virtualCanvasMasterHit(
  wx: number,
  wy: number,
  reg: MasterCanvasRegion
): boolean {
  const bio = (reg.masterNodeBio ?? "").trim();
  const H = bio ? MASTER_H_WITH_BIO : MASTER_H_WITHOUT_BIO;
  const W = MASTER_W;
  const cx = reg.masterHubX;
  const cy = reg.masterHubY;
  return (
    wx >= cx - W / 2 &&
    wx <= cx + W / 2 &&
    wy >= cy - H / 2 &&
    wy <= cy + H / 2
  );
}

export function nodeAt(
  sx: number,
  sy: number,
  transform: Transform,
  nodes: GraphNode[],
  nodePositions: Map<string, { x: number; y: number }>,
  collapsedVaultIds: Set<string>,
  hiddenVaultIds: Set<string>,
  userId: string | null,
  masterHasBio: boolean,
  masterRegions?: Map<string, MasterCanvasRegion> | null
): GraphNode | null {
  const { x: wx, y: wy } = screenToWorld(sx, sy, transform);
  void masterHasBio;

  for (let i = nodes.length - 1; i >= 0; i--) {
    const node = nodes[i];
    if (!node || skipGraphNode(node)) continue;
    if (node.id.startsWith("att:")) continue;
    if (hiddenVaultIds.has(node.vaultId ?? "")) continue;
    if (collapsedVaultIds.has(node.vaultId ?? "")) continue;

    const pos = nodePositions.get(node.id);
    if (!pos) continue;

    let hw: number;
    let hh: number;
    if (node.nodeKind === "attachment") {
      hw = ATTACH_W / 2;
      hh = ATTACH_H / 2;
    } else if (isFileGraphNode(node)) {
      hw = FILE_NODE_W / 2;
      hh = FILE_NODE_H / 2;
    } else if (node.nodeType === "sticky") {
      hw = STICKY_W / 2;
      hh = STICKY_H / 2;
    } else {
      hw = NODE_W / 2;
      hh = NODE_H / 2;
    }

    if (
      wx >= pos.x - hw &&
      wx <= pos.x + hw &&
      wy >= pos.y - hh &&
      wy <= pos.y + hh
    ) {
      return node;
    }
  }

  if (
    masterRegions &&
    masterRegions.size > 0 &&
    useCanvasStore.getState().isMasterView
  ) {
    for (const [cid, reg] of masterRegions) {
      if (virtualCanvasMasterHit(wx, wy, reg)) {
        return {
          id: `master-canvas-${cid}`,
          nodeKind: "master",
          canvasId: cid,
          category: "",
          title: reg.name,
          value: "",
          color: "",
          val: 0,
        } as GraphNode;
      }
    }
  }

  /** Generous fixed hit area — master is drawn at (0,0); hidden in master graph view. */
  const MASTER_HIT_W = MASTER_W / 2 + 10;
  const MASTER_HIT_H = 50;
  if (
    !useCanvasStore.getState().isMasterView &&
    userId &&
    wx >= -MASTER_HIT_W &&
    wx <= MASTER_HIT_W &&
    wy >= -MASTER_HIT_H &&
    wy <= MASTER_HIT_H
  ) {
    return { id: `master-${userId}`, nodeKind: "master" } as GraphNode;
  }

  return null;
}

/** Matches `drawEdge` path construction (half-width / half-height of card). */
const EDGE_PATH_HW = 100;
const EDGE_PATH_HH = 40;

function quadBezierPoint(
  a: { x: number; y: number },
  c: { x: number; y: number },
  b: { x: number; y: number },
  t: number
): { x: number; y: number } {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}

function worldSegmentsForEdge(
  drawSx: number,
  drawSy: number,
  drawTx: number,
  drawTy: number,
  edgeStyle: EdgeStyle
): Array<{ ax: number; ay: number; bx: number; by: number }> {
  const ortho = edgeStyle.startsWith("orthogonal");
  const pts = ortho
    ? buildOrthogonalPath(
        drawSx,
        drawSy,
        drawTx,
        drawTy,
        EDGE_PATH_HW,
        EDGE_PATH_HH,
        EDGE_PATH_HW,
        EDGE_PATH_HH
      )
    : buildCurvedPath(
        drawSx,
        drawSy,
        drawTx,
        drawTy,
        EDGE_PATH_HW,
        EDGE_PATH_HH,
        EDGE_PATH_HW,
        EDGE_PATH_HH
      );

  const segs: Array<{ ax: number; ay: number; bx: number; by: number }> = [];
  if (ortho) {
    for (let i = 0; i < pts.length - 1; i++) {
      segs.push({
        ax: pts[i].x,
        ay: pts[i].y,
        bx: pts[i + 1].x,
        by: pts[i + 1].y,
      });
    }
    return segs;
  }

  if (pts.length >= 5) {
    const a0 = pts[0];
    const a1 = pts[1];
    const mid = pts[2];
    const b1 = pts[3];
    const b0 = pts[4];
    segs.push({ ax: a0.x, ay: a0.y, bx: a1.x, by: a1.y });
    const steps = 16;
    for (let i = 0; i < steps; i++) {
      const t0 = i / steps;
      const t1 = (i + 1) / steps;
      const p0 = quadBezierPoint(a1, mid, b1, t0);
      const p1 = quadBezierPoint(a1, mid, b1, t1);
      segs.push({ ax: p0.x, ay: p0.y, bx: p1.x, by: p1.y });
    }
    segs.push({ ax: b1.x, ay: b1.y, bx: b0.x, by: b0.y });
  }
  return segs;
}

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/**
 * Returns the edge closest to the click if within threshold (screen ~6px).
 * Endpoint resolution mirrors `useDrawLoop` edge drawing.
 */
export function edgeAt(
  sx: number,
  sy: number,
  transform: Transform,
  edges: NodeEdge[],
  nodes: GraphNode[],
  nodePositions: Map<string, { x: number; y: number }>,
  vaultGroupPositions: Map<string, { x: number; y: number }>,
  collapsedVaults: Set<string>,
  mutedVaultIds: Set<string>,
  edgeStyle: EdgeStyle
): NodeEdge | null {
  const { x: wx, y: wy } = screenToWorld(sx, sy, transform);
  const threshold = 6 / transform.scale;

  let bestEdge: NodeEdge | null = null;
  let bestD = Infinity;
  const isMaster = useCanvasStore.getState().isMasterView;

  const gpVault = (
    vaultId: string,
    canvasId: string | null | undefined
  ) => {
    if (isMaster && canvasId) {
      return (
        vaultGroupPositions.get(masterVaultKey(canvasId, vaultId)) ??
        vaultGroupPositions.get(vaultId)
      );
    }
    return vaultGroupPositions.get(vaultId);
  };

  for (const e of edges) {
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
    ) {
      continue;
    }

    const sv = sourceNode.vaultId ?? "";
    const tv = targetNode.vaultId ?? "";
    if (mutedVaultIds.has(sv) || mutedVaultIds.has(tv)) continue;

    const isCrossVault = sv !== tv;
    if (!isCrossVault && collapsedVaults.has(sv)) continue;

    const sourceCollapsed = isCrossVault && collapsedVaults.has(sv);
    const targetCollapsed = isCrossVault && collapsedVaults.has(tv);
    if (sourceCollapsed && targetCollapsed) continue;

    let drawSx: number;
    let drawSy: number;
    let drawTx: number;
    let drawTy: number;

    if (sourceCollapsed) {
      const gp = gpVault(sv, sourceNode.canvasId);
      if (!gp) continue;
      drawSx = gp.x;
      drawSy = gp.y;
    } else {
      const sp = nodePositions.get(e.sourceNodeId);
      if (!sp) continue;
      drawSx = sp.x;
      drawSy = sp.y;
    }

    if (targetCollapsed) {
      const gp = gpVault(tv, targetNode.canvasId);
      if (!gp) continue;
      drawTx = gp.x;
      drawTy = gp.y;
    } else {
      const tp = nodePositions.get(e.targetNodeId);
      if (!tp) continue;
      drawTx = tp.x;
      drawTy = tp.y;
    }

    const sCanvas = sourceNode.canvasId ?? "";
    const tCanvas = targetNode.canvasId ?? "";
    const isCrossCanvas =
      isMaster && Boolean(sCanvas && tCanvas && sCanvas !== tCanvas);
    const edgeStyleUse = isCrossCanvas ? "orthogonal-dashed" : edgeStyle;

    const segs = worldSegmentsForEdge(
      drawSx,
      drawSy,
      drawTx,
      drawTy,
      edgeStyleUse
    );
    for (const seg of segs) {
      const d = pointToSegmentDist(
        wx,
        wy,
        seg.ax,
        seg.ay,
        seg.bx,
        seg.by
      );
      if (d < bestD) {
        bestD = d;
        bestEdge = e;
      }
    }
  }

  return bestD < threshold ? bestEdge : null;
}

export function vaultHeaderAt(
  sx: number,
  sy: number,
  transform: Transform,
  vaultGroupPositions: Map<string, { x: number; y: number }>,
  vaults: CategoryVault[],
  getPositionedCount: (vaultId: string, canvasId?: string) => number
): string | null {
  const { x: wx, y: wy } = screenToWorld(sx, sy, transform);
  const isMaster = useCanvasStore.getState().isMasterView;

  if (isMaster) {
    for (const [mapKey, gp] of vaultGroupPositions) {
      const parsed = parseMasterVaultKey(mapKey);
      if (!parsed) continue;
      const vault = vaults.find((v) => v.id === parsed.vaultId);
      if (!vault) continue;
      const positionCount = getPositionedCount(
        parsed.vaultId,
        parsed.canvasId
      );
      const includePlus = vault.isActive && !vault.isLocked;
      const hasIcon = Boolean(vault.iconKey?.trim());
      const { headerWidth } = computeVaultHeaderLayout(
        vault.name,
        positionCount,
        includePlus,
        hasIcon
      );
      const hx = gp.x - headerWidth / 2;
      const hy = gp.y - VAULT_HEADER_H / 2;
      if (
        wx >= hx &&
        wx <= hx + headerWidth &&
        wy >= hy &&
        wy <= hy + VAULT_HEADER_H
      ) {
        return mapKey;
      }
    }
    return null;
  }

  for (const vault of vaults) {
    const gp = vaultGroupPositions.get(vault.id);
    if (!gp) continue;
    const positionCount = getPositionedCount(vault.id);
    const includePlus = vault.isActive && !vault.isLocked;
    const hasIcon = Boolean(vault.iconKey?.trim());
    const { headerWidth } = computeVaultHeaderLayout(
      vault.name,
      positionCount,
      includePlus,
      hasIcon
    );
    const hx = gp.x - headerWidth / 2;
    const hy = gp.y - VAULT_HEADER_H / 2;
    if (
      wx >= hx &&
      wx <= hx + headerWidth &&
      wy >= hy &&
      wy <= hy + VAULT_HEADER_H
    ) {
      return vault.id;
    }
  }
  return null;
}

export function collapseButtonAt(
  wx: number,
  wy: number,
  vault: CategoryVault,
  groupPos: { x: number; y: number },
  positionCount: number
): boolean {
  const includePlus = vault.isActive && !vault.isLocked;
  const hasIcon = Boolean(vault.iconKey?.trim());
  const countW = estimateVaultCountChipWidth(positionCount);
  const layout = computeVaultHeaderLayout(
    vault.name,
    positionCount,
    includePlus,
    hasIcon
  );
  const { collapse } = getVaultHeaderRects(
    groupPos,
    countW,
    includePlus,
    layout.headerWidth,
    hasIcon,
    layout
  );
  return pointInVaultRect(wx, wy, collapse);
}

export function gearIconAt(
  wx: number,
  wy: number,
  vault: CategoryVault,
  groupPos: { x: number; y: number },
  positionCount: number
): boolean {
  const includePlus = vault.isActive && !vault.isLocked;
  const hasIcon = Boolean(vault.iconKey?.trim());
  const countW = estimateVaultCountChipWidth(positionCount);
  const layout = computeVaultHeaderLayout(
    vault.name,
    positionCount,
    includePlus,
    hasIcon
  );
  const { gear } = getVaultHeaderRects(
    groupPos,
    countW,
    includePlus,
    layout.headerWidth,
    hasIcon,
    layout
  );
  return pointInVaultRect(wx, wy, gear);
}

export function vaultPlusButtonAt(
  wx: number,
  wy: number,
  vault: CategoryVault,
  groupPos: { x: number; y: number },
  positionCount: number
): boolean {
  const includePlus = vault.isActive && !vault.isLocked;
  if (!includePlus) return false;
  const hasIcon = Boolean(vault.iconKey?.trim());
  const countW = estimateVaultCountChipWidth(positionCount);
  const layout = computeVaultHeaderLayout(
    vault.name,
    positionCount,
    true,
    hasIcon
  );
  const { plus } = getVaultHeaderRects(
    groupPos,
    countW,
    true,
    layout.headerWidth,
    hasIcon,
    layout
  );
  return pointInVaultRect(wx, wy, plus);
}

export function emptyVaultAddButtonAt(
  wx: number,
  wy: number,
  _vaultId: string,
  groupPos: { x: number; y: number }
): boolean {
  const btnW = 120;
  const btnH = 28;
  const btnX = groupPos.x - btnW / 2;
  const btnY = groupPos.y + VAULT_HEADER_H / 2 + 14;
  return wx >= btnX && wx <= btnX + btnW && wy >= btnY && wy <= btnY + btnH;
}

export function plusZoneAt(
  wx: number,
  wy: number,
  nodePos: { x: number; y: number }
): boolean {
  const left = nodePos.x + NODE_W / 2 - 28;
  const top = nodePos.y - NODE_H / 2 + 8;
  return wx >= left && wx <= left + 20 && wy >= top && wy <= top + 20;
}
