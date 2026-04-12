import type { GraphNode, NodeEdge, CategoryVault } from "@/types/memorey";
import { FILE_NODE_H, NODE_H, VAULT_HEADER_H } from "../constants/dimensions";
import { graphNodeCardWorldDimensions } from "../lib/graphNodeDimensions";
import type { CanvasMeta, MasterCanvasRegion } from "./types";

export type StructuredLayoutResult = {
  vaultPositions: Map<string, { x: number; y: number }>;
  nodePositions: Map<string, { x: number; y: number }>;
  nodeRelative: Map<string, { dx: number; dy: number }>;
};

function masterVaultKey(canvasId: string, vaultId: string): string {
  return `${canvasId}::${vaultId}`;
}

/** Gap between canvas region boxes in master view (matches spec `CANVAS_GAP`). */
export const CANVAS_REGION_GAP = 400;

export const CARD_WIDTH = 220;
export const CARD_HEIGHT = 120;
export const MASTER_NODE_SIZE = 80;
/** Vertical gap between stacked node cards under one vault (edge-to-edge). */
export const VERTICAL_GAP = 20;
/**
 * Horizontal gap between **card edges** when two linked nodes sit on one row
 * (room to read the edge between them).
 */
export const LINKED_NODE_HORIZONTAL_GAP = 56;
/**
 * Extra horizontal space between vault columns (pitch is {@link CARD_WIDTH} + this).
 * Kept modest so vaults sit closer without cards overlapping.
 */
export const HORIZONTAL_GAP = 56;
/**
 * Gap from the bottom of the master node to the **top** of the vault header pill.
 */
const MASTER_TO_VAULT_PILL_GAP = 16;
/**
 * Gap from the bottom of the vault pill to the top of the first node card
 * (clear separation so cards never overlap the pill).
 */
const GAP_PILL_TO_FIRST_NODE = 12;
const COLLISION_MIN_GAP = 20;
const MAX_COLLISION_ITERS = 12;

/**
 * Legacy composite spacing (master → vault pill → first card). Kept so stale
 * bundles or partial HMR cannot throw ReferenceError at runtime.
 */
export const MASTER_TO_MEMORY_STACK_GAP =
  MASTER_TO_VAULT_PILL_GAP + VAULT_HEADER_H + GAP_PILL_TO_FIRST_NODE;

export type CanvasLayoutStats = {
  numVaults: number;
  maxNodesInAnyVault: number;
};

function layoutable(n: GraphNode): boolean {
  if (!n?.vaultId) return false;
  if (n.nodeKind === "master" || n.nodeKind === "person") return false;
  if (n.nodeKind === "category" || n.id.startsWith("cat:")) return false;
  if (!n.canvasId) return false;
  return true;
}

export function statsForCanvas(
  canvasId: string,
  allNodes: GraphNode[],
  extraEmptyVaultIds?: Set<string>
): CanvasLayoutStats {
  const list = allNodes.filter(
    (n) => layoutable(n) && n.canvasId === canvasId
  );
  const byV = new Map<string, number>();
  for (const n of list) {
    const v = n.vaultId!;
    byV.set(v, (byV.get(v) ?? 0) + 1);
  }
  if (extraEmptyVaultIds) {
    for (const vid of extraEmptyVaultIds) {
      if (!byV.has(vid)) byV.set(vid, 0);
    }
  }
  let maxN = 0;
  for (const c of byV.values()) maxN = Math.max(maxN, c);
  return {
    numVaults: byV.size,
    maxNodesInAnyVault: Math.max(maxN, 1),
  };
}

