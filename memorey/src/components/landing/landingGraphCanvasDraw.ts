/**
 * Product-aligned card rendering for the landing-page graph demo (world units,
 * drawn under ctx.translate(center); ctx.scale(scale, scale)).
 */

import { getOrLoadImage } from "@/components/graph/canvas/fileNode";
import {
  CANVAS_NODE_BG_DARK_0,
  CANVAS_NODE_BG_DARK_1,
  CANVAS_NODE_BG_LIGHT_0,
  CANVAS_NODE_BG_LIGHT_1,
  canvasPrimaryText,
  canvasValueText,
  hexToRgba,
  themeCssColor,
} from "@/components/graph/constants/colors";
import {
  MASTER_W,
  MASTER_H_WITH_BIO,
  MASTER_H_WITHOUT_BIO,
  MASTER_R,
  NODE_W,
  NODE_H,
  NODE_R,
} from "@/components/graph/constants/dimensions";
import type { GraphNode } from "./landingPageData";
import { VAULTS } from "./landingPageData";

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
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

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number,
): string {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}

/** Screen-space rounded rect around a node's card (for connect-mode UI). */
export function strokeLandingNodeScreenOutline(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  n: GraphNode,
  scale: number,
  opts: {
    stroke: string;
    lineWidth: number;
    dash?: number[];
    dashOffset?: number;
  },
): void {
  const { hw, hh } = landingNodeHalfExtent(n);
  const rw = hw * scale;
  const rh = hh * scale;
  const x = centerX - rw;
  const y = centerY - rh;
  const corner = (n.id === 0 ? MASTER_R : NODE_R) * scale;
  const r = Math.max(3, Math.min(corner, rw, rh));
  ctx.save();
  ctx.beginPath();
  const c = ctx as CanvasRenderingContext2D & {
    roundRect?: (a: number, b: number, w: number, h: number, rad: number) => void;
  };
  if (typeof c.roundRect === "function") {
    c.roundRect(x, y, rw * 2, rh * 2, r);
  } else {
    ctx.rect(x, y, rw * 2, rh * 2);
  }
  ctx.strokeStyle = opts.stroke;
  ctx.lineWidth = opts.lineWidth;
  if (opts.dash?.length) {
    ctx.setLineDash(opts.dash);
    ctx.lineDashOffset = opts.dashOffset ?? 0;
  }
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

export function landingNodeHalfExtent(n: GraphNode): { hw: number; hh: number } {
  if (n.id === 0) {
    const bio = (n.detail ?? "").trim();
    const h = bio.length > 0 ? MASTER_H_WITH_BIO : MASTER_H_WITHOUT_BIO;
    return { hw: MASTER_W / 2, hh: h / 2 };
  }
  return { hw: NODE_W / 2, hh: NODE_H / 2 };
}

export function drawLandingYouCard(
  ctx: CanvasRenderingContext2D,
  n: GraphNode,
  opts: {
    dark: boolean;
    frameCount: number;
    isPeek: boolean;
    inSub: boolean;
  },
): void {
  const color = VAULTS.personal?.color ?? "#FF6600";
  const bio = (n.detail ?? "").trim();
  const H = bio.length > 0 ? MASTER_H_WITH_BIO : MASTER_H_WITHOUT_BIO;
  const W = MASTER_W;
  const R = MASTER_R;
  const AVATAR_SIZE = 32;
  const name = n.label === "YOU" ? "You" : n.label;

  const x = -W / 2;
  const y = -H / 2;

  ctx.save();

  ctx.shadowColor = color + "44";
  ctx.shadowBlur = opts.isPeek ? 18 : 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = opts.dark ? "#1C1710" : "#FFFFFF";
  roundRect(ctx, x, y, W, H, R);
  ctx.fill();
  ctx.shadowBlur = 0;

  const pulse = 0.55 + 0.45 * Math.sin(opts.frameCount * 0.035);
  const borderAlpha = opts.isPeek ? 0.95 : 0.5 + pulse * 0.35;
  ctx.strokeStyle =
    color + Math.round(borderAlpha * 255)
      .toString(16)
      .padStart(2, "0");
  ctx.lineWidth = opts.isPeek ? 2 : 1.5;
  roundRect(ctx, x, y, W, H, R);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  roundRect(ctx, x, y + R, 3, H - R * 2, 1.5);
  ctx.fill();

  const avatarX = x + 14 + AVATAR_SIZE / 2;
  const avatarY = 0;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = color + "33";
  ctx.fillRect(
    avatarX - AVATAR_SIZE / 2,
    avatarY - AVATAR_SIZE / 2,
    AVATAR_SIZE,
    AVATAR_SIZE,
  );
  ctx.font = `700 ${AVATAR_SIZE * 0.38}px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(name[0]?.toUpperCase() ?? "Y", avatarX, avatarY);
  ctx.restore();

  ctx.strokeStyle = color + "88";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.stroke();

  const badgeX = avatarX;
  const badgeY = avatarY + AVATAR_SIZE / 2 + 7;
  const badgeW = 28;
  const badgeH = 13;
  ctx.fillStyle = color;
  roundRect(ctx, badgeX - badgeW / 2, badgeY - badgeH / 2, badgeW, badgeH, 3);
  ctx.fill();
  ctx.font =
    '700 7px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif';
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("YOU", badgeX, badgeY);

  const textX = x + 14 + AVATAR_SIZE + 10;
  const textW = W - 14 - AVATAR_SIZE - 24;

  ctx.font =
    '600 12px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif';
  ctx.fillStyle = opts.dark ? "#F2F0EB" : "#0F0F0F";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  let displayName = name;
  while (displayName.length > 1 && ctx.measureText(displayName).width > textW) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== name) displayName += "…";

  const nameY = bio ? -14 : 4;
  ctx.fillText(displayName, textX, nameY);

  if (bio) {
    ctx.font =
      '400 9.5px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif';
    ctx.fillStyle = opts.dark
      ? "rgba(242,240,235,0.55)"
      : "rgba(15,15,15,0.55)";

    const words = bio.split(/\s+/).filter(Boolean);
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      if (ctx.measureText(test).width > textW) {
        if (current) lines.push(current);
        current = word;
        if (lines.length >= 2) break;
      } else {
        current = test;
      }
    }
    if (current && lines.length < 2) lines.push(current);

    lines.forEach((line, li) => {
      let l = line;
      if (li === 1 && words.join(" ") !== lines.join(" ")) {
        while (ctx.measureText(`${l}…`).width > textW && l.length > 1) {
          l = l.slice(0, -1);
        }
        l += "…";
      }
      ctx.fillText(l, textX, 2 + li * 13);
    });
  }

  if (opts.inSub) {
    ctx.strokeStyle = hexToRgba(color, 0.85);
    ctx.lineWidth = 2;
    roundRect(ctx, x - 3, y - 3, W + 6, H + 6, R + 2);
    ctx.stroke();
  }

  ctx.restore();
}

export function drawLandingMemoryCard(
  ctx: CanvasRenderingContext2D,
  n: GraphNode,
  opts: {
    dark: boolean;
    frameCount: number;
    isPeek: boolean;
    inSub: boolean;
    faded: boolean;
    showOgPreview: boolean;
    requestRedraw?: () => void;
  },
): void {
  const accent = VAULTS[n.vault]?.color ?? "#FF6600";
  const x = -NODE_W / 2;
  const y = -NODE_H / 2;

  ctx.save();
  ctx.globalAlpha = opts.faded ? 0.32 : 1;

  const g = ctx.createLinearGradient(x, y, x + NODE_W, y + NODE_H);
  const stop0 = themeCssColor(
    "--bg3",
    opts.dark ? CANVAS_NODE_BG_DARK_0 : CANVAS_NODE_BG_LIGHT_0,
  );
  const stop1 = themeCssColor(
    "--bg2",
    opts.dark ? CANVAS_NODE_BG_DARK_1 : CANVAS_NODE_BG_LIGHT_1,
  );
  g.addColorStop(0, stop0);
  g.addColorStop(1, stop1);

  roundRect(ctx, x, y, NODE_W, NODE_H, NODE_R);
  ctx.fillStyle = g;
  ctx.fill();

  ctx.strokeStyle = opts.isPeek
    ? hexToRgba(accent, 0.92)
    : hexToRgba(accent, 0.5);
  ctx.lineWidth = opts.isPeek ? 2 : 1;
  roundRect(ctx, x, y, NODE_W, NODE_H, NODE_R);
  ctx.stroke();

  const ogUrl =
    opts.showOgPreview && n.ogImage ? String(n.ogImage) : null;
  const PREVIEW_H = 30;

  if (ogUrl) {
    const img = getOrLoadImage(ogUrl, () => opts.requestRedraw?.());
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
      ctx.fillStyle = hexToRgba(accent, 0.12);
      ctx.fillRect(x, y, NODE_W, PREVIEW_H);
    }
    ctx.restore();
  }

  const textTop = y + (ogUrl ? PREVIEW_H + 2 : 6);
  ctx.fillStyle = accent;
  if (ogUrl) {
    ctx.fillRect(x, textTop, 4, y + NODE_H - textTop - 6);
  } else {
    ctx.fillRect(x, y + 6, 4, NODE_H - 12);
  }

  const category = VAULTS[n.vault]?.label ?? "Vault";
  ctx.font = '600 10px system-ui, sans-serif';
  ctx.fillStyle = hexToRgba(accent, 0.95);
  const badgeY = ogUrl ? textTop + 10 : y + 18;
  ctx.fillText(truncate(ctx, category, NODE_W - 56), x + 12, badgeY);

  ctx.fillStyle = themeCssColor("--text", canvasPrimaryText());
  ctx.font =
    '600 12px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif';
  const titleY = ogUrl ? textTop + 24 : y + 38;
  ctx.fillText(truncate(ctx, n.label || "Untitled", NODE_W - 24), x + 12, titleY);

  const value = (n.detail ?? "").replace(/\s+/g, " ").trim();
  if (value) {
    ctx.font =
      '11px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif';
    ctx.fillStyle = themeCssColor("--text2", canvasValueText());
    const valueY = ogUrl ? textTop + 38 : y + 54;
    ctx.fillText(truncate(ctx, value, NODE_W - 24), x + 12, valueY);
  }

  if (n.fresh && !opts.faded) {
    const pulse = 0.5 + 0.5 * Math.sin(opts.frameCount * 0.12);
    ctx.strokeStyle = hexToRgba(accent, 0.35 + pulse * 0.35);
    ctx.lineWidth = 1.5;
    roundRect(ctx, x - 3, y - 3, NODE_W + 6, NODE_H + 6, NODE_R + 2);
    ctx.stroke();
  }

  if (opts.inSub && !opts.faded) {
    ctx.strokeStyle = hexToRgba(accent, 0.88);
    ctx.lineWidth = 2;
    ctx.shadowColor = accent;
    ctx.shadowBlur = 12;
    roundRect(ctx, x - 3, y - 3, NODE_W + 6, NODE_H + 6, NODE_R + 3);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  ctx.restore();
}
