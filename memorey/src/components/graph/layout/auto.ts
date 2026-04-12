import type { MutableRefObject } from "react";
import type { GraphologyGraph } from "@/store/graphStore";
import type { GraphNode, NodeEdge } from "@/types/memorey";
import {
  NODE_GRID_HEADER_OFFSET_Y,
  NODE_GRID_ROW_SPACING,
} from "../constants/layout";
import type { LayoutAnimFrame } from "./types";

/** Same filter as `placeAllNodes` — graph nodes that live in a vault column. */
function shouldAutoLayoutNode(n: GraphNode): boolean {
  if (!n?.id || n.id.startsWith("cat:")) return false;
  if (n.nodeKind === "master" || n.nodeKind === "person") return false;
  if (n.nodeKind === "category") return false;
  if (!n.vaultId) return false;
  return true;
}

/**
 * Vertical stack under each vault (aligned with structured canvas layout).
 */
export function computeAutoLayout(
  graphDataNodes: GraphNode[],
  _edges: NodeEdge[],
  _graph: GraphologyGraph | null,
  vaultGroupPositions: Map<string, { x: number; y: number }>
): Map<string, { x: number; y: number }> {
  const out = new Map<string, { x: number; y: number }>();
  const byVault = new Map<string, GraphNode[]>();

  for (const n of graphDataNodes) {
    if (!shouldAutoLayoutNode(n)) continue;
    const vid = n.vaultId!;
    if (!byVault.has(vid)) byVault.set(vid, []);
    byVault.get(vid)!.push(n);
  }

  for (const [, list] of byVault) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }

  for (const [vaultId, vaultNodes] of byVault) {
    const groupPos = vaultGroupPositions.get(vaultId);
    if (!groupPos) continue;

    vaultNodes.forEach((node, i) => {
      out.set(node.id, {
        x: groupPos.x,
        y: groupPos.y + NODE_GRID_HEADER_OFFSET_Y + i * NODE_GRID_ROW_SPACING,
      });
    });
  }

  return out;
}

export function triggerAutoLayout(
  layoutAnimRef: MutableRefObject<LayoutAnimFrame | null>,
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>,
  newPositions: Map<string, { x: number; y: number }>,
  durationMs: number
): void {
  const from = new Map(nodePositionsRef.current);
  const to = new Map<string, { x: number; y: number }>();
  for (const [id, p] of newPositions) {
    to.set(id, { ...p });
  }
  layoutAnimRef.current = {
    from,
    to,
    startTime: performance.now(),
    duration: durationMs,
  };
}
