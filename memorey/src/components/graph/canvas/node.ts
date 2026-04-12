import type { GraphNode, MemoryNode } from "@/types/memorey";
import { getOrLoadImage } from "./fileNode";
import {
  NODE_W,
  NODE_H,
  NODE_R,
  ATTACH_W,
  ATTACH_H,
  ATTACH_R,
  STICKY_W,
  STICKY_H,
  STICKY_R,
} from "../constants/dimensions";
import {
  vaultColorForNode,
  hexToRgba,
  BRAND_ORANGE,
  STICKY_YELLOW,
  isDarkTheme,
  CANVAS_NODE_BG_DARK_0,
  CANVAS_NODE_BG_DARK_1,
  CANVAS_NODE_BG_LIGHT_0,
  CANVAS_NODE_BG_LIGHT_1,
  CANVAS_BORDER_MUTED,
  CANVAS_STICKY_FOLD,
  CANVAS_STICKY_TITLE,
  CANVAS_STICKY_BODY,
  CANVAS_STICKY_BORDER_HOVER,
  CANVAS_STICKY_BORDER,
  canvasPrimaryText,
  canvasValueText,
  canvasAttachFill,
  canvasAttachLabel,
  themeCssColor,
} from "../constants/colors";
import { truncate } from "./utils";

