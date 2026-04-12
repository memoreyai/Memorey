import type { CategoryVault, GraphNode } from "@/types/memorey";
import {
  VAULT_HEADER_H,
  VAULT_HEADER_R,
  MASTER_W,
  MASTER_H_WITH_BIO,
  MASTER_H_WITHOUT_BIO,
} from "../constants/dimensions";
import { graphNodeCardWorldDimensions } from "../lib/graphNodeDimensions";
import {
  hexToRgba,
  hexToRgbaSafe,
  vaultColorForNode,
} from "../constants/colors";
import { truncate } from "./utils";
import {
  computeVaultHeaderLayout,
  estimateVaultCountChipWidth,
  getVaultHeaderRects,
  VAULT_ICON_SLOT,
} from "./vaultHeaderLayout";
import {
  ensureLucideIconImage,
  getLucideIconImageSync,
} from "@/lib/lucideIconCanvasCache";
import { resolveVaultPill } from "@/lib/vaultThemeResolve";
import { masterVaultKey } from "../layout/masterLayout";

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

function computeVaultGroupBounds(
  groupPos: { x: number; y: number },
  vaultNodes: GraphNode[],
  nodePositionsMap: Map<string, { x: number; y: number }>,
  isCollapsed: boolean,
  vault: CategoryVault
): { x: number; y: number; w: number; h: number } {
  const positionedCount = vaultNodes.filter((n) =>
    nodePositionsMap.has(n.id)
  ).length;
  const includePlus = vault.isActive && !vault.isLocked;
  const hasIcon = Boolean(vault.iconKey?.trim());
  const { headerWidth } = computeVaultHeaderLayout(
    vault.name,
    positionedCount,
    includePlus,
    hasIcon
  );
  const pillLeft = groupPos.x - headerWidth / 2;
  const pillRight = groupPos.x + headerWidth / 2;
  const pillTop = groupPos.y - VAULT_HEADER_H / 2;
  const pillBottom = groupPos.y + VAULT_HEADER_H / 2;

  if (isCollapsed || vaultNodes.length === 0) {
    const PADDING = 8;
    return {
      x: pillLeft - PADDING,
      y: pillTop - PADDING,
      w: headerWidth + PADDING * 2,
      h: VAULT_HEADER_H + PADDING * 2,
    };
  }

  let minX = pillLeft;
  let maxX = pillRight;
  let minY = pillTop;

  for (const node of vaultNodes) {
    const pos = nodePositionsMap.get(node.id);
    if (!pos) continue;
    const { w, h } = graphNodeCardWorldDimensions(node);
    minX = Math.min(minX, pos.x - w / 2);
    maxX = Math.max(maxX, pos.x + w / 2);
    minY = Math.min(minY, pos.y - h / 2);
  }

  let maxY = pillBottom;
  for (const node of vaultNodes) {
    const pos = nodePositionsMap.get(node.id);
    if (!pos) continue;
    const { h } = graphNodeCardWorldDimensions(node);
    maxY = Math.max(maxY, pos.y + h / 2);
  }

  const PADDING = 16;
  return {
    x: minX - PADDING,
    y: minY - PADDING,
    w: maxX - minX + PADDING * 2,
    h: maxY - minY + PADDING * 2,
  };
}

/** Group tint + border only. Alpha lives in the color hex suffix, not globalAlpha. */
export function drawVaultGroupBackground(
  ctx: CanvasRenderingContext2D,
  vault: CategoryVault,
  groupPos: { x: number; y: number },
  bounds: { x: number; y: number; w: number; h: number },
  options: { isCollapsed: boolean }
): void {
  ctx.save();
  ctx.globalAlpha = 1;
  const base = vault.color || vaultColorForNode({ category: vault.name });
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";

  ctx.fillStyle = isDark ? base + "0A" : base + "08";
  ctx.beginPath();
  roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 14);
  ctx.fill();

  ctx.strokeStyle = isDark ? base + "18" : base + "14";
  ctx.lineWidth = 0.75;
  ctx.setLineDash([]);
  ctx.stroke();

  if (options.isCollapsed) {
    ctx.strokeStyle = base + "33";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    roundRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h, 12);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  ctx.restore();
}

