import type { GraphNode } from "@/types/memorey";
import {
  NODE_W,
  NODE_H,
  FILE_NODE_W,
  FILE_NODE_H,
  STICKY_W,
  STICKY_H,
} from "../constants/dimensions";
import { hexToRgba, BRAND_ORANGE } from "../constants/colors";
import { buildOrthogonalPath } from "./edge";
import { isFileGraphNode } from "../lib/fileNodeHelpers";

function skip(n: GraphNode): boolean {
  const k = n.nodeKind;
  return k === "person" || k === "category" || k === "master" || n.id.startsWith("cat:");
}

function nodeHalfForConnect(n: GraphNode): { hw: number; hh: number } {
  if (isFileGraphNode(n)) {
    return { hw: FILE_NODE_W / 2, hh: FILE_NODE_H / 2 };
  }
  if (n.nodeType === "sticky") {
    return { hw: STICKY_W / 2, hh: STICKY_H / 2 };
  }
  return { hw: NODE_W / 2, hh: NODE_H / 2 };
}

export function drawConnectPreview(
  ctx: CanvasRenderingContext2D,
  sourceNode: GraphNode,
  cursorWorld: { x: number; y: number },
  nodePositions: Map<string, { x: number; y: number }>,
  nodes: GraphNode[],
  frame: number
): void {
  ctx.save();
  const sp = nodePositions.get(sourceNode.id);
  if (!sp) {
    ctx.restore();
    return;
  }

  const sDim = nodeHalfForConnect(sourceNode);
  const pulse = 0.5 + 0.5 * Math.sin(frame * 0.15);
  ctx.strokeStyle = hexToRgba(BRAND_ORANGE, 0.35 + pulse * 0.35);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(sp.x, sp.y, sDim.hw + 8, 0, Math.PI * 2);
  ctx.stroke();

  let target: GraphNode | null = null;
  const { x: cx, y: cy } = cursorWorld;
  for (let i = nodes.length - 1; i >= 0; i--) {
    const n = nodes[i];
    if (!n || n.id === sourceNode.id || skip(n)) continue;
    const p = nodePositions.get(n.id);
    if (!p) continue;
    const th = nodeHalfForConnect(n);
    if (
      cx >= p.x - th.hw &&
      cx <= p.x + th.hw &&
      cy >= p.y - th.hh &&
      cy <= p.y + th.hh
    ) {
      target = n;
      break;
    }
  }

  const tDim = target ? nodeHalfForConnect(target) : sDim;
  const tp = target ? nodePositions.get(target.id) : null;
  const tx = tp ? tp.x : cursorWorld.x;
  const ty = tp ? tp.y : cursorWorld.y;
  const pts = buildOrthogonalPath(
    sp.x,
    sp.y,
    tx,
    ty,
    sDim.hw,
    sDim.hh,
    tDim.hw,
    tDim.hh
  );

  ctx.setLineDash([6, 6]);
  ctx.lineDashOffset = -(frame * 0.4) % 12;
  ctx.strokeStyle = hexToRgba(BRAND_ORANGE, 0.65);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.stroke();
  ctx.setLineDash([]);

  if (target) {
    const p = nodePositions.get(target.id)!;
    const td = nodeHalfForConnect(target);
    ctx.strokeStyle = hexToRgba(BRAND_ORANGE, 0.9);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, td.hw + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}