function hasCrossVaultEdge(
  nodeId: string,
  nodesInCanvas: GraphNode[],
  edges: NodeEdge[],
  canvasId: string
): boolean {
  const inCanvas = new Set(nodesInCanvas.map((n) => n.id));
  for (const e of edges) {
    if (!inCanvas.has(e.sourceNodeId) || !inCanvas.has(e.targetNodeId))
      continue;
    const a = nodesInCanvas.find((n) => n.id === e.sourceNodeId);
    const b = nodesInCanvas.find((n) => n.id === e.targetNodeId);
    if (!a || !b || !layoutable(a) || !layoutable(b)) continue;
    if (a.canvasId !== canvasId || b.canvasId !== canvasId) continue;
    if (a.vaultId === b.vaultId) continue;
    if (e.sourceNodeId === nodeId || e.targetNodeId === nodeId) return true;
  }
  return false;
}

/** Edges whose endpoints are both in this vault (same canvas). */
function edgesWithinVaultSubset(
  vaultNodes: GraphNode[],
  allEdges: NodeEdge[],
  canvasId: string
): NodeEdge[] {
  const ids = new Set(vaultNodes.map((n) => n.id));
  return allEdges.filter((e) => {
    if (!ids.has(e.sourceNodeId) || !ids.has(e.targetNodeId)) return false;
    if (e.sourceNodeId === e.targetNodeId) return false;
    const a = vaultNodes.find((n) => n.id === e.sourceNodeId);
    const b = vaultNodes.find((n) => n.id === e.targetNodeId);
    return (
      !!a &&
      !!b &&
      a.vaultId === b.vaultId &&
      a.canvasId === canvasId &&
      b.canvasId === canvasId
    );
  });
}

