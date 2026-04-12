import type { EdgeStyle } from "../types/canvas.types";
import { EDGE_OFFSET } from "../constants/dimensions";
import { edgeArrowFill, hexToRgbaSafe } from "../constants/colors";

export type Face = "left" | "right" | "top" | "bottom";

export interface EdgePoint {
  x: number;
  y: number;
}

export function getFacePoint(
  cx: number,
  cy: number,
  face: Face,
  hw: number,
  hh: number
): EdgePoint {
  switch (face) {
    case "left":
      return { x: cx - hw, y: cy };
    case "right":
      return { x: cx + hw, y: cy };
    case "top":
      return { x: cx, y: cy - hh };
    default:
      return { x: cx, y: cy + hh };
  }
}

export function getExitFace(
  sx: number,
  sy: number,
  tx: number,
  ty: number
): Face {
  const dx = tx - sx;
  const dy = ty - sy;
  if (Math.abs(dx) >= Math.abs(dy)) {
    return dx >= 0 ? "right" : "left";
  }
  return dy >= 0 ? "bottom" : "top";
}

export function getEntryFace(
  _exitFace: Face,
  sx: number,
  sy: number,
  tx: number,
  ty: number
): Face {
  return getExitFace(tx, ty, sx, sy);
}

function offsetAlongFace(
  p: EdgePoint,
  face: Face,
  dist: number
): EdgePoint {
  switch (face) {
    case "left":
      return { x: p.x - dist, y: p.y };
    case "right":
      return { x: p.x + dist, y: p.y };
    case "top":
      return { x: p.x, y: p.y - dist };
    default:
      return { x: p.x, y: p.y + dist };
  }
}

export function buildOrthogonalPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sHw: number,
  sHh: number,
  tHw: number,
  tHh: number
): EdgePoint[] {
  const dist = Math.hypot(tx - sx, ty - sy);
  if (dist < sHw + tHw + 40) {
    const exitF = getExitFace(sx, sy, tx, ty);
    const entryF = getExitFace(tx, ty, sx, sy);
    const start = getFacePoint(sx, sy, exitF, sHw, sHh);
    const end = getFacePoint(tx, ty, entryF, tHw, tHh);
    const midX = (sx + tx) / 2;
    return [start, { x: midX, y: start.y }, { x: midX, y: end.y }, end];
  }

  const exitF = getExitFace(sx, sy, tx, ty);
  const entryF = getEntryFace(exitF, sx, sy, tx, ty);
  const a0 = getFacePoint(sx, sy, exitF, sHw, sHh);
  const a1 = offsetAlongFace(a0, exitF, EDGE_OFFSET);
  const b0 = getFacePoint(tx, ty, entryF, tHw, tHh);
  const b1 = offsetAlongFace(b0, entryF, EDGE_OFFSET);

  if (exitF === "left" || exitF === "right") {
    const midX = (a1.x + b1.x) / 2;
    return [a0, a1, { x: midX, y: a1.y }, { x: midX, y: b1.y }, b1, b0];
  }
  const midY = (a1.y + b1.y) / 2;
  return [a0, a1, { x: a1.x, y: midY }, { x: b1.x, y: midY }, b1, b0];
}

export function buildCurvedPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  sHw: number,
  sHh: number,
  tHw: number,
  tHh: number
): EdgePoint[] {
  const exitF = getExitFace(sx, sy, tx, ty);
  const entryF = getEntryFace(exitF, sx, sy, tx, ty);
  const a0 = getFacePoint(sx, sy, exitF, sHw, sHh);
  const b0 = getFacePoint(tx, ty, entryF, tHw, tHh);
  const a1 = offsetAlongFace(a0, exitF, EDGE_OFFSET * 1.5);
  const b1 = offsetAlongFace(b0, entryF, EDGE_OFFSET * 1.5);
  const cx = (a1.x + b1.x) / 2;
  const cy = (a1.y + b1.y) / 2;
  return [a0, a1, { x: cx, y: cy }, b1, b0];
}

function strokeEdgePath(
  ctx: CanvasRenderingContext2D,
  pts: EdgePoint[],
  ortho: boolean
): void {
  if (pts.length < 2) return;
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  if (ortho) {
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
  } else if (pts.length >= 5) {
    ctx.lineTo(pts[1].x, pts[1].y);
    ctx.quadraticCurveTo(pts[2].x, pts[2].y, pts[3].x, pts[3].y);
    ctx.lineTo(pts[4].x, pts[4].y);
  } else {
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
  }
}

