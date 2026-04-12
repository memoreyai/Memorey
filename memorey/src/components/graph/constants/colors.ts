export const VAULT_COLORS: Record<string, string> = {
  Work: "#378ADD",
  Goals: "#F5C542",
  Personal: "#FF6600",
  Health: "#FF5B8A",
  Finance: "#C792EA",
  Study: "#A8E063",
  Relationships: "#4FC1E9",
  Preferences: "#888780",
};

export const BRAND_ORANGE = "#FF6600";
export const STICKY_YELLOW = "#F5E642";

/** Canvas edge base stroke (under glow pass) */
export const EDGE_BASE_STROKE = "rgba(120,120,128,0.45)";

export function isDarkTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") !== "light";
}

/** Resolved CSS custom property for canvas drawing (e.g. `--text`, `--bg3`). */
export function themeCssColor(varName: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
  return raw || fallback;
}

export function edgeArrowFill(): string {
  return isDarkTheme() ? "#e8e8ec" : "#222222";
}

export function vaultColorForNode(node: {
  category?: string;
  color?: string;
  customAccentColor?: string | null;
}): string {
  return (
    node.customAccentColor ??
    VAULT_COLORS[node.category ?? ""] ??
    node.color ??
    "#888780"
  );
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/** Use when hex may be incomplete (e.g. user typing in settings). */
export function hexToRgbaSafe(
  hex: string,
  alpha: number,
  fallback: string
): string {
  const h = hex.replace("#", "");
  if (h.length !== 6 || !/^[0-9A-Fa-f]{6}$/i.test(h)) return fallback;
  return hexToRgba(`#${h}`, alpha);
}

/** Canvas memory card — dark theme gradient stops */
export const CANVAS_NODE_BG_DARK_0 = "rgba(28,28,30,1)";
export const CANVAS_NODE_BG_DARK_1 = "rgba(18,18,20,1)";
export const CANVAS_NODE_BG_LIGHT_0 = "rgba(255,255,255,1)";
export const CANVAS_NODE_BG_LIGHT_1 = "rgba(245,245,247,1)";
export const CANVAS_TEXT_ON_DARK = "#f4f4f5";
export const CANVAS_TEXT_ON_LIGHT = "#111111";
export const CANVAS_VALUE_ON_DARK = "rgba(228,228,232,0.75)";
export const CANVAS_VALUE_ON_LIGHT = "rgba(30,30,35,0.72)";
export const CANVAS_BORDER_MUTED = "rgba(128,128,136,0.35)";
export const CANVAS_ATTACH_PANEL_DARK = "rgba(32,32,36,0.98)";
export const CANVAS_ATTACH_PANEL_LIGHT = "rgba(252,252,254,0.98)";
export const CANVAS_ATTACH_TEXT_DARK = "#eeeeee";
export const CANVAS_STICKY_FOLD = "rgba(0,0,0,0.08)";
export const CANVAS_STICKY_TITLE = "#1a1a1a";
export const CANVAS_STICKY_BODY = "rgba(0,0,0,0.72)";
export const CANVAS_STICKY_BORDER_HOVER = "rgba(0,0,0,0.25)";
export const CANVAS_STICKY_BORDER = "rgba(0,0,0,0.12)";

export function canvasPrimaryText(): string {
  return isDarkTheme() ? CANVAS_TEXT_ON_DARK : CANVAS_TEXT_ON_LIGHT;
}

export function canvasValueText(): string {
  return isDarkTheme() ? CANVAS_VALUE_ON_DARK : CANVAS_VALUE_ON_LIGHT;
}

export function canvasAttachFill(): string {
  return isDarkTheme()
    ? CANVAS_ATTACH_PANEL_DARK
    : CANVAS_ATTACH_PANEL_LIGHT;
}

export function canvasAttachLabel(): string {
  return isDarkTheme() ? CANVAS_ATTACH_TEXT_DARK : CANVAS_TEXT_ON_LIGHT;
}

export const CANVAS_MINIMAP_BG_DARK = "rgba(20,20,22,0.92)";
export const CANVAS_MINIMAP_BG_LIGHT = "rgba(250,250,252,0.94)";
export const CANVAS_MINIMAP_NODE_DARK = "rgba(36,36,40,0.95)";
export const CANVAS_MINIMAP_NODE_LIGHT = "rgba(255,255,255,0.95)";
export const CANVAS_MINIMAP_DIM_DARK = "rgba(0,0,0,0.45)";
export const CANVAS_MINIMAP_DIM_LIGHT = "rgba(0,0,0,0.12)";

export const CANVAS_MAIN_BG_DARK = "#0A0A0B";
export const CANVAS_MAIN_BG_LIGHT = "#F7F7F8";
export const CANVAS_SELECTION_STROKE = "rgba(55,138,221,0.8)";
export const CANVAS_EDGE_FALLBACK = "#888780";
