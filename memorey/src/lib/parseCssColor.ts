/**
 * Parse common CSS colour strings to #RRGGBB (alpha stripped).
 * Supports #RGB, #RRGGBB, #RRGGBBAA, rgb()/rgba(), hsl()/hsla(), named colours
 * (via canvas in browser). Safe for SSR: hex/rgb only without document.
 */

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

function parseShortHex(s: string): string | null {
  const t = s.trim().replace("#", "");
  if (/^[0-9A-Fa-f]{3}$/i.test(t)) {
    return `#${t[0]}${t[0]}${t[1]}${t[1]}${t[2]}${t[2]}`.toUpperCase();
  }
  return null;
}

function parseLongHex(s: string): string | null {
  const t = s.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return t.toUpperCase();
  if (/^#[0-9A-Fa-f]{8}$/i.test(t)) return t.slice(0, 7).toUpperCase();
  return null;
}

/** rgb(...) / rgba(...) with integers or decimals */
function parseRgbFunction(s: string): string | null {
  const m = s.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*[\d.]+\s*)?\)/i
  );
  if (!m) return null;
  const r = Number(m[1]);
  const g = Number(m[2]);
  const b = Number(m[3]);
  if ([r, g, b].some((x) => Number.isNaN(x))) return null;
  return rgbToHex(r, g, b);
}

/**
 * Resolve a CSS colour string to opaque #RRGGBB, or null if invalid / empty.
 * Accepts `ff6600` / `F60` without `#`, full `#RRGGBB`, rgb(), names (in browser).
 */
export function parseCssColorToHex6(input: string): string | null {
  const s = input.trim();
  if (!s) return null;

  // 6-char hex without # (e.g. ff6600)
  if (/^[0-9A-Fa-f]{6}$/i.test(s)) return `#${s}`.toUpperCase();

  // 3-char shorthand without # (e.g. f60)
  if (/^[0-9A-Fa-f]{3}$/i.test(s)) {
    const withHash = parseShortHex(`#${s}`);
    if (withHash) return withHash;
  }

  const long = parseLongHex(s);
  if (long) return long;

  const short = parseShortHex(s);
  if (short) return short;

  const rgb = parseRgbFunction(s);
  if (rgb) return rgb;

  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  try {
    ctx.fillStyle = "#000000";
    ctx.fillStyle = s;
    const out = ctx.fillStyle as string;
    if (typeof out !== "string") return null;
    if (out.startsWith("#")) {
      if (out.length === 7) return out.toUpperCase();
      if (out.length === 4) return parseShortHex(out);
    }
    const m = out.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
    if (m) {
      return rgbToHex(Number(m[1]), Number(m[2]), Number(m[3]));
    }
  } catch {
    return null;
  }
  return null;
}

/** Opaque #RRGGBB → RGB components (for pickers / inputs). */
export function hexToRgbComponents(hexInput: string): {
  r: number;
  g: number;
  b: number;
} | null {
  const hex = parseCssColorToHex6(hexInput);
  if (!hex) return null;
  const t = hex.slice(1);
  return {
    r: parseInt(t.slice(0, 2), 16),
    g: parseInt(t.slice(2, 4), 16),
    b: parseInt(t.slice(4, 6), 16),
  };
}

/** Clamp channels and format as #RRGGBB */
export function rgbComponentsToHex(r: number, g: number, b: number): string {
  const c = (n: number) =>
    Math.min(255, Math.max(0, Math.round(n)));
  return rgbToHex(c(r), c(g), c(b));
}
