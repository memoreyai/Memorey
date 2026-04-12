import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import type { GraphNode, CategoryVault } from "@/types/memorey";
import type { VaultLayoutRefs } from "./types";
import {
  masterVaultKey,
  mergeSavedMemoryNodePositionsIntoMaps,
  runPlaceAllNodesMaster,
  vaultGroupKeyForNode,
} from "./masterLayout";
import {
  computeUnifiedCanvasLayout,
  type StructuredLayoutResult,
} from "./canvasRegionLayout";
import { getExtraEmptyVaultIdsForCanvas } from "@/lib/vaults/emptyVaultLayout";
import {
  VAULT_CIRCLE_BASE_RADIUS,
  VAULT_CIRCLE_RADIUS_PER_VAULT,
} from "../constants/layout";

const MIN_DISTANCE_FROM_MASTER = 180;

/** Reading order for auto-layout: top-to-bottom, then left-to-right (matches visual flow). */
export function buildUserOrderHintFromPositionMap(
  nodePositions: Map<string, { x: number; y: number }>,
  graphNodes: GraphNode[]
): Map<string, number> {
  const layoutable = (n: GraphNode) =>
    !!n.vaultId &&
    n.canvasId &&
    n.nodeKind !== "master" &&
    n.nodeKind !== "person" &&
    n.nodeKind !== "category" &&
    !n.id.startsWith("cat:");
  const memoryLike = graphNodes.filter(layoutable);
  const sorted = [...memoryLike].sort((a, b) => {
    const pa = nodePositions.get(a.id);
    const pb = nodePositions.get(b.id);
    if (!pa || !pb) return 0;
    if (Math.abs(pa.y - pb.y) > 1) return pa.y - pb.y;
    return pa.x - pb.x;
  });
  const out = new Map<string, number>();
  sorted.forEach((n, i) => out.set(n.id, i));
  return out;
}

export function initVaultGroups(
  vaults: CategoryVault[],
  refs: VaultLayoutRefs
): void {
  const active = vaults.filter((v) => v.isActive);
  const count = active.length;
  if (count === 0) return;

  const RADIUS =
    VAULT_CIRCLE_BASE_RADIUS + count * VAULT_CIRCLE_RADIUS_PER_VAULT;

  active.forEach((vault, i) => {
    if (refs.vaultGroupPositionsRef.current.has(vault.id)) return;

    const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
    let gx = Math.cos(angle) * RADIUS;
    let gy = Math.sin(angle) * RADIUS;

    const dist = Math.sqrt(gx * gx + gy * gy);
    if (dist < MIN_DISTANCE_FROM_MASTER) {
      const scale = MIN_DISTANCE_FROM_MASTER / Math.max(dist, 1);
      gx *= scale;
      gy *= scale;
    }

    refs.vaultGroupPositionsRef.current.set(vault.id, { x: gx, y: gy });
  });
}

export function setNodeInVaultGroup(
  nodeId: string,
  vaultId: string,
  refs: VaultLayoutRefs
): void {
  if (!nodeId || !vaultId) return;

  const isMaster = useCanvasStore.getState().isMasterView;
  const mem = useGraphStore.getState().nodes.find((n) => n.id === nodeId);
  const canvasId = mem?.canvasId;
  const key =
    isMaster && canvasId
      ? masterVaultKey(canvasId, vaultId)
      : vaultId;

  if (!refs.vaultGroupPositionsRef.current.has(key)) {
    const allVaults = useVaultStore.getState().vaults;
    if (isMaster && canvasId) {
      runPlaceAllNodesMaster(refs);
    } else {
      initVaultGroups(allVaults, refs);
    }
  }

  const groupPos = refs.vaultGroupPositionsRef.current.get(key);
  if (!groupPos) return;

  const liveNodes = useGraphStore.getState().graphData.nodes;
  const existingInVault = liveNodes.filter((n) => {
    if (n.vaultId !== vaultId) return false;
    if (isMaster && canvasId && n.canvasId !== canvasId) return false;
    return (
      n.nodeKind !== "master" &&
      n.nodeKind !== "person" &&
      n.nodeKind !== "category" &&
      !n.id.startsWith("cat:") &&
      n.id !== nodeId &&
      (refs.nodeRelativePositionsRef.current.has(n.id) ||
        refs.nodePositionsRef.current.has(n.id))
    );
  });

  const count = existingInVault.length;
  const cols = Math.max(1, Math.ceil(Math.sqrt(count + 1)));
  const col = count % cols;
  const row = Math.floor(count / cols);
  const totalCols = Math.min(cols, count + 1);

  const NODE_GRID_COL_SPACING = 230;
  const NODE_GRID_ROW_SPACING = 110;
  const NODE_GRID_HEADER_OFFSET_Y = 70;

  const dx = (col - (totalCols - 1) / 2) * NODE_GRID_COL_SPACING;
  const dy = NODE_GRID_HEADER_OFFSET_Y + row * NODE_GRID_ROW_SPACING;

  refs.nodeRelativePositionsRef.current.set(nodeId, { dx, dy });
  refs.nodePositionsRef.current.set(nodeId, {
    x: groupPos.x + dx,
    y: groupPos.y + dy,
  });
}

