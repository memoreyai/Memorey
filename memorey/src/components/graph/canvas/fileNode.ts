import type { MemoryNode } from "@/types/memorey";
import { themeCssColor } from "../constants/colors";
import {
  FILE_NODE_W,
  FILE_NODE_H,
  FILE_NODE_R,
} from "../constants/dimensions";

export { FILE_NODE_W, FILE_NODE_H, FILE_NODE_R };

// ── Dimensions ────────────────────────────────────────────────────
const PREVIEW_H = 90;
const FOOTER_H = FILE_NODE_H - PREVIEW_H;

// Cache for loaded images — keyed by URL
const imageCache = new Map<string, HTMLImageElement | "loading" | "error">();

export function getOrLoadImage(
  url: string,
  onLoad: () => void
): HTMLImageElement | null {
  if (!url) return null;

  const absUrl = url.startsWith("http") ? url : `${window.location.origin}${url}`;

  const cached = imageCache.get(absUrl);
  if (cached === "loading") return null;
  if (cached === "error") return null;
  if (cached instanceof HTMLImageElement) return cached;

  imageCache.set(absUrl, "loading");
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = () => {
    imageCache.set(absUrl, img);
    onLoad();
  };
  img.onerror = () => {
    imageCache.set(absUrl, "error");
    console.warn("[fileNode] failed to load image:", absUrl);
  };
  img.src = absUrl;
  return null;
}

// ── File type helpers ─────────────────────────────────────────────

export function fileTypeLabel(type: string | null): string {
  switch (type) {
    case "image":
      return "IMG";
    case "pdf":
      return "PDF";
    case "video":
      return "VID";
    case "doc":
      return "DOC";
    case "link":
      return "URL";
    default:
      return "FILE";
  }
}

export function fileTypeColor(type: string | null): string {
  switch (type) {
    case "image":
      return "#4FC1E9";
    case "pdf":
      return "#E05C5C";
    case "video":
      return "#C792EA";
    case "doc":
      return "#378ADD";
    case "link":
      return "#5DCAA5";
    default:
      return "#888780";
  }
}

// ── Draw file node icon (for non-image files) ─────────────────────

function drawFileIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  type: string | null
): void {
  const color = fileTypeColor(type);
  const label = fileTypeLabel(type);

  ctx.fillStyle = color + "22";
  ctx.strokeStyle = color + "66";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy - 8, 24, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.font = "600 22px serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.fillText(label, cx, cy - 8);

  ctx.font = "700 9px Inter, system-ui, sans-serif";
  ctx.fillStyle = color;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, cx, cy + 20);

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
}

// ── Main draw function ────────────────────────────────────────────

