import type { MasterProfile } from "../types/graph.types";
import type { MasterCanvasRegion } from "../layout/types";
import { MASTER_W, MASTER_H_WITH_BIO, MASTER_H_WITHOUT_BIO } from "../constants/dimensions";

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

export function drawMasterNode(
  ctx: CanvasRenderingContext2D,
  wx: number,
  wy: number,
  opts: {
    isHovered: boolean;
    profile: MasterProfile | null;
    avatarImage: CanvasImageSource | null;
    frameCount: number;
  }
): void {
  const { isHovered, profile, avatarImage, frameCount } = opts;
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";
  const color = profile?.master_node_color ?? "#FF6600";
  const name = profile?.display_name ?? profile?.full_name ?? "You";
  const bio = (profile?.master_node_bio ?? "").trim();

  const W = MASTER_W;
  const H = bio ? 76 : 52;
  const R = 10;
  const AVATAR_SIZE = 32;

  const x = wx - W / 2;
  const y = wy - H / 2;

  ctx.save();

  ctx.shadowColor = color + "44";
  ctx.shadowBlur = isHovered ? 20 : 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = isDark ? "#1C1710" : "#FFFFFF";
  roundRect(ctx, x, y, W, H, R);
  ctx.fill();
  ctx.shadowBlur = 0;

  const pulse = 0.55 + 0.45 * Math.sin(frameCount * 0.035);
  const borderAlpha = isHovered ? 0.95 : 0.5 + pulse * 0.35;
  ctx.strokeStyle =
    color + Math.round(borderAlpha * 255).toString(16).padStart(2, "0");
  ctx.lineWidth = isHovered ? 2 : 1.5;
  roundRect(ctx, x, y, W, H, R);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  roundRect(ctx, x, y + R, 3, H - R * 2, 1.5);
  ctx.fill();

  const avatarX = x + 14 + AVATAR_SIZE / 2;
  const avatarY = wy;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();

  const img =
    avatarImage instanceof HTMLImageElement ? avatarImage : null;
  if (img && img.complete && img.naturalWidth > 0) {
    ctx.drawImage(
      img,
      avatarX - AVATAR_SIZE / 2,
      avatarY - AVATAR_SIZE / 2,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
  } else {
    ctx.fillStyle = color + "33";
    ctx.fillRect(
      avatarX - AVATAR_SIZE / 2,
      avatarY - AVATAR_SIZE / 2,
      AVATAR_SIZE,
      AVATAR_SIZE
    );
    ctx.font = `700 ${AVATAR_SIZE * 0.38}px Inter, system-ui, sans-serif`;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(name[0]?.toUpperCase() ?? "Y", avatarX, avatarY);
  }
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

  ctx.font = "700 7px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("YOU", badgeX, badgeY);

  const textX = x + 14 + AVATAR_SIZE + 10;
  const textW = W - 14 - AVATAR_SIZE - 24;

  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.fillStyle = isDark ? "#F2F0EB" : "#0F0F0F";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  let displayName = name;
  while (displayName.length > 1 && ctx.measureText(displayName).width > textW) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== name) displayName += "…";

  const nameY = bio ? wy - 14 : wy + 4;
  ctx.fillText(displayName, textX, nameY);

  if (bio) {
    ctx.font = "400 9.5px Inter, system-ui, sans-serif";
    ctx.fillStyle = isDark
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
      ctx.fillText(l, textX, wy + 2 + li * 13);
    });
  }

  if (isHovered) {
    ctx.font = "400 8px Inter, system-ui, sans-serif";
    ctx.fillStyle = color + "AA";
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText("click to edit", x + W - 8, y + H - 6);
  }

  ctx.restore();
}

/** Per-canvas hub in master graph view (no DB row — virtual anchor). */
export function drawVirtualCanvasMaster(
  ctx: CanvasRenderingContext2D,
  region: MasterCanvasRegion,
  opts: { isHovered: boolean; frameCount: number }
): void {
  const { isHovered, frameCount } = opts;
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";
  const color = region.masterNodeColor ?? "#FF6600";
  const bio = (region.masterNodeBio ?? "").trim();
  const nameBase = [region.emoji?.trim(), region.name]
    .filter((s): s is string => Boolean(s && s.length))
    .join(" ");

  const W = MASTER_W;
  const H = bio ? MASTER_H_WITH_BIO : MASTER_H_WITHOUT_BIO;
  const R = 10;
  const wx = region.masterHubX;
  const wy = region.masterHubY;
  const x = wx - W / 2;
  const y = wy - H / 2;

  ctx.save();

  ctx.shadowColor = color + "44";
  ctx.shadowBlur = isHovered ? 20 : 12;
  ctx.shadowOffsetX = 0;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = isDark ? "#1C1710" : "#FFFFFF";
  roundRect(ctx, x, y, W, H, R);
  ctx.fill();
  ctx.shadowBlur = 0;

  const pulse = 0.55 + 0.45 * Math.sin(frameCount * 0.035);
  const borderAlpha = isHovered ? 0.95 : 0.5 + pulse * 0.35;
  ctx.strokeStyle =
    color + Math.round(borderAlpha * 255).toString(16).padStart(2, "0");
  ctx.lineWidth = isHovered ? 2 : 1.5;
  roundRect(ctx, x, y, W, H, R);
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.beginPath();
  roundRect(ctx, x, y + R, 3, H - R * 2, 1.5);
  ctx.fill();

  const AVATAR_SIZE = 32;
  const avatarX = x + 14 + AVATAR_SIZE / 2;
  const avatarY = wy;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX, avatarY, AVATAR_SIZE / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = color + "33";
  ctx.fillRect(
    avatarX - AVATAR_SIZE / 2,
    avatarY - AVATAR_SIZE / 2,
    AVATAR_SIZE,
    AVATAR_SIZE
  );
  ctx.font = `700 ${AVATAR_SIZE * 0.55}px Inter, system-ui, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const em = (region.emoji ?? "").trim();
  const avatarGlyph = em
    ? em.slice(0, 2)
    : region.name.trim().slice(0, 1) || "·";
  ctx.fillText(avatarGlyph, avatarX, avatarY);
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
  ctx.font = "700 7px Inter, system-ui, sans-serif";
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("HUB", badgeX, badgeY);

  const textX = x + 14 + AVATAR_SIZE + 10;
  const textW = W - 14 - AVATAR_SIZE - 24;

  ctx.font = "600 12px Inter, system-ui, sans-serif";
  ctx.fillStyle = isDark ? "#F2F0EB" : "#0F0F0F";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  let displayName = nameBase;
  while (displayName.length > 1 && ctx.measureText(displayName).width > textW) {
    displayName = displayName.slice(0, -1);
  }
  if (displayName !== nameBase) displayName += "…";
  const nameY = bio ? wy - 14 : wy + 4;
  ctx.fillText(displayName, textX, nameY);

  if (bio) {
    ctx.font = "400 9.5px Inter, system-ui, sans-serif";
    ctx.fillStyle = isDark
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
      ctx.fillText(l, textX, wy + 2 + li * 13);
    });
  }

  ctx.restore();
}
