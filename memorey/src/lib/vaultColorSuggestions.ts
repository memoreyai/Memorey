import {
  CANVAS_MAIN_BG_DARK,
  CANVAS_MAIN_BG_LIGHT,
} from "@/components/graph/constants/colors";

export type RGB = { r: number; g: number; b: number };

const FALLBACK = "#888780";

export function parseHex6(hex: string): RGB | null {
  const t = hex.trim().replace("#", "");
  if (/^[0-9A-Fa-f]{6}$/i.test(t)) {
    return {
      r: parseInt(t.slice(0, 2), 16),
      g: parseInt(t.slice(2, 4), 16),
      b: parseInt(t.slice(4, 6), 16),
    };
  }
  return null;
}

export function toHex6(rgb: RGB): string {
  const h = (n: number) => n.toString(16).padStart(2, "0");
  return `#${h(rgb.r)}${h(rgb.g)}${h(rgb.b)}`.toUpperCase();
}

function blendOnto(bg: RGB, fg: RGB, alpha: number): RGB {
  const a = Math.min(1, Math.max(0, alpha));
  return {
    r: Math.round((1 - a) * bg.r + a * fg.r),
    g: Math.round((1 - a) * bg.g + a * fg.g),
    b: Math.round((1 - a) * bg.b + a * fg.b),
  };
}

function srgbChannelToLinear(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance (0–1). */
function relativeLuminance(rgb: RGB): number {
  const R = srgbChannelToLinear(rgb.r);
  const G = srgbChannelToLinear(rgb.g);
  const B = srgbChannelToLinear(rgb.b);
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}

function contrastRatio(L1: number, L2: number): number {
  const lighter = Math.max(L1, L2);
  const darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}

const NEAR_BLACK: RGB = { r: 17, g: 17, b: 18 };
const NEAR_WHITE: RGB = { r: 244, g: 244, b: 245 };

/**
 * Solid hex that approximates vault pill fill when canvas uses rgba(base, ~0.14)
 * composited on the main graph background for the current theme.
 */
export function suggestedPillFill(baseHex: string, isDark: boolean): string {
  const base = parseHex6(baseHex) ?? parseHex6(FALLBACK)!;
  const canvasBg =
    parseHex6(CANVAS_MAIN_BG_DARK) ?? ({ r: 10, g: 10, b: 11 } as RGB);
  const canvasLight =
    parseHex6(CANVAS_MAIN_BG_LIGHT) ?? ({ r: 247, g: 247, b: 248 } as RGB);
  const bg = isDark ? canvasBg : canvasLight;
  return toHex6(blendOnto(bg, base, isDark ? 0.22 : 0.18));
}

/** Border that reads clearly on the pill fill in the given theme. */
export function suggestedPillBorder(baseHex: string, isDark: boolean): string {
  const base = parseHex6(baseHex) ?? parseHex6(FALLBACK)!;
  const lift: RGB = isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  return toHex6(blendOnto(base, lift, isDark ? 0.28 : 0.22));
}

/** Default memory card body fill — subtle vault tint on neutral canvas cards. */
export function suggestedCardFill(baseHex: string, isDark: boolean): string {
  const base = parseHex6(baseHex) ?? parseHex6(FALLBACK)!;
  if (isDark) {
    const mid: RGB = { r: 23, g: 23, b: 24 };
    return toHex6(blendOnto(mid, base, 0.1));
  }
  const mid: RGB = { r: 252, g: 252, b: 253 };
  return toHex6(blendOnto(mid, base, 0.07));
}

/** Accent / left rail — close to vault colour, slightly tuned per theme. */
export function suggestedCardAccent(baseHex: string, isDark: boolean): string {
  const base = parseHex6(baseHex) ?? parseHex6(FALLBACK)!;
  const lift: RGB = isDark ? { r: 255, g: 255, b: 255 } : { r: 0, g: 0, b: 0 };
  return toHex6(blendOnto(base, lift, isDark ? 0.06 : 0.1));
}

/**
 * Primary text colour with strong contrast on the given background (6-digit hex).
 */
export function suggestedReadableTextForBackground(bgHex: string): string {
  const bg = parseHex6(bgHex);
  if (!bg) return "#111112";
  const Lbg = relativeLuminance(bg);
  const Ldark = relativeLuminance(NEAR_BLACK);
  const Llight = relativeLuminance(NEAR_WHITE);
  const cDark = contrastRatio(Lbg, Ldark);
  const cLight = contrastRatio(Lbg, Llight);
  return cDark >= cLight ? toHex6(NEAR_BLACK) : toHex6(NEAR_WHITE);
}