function drawArrow(
  ctx: CanvasRenderingContext2D,
  tx: number,
  ty: number,
  sx: number,
  sy: number,
  L = 10,
  w = 5
): void {
  const ang = Math.atan2(ty - sy, tx - sx);
  ctx.beginPath();
  ctx.moveTo(tx, ty);
  ctx.lineTo(
    tx - L * Math.cos(ang) + w * Math.sin(ang),
    ty - L * Math.sin(ang) - w * Math.cos(ang)
  );
  ctx.lineTo(
    tx - L * Math.cos(ang) - w * Math.sin(ang),
    ty - L * Math.sin(ang) + w * Math.cos(ang)
  );
  ctx.closePath();
  ctx.fill();
}

function rgbHexForGlow(color: string, fallback: string): string {
  const raw = (color?.trim() || fallback).replace("#", "");
  if (raw.length >= 6 && /^[0-9A-Fa-f]{6}/i.test(raw.slice(0, 6)))
    return `#${raw.slice(0, 6)}`;
  const fb = fallback.replace("#", "");
  if (fb.length >= 6) return `#${fb.slice(0, 6)}`;
  return "#888780";
}

function hexWithByteAlpha(hex6: string, alpha01: number): string {
  const h = hex6.replace("#", "");
  const a = Math.round(Math.max(0, Math.min(1, alpha01)) * 255);
  return `#${h.slice(0, 6)}${a.toString(16).padStart(2, "0")}`;
}

export function drawEdge(
  ctx: CanvasRenderingContext2D,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  strength: number,
  style: EdgeStyle,
  frame: number,
  color: string,
  highlighted: boolean,
  isDimmed?: boolean,
  overrideColor?: string | null,
  /** Master graph: thinner stroke between different canvases */
  crossCanvas?: boolean
): void {
  const sHw = 100;
  const sHh = 40;
  const tHw = 100;
  const tHh = 40;
  const effectiveStyle: EdgeStyle = isDimmed
    ? "orthogonal-dashed"
    : style;
  const ortho = effectiveStyle.startsWith("orthogonal");
  const dashed = effectiveStyle.includes("dashed");
  const dotted = effectiveStyle.includes("dotted");
  const pts = ortho
    ? buildOrthogonalPath(sx, sy, tx, ty, sHw, sHh, tHw, tHh)
    : buildCurvedPath(sx, sy, tx, ty, sHw, sHh, tHw, tHh);

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";
  const str =
    typeof strength === "number" && !Number.isNaN(strength) ? strength : 0.5;

  let baseOpacity = highlighted ? 0.65 : 0.35 + str * 0.15;
  if (isDimmed) baseOpacity *= 0.5;

  const dash = dotted ? [2, 6] : [8, 6];
  const dashOff = -(frame * 0.35) % 20;

  const sourceHex = rgbHexForGlow(color, color);
  const hasUserEdgeColor =
    overrideColor != null && String(overrideColor).trim() !== "";
  const glowHexBase = rgbHexForGlow(
    hasUserEdgeColor ? overrideColor! : color,
    color
  );

  const glowOpacity = isDimmed
    ? highlighted
      ? 0.55
      : 0.4
    : highlighted
      ? 0.95
      : 0.75;
  const glowStroke = hexWithByteAlpha(glowHexBase, glowOpacity);

  const thin = crossCanvas ? 0.55 : 1;

  ctx.save();
  strokeEdgePath(ctx, pts, ortho);
  ctx.strokeStyle = hasUserEdgeColor
    ? hexWithByteAlpha(rgbHexForGlow(overrideColor!, color), baseOpacity * 0.85)
    : isDark
      ? `rgba(255,255,255,${baseOpacity})`
      : `rgba(0,0,0,${baseOpacity})`;
  ctx.lineWidth = 1 * thin;
  ctx.globalAlpha = 1;
  ctx.setLineDash(dashed || dotted ? dash : []);
  ctx.lineDashOffset = dashOff;
  ctx.stroke();

  strokeEdgePath(ctx, pts, ortho);
  ctx.strokeStyle = glowStroke;
  ctx.lineWidth = (dashed ? 2 : 1.5) * thin;
  ctx.globalAlpha = 1;
  ctx.shadowColor = glowHexBase;
  ctx.shadowBlur = (highlighted ? 8 : isDimmed ? 3 : 5) * (crossCanvas ? 0.5 : 1);
  ctx.setLineDash(dashed || dotted ? dash : []);
  ctx.lineDashOffset = dashOff;
  ctx.stroke();
  ctx.shadowBlur = 0;

  const pen = pts[pts.length - 2] ?? pts[0];
  const end = pts[pts.length - 1] ?? pen;
  ctx.fillStyle =
    overrideColor != null && overrideColor !== ""
      ? hexToRgbaSafe(overrideColor, isDimmed ? 0.55 : 0.92, sourceHex)
      : edgeArrowFill();
  drawArrow(
    ctx,
    end.x,
    end.y,
    pen.x,
    pen.y,
    (isDimmed ? 7 : 10) * thin,
    (isDimmed ? 3.5 : 5) * thin
  );

  ctx.restore();
}