/** After absolute positions change (e.g. auto layout), keep relative offsets in sync for vault drag. */
export function syncNodeRelativePositionsFromAbsolute(
  nodeIds: Iterable<string>,
  nodes: GraphNode[],
  refs: VaultLayoutRefs
): void {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const isMaster = useCanvasStore.getState().isMasterView;
  for (const id of nodeIds) {
    const n = byId.get(id);
    const vid = n?.vaultId;
    if (!vid) continue;
    const gk = vaultGroupKeyForNode(n?.canvasId, vid, isMaster);
    const gp = gk ? refs.vaultGroupPositionsRef.current.get(gk) : undefined;
    const p = refs.nodePositionsRef.current.get(id);
    if (!gp || !p) continue;
    refs.nodeRelativePositionsRef.current.set(id, {
      dx: p.x - gp.x,
      dy: p.y - gp.y,
    });
  }
}

export function placeAllNodes(
  nodes: GraphNode[],
  refs: VaultLayoutRefs,
  excludeNodeId?: string,
  options?: { skipSavedMerge?: boolean; userOrderHint?: Map<string, number> }
): StructuredLayoutResult {
  const allVaults = useVaultStore.getState().vaults;
  const activeCanvasId = useCanvasStore.getState().activeCanvasId;
  const edges = useGraphStore.getState().edges;

  refs.vaultGroupPositionsRef.current.clear();
  refs.nodePositionsRef.current.clear();
  refs.nodeRelativePositionsRef.current.clear();
  refs.canvasRegionsRef.current.clear();

  if (!activeCanvasId) {
    return {
      vaultPositions: new Map(),
      nodePositions: new Map(),
      nodeRelative: new Map(),
    };
  }

  const createdAtByNodeId = new Map(
    useGraphStore.getState().nodes.map((m) => [m.id, m.createdAt])
  );

  const graphNodes =
    excludeNodeId != null
      ? nodes.filter((n) => n.id !== excludeNodeId)
      : nodes;

  const extraEmpty = getExtraEmptyVaultIdsForCanvas(activeCanvasId, false);

  const { vaultPositions, nodePositions, nodeRelative } =
    computeUnifiedCanvasLayout(
      activeCanvasId,
      0,
      0,
      graphNodes,
      edges,
      allVaults,
      false,
      createdAtByNodeId,
      extraEmpty,
      options?.userOrderHint
    );

  for (const [k, p] of vaultPositions) {
    refs.vaultGroupPositionsRef.current.set(k, p);
  }
  for (const [id, p] of nodePositions) {
    refs.nodePositionsRef.current.set(id, p);
  }
  for (const [id, r] of nodeRelative) {
    refs.nodeRelativePositionsRef.current.set(id, r);
  }

  if (!options?.skipSavedMerge) {
    mergeSavedMemoryNodePositionsIntoMaps(
      refs.nodePositionsRef.current,
      refs.nodeRelativePositionsRef.current,
      refs.vaultGroupPositionsRef.current,
      graphNodes
    );
  }

  return {
    vaultPositions: new Map(refs.vaultGroupPositionsRef.current),
    nodePositions: new Map(refs.nodePositionsRef.current),
    nodeRelative: new Map(refs.nodeRelativePositionsRef.current),
  };
}
