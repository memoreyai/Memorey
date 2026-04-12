import type { GraphNode } from "@/types/memorey";
import { hexToRgbaSafe } from "../constants/colors";
import { isFileGraphNode } from "../lib/fileNodeHelpers";
import { isGraphNodeLayoutable } from "../layout/masterLayout";
import type { MasterCanvasRegion } from "../layout/types";
import {
  ATTACH_H,
  ATTACH_W,
  FILE_NODE_H,
  FILE_NODE_W,
  MASTER_H_WITH_BIO,
  MASTER_H_WITHOUT_BIO,
  MASTER_W,
  NODE_H,
  NODE_W,
  STICKY_H,
  STICKY_W,
} from "../constants/dimensions";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
): void {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export const MASTER_REGION_PAD = 80;

function graphNodeHalfExtents(node: GraphNode): { hw: number; hh: number } {
  if (node.nodeKind === "attachment") {
    return { hw: ATTACH_W / 2, hh: ATTACH_H / 2 };
  }
  if (isFileGraphNode(node)) {
    return { hw: FILE_NODE_W / 2, hh: FILE_NODE_H / 2 };
  }
  if (node.nodeType === "sticky") {
    return { hw: STICKY_W / 2, hh: STICKY_H / 2 };
  }
  return { hw: NODE_W / 2, hh: NODE_H / 2 };
}

/**
 * Recompute each canvas region's rect and hub from live node positions (master view).
 * Call every frame for drawing and hit-testing so backgrounds track dragged nodes.
 */
export function computeDynamicMasterCanvasRegions(
  staticRegions: Map<string, MasterCanvasRegion>,
  nodes: GraphNode[],
  nodePositions: Map<string, { x: number; y: number }>
): Map<string, MasterCanvasRegion> {
  const out = new Map<string, MasterCanvasRegion>();
  for (const [canvasId, meta] of staticRegions) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const expand = (cx: number, cy: number, hw: number, hh: number) => {
      minX = Math.min(minX, cx - hw);
      maxX = Math.max(maxX, cx + hw);
      minY = Math.min(minY, cy - hh);
      maxY = Math.max(maxY, cy + hh);
    };

    const bio = (meta.masterNodeBio ?? "").trim();
    const hubH = bio ? MASTER_H_WITH_BIO : MASTER_H_WITHOUT_BIO;
    expand(meta.masterHubX, meta.masterHubY, MASTER_W / 2, hubH / 2);

    for (const n of nodes) {
      if (n.canvasId !== canvasId) continue;
      if (!isGraphNodeLayoutable(n)) continue;
      const p = nodePositions.get(n.id);
      if (!p) continue;
      const { hw, hh } = graphNodeHalfExtents(n);
      expand(p.x, p.y, hw, hh);
    }

    if (!Number.isFinite(minX)) {
      out.set(canvasId, { ...meta });
      continue;
    }

    minX -= MASTER_REGION_PAD;
    maxX += MASTER_REGION_PAD;
    minY -= MASTER_REGION_PAD;
    maxY += MASTER_REGION_PAD;

    const w = maxX - minX;
    const h = maxY - minY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const masterHubX = cx;
    const masterHubY = minY + hubH / 2 + 24;

    out.set(canvasId, {
      ...meta,
      cx,
      cy,
      halfW: w / 2,
      halfH: h / 2,
      masterHubX,
      masterHubY,
    });
  }
  return out;
}

export function getDynamicMasterCanvasRegionsForInteraction(
  staticRegions: Map<string, MasterCanvasRegion>,
  nodes: GraphNode[],
  nodePositions: Map<string, { x: number; y: number }>
): Map<string, MasterCanvasRegion> {
  if (staticRegions.size === 0) return staticRegions;
  return computeDynamicMasterCanvasRegions(staticRegions, nodes, nodePositions);
}

/**
 * Master view canvas chrome: rounded tint + label at top-left of the given bounds.
 * Pass {@link computeDynamicMasterCanvasRegions} output so the frame follows nodes.
 */
export function drawMasterCanvasRegions(
  ctx: CanvasRenderingContext2D,
  regions: Map<string, MasterCanvasRegion>
): void {
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";

  for (const [, r] of regions) {
    const w = r.halfW * 2;
    const h = r.halfH * 2;
    const x = r.cx - r.halfW;
    const y = r.cy - r.halfH;
    const labelPad = 12;
    const labelH = 26;

    ctx.save();
    const fill = hexToRgbaSafe(r.tintColor, isDark ? 0.09 : 0.07, "#888780");
    ctx.fillStyle = fill;
    ctx.strokeStyle = isDark
      ? "rgba(255,255,255,0.08)"
      : "rgba(0,0,0,0.08)";
    ctx.lineWidth = 1;
    roundRect(ctx, x, y, w, h, 16);
    ctx.fill();
    ctx.stroke();

    ctx.font = "600 15px system-ui, sans-serif";
    ctx.fillStyle = isDark ? "rgba(230,230,235,0.42)" : "rgba(30,30,35,0.45)";
    const label = `${r.emoji ?? ""} ${r.name}`.trim().slice(0, 48);
    ctx.fillText(label, x + labelPad, y + labelH);
    ctx.restore();
  }
}