export function drawVaultGroupHeader(
  ctx: CanvasRenderingContext2D,
  vault: CategoryVault,
  groupPos: { x: number; y: number },
  options: {
    vaultNodes: GraphNode[];
    isCollapsed: boolean;
    isDragging: boolean;
    nodePositions: Map<string, { x: number; y: number }>;
    emptyVaultHoverId: string | null;
    gearHoverId: string | null;
    vaultPlusHoverId: string | null;
    frameCount: number;
  }
): void {
  void options.frameCount;
  ctx.save();
  ctx.globalAlpha = 1;
  const base = vault.color || vaultColorForNode({ category: vault.name });
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";
  const { fill: pillFillResolved, border: strokeTint, text: textTint } =
    resolveVaultPill(vault, isDark);

  const positionedCount = options.vaultNodes.filter((n) =>
    options.nodePositions.has(n.id)
  ).length;
  const countW = estimateVaultCountChipWidth(positionedCount);
  const showVaultPlus = vault.isActive && !vault.isLocked;
  const hasIcon = Boolean(vault.iconKey?.trim());
  const iconKeyTrim = vault.iconKey?.trim();
  if (iconKeyTrim) {
    ensureLucideIconImage(iconKeyTrim, textTint, VAULT_ICON_SLOT, () => {});
  }
  const layoutDims = computeVaultHeaderLayout(
    vault.name,
    positionedCount,
    showVaultPlus,
    hasIcon
  );
  const headerWidth = layoutDims.headerWidth;
  const hx = groupPos.x - headerWidth / 2;
  const hy = groupPos.y - VAULT_HEADER_H / 2;

  const isHoveringPill =
    options.gearHoverId === vault.id ||
    options.vaultPlusHoverId === vault.id ||
    options.isDragging;

  roundRect(ctx, hx, hy, headerWidth, VAULT_HEADER_H, VAULT_HEADER_R);
  ctx.fillStyle = pillFillResolved;
  ctx.fill();
  ctx.strokeStyle = strokeTint + (isHoveringPill ? "CC" : "AA");
  ctx.lineWidth = isHoveringPill ? 1.75 : 1.5;
  ctx.stroke();

  const rects = getVaultHeaderRects(
    groupPos,
    countW,
    showVaultPlus,
    headerWidth,
    hasIcon,
    layoutDims
  );
  const countStr = String(positionedCount);

  const iconImg =
    iconKeyTrim && hasIcon
      ? getLucideIconImageSync(iconKeyTrim, textTint, VAULT_ICON_SLOT)
      : null;
  if (iconImg && rects.hasIcon) {
    ctx.drawImage(
      iconImg,
      rects.iconLeft,
      groupPos.y - VAULT_ICON_SLOT / 2,
      VAULT_ICON_SLOT,
      VAULT_ICON_SLOT
    );
  }

  ctx.font = "600 11px Inter, system-ui, sans-serif";
  ctx.fillStyle = textTint;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.fillText(
    truncate(ctx, vault.name, rects.titleMaxWidth),
    rects.nameX,
    groupPos.y
  );
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  ctx.font = "500 9px Inter, system-ui, sans-serif";
  const cr = rects.count;
  ctx.fillStyle = textTint + "33";
  ctx.beginPath();
  roundRect(ctx, cr.left, cr.top, cr.w, cr.h, 8);
  ctx.fill();

  ctx.fillStyle = textTint;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(countStr, cr.left + cr.w / 2, groupPos.y);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  if (showVaultPlus) {
    const pr = rects.plus;
    const isPlusHover = options.vaultPlusHoverId === vault.id;
    ctx.fillStyle = hexToRgbaSafe(
      textTint,
      isPlusHover ? 0.28 : 0.14,
      hexToRgba(base, isPlusHover ? 0.28 : 0.14)
    );
    roundRect(ctx, pr.left, pr.top, pr.w, pr.h, 6);
    ctx.fill();
    ctx.strokeStyle = textTint + (isPlusHover ? "AA" : "55");
    ctx.lineWidth = 1;
    ctx.stroke();
    const pcx = pr.left + pr.w / 2;
    const pcy = groupPos.y;
    const ph = 6;
    ctx.strokeStyle = textTint + "DD";
    ctx.lineWidth = 1.35;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(pcx - ph, pcy);
    ctx.lineTo(pcx + ph, pcy);
    ctx.moveTo(pcx, pcy - ph);
    ctx.lineTo(pcx, pcy + ph);
    ctx.stroke();
  }

  const gearCX = rects.gear.left + rects.gear.w / 2;
  const gearCY = groupPos.y;
  const isGearHover = options.gearHoverId === vault.id;
  const gearColor = textTint + (isGearHover ? "EE" : "88");

  ctx.save();
  ctx.translate(gearCX, gearCY);

  ctx.strokeStyle = gearColor;
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, 4.5, 0, Math.PI * 2);
  ctx.stroke();

  ctx.fillStyle = gearColor;
  ctx.beginPath();
  ctx.arc(0, 0, 1.5, 0, Math.PI * 2);
  ctx.fill();

  for (let t = 0; t < 4; t++) {
    const angle = (t / 4) * Math.PI * 2;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(cos * 4.5, sin * 4.5);
    ctx.lineTo(cos * 6.5, sin * 6.5);
    ctx.stroke();
  }

  if (vault.isLocked) {
    ctx.fillStyle = textTint;
    ctx.beginPath();
    ctx.arc(0, 0, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();

  const chevX = rects.collapse.left + rects.collapse.w / 2;
  const chevY = groupPos.y;
  const chevColor = textTint + "AA";
  const chevSize = 3.5;

  ctx.save();
  ctx.translate(chevX, chevY);
  ctx.strokeStyle = chevColor;
  ctx.lineWidth = 1.5;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  if (options.isCollapsed) {
    ctx.moveTo(-chevSize * 0.5, -chevSize);
    ctx.lineTo(chevSize * 0.5, 0);
    ctx.lineTo(-chevSize * 0.5, chevSize);
  } else {
    ctx.moveTo(-chevSize, -chevSize * 0.5);
    ctx.lineTo(0, chevSize * 0.5);
    ctx.lineTo(chevSize, -chevSize * 0.5);
  }
  ctx.stroke();
  ctx.restore();

  if (
    options.vaultNodes.length === 0 &&
    !options.isCollapsed &&
    vault.isActive
  ) {
    const btnW = 120;
    const btnH = 28;
    const btnX = groupPos.x - btnW / 2;
    const btnY = groupPos.y + VAULT_HEADER_H / 2 + 14;
    const hov = options.emptyVaultHoverId === vault.id;
    ctx.fillStyle = hexToRgba(textTint, hov ? 0.35 : 0.2);
    roundRect(ctx, btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = hexToRgba(textTint, 0.5);
    ctx.stroke();
    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillStyle = isDark ? "#e8e8e8" : "#1a1a1a";
    ctx.textBaseline = "middle";
    ctx.fillText("+ Add memory", btnX + 14, btnY + btnH / 2);
    ctx.textBaseline = "alphabetic";
  }

  ctx.restore();
}

/** @internal — shared bounds for background + hit testing if needed */
export function getVaultGroupBounds(
  groupPos: { x: number; y: number },
  vaultNodes: GraphNode[],
  nodePositions: Map<string, { x: number; y: number }>,
  isCollapsed: boolean,
  vault: CategoryVault
): { x: number; y: number; w: number; h: number } {
  return computeVaultGroupBounds(
    groupPos,
    vaultNodes,
    nodePositions,
    isCollapsed,
    vault
  );
}

/**
 * Master node center (0,0): exit toward vault at the midpoint of the edge that
 * faces the vault — vertical center for left/right edges, horizontal center for top/bottom.
 */
function exitFromMasterFacingVault(
  vx: number,
  vy: number,
  mw: number,
  mh: number
): { x: number; y: number } {
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  const eps = 1e-9;
  if (ax >= ay) {
    if (vx > eps) return { x: mw, y: 0 };
    if (vx < -eps) return { x: -mw, y: 0 };
    return { x: 0, y: vy >= 0 ? mh : -mh };
  }
  if (vy > eps) return { x: 0, y: mh };
  if (vy < -eps) return { x: 0, y: -mh };
  return { x: mw, y: 0 };
}

/**
 * Vault pill: attach at the midpoint of the edge facing the master (same |vx| vs |vy| rule).
 */
function entryOnVaultPillFacingMaster(
  vx: number,
  vy: number,
  halfW: number,
  halfH: number,
  gap: number
): { x: number; y: number } {
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  const eps = 1e-9;
  if (ax >= ay) {
    if (vx > eps) return { x: vx - halfW - gap, y: vy };
    if (vx < -eps) return { x: vx + halfW + gap, y: vy };
    return { x: vx, y: vy + (vy >= 0 ? -halfH - gap : halfH + gap) };
  }
  if (vy > eps) return { x: vx, y: vy - halfH - gap };
  if (vy < -eps) return { x: vx, y: vy + halfH + gap };
  return { x: vx - halfW - gap, y: vy };
}

/** Which edge of the pill the line attaches to — drives orthogonal path so the last segment meets the edge cleanly (not like an underline). */
function vaultEntryEdgeKind(
  vx: number,
  vy: number
): "left" | "right" | "top" | "bottom" {
  const ax = Math.abs(vx);
  const ay = Math.abs(vy);
  const eps = 1e-9;
  if (ax >= ay) {
    if (vx > eps) return "left";
    if (vx < -eps) return "right";
    return vy >= 0 ? "top" : "bottom";
  }
  if (vy > eps) return "top";
  if (vy < -eps) return "bottom";
  return "left";
}

export function drawMasterToVaultLines(
  ctx: CanvasRenderingContext2D,
  vaults: CategoryVault[],
  vaultGroupPositions: Map<string, { x: number; y: number }>,
  frameCount: number,
  _edgeStyle: string,
  _edgeColor: string | null,
  masterLineStyle: string,
  masterLineColor: string | null,
  masterHasBio: boolean
): void {
  const masterBodyH = masterHasBio
    ? MASTER_H_WITH_BIO
    : MASTER_H_WITHOUT_BIO;

  for (const vault of vaults) {
    if (!vault.isActive) continue;
    const groupPos = vaultGroupPositions.get(vault.id);
    if (!groupPos) continue;

    const lineColor =
      masterLineColor ??
      (vault.color || vaultColorForNode({ category: vault.name }));

    const vx = groupPos.x;
    const vy = groupPos.y;
    if (Math.hypot(vx, vy) < 1e-6) continue;

    const mw = MASTER_W / 2 + 6;
    const mh = masterBodyH / 2 + 6;
    const { x: exitX, y: exitY } = exitFromMasterFacingVault(vx, vy, mw, mh);

    const includePlus = vault.isActive && !vault.isLocked;
    const hasIcon = Boolean(vault.iconKey?.trim());
    const { headerWidth } = computeVaultHeaderLayout(
      vault.name,
      0,
      includePlus,
      hasIcon
    );
    const halfW = headerWidth / 2;
    const halfH = VAULT_HEADER_H / 2;
    const gap = 4;
    const { x: entryX, y: entryY } = entryOnVaultPillFacingMaster(
      vx,
      vy,
      halfW,
      halfH,
      gap
    );

    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") !== "light";
    const isCurved = masterLineStyle.startsWith("curved");
    const isDashed = masterLineStyle.endsWith("dashed");
    const isStraight = masterLineStyle.startsWith("straight");
    const dashPat = isDashed ? [5, 4] : [1.5, 5];

    ctx.save();

    const edgeKind = vaultEntryEdgeKind(vx, vy);

    const drawPath = () => {
      ctx.beginPath();
      if (isCurved) {
        const ox = (entryX - exitX) * 0.38;
        const oy = (entryY - exitY) * 0.38;
        ctx.moveTo(exitX, exitY);
        ctx.bezierCurveTo(
          exitX + ox,
          exitY + oy,
          entryX - ox,
          entryY - oy,
          entryX,
          entryY
        );
      } else if (isStraight) {
        ctx.moveTo(exitX, exitY);
        ctx.lineTo(entryX, entryY);
      } else {
        // Orthogonal: last segment must be perpendicular to the pill edge
        // (horizontal into left/right edge; vertical into top/bottom edge).
        if (edgeKind === "left" || edgeKind === "right") {
          ctx.moveTo(exitX, exitY);
          ctx.lineTo(exitX, entryY);
          ctx.lineTo(entryX, entryY);
        } else {
          ctx.moveTo(exitX, exitY);
          ctx.lineTo(entryX, exitY);
          ctx.lineTo(entryX, entryY);
        }
      }
    };

    ctx.strokeStyle = lineColor + (isDark ? "44" : "33");
    ctx.lineWidth = 1.25;
    ctx.setLineDash(dashPat);
    ctx.lineDashOffset = 0;
    ctx.lineJoin = "round";
    drawPath();
    ctx.stroke();

    ctx.strokeStyle = lineColor + (isDark ? "BB" : "99");
    ctx.lineWidth = 2;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 5;
    ctx.setLineDash(dashPat);
    ctx.lineDashOffset =
      -(frameCount * 0.3) % (dashPat[0] + dashPat[1]);
    drawPath();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.restore();
  }
}

/** Master→vault spokes when the hub is not at the world origin (master graph per canvas). */
export function drawMasterToVaultLinesFromHub(
  ctx: CanvasRenderingContext2D,
  hubX: number,
  hubY: number,
  canvasId: string,
  vaults: CategoryVault[],
  vaultGroupPositions: Map<string, { x: number; y: number }>,
  frameCount: number,
  masterLineStyle: string,
  masterLineColor: string | null,
  masterHasBio: boolean
): void {
  const masterBodyH = masterHasBio
    ? MASTER_H_WITH_BIO
    : MASTER_H_WITHOUT_BIO;

  for (const vault of vaults) {
    if (!vault.isActive) continue;
    const groupPos = vaultGroupPositions.get(masterVaultKey(canvasId, vault.id));
    if (!groupPos) continue;

    const lineColor =
      masterLineColor ??
      (vault.color || vaultColorForNode({ category: vault.name }));

    const vx = groupPos.x - hubX;
    const vy = groupPos.y - hubY;
    if (Math.hypot(vx, vy) < 1e-6) continue;

    const mw = MASTER_W / 2 + 6;
    const mh = masterBodyH / 2 + 6;
    const ex = exitFromMasterFacingVault(vx, vy, mw, mh);
    const exitX = ex.x + hubX;
    const exitY = ex.y + hubY;

    const includePlus = vault.isActive && !vault.isLocked;
    const hasIcon = Boolean(vault.iconKey?.trim());
    const { headerWidth } = computeVaultHeaderLayout(
      vault.name,
      0,
      includePlus,
      hasIcon
    );
    const halfW = headerWidth / 2;
    const halfH = VAULT_HEADER_H / 2;
    const gap = 4;
    const en = entryOnVaultPillFacingMaster(vx, vy, halfW, halfH, gap);
    const entryX = en.x + hubX;
    const entryY = en.y + hubY;

    const isDark =
      typeof document !== "undefined" &&
      document.documentElement.getAttribute("data-theme") !== "light";
    const isCurved = masterLineStyle.startsWith("curved");
    const isDashed = masterLineStyle.endsWith("dashed");
    const isStraight = masterLineStyle.startsWith("straight");
    const dashPat = isDashed ? [5, 4] : [1.5, 5];

    ctx.save();

    const edgeKind = vaultEntryEdgeKind(vx, vy);

    const drawPath = () => {
      ctx.beginPath();
      if (isCurved) {
        const ox = (entryX - exitX) * 0.38;
        const oy = (entryY - exitY) * 0.38;
        ctx.moveTo(exitX, exitY);
        ctx.bezierCurveTo(
          exitX + ox,
          exitY + oy,
          entryX - ox,
          entryY - oy,
          entryX,
          entryY
        );
      } else if (isStraight) {
        ctx.moveTo(exitX, exitY);
        ctx.lineTo(entryX, entryY);
      } else {
        if (edgeKind === "left" || edgeKind === "right") {
          ctx.moveTo(exitX, exitY);
          ctx.lineTo(exitX, entryY);
          ctx.lineTo(entryX, entryY);
        } else {
          ctx.moveTo(exitX, exitY);
          ctx.lineTo(entryX, exitY);
          ctx.lineTo(entryX, entryY);
        }
      }
    };

    ctx.strokeStyle = lineColor + (isDark ? "44" : "33");
    ctx.lineWidth = 1.25;
    ctx.setLineDash(dashPat);
    ctx.lineDashOffset = 0;
    ctx.lineJoin = "round";
    drawPath();
    ctx.stroke();

    ctx.strokeStyle = lineColor + (isDark ? "BB" : "99");
    ctx.lineWidth = 2;
    ctx.shadowColor = lineColor;
    ctx.shadowBlur = 5;
    ctx.setLineDash(dashPat);
    ctx.lineDashOffset =
      -(frameCount * 0.3) % (dashPat[0] + dashPat[1]);
    drawPath();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.setLineDash([]);
    ctx.restore();
  }
}
