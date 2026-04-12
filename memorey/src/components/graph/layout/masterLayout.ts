import { useGraphStore } from "@/store/graphStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useVaultStore } from "@/store/vaultStore";
import type { GraphNode } from "@/types/memorey";
import type { CategoryVault } from "@/types/memorey";
import type { NodeEdge } from "@/types/memorey";
import type { VaultLayoutRefs, CanvasMeta, MasterCanvasRegion } from "./types";
import {
  allocateCanvasRegions,
  computeUnifiedCanvasLayout,
  statsForCanvas,
  type CanvasLayoutStats,
  type StructuredLayoutResult,
} from "./canvasRegionLayout";
import { getExtraEmptyVaultIdsForCanvas } from "@/lib/vaults/emptyVaultLayout";

export function masterVaultKey(canvasId: string, vaultId: string): string {
  return `${canvasId}::${vaultId}`;
}

export function parseMasterVaultKey(
  key: string
): { canvasId: string; vaultId: string } | null {
  const i = key.indexOf("::");
  if (i <= 0) return null;
  return { canvasId: key.slice(0, i), vaultId: key.slice(i + 2) };
}

export function vaultGroupKeyForNode(
  canvasId: string | null | undefined,
  vaultId: string | null | undefined,
  isMasterView: boolean
): string | null {
  if (!vaultId) return null;
  if (isMasterView && canvasId) return masterVaultKey(canvasId, vaultId);
  return vaultId;
}

/** 2 cols for 3+ canvases, 1 col for single, 2 for pair. */
export function gridColsForCanvasCount(n: number): number {
  if (n <= 1) return 1;
  if (n === 2) return 2;
  return 2;
}

export function canvasIdAtWorld(
  wx: number,
  wy: number,
  regions: Map<string, MasterCanvasRegion>
): string | null {
  for (const [id, r] of regions) {
    if (
      wx >= r.cx - r.halfW &&
      wx <= r.cx + r.halfW &&
      wy >= r.cy - r.halfH &&
      wy <= r.cy + r.halfH
    ) {
      return id;
    }
  }
  return null;
}

/** Nodes that participate in canvas layout and can persist pos_x/pos_y. */
export function isGraphNodeLayoutable(n: GraphNode): boolean {
  if (!n?.vaultId) return false;
  if (n.nodeKind === "person" || n.nodeKind === "master") return false;
  if (n.nodeKind === "category" || n.id.startsWith("cat:")) return false;
  if (!n.canvasId) return false;
  return true;
}

/**
 * After auto-layout fills node/vault maps, override with DB-saved positions
 * from the memory store and resync node↔vault relative offsets.
 */
export function mergeSavedMemoryNodePositionsIntoMaps(
  nodePositions: Map<string, { x: number; y: number }>,
  nodeRelative: Map<string, { dx: number; dy: number }>,
  vaultGroupPositions: Map<string, { x: number; y: number }>,
  graphNodes: GraphNode[]
): void {
  const memories = useGraphStore.getState().nodes;
  const isMaster = useCanvasStore.getState().isMasterView;

  for (const m of memories) {
    if (m.posX == null || m.posY == null) continue;
    if (!Number.isFinite(m.posX) || !Number.isFinite(m.posY)) continue;
    const gn = graphNodes.find((x) => x.id === m.id);
    if (!gn || !isGraphNodeLayoutable(gn)) continue;
    nodePositions.set(m.id, { x: m.posX, y: m.posY });
  }

  for (const [id, p] of nodePositions) {
    const n = graphNodes.find((x) => x.id === id);
    const vid = n?.vaultId;
    if (!n || !vid) continue;
    const gk =
      isMaster && n.canvasId ? masterVaultKey(n.canvasId, vid) : vid;
    const gp = vaultGroupPositions.get(gk);
    if (!gp) continue;
    nodeRelative.set(id, { dx: p.x - gp.x, dy: p.y - gp.y });
  }
}

function copyMap<K, V>(m: Map<K, V>): Map<K, V> {
  return new Map(m);
}

/** Apply canvas region drag offsets to live refs from base snapshot. */
export function applyRegionOffsetsToRefs(refs: VaultLayoutRefs): void {
  const base = refs.regionLayoutBaseRef.current;
  if (!base) return;
  const offsets = refs.canvasRegionOffsetsRef.current;

  refs.nodePositionsRef.current.clear();
  refs.vaultGroupPositionsRef.current.clear();
  refs.nodeRelativePositionsRef.current.clear();
  refs.canvasRegionsRef.current.clear();

  const offForVaultKey = (key: string) => {
    const parsed = parseMasterVaultKey(key);
    const cid = parsed?.canvasId;
    if (cid && offsets.has(cid)) {
      const o = offsets.get(cid)!;
      return { dx: o.dx, dy: o.dy };
    }
    return { dx: 0, dy: 0 };
  };

  for (const [id, p] of base.nodePositions) {
    const n = useGraphStore.getState().graphData.nodes.find((x) => x.id === id);
    const cid = n?.canvasId;
    const o =
      cid && offsets.has(cid) ? offsets.get(cid)! : { dx: 0, dy: 0 };
    refs.nodePositionsRef.current.set(id, {
      x: p.x + o.dx,
      y: p.y + o.dy,
    });
  }

  for (const [k, p] of base.vaultGroupPositions) {
    const o = offForVaultKey(k);
    refs.vaultGroupPositionsRef.current.set(k, {
      x: p.x + o.dx,
      y: p.y + o.dy,
    });
  }

  for (const [k, p] of base.nodeRelativePositions) {
    refs.nodeRelativePositionsRef.current.set(k, { ...p });
  }

  for (const [k, r] of base.regions) {
    const o = offsets.get(k) ?? { dx: 0, dy: 0 };
    refs.canvasRegionsRef.current.set(k, {
      ...r,
      cx: r.cx + o.dx,
      cy: r.cy + o.dy,
      masterHubX: r.masterHubX + o.dx,
      masterHubY: r.masterHubY + o.dy,
    });
  }
}