function parseCreatedAtMs(
  id: string,
  createdAtByNodeId: Map<string, string>
): number {
  const s = createdAtByNodeId.get(id);
  if (!s) return 0;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function connectedComponentsInVault(
  vaultNodes: GraphNode[],
  internalEdges: NodeEdge[],
  createdAtByNodeId: Map<string, string>,
  userOrderHint?: Map<string, number>
): GraphNode[][] {
  const idToNode = new Map(vaultNodes.map((n) => [n.id, n]));
  const ids = new Set(vaultNodes.map((n) => n.id));
  const adj = new Map<string, string[]>();
  for (const id of ids) adj.set(id, []);
  for (const e of internalEdges) {
    adj.get(e.sourceNodeId)!.push(e.targetNodeId);
    adj.get(e.targetNodeId)!.push(e.sourceNodeId);
  }
  for (const [, v] of adj) {
    v.sort((a, b) => {
      const ta = parseCreatedAtMs(a, createdAtByNodeId);
      const tb = parseCreatedAtMs(b, createdAtByNodeId);
      if (ta !== tb) return tb - ta;
      return a.localeCompare(b);
    });
  }

  const seen = new Set<string>();
  const comps: GraphNode[][] = [];
  const sortedStarts = [...ids].sort((a, b) => {
    const ta = parseCreatedAtMs(a, createdAtByNodeId);
    const tb = parseCreatedAtMs(b, createdAtByNodeId);
    if (ta !== tb) return tb - ta;
    return a.localeCompare(b);
  });
  for (const start of sortedStarts) {
    if (seen.has(start)) continue;
    const comp: GraphNode[] = [];
    const stack = [start];
    seen.add(start);
    while (stack.length) {
      const id = stack.pop()!;
      comp.push(idToNode.get(id)!);
      for (const nb of adj.get(id) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    comp.sort((a, b) => {
      const ta = parseCreatedAtMs(a.id, createdAtByNodeId);
      const tb = parseCreatedAtMs(b.id, createdAtByNodeId);
      if (ta !== tb) return tb - ta;
      return a.id.localeCompare(b.id);
    });
    comps.push(comp);
  }
  comps.sort((a, b) => {
    if (userOrderHint && userOrderHint.size > 0) {
      const ka = Math.min(...a.map((n) => userOrderHint.get(n.id) ?? 1e9));
      const kb = Math.min(...b.map((n) => userOrderHint.get(n.id) ?? 1e9));
      if (ka !== kb) return ka - kb;
    }
    const maxA = Math.max(
      ...a.map((n) => parseCreatedAtMs(n.id, createdAtByNodeId))
    );
    const maxB = Math.max(
      ...b.map((n) => parseCreatedAtMs(n.id, createdAtByNodeId))
    );
    if (maxA !== maxB) return maxB - maxA;
    return a[0].id.localeCompare(b[0].id);
  });
  return comps;
}

/** Linked row: respect user order hint when full; else DFS from newest with newest-first neighbor order. */
function orderNodesForLinkedRow(
  comp: GraphNode[],
  internalEdges: NodeEdge[],
  createdAtByNodeId: Map<string, string>,
  userOrderHint?: Map<string, number>
): GraphNode[] {
  const ids = new Set(comp.map((n) => n.id));
  const hasAllHints =
    userOrderHint &&
    comp.length > 0 &&
    comp.every((n) => userOrderHint!.has(n.id));
  if (hasAllHints) {
    return [...comp].sort(
      (a, b) => userOrderHint!.get(a.id)! - userOrderHint!.get(b.id)!
    );
  }

  const adj = new Map<string, string[]>();
  for (const n of comp) adj.set(n.id, []);
  for (const e of internalEdges) {
    if (!ids.has(e.sourceNodeId) || !ids.has(e.targetNodeId)) continue;
    adj.get(e.sourceNodeId)!.push(e.targetNodeId);
    adj.get(e.targetNodeId)!.push(e.sourceNodeId);
  }
  for (const [, v] of adj) {
    v.sort((a, b) => {
      const ha = userOrderHint?.get(a);
      const hb = userOrderHint?.get(b);
      if (ha != null && hb != null && ha !== hb) return ha - hb;
      if (ha != null && hb == null) return -1;
      if (ha == null && hb != null) return 1;
      const ta = parseCreatedAtMs(a, createdAtByNodeId);
      const tb = parseCreatedAtMs(b, createdAtByNodeId);
      if (ta !== tb) return tb - ta;
      return a.localeCompare(b);
    });
  }

  const startNode = [...comp].sort((a, b) => {
    const ha = userOrderHint?.get(a.id);
    const hb = userOrderHint?.get(b.id);
    if (ha != null && hb != null && ha !== hb) return ha - hb;
    if (ha != null && hb == null) return -1;
    if (ha == null && hb != null) return 1;
    const ta = parseCreatedAtMs(a.id, createdAtByNodeId);
    const tb = parseCreatedAtMs(b.id, createdAtByNodeId);
    if (ta !== tb) return tb - ta;
    return a.id.localeCompare(b.id);
  })[0]!;
  const start = startNode.id;
  const out: GraphNode[] = [];
  const visited = new Set<string>();
  function dfs(id: string) {
    visited.add(id);
    out.push(comp.find((n) => n.id === id)!);
    for (const nb of adj.get(id) ?? []) {
      if (!visited.has(nb)) dfs(nb);
    }
  }
  dfs(start);
  for (const n of [...comp].sort((a, b) => {
    const ha = userOrderHint?.get(a.id);
    const hb = userOrderHint?.get(b.id);
    if (ha != null && hb != null && ha !== hb) return ha - hb;
    if (ha != null && hb == null) return -1;
    if (ha == null && hb != null) return 1;
    const ta = parseCreatedAtMs(a.id, createdAtByNodeId);
    const tb = parseCreatedAtMs(b.id, createdAtByNodeId);
    if (ta !== tb) return tb - ta;
    return a.id.localeCompare(b.id);
  })) {
    if (!visited.has(n.id)) out.push(n);
  }
  return out;
}

type RowSpec = {
  nodes: GraphNode[];
  width: number;
  height: number;
};

function buildRowsForVault(
  vaultNodes: GraphNode[],
  allEdges: NodeEdge[],
  canvasId: string,
  createdAtByNodeId: Map<string, string>,
  userOrderHint?: Map<string, number>
): RowSpec[] {
  if (vaultNodes.length === 0) return [];
  const internalEdges = edgesWithinVaultSubset(vaultNodes, allEdges, canvasId);
  const comps = connectedComponentsInVault(
    vaultNodes,
    internalEdges,
    createdAtByNodeId,
    userOrderHint
  );
  const rows: RowSpec[] = [];
  for (const comp of comps) {
    if (comp.length === 1) {
      const n = comp[0];
      const dim = graphNodeCardWorldDimensions(n);
      rows.push({ nodes: [n], width: dim.w, height: dim.h });
    } else {
      const ordered = orderNodesForLinkedRow(
        comp,
        internalEdges,
        createdAtByNodeId,
        userOrderHint
      );
      let totalW = 0;
      let maxH = 0;
      for (let i = 0; i < ordered.length; i++) {
        const d = graphNodeCardWorldDimensions(ordered[i]);
        totalW += d.w + (i > 0 ? LINKED_NODE_HORIZONTAL_GAP : 0);
        maxH = Math.max(maxH, d.h);
      }
      rows.push({ nodes: ordered, width: totalW, height: maxH });
    }
  }
  return rows;
}

function bboxForNode(
  node: GraphNode,
  x: number,
  y: number
): { left: number; right: number; top: number; bottom: number } {
  const { w, h } = graphNodeCardWorldDimensions(node);
  return {
    left: x - w / 2,
    right: x + w / 2,
    top: y - h / 2,
    bottom: y + h / 2,
  };
}

/** Alias for {@link bboxForNode} — avoids ReferenceError in partial HMR bundles. */
export const bbox = bboxForNode;

function overlaps(
  a: { left: number; right: number; top: number; bottom: number },
  b: { left: number; right: number; top: number; bottom: number },
  gap: number
): boolean {
  return !(
    a.right + gap <= b.left ||
    b.right + gap <= a.left ||
    a.bottom + gap <= b.top ||
    b.bottom + gap <= a.top
  );
}

/**
 * Master centered in the region; vaults in one horizontal row below the master;
 * under each vault, memory nodes stack in a vertical column with even spacing.
 */
export function computeStructuredCanvasLayout(
  canvasIdFilter: string | null,
  centerX: number,
  centerY: number,
  allNodes: GraphNode[],
  edges: NodeEdge[],
  vaults: CategoryVault[],
  useMasterVaultKeys: boolean,
  createdAtByNodeId: Map<string, string> = new Map(),
  extraEmptyVaultIds?: Set<string>,
  userOrderHint?: Map<string, number>
): StructuredLayoutResult {
  const vaultPositions = new Map<string, { x: number; y: number }>();
  const nodePositions = new Map<string, { x: number; y: number }>();
  const nodeRelative = new Map<string, { dx: number; dy: number }>();

  const nodesInCanvas = allNodes.filter((n) => {
    if (!layoutable(n)) return false;
    if (canvasIdFilter && n.canvasId !== canvasIdFilter) return false;
    return true;
  });

  if (!canvasIdFilter) {
    return { vaultPositions, nodePositions, nodeRelative };
  }

  const canvasId = canvasIdFilter;

  const vaultIdSet = new Set(nodesInCanvas.map((n) => n.vaultId!));
  if (extraEmptyVaultIds) {
    for (const id of extraEmptyVaultIds) {
      if (vaults.some((v) => v.id === id && v.isActive)) vaultIdSet.add(id);
    }
  }

  if (nodesInCanvas.length === 0 && vaultIdSet.size === 0) {
    return { vaultPositions, nodePositions, nodeRelative };
  }

  const sortedVaults = [...vaultIdSet]
    .map((id) => vaults.find((v) => v.id === id))
    .filter((v): v is CategoryVault => v != null && v.isActive)
    .sort((a, b) => a.displayOrder - b.displayOrder);

  const graphById = new Map(allNodes.map((n) => [n.id, n]));

  const nV = sortedVaults.length;

  /**
   * Vault pill vertical center: below the master, aligned across all vault columns.
   * First node center = pill bottom + gap + half of that card’s height (per vault).
   */
  const vaultPillCenterY =
    centerY +
    MASTER_NODE_SIZE / 2 +
    MASTER_TO_VAULT_PILL_GAP +
    VAULT_HEADER_H / 2;

  /** Per-vault row plan + slot width (linked nodes share one horizontal row). */
  const rowsByVault = new Map<string, RowSpec[]>();
  const maxWidthByVault = new Map<string, number>();
  for (const v of sortedVaults) {
    const vaultNodes = nodesInCanvas.filter((n) => n.vaultId === v.id);
    const rows = buildRowsForVault(
      vaultNodes,
      edges,
      canvasId,
      createdAtByNodeId,
      userOrderHint
    );
    rows.sort((a, b) => {
      const ca = a.nodes.some((n) =>
        hasCrossVaultEdge(n.id, nodesInCanvas, edges, canvasId)
      );
      const cb = b.nodes.some((n) =>
        hasCrossVaultEdge(n.id, nodesInCanvas, edges, canvasId)
      );
      if (ca !== cb) return ca ? -1 : 1;
      if (userOrderHint && userOrderHint.size > 0) {
        const minA = Math.min(
          ...a.nodes.map((n) => userOrderHint.get(n.id) ?? 1e9)
        );
        const minB = Math.min(
          ...b.nodes.map((n) => userOrderHint.get(n.id) ?? 1e9)
        );
        if (minA !== minB) return minA - minB;
      } else {
        const maxA = Math.max(
          ...a.nodes.map((n) => parseCreatedAtMs(n.id, createdAtByNodeId))
        );
        const maxB = Math.max(
          ...b.nodes.map((n) => parseCreatedAtMs(n.id, createdAtByNodeId))
        );
        if (maxA !== maxB) return maxB - maxA;
      }
      const minA = [...a.nodes].sort((x, y) => x.id.localeCompare(y.id))[0];
      const minB = [...b.nodes].sort((x, y) => x.id.localeCompare(y.id))[0];
      if (!minA || !minB) return 0;
      return minA.id.localeCompare(minB.id);
    });
    rowsByVault.set(v.id, rows);
    const mw =
      rows.length > 0
        ? Math.max(CARD_WIDTH, ...rows.map((r) => r.width))
        : CARD_WIDTH;
    maxWidthByVault.set(v.id, mw);
  }

  let totalSpan = 0;
  for (const v of sortedVaults) {
    totalSpan += maxWidthByVault.get(v.id) ?? CARD_WIDTH;
  }
  if (nV > 1) totalSpan += (nV - 1) * HORIZONTAL_GAP;

  /** Step D–E: place vault slots on an even horizontal distribution */
  type Placed = { id: string; vaultId: string; x: number; y: number; order: number };
  const placed: Placed[] = [];
  let orderCounter = 0;

  let slotLeft = centerX - totalSpan / 2;

  for (let vi = 0; vi < sortedVaults.length; vi++) {
    const v = sortedVaults[vi];
    const mw = maxWidthByVault.get(v.id) ?? CARD_WIDTH;
    const vx = slotLeft + mw / 2;
    slotLeft += mw;
    if (vi < sortedVaults.length - 1) slotLeft += HORIZONTAL_GAP;

    const vk = useMasterVaultKeys
      ? masterVaultKey(canvasId, v.id)
      : v.id;
    vaultPositions.set(vk, {
      x: vx,
      y: vaultPillCenterY,
    });

    const rows = rowsByVault.get(v.id) ?? [];
    if (rows.length === 0) continue;

    const firstH = rows[0].height;
    let cy =
      vaultPillCenterY +
      VAULT_HEADER_H / 2 +
      GAP_PILL_TO_FIRST_NODE +
      firstH / 2;

    for (let ri = 0; ri < rows.length; ri++) {
      const row = rows[ri];
      if (row.nodes.length === 1) {
        const n = row.nodes[0];
        nodePositions.set(n.id, { x: vx, y: cy });
        placed.push({
          id: n.id,
          vaultId: n.vaultId!,
          x: vx,
          y: cy,
          order: orderCounter++,
        });
      } else {
        const rowW = row.width;
        let xLeft = vx - rowW / 2;
        for (let k = 0; k < row.nodes.length; k++) {
          const n = row.nodes[k];
          const dim = graphNodeCardWorldDimensions(n);
          const cx = xLeft + dim.w / 2;
          nodePositions.set(n.id, { x: cx, y: cy });
          placed.push({
            id: n.id,
            vaultId: n.vaultId!,
            x: cx,
            y: cy,
            order: orderCounter++,
          });
          xLeft += dim.w + LINKED_NODE_HORIZONTAL_GAP;
        }
      }
      if (ri + 1 < rows.length) {
        const nextH = rows[ri + 1].height;
        cy =
          cy +
          row.height / 2 +
          VERTICAL_GAP +
          nextH / 2;
      }
    }
  }

  const orderOf = new Map(placed.map((p) => [p.id, p.order]));

  /** Step F: cross-vault edges — align interconnected nodes to the same row (y). */
  const crossEdges: Array<{ a: string; b: string }> = [];
  const inCanvasIds = new Set(nodesInCanvas.map((n) => n.id));
  for (const e of edges) {
    if (!inCanvasIds.has(e.sourceNodeId) || !inCanvasIds.has(e.targetNodeId))
      continue;
    const sa = allNodes.find((x) => x.id === e.sourceNodeId);
    const sb = allNodes.find((x) => x.id === e.targetNodeId);
    if (!sa || !sb || !layoutable(sa) || !layoutable(sb)) continue;
    if (sa.canvasId !== canvasId || sb.canvasId !== canvasId) continue;
    if (sa.vaultId === sb.vaultId) continue;
    crossEdges.push({ a: e.sourceNodeId, b: e.targetNodeId });
  }

  for (const { a, b } of crossEdges) {
    const oa = orderOf.get(a) ?? 0;
    const ob = orderOf.get(b) ?? 0;
    const fixed = oa <= ob ? a : b;
    const moved = oa <= ob ? b : a;
    const pf = nodePositions.get(fixed);
    const pm = nodePositions.get(moved);
    if (!pf || !pm) continue;
    pm.y = pf.y;
    nodePositions.set(moved, { x: pm.x, y: pm.y });
  }

  /** Step G: collision pass — separate overlapping nodes using real card bounds */
  const ids = [...nodePositions.keys()];
  for (let iter = 0; iter < MAX_COLLISION_ITERS; iter++) {
    let any = false;
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const ia = ids[i];
        const ib = ids[j];
        const pa = nodePositions.get(ia)!;
        const pb = nodePositions.get(ib)!;
        const na = graphById.get(ia);
        const nb = graphById.get(ib);
        if (!na || !nb) continue;
        const ba = bboxForNode(na, pa.x, pa.y);
        const bb = bboxForNode(nb, pb.x, pb.y);
        if (!overlaps(ba, bb, COLLISION_MIN_GAP)) continue;
        any = true;
        const ha = graphNodeCardWorldDimensions(na).h;
        const hb = graphNodeCardWorldDimensions(nb).h;
        if (pa.y >= pb.y) {
          const newY = pb.y + hb / 2 + COLLISION_MIN_GAP + ha / 2;
          nodePositions.set(ia, { x: pa.x, y: newY });
        } else {
          const newY = pa.y + ha / 2 + COLLISION_MIN_GAP + hb / 2;
          nodePositions.set(ib, { x: pb.x, y: newY });
        }
      }
    }
    if (!any) break;
  }

  /** Relative offsets for vault drag */
  for (const n of nodesInCanvas) {
    const vid = n.vaultId!;
    const vk = useMasterVaultKeys
      ? masterVaultKey(canvasId, vid)
      : vid;
    const gp = vaultPositions.get(vk);
    const p = nodePositions.get(n.id);
    if (gp && p) {
      nodeRelative.set(n.id, { dx: p.x - gp.x, dy: p.y - gp.y });
    }
  }

  return { vaultPositions, nodePositions, nodeRelative };
}

/**
 * Master view: size regions from vault/node counts, place in a grid with {@link CANVAS_REGION_GAP}.
 */
export function allocateStructuredCanvasRegions(
  canvasIds: string[],
  statsByCanvas: Map<string, CanvasLayoutStats>,
  canvasMeta: CanvasMeta[],
  masterColorById: Map<string, string>,
  masterBioById: Map<string, string | null | undefined>
): Map<string, MasterCanvasRegion> {
  const out = new Map<string, MasterCanvasRegion>();
  const n = canvasIds.length;
  if (n === 0) return out;

  const dims = canvasIds.map((id) => {
    const s = statsByCanvas.get(id) ?? {
      numVaults: 0,
      maxNodesInAnyVault: 0,
    };
    const nv = Math.max(s.numVaults, 1);
    const mx = Math.max(s.maxNodesInAnyVault, 1);
    /** Allow two linked cards side-by-side in a vault without clipping the region. */
    const minSlotForLinkedPair =
      CARD_WIDTH * 2 + LINKED_NODE_HORIZONTAL_GAP + 24;
    const regionWidth = Math.max(
      820,
      nv * Math.max(CARD_WIDTH + HORIZONTAL_GAP, minSlotForLinkedPair) + 200
    );
    /** Worst-case vertical span: all nodes in the fullest vault are file cards. */
    const stackEstimate =
      mx > 0
        ? mx * FILE_NODE_H + Math.max(0, mx - 1) * VERTICAL_GAP
        : NODE_H + VERTICAL_GAP;
    const regionHeight = Math.max(
      520,
      MASTER_NODE_SIZE +
        MASTER_TO_VAULT_PILL_GAP +
        VAULT_HEADER_H +
        GAP_PILL_TO_FIRST_NODE +
        stackEstimate +
        200
    );
    return { halfW: regionWidth / 2, halfH: regionHeight / 2 };
  });

  const cols = n <= 1 ? 1 : n === 2 ? 2 : 2;
  const rows = Math.ceil(n / cols);

  const rowHeights: number[] = [];
  for (let r = 0; r < rows; r++) {
    let mh = 0;
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx < n) mh = Math.max(mh, dims[idx].halfH);
    }
    rowHeights.push(mh);
  }

  let totalRowStack = 0;
  for (let r = 0; r < rows; r++) {
    totalRowStack += rowHeights[r] * 2;
    if (r < rows - 1) totalRowStack += CANVAS_REGION_GAP;
  }

  let yTop = -totalRowStack / 2;

  for (let r = 0; r < rows; r++) {
    const rowItems: number[] = [];
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (idx < n) rowItems.push(idx);
    }
    const k = rowItems.length;
    const rowHalfWidths = rowItems.map((idx) => dims[idx].halfW);
    const totalW =
      rowHalfWidths.reduce((sum, hw) => sum + 2 * hw, 0) +
      (k - 1) * CANVAS_REGION_GAP;

    const rowH = rowHeights[r];
    const cy = yTop + rowH;

    let x = -totalW / 2;
    for (let j = 0; j < k; j++) {
      const idx = rowItems[j];
      const canvasId = canvasIds[idx];
      const hw = rowHalfWidths[j];
      const hh = dims[idx].halfH;
      x += hw;
      const cx = x;
      x += hw + (j < k - 1 ? CANVAS_REGION_GAP : 0);

      const meta = canvasMeta.find((c) => c.id === canvasId);
      const mBio = masterBioById.get(canvasId);
      const mColor = masterColorById.get(canvasId) ?? "#FF6600";

      out.set(canvasId, {
        canvasId,
        cx,
        cy,
        halfW: hw,
        halfH: hh,
        tintColor: "#888780",
        emoji: meta?.emoji ?? null,
        name: meta?.name ?? "Canvas",
        masterHubX: cx,
        masterHubY: cy,
        masterNodeBio: mBio ?? null,
        masterNodeColor: mColor,
      });
    }

    yTop += rowH * 2 + (r < rows - 1 ? CANVAS_REGION_GAP : 0);
  }

  return out;
}