/** Force 6-digit hex so card fill is fully opaque (ignore #RRGGBBAA alpha). */
function opaqueCustomBg(hex: string): string {
  const t = hex.trim();
  if (/^#[0-9A-Fa-f]{8}$/i.test(t)) return t.slice(0, 7);
  return t;
}

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

export function drawMemoryNode(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  sx: number,
  sy: number,
  options: {
    isHovered: boolean;
    isSelected: boolean;
    isHighlighted: boolean;
    isMuted: boolean;
    accentColor: string;
    inConnectMode: boolean;
    crossVaultLabel?: string;
    frameCount: number;
    /** When true (e.g. node clicked for peek), show link preview image in the card. */
    showOgImagePreview?: boolean;
    requestRedraw?: () => void;
  }
): void {
  ctx.save();
  ctx.globalAlpha = options.isMuted ? 0.32 : 1;
  const x = sx - NODE_W / 2;
  const y = sy - NODE_H / 2;
  const g = ctx.createLinearGradient(x, y, x + NODE_W, y + NODE_H);
  const stop0 = themeCssColor("--bg3", isDarkTheme() ? CANVAS_NODE_BG_DARK_0 : CANVAS_NODE_BG_LIGHT_0);
  const stop1 = themeCssColor("--bg2", isDarkTheme() ? CANVAS_NODE_BG_DARK_1 : CANVAS_NODE_BG_LIGHT_1);
  g.addColorStop(0, stop0);
  g.addColorStop(1, stop1);

  roundRect(ctx, x, y, NODE_W, NODE_H, NODE_R);
  ctx.fillStyle = node.customBgColor
    ? opaqueCustomBg(node.customBgColor)
    : g;
  ctx.fill();
  const borderAccent = options.accentColor;
  ctx.strokeStyle = options.isSelected
    ? hexToRgba(borderAccent, 0.92)
    : hexToRgba(borderAccent, 0.5);
  ctx.lineWidth = options.isSelected ? 2 : 1;
  ctx.stroke();

  const mem = node as unknown as MemoryNode;
  const ogUrl =
    options.showOgImagePreview && mem.ogImage ? String(mem.ogImage) : null;
  const PREVIEW_H = 30;
  if (ogUrl) {
    const img = getOrLoadImage(ogUrl, () => options.requestRedraw?.());
    ctx.save();
    ctx.beginPath();
    roundRect(ctx, x, y, NODE_W, NODE_H, NODE_R);
    ctx.clip();
    if (img) {
      const iw = img.naturalWidth || img.width;
      const ih = img.naturalHeight || img.height;
      if (iw > 0 && ih > 0) {
        const ar = iw / ih;
        let dw = NODE_W;
        let dh = PREVIEW_H;
        if (ar > NODE_W / PREVIEW_H) {
          dh = PREVIEW_H;
          dw = dh * ar;
        } else {
          dw = NODE_W;
          dh = dw / ar;
        }
        const dx = x + (NODE_W - dw) / 2;
        const dy = y + (PREVIEW_H - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
      }
    } else {
      ctx.fillStyle = hexToRgba(borderAccent, 0.12);
      ctx.fillRect(x, y, NODE_W, PREVIEW_H);
    }
    ctx.restore();
  }

  const textTop = y + (ogUrl ? PREVIEW_H + 2 : 6);
  ctx.fillStyle = options.accentColor;
  if (ogUrl) {
    ctx.fillRect(x, textTop, 4, y + NODE_H - textTop - 6);
  } else {
    ctx.fillRect(x, y + 6, 4, NODE_H - 12);
  }

  ctx.font = "600 10px system-ui, sans-serif";
  ctx.fillStyle = hexToRgba(options.accentColor, 0.95);
  const badge = truncate(ctx, node.category || "Vault", NODE_W - 56);
  const badgeY = ogUrl ? textTop + 10 : y + 18;
  ctx.fillText(badge, x + 12, badgeY);
  if (node.canvasEmoji) {
    ctx.font = "13px system-ui, sans-serif";
    ctx.fillStyle = themeCssColor("--text2", canvasValueText());
    ctx.fillText(node.canvasEmoji, x + NODE_W - 26, badgeY);
  }

  ctx.fillStyle =
    node.customTextColor ?? themeCssColor("--text", canvasPrimaryText());
  ctx.font = "600 12px system-ui, sans-serif";
  const titleY = ogUrl ? textTop + 24 : y + 38;
  ctx.fillText(truncate(ctx, node.title || "Untitled", NODE_W - 24), x + 12, titleY);

  if (node.value) {
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = node.customTextColor
      ? hexToRgba(node.customTextColor, 0.88)
      : themeCssColor("--text2", canvasValueText());
    const lines = truncate(ctx, node.value.replace(/\s+/g, " "), NODE_W - 24);
    const valueY = ogUrl ? textTop + 38 : y + 54;
    ctx.fillText(lines, x + 12, valueY);
  }

  const ac = node.attachmentCount ?? 0;
  if (ac > 0) {
    const BADGE_SIZE = 16;
    const BADGE_R = 4;
    const bx = sx + NODE_W / 2 - BADGE_SIZE - 4;
    const by = sy + NODE_H / 2 - BADGE_SIZE - 4;

    ctx.fillStyle = "#4FC1E9";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(bx, by, BADGE_SIZE, BADGE_SIZE, BADGE_R);
    } else {
      roundRect(ctx, bx, by, BADGE_SIZE, BADGE_SIZE, BADGE_R);
    }
    ctx.fill();

    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 0.75;
    ctx.stroke();

    const label = ac > 99 ? "99+" : String(ac);
    ctx.font =
      ac > 9
        ? `bold 6px Inter, system-ui, sans-serif`
        : `bold 7px Inter, system-ui, sans-serif`;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, bx + BADGE_SIZE / 2, by + BADGE_SIZE / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
  }

  if (options.isHovered && !options.inConnectMode && !options.isMuted) {
    ctx.fillStyle = hexToRgba(BRAND_ORANGE, 0.2);
    ctx.beginPath();
    ctx.arc(x + NODE_W - 18, y + 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = BRAND_ORANGE;
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText("+", x + NODE_W - 22, y + 21);
  }

  if (options.crossVaultLabel) {
    ctx.font = "9px system-ui, sans-serif";
    ctx.fillStyle = hexToRgba(BRAND_ORANGE, 0.85);
    ctx.fillText(
      truncate(ctx, options.crossVaultLabel, NODE_W),
      x,
      y + NODE_H + 12
    );
  }

  if (options.isHighlighted) {
    ctx.strokeStyle = hexToRgba(options.accentColor, 0.85);
    ctx.lineWidth = 2;
    ctx.shadowColor = options.accentColor;
    ctx.shadowBlur = 14;
    roundRect(ctx, x - 3, y - 3, NODE_W + 6, NODE_H + 6, NODE_R + 3);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (options.inConnectMode) {
    const pulse = 0.5 + 0.5 * Math.sin(options.frameCount * 0.12);
    ctx.strokeStyle = hexToRgba(BRAND_ORANGE, 0.4 + pulse * 0.4);
    ctx.lineWidth = 2;
    roundRect(ctx, x - 4, y - 4, NODE_W + 8, NODE_H + 8, NODE_R + 4);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawStickyNote(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  sx: number,
  sy: number,
  isHovered: boolean,
  isSelected: boolean
): void {
  ctx.save();
  const x = sx - STICKY_W / 2;
  const y = sy - STICKY_H / 2;
  roundRect(ctx, x, y, STICKY_W, STICKY_H, STICKY_R);
  ctx.fillStyle = STICKY_YELLOW;
  ctx.fill();
  ctx.fillStyle = CANVAS_STICKY_FOLD;
  ctx.beginPath();
  ctx.moveTo(x + STICKY_W - 18, y);
  ctx.lineTo(x + STICKY_W, y + 18);
  ctx.lineTo(x + STICKY_W - 18, y + 18);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = isSelected
    ? BRAND_ORANGE
    : isHovered
      ? CANVAS_STICKY_BORDER_HOVER
      : CANVAS_STICKY_BORDER;
  ctx.lineWidth = isSelected ? 2 : 1;
  roundRect(ctx, x, y, STICKY_W, STICKY_H, STICKY_R);
  ctx.stroke();

  ctx.fillStyle = CANVAS_STICKY_TITLE;
  ctx.font = "600 12px system-ui, sans-serif";
  ctx.fillText(truncate(ctx, node.title || "Note", STICKY_W - 16), x + 8, y + 22);
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = CANVAS_STICKY_BODY;
  ctx.fillText(truncate(ctx, (node.value || "").slice(0, 80), STICKY_W - 16), x + 8, y + 42);

  ctx.restore();
}

function fileLabel(ft: string): string {
  return ft ? ft.toUpperCase().slice(0, 4) : "FILE";
}

export function drawAttachmentNode(
  ctx: CanvasRenderingContext2D,
  node: GraphNode,
  sx: number,
  sy: number,
  isHovered: boolean,
  isSelected: boolean
): void {
  ctx.save();
  const x = sx - ATTACH_W / 2;
  const y = sy - ATTACH_H / 2;
  const att = node.attachment;
  const ft = att?.fileType ?? "other";

  roundRect(ctx, x, y, ATTACH_W, ATTACH_H, ATTACH_R);
  ctx.fillStyle = canvasAttachFill();
  ctx.fill();
  ctx.strokeStyle = isSelected ? vaultColorForNode(node) : CANVAS_BORDER_MUTED;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.stroke();

  const thumbH = 52;
  ctx.fillStyle = hexToRgba(vaultColorForNode(node), 0.15);
  roundRect(ctx, x + 8, y + 8, ATTACH_W - 16, thumbH, 6);
  ctx.fill();

  ctx.font = "600 11px system-ui, sans-serif";
  ctx.fillStyle = canvasAttachLabel();
  ctx.fillText(truncate(ctx, node.title || att?.fileName || "File", ATTACH_W - 20), x + 10, y + thumbH + 24);

  ctx.font = "600 8px system-ui, sans-serif";
  ctx.fillStyle = vaultColorForNode(node);
  ctx.fillText(fileLabel(ft), x + 10, y + thumbH + 40);

  if (att?.fileType === "link" || (att?.fileUrl && /^https?:/i.test(att.fileUrl))) {
    ctx.fillStyle = vaultColorForNode(node);
    ctx.beginPath();
    ctx.moveTo(x + ATTACH_W - 18, y + thumbH + 28);
    ctx.lineTo(x + ATTACH_W - 10, y + thumbH + 36);
    ctx.lineTo(x + ATTACH_W - 18, y + thumbH + 44);
    ctx.stroke();
  }

  if (isHovered) {
    ctx.strokeStyle = hexToRgba(vaultColorForNode(node), 0.5);
    ctx.lineWidth = 1;
    roundRect(ctx, x - 1, y - 1, ATTACH_W + 2, ATTACH_H + 2, ATTACH_R + 1);
    ctx.stroke();
  }

  ctx.restore();
}