/**
 * Master graph: allocated canvas regions + unified vault/row layout per canvas.
 */
export function placeAllNodesMaster(
  nodes: GraphNode[],
  vaults: CategoryVault[],
  refs: VaultLayoutRefs,
  canvasOrder: CanvasMeta[],
  canvases: Array<{
    id: string;
    masterNodeBio?: string | null;
    masterNodeColor?: string;
  }>,
  edges: NodeEdge[],
  options?: { skipSavedMerge?: boolean }
): StructuredLayoutResult {
  refs.vaultGroupPositionsRef.current.clear();
  refs.nodePositionsRef.current.clear();
  refs.nodeRelativePositionsRef.current.clear();
  refs.canvasRegionsRef.current.clear();

  const hidden = new Set(useCanvasStore.getState().masterHiddenCanvasIds);

  const byCanvas = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    if (!layoutableNode(n)) continue;
    if (!n.canvasId || hidden.has(n.canvasId)) continue;
    const list = byCanvas.get(n.canvasId) ?? [];
    list.push(n);
    byCanvas.set(n.canvasId, list);
  }

  const visibleIds = canvasOrder
    .filter((c) => !hidden.has(c.id))
    .map((c) => c.id);
  if (visibleIds.length === 0) {
    refs.regionLayoutBaseRef.current = null;
    return {
      vaultPositions: new Map(),
      nodePositions: new Map(),
      nodeRelative: new Map(),
    };
  }

  const statsByCanvas = new Map<string, CanvasLayoutStats>();
  for (const id of visibleIds) {
    const extraEmpty = getExtraEmptyVaultIdsForCanvas(id, true);
    statsByCanvas.set(id, statsForCanvas(id, nodes, extraEmpty));
  }

  const masterColorById = new Map(
    canvases.map((c) => [c.id, c.masterNodeColor ?? "#FF6600"])
  );
  const masterBioById = new Map(
    canvases.map((c) => [c.id, c.masterNodeBio])
  );

  const allocated = allocateCanvasRegions(
    visibleIds,
    statsByCanvas,
    canvasOrder,
    masterColorById,
    masterBioById
  );

  const createdAtByNodeId = new Map(
    useGraphStore.getState().nodes.map((m) => [m.id, m.createdAt])
  );

  const baseNp = new Map<string, { x: number; y: number }>();
  const baseVg = new Map<string, { x: number; y: number }>();
  const baseNrp = new Map<string, { dx: number; dy: number }>();
  const baseRegions = new Map<string, MasterCanvasRegion>();

  for (const canvasId of visibleIds) {
    const region = allocated.get(canvasId);
    if (!region) continue;
    baseRegions.set(canvasId, { ...region });

    const extraEmpty = getExtraEmptyVaultIdsForCanvas(canvasId, true);

    const { vaultPositions, nodePositions, nodeRelative } =
      computeUnifiedCanvasLayout(
        canvasId,
        region.cx,
        region.cy,
        nodes,
        edges,
        vaults,
        true,
        createdAtByNodeId,
        extraEmpty
      );

    for (const [k, p] of vaultPositions) baseVg.set(k, { ...p });
    for (const [id, p] of nodePositions) baseNp.set(id, { ...p });
    for (const [id, r] of nodeRelative) baseNrp.set(id, { ...r });
  }

  if (!options?.skipSavedMerge) {
    mergeSavedMemoryNodePositionsIntoMaps(baseNp, baseNrp, baseVg, nodes);
  }

  refs.regionLayoutBaseRef.current = {
    nodePositions: copyMap(baseNp),
    vaultGroupPositions: copyMap(baseVg),
    nodeRelativePositions: copyMap(baseNrp),
    regions: copyMap(baseRegions),
  };

  applyRegionOffsetsToRefs(refs);
  return {
    vaultPositions: new Map(refs.vaultGroupPositionsRef.current),
    nodePositions: new Map(refs.nodePositionsRef.current),
    nodeRelative: new Map(refs.nodeRelativePositionsRef.current),
  };
}

function layoutableNode(n: GraphNode): boolean {
  return isGraphNodeLayoutable(n);
}

/** Re-run master layout from current stores (after node canvas change, etc.). */
export function runPlaceAllNodesMaster(
  refs: VaultLayoutRefs,
  options?: { skipSavedMerge?: boolean }
): StructuredLayoutResult {
  const nodes = useGraphStore.getState().graphData.nodes;
  const edges = useGraphStore.getState().edges;
  const vaults = useVaultStore.getState().vaults;
  const canvases = useCanvasStore.getState().canvases;
  const order: CanvasMeta[] = [...canvases]
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((c) => ({ id: c.id, emoji: c.emoji, name: c.name }));
  return placeAllNodesMaster(nodes, vaults, refs, order, canvases, edges, options);
}