export function drawFileNode(
  ctx: CanvasRenderingContext2D,
  node: MemoryNode,
  sx: number,
  sy: number,
  opts: {
    isHovered: boolean;
    isSelected: boolean;
    isHighlighted: boolean;
    isMuted: boolean;
    accentColor?: string;
    /** Card fill; outline uses accentColor / selection. */
    fillColor?: string;
    frameCount: number;
    requestRedraw: () => void;
  }
): void {
  const { isHovered, isSelected, isHighlighted, isMuted, frameCount } = opts;

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";
  const typeColor = opts.accentColor ?? fileTypeColor(node.fileType ?? null);
  const cardFill =
    opts.fillColor ??
    themeCssColor("--card-bg", isDark ? "#161412" : "#FFFFFF");
  const alpha = isMuted ? 0.3 : 1.0;

  const x = sx - FILE_NODE_W / 2;
  const y = sy - FILE_NODE_H / 2;

  ctx.save();
  ctx.globalAlpha = alpha;

  if (isHovered || isSelected) {
    ctx.shadowColor = typeColor + "55";
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 2;
  }

  ctx.fillStyle = cardFill;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, FILE_NODE_W, FILE_NODE_H, FILE_NODE_R);
  } else {
    ctx.rect(x, y, FILE_NODE_W, FILE_NODE_H);
  }
  ctx.fill();
  ctx.shadowBlur = 0;

  const borderColor = isSelected
    ? "#FF6600"
    : isHighlighted
      ? typeColor + "CC"
      : typeColor + (isDark ? "55" : "44");
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = isSelected ? 2 : 1;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, FILE_NODE_W, FILE_NODE_H, FILE_NODE_R);
  } else {
    ctx.rect(x, y, FILE_NODE_W, FILE_NODE_H);
  }
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, y, FILE_NODE_W, PREVIEW_H, [
      FILE_NODE_R,
      FILE_NODE_R,
      0,
      0,
    ]);
  } else {
    ctx.rect(x, y, FILE_NODE_W, PREVIEW_H);
  }
  ctx.clip();

  if (node.fileType === "image" && (node.fileUrl || node.thumbnailUrl)) {
    const imgUrl = node.thumbnailUrl ?? node.fileUrl!;
    const img = getOrLoadImage(imgUrl, opts.requestRedraw);

    if (img) {
      const aspectRatio = img.naturalWidth / img.naturalHeight;
      let dw = FILE_NODE_W;
      let dh = PREVIEW_H;
      if (aspectRatio > FILE_NODE_W / PREVIEW_H) {
        dh = PREVIEW_H;
        dw = dh * aspectRatio;
      } else {
        dw = FILE_NODE_W;
        dh = dw / aspectRatio;
      }
      const dx = x + (FILE_NODE_W - dw) / 2;
      const dy = y + (PREVIEW_H - dh) / 2;
      ctx.drawImage(img, dx, dy, dw, dh);
    } else {
      ctx.fillStyle = themeCssColor(
        "--bg4",
        isDark ? "#1A1814" : "#F0EDE6"
      );
      ctx.fillRect(x, y, FILE_NODE_W, PREVIEW_H);
      const shimmerX = ((frameCount * 2) % (FILE_NODE_W * 2)) - FILE_NODE_W;
      const grad = ctx.createLinearGradient(
        x + shimmerX,
        0,
        x + shimmerX + 60,
        0
      );
      grad.addColorStop(0, "transparent");
      grad.addColorStop(
        0.5,
        isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)"
      );
      grad.addColorStop(1, "transparent");
      ctx.fillStyle = grad;
      ctx.fillRect(x, y, FILE_NODE_W, PREVIEW_H);
    }
  } else if (node.ogImage) {
    const img = getOrLoadImage(node.ogImage, opts.requestRedraw);
    if (img) {
      ctx.drawImage(img, x, y, FILE_NODE_W, PREVIEW_H);
    } else {
      ctx.fillStyle = typeColor + "18";
      ctx.fillRect(x, y, FILE_NODE_W, PREVIEW_H);
    }
  } else {
    ctx.fillStyle = themeCssColor(
      "--bg4",
      isDark ? "#1A1814" : "#F7F5F0"
    );
    ctx.fillRect(x, y, FILE_NODE_W, PREVIEW_H);
    drawFileIcon(ctx, sx, y + PREVIEW_H / 2, node.fileType ?? null);
  }

  ctx.restore();

  if (isHovered) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = "rgba(8,8,10,0.52)";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(x, y, FILE_NODE_W, PREVIEW_H, [FILE_NODE_R, FILE_NODE_R, 0, 0]);
    } else {
      ctx.rect(x, y, FILE_NODE_W, PREVIEW_H);
    }
    ctx.fill();

    const pillW = 132;
    const pillH = 30;
    const pillX = sx - pillW / 2;
    const pillY = y + PREVIEW_H / 2 - pillH / 2;
    ctx.fillStyle = "rgba(255,102,0,0.98)";
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(pillX, pillY, pillW, pillH, 8);
    } else {
      ctx.rect(pillX, pillY, pillW, pillH);
    }
    ctx.fill();
    ctx.stroke();

    ctx.font = "600 11px Inter, system-ui, sans-serif";
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Click to open", sx, pillY + pillH / 2);
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }

  ctx.strokeStyle = typeColor + "33";
  ctx.lineWidth = 0.75;
  ctx.beginPath();
  ctx.moveTo(x, y + PREVIEW_H);
  ctx.lineTo(x + FILE_NODE_W, y + PREVIEW_H);
  ctx.stroke();

  const footerY = y + PREVIEW_H;

  ctx.fillStyle = typeColor;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x, footerY + 4, 3, FOOTER_H - 8, [0, 1.5, 1.5, 0]);
  } else {
    ctx.rect(x, footerY + 4, 3, FOOTER_H - 8);
  }
  ctx.fill();

  const displayName = node.ogTitle ?? node.title ?? node.fileName ?? "Untitled";
  ctx.font = `500 10px Inter, system-ui, sans-serif`;
  ctx.fillStyle = themeCssColor("--text", isDark ? "#F2F0EB" : "#0F0F0F");
  ctx.textBaseline = "top";

  let name = displayName;
  const maxW = FILE_NODE_W - 20;
  while (name.length > 2 && ctx.measureText(name).width > maxW) {
    name = name.slice(0, -1);
  }
  if (name !== displayName) name += "…";
  ctx.fillText(name, x + 10, footerY + 7);

  ctx.font = `500 8px Inter, system-ui, sans-serif`;
  ctx.fillStyle = typeColor;
  ctx.textBaseline = "bottom";

  const typeLabel = node.ogSiteName ?? fileTypeLabel(node.fileType ?? null);
  ctx.fillText(typeLabel, x + 10, y + FILE_NODE_H - 5);

  if (node.fileSize) {
    const sizeStr =
      node.fileSize > 1024 * 1024
        ? `${(node.fileSize / 1024 / 1024).toFixed(1)} MB`
        : `${(node.fileSize / 1024).toFixed(0)} KB`;
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.3)" : "rgba(0,0,0,0.3)";
    ctx.textAlign = "right";
    ctx.fillText(sizeStr, x + FILE_NODE_W - 6, y + FILE_NODE_H - 5);
    ctx.textAlign = "left";
  }

  ctx.textBaseline = "alphabetic";

  if (isSelected) {
    ctx.strokeStyle = "rgba(255,102,0,0.7)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(
        x - 3,
        y - 3,
        FILE_NODE_W + 6,
        FILE_NODE_H + 6,
        FILE_NODE_R + 3
      );
    } else {
      ctx.rect(x - 3, y - 3, FILE_NODE_W + 6, FILE_NODE_H + 6);
    }
    ctx.stroke();
  }

  ctx.restore();
}
