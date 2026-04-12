import { parseCssColorToHex6 } from "@/lib/parseCssColor";
import type {
  CategoryVault,
  VaultColorOverrides,
  VaultModeColorSlice,
  VaultThemeMode,
} from "@/types/memorey";
import {
  suggestedCardAccent,
  suggestedCardFill,
  suggestedPillBorder,
  suggestedPillFill,
  suggestedReadableTextForBackground,
} from "@/lib/vaultColorSuggestions";

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function parseSlice(v: unknown): VaultModeColorSlice | undefined {
  if (!isRecord(v)) return undefined;
  return {
    pillFill: typeof v.pillFill === "string" ? v.pillFill : null,
    pillText: typeof v.pillText === "string" ? v.pillText : null,
    cardBg: typeof v.cardBg === "string" ? v.cardBg : null,
    cardText: typeof v.cardText === "string" ? v.cardText : null,
    cardAccent: typeof v.cardAccent === "string" ? v.cardAccent : null,
  };
}

/** Parse JSONB from Supabase into a typed shape (invalid → null). */
export function parseVaultColorOverrides(
  raw: unknown
): VaultColorOverrides | null {
  if (raw == null) return null;
  if (!isRecord(raw)) return null;
  const light = parseSlice(raw.light);
  const dark = parseSlice(raw.dark);
  if (!light && !dark) return null;
  return { light, dark };
}

/** Chroma for suggestions: saved border, else vault swatch. */
export function getVaultChromaHex(vault: CategoryVault): string {
  const b = vault.pillBorderColor?.trim();
  if (b) {
    const p = parseCssColorToHex6(b);
    if (p) return p;
  }
  const c = vault.color?.trim() ?? "";
  return parseCssColorToHex6(c) ?? "#888780";
}

/**
 * Vault header pill — fill & text follow light/dark unless overridden for that mode.
 * Legacy single columns apply when per-mode JSON is absent.
 */
export function resolveVaultPill(
  vault: CategoryVault,
  isDark: boolean
): { fill: string; border: string; text: string } {
  const mode: VaultThemeMode = isDark ? "dark" : "light";
  const chroma = getVaultChromaHex(vault);
  const o = vault.colorOverrides?.[mode];

  const computedFill = suggestedPillFill(chroma, isDark);
  const computedBorder = suggestedPillBorder(chroma, isDark);
  const legacyFill = vault.pillFillBg?.trim();
  const legacyText = vault.pillTextColor?.trim();
  const legacyBorder = vault.pillBorderColor?.trim();

  const fill =
    o?.pillFill?.trim() ||
    legacyFill ||
    computedFill;

  const border = legacyBorder || computedBorder;

  const fillForReadable =
    o?.pillFill?.trim() || legacyFill || computedFill;
  const text =
    o?.pillText?.trim() ||
    legacyText ||
    suggestedReadableTextForBackground(fillForReadable);

  return { fill, border, text };
}

/** Default memory card colours for the current theme. */
export function resolveVaultDefaultCard(
  vault: CategoryVault,
  isDark: boolean
): { accent: string; bg: string; text: string } {
  const mode: VaultThemeMode = isDark ? "dark" : "light";
  const chroma = getVaultChromaHex(vault);
  const o = vault.colorOverrides?.[mode];

  const computedBg = suggestedCardFill(chroma, isDark);
  const computedAccent = suggestedCardAccent(chroma, isDark);

  const legacyBg = vault.defaultCardBg?.trim();
  const legacyText = vault.defaultCardText?.trim();
  const legacyAccent = vault.defaultCardAccent?.trim();

  const bg = o?.cardBg?.trim() || legacyBg || computedBg;
  const accent = o?.cardAccent?.trim() || legacyAccent || computedAccent;
  const bgForText = o?.cardBg?.trim() || legacyBg || computedBg;
  const text =
    o?.cardText?.trim() ||
    legacyText ||
    suggestedReadableTextForBackground(bgForText);

  return { accent, bg, text };
}
