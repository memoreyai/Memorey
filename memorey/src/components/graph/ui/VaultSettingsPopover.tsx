"use client";

/**
 * SECURITY NOTE: The vault PIN lock is a client-side convenience feature only.
 * It does NOT prevent server-side data access. All vault data (memory nodes)
 * is fetched regardless of lock state. The PIN hash is stored in client-side
 * state and a short PIN can be brute-forced trivially. Do not rely on this
 * feature for data confidentiality. It is intended as a visual privacy screen
 * (e.g. hiding vaults from casual over-the-shoulder viewing).
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { parseCssColorToHex6 } from "@/lib/parseCssColor";
import { useVaultStore } from "@/store/vaultStore";
import type { CategoryVault } from "@/types/memorey";
import type { VaultSettingsState } from "../types/graph.types";
import { PinModal } from "./PinModal";
import { FlexibleColorInput } from "./FlexibleColorInput";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";
import {
  parseHex6,
  suggestedPillBorder,
  suggestedPillFill,
  suggestedReadableTextForBackground,
  toHex6,
} from "@/lib/vaultColorSuggestions";
import { parseVaultColorOverrides } from "@/lib/vaultThemeResolve";
import type { Json } from "@/lib/supabase/types";
import { toast } from "sonner";

function normalizeVaultBaseHex(hex: string): string {
  const p = parseHex6(hex);
  return p ? toHex6(p) : "#888780";
}

function effectiveHexOrFallback(userHex: string, fallbackHex: string): string {
  const t = userHex.trim();
  if (/^#[0-9A-Fa-f]{6}$/i.test(t)) return t;
  return fallbackHex;
}

function getVaultFormSlice(v: CategoryVault, dark: boolean) {
  const mode = dark ? "dark" : "light";
  const s = v.colorOverrides?.[mode];
  return {
    fill: s?.pillFill ?? v.pillFillBg ?? v.defaultCardBg ?? "",
    border: v.pillBorderColor ?? v.defaultCardAccent ?? "",
    text: s?.pillText ?? v.pillTextColor ?? v.defaultCardText ?? "",
  };
}

function supabaseErrorMessage(err: unknown): string {
  if (err && typeof err === "object") {
    const o = err as { message?: string; details?: string; hint?: string };
    if (typeof o.message === "string" && o.message) return o.message;
    if (typeof o.details === "string" && o.details) return o.details;
    if (typeof o.hint === "string" && o.hint) return o.hint;
  }
  if (err instanceof Error) return err.message;
  return "Could not save colours";
}

function ThemeColorRow({
  label,
  value,
  onChange,
  onCommitHex,
  themeSuggestion,
  themeHint,
  onThemeClick,
  showReadable,
  readableBgHex,
  onApplyReadable,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onCommitHex?: (hex: string) => void;
  themeSuggestion: string;
  themeHint: string;
  onThemeClick: () => void;
  showReadable?: boolean;
  readableBgHex?: string;
  onApplyReadable?: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 text-xs">
      <span style={{ color: "var(--muted)" }}>{label}</span>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded border px-2 py-1 text-[10px] font-medium tracking-wide uppercase"
          style={{ borderColor: "var(--border2)", color: "var(--text)" }}
          title={themeHint}
          onClick={onThemeClick}
        >
          <span
            className="size-4 shrink-0 rounded-sm border"
            style={{
              backgroundColor: themeSuggestion,
              borderColor: "var(--border)",
            }}
            aria-hidden
          />
          Theme
        </button>
        {showReadable && readableBgHex && onApplyReadable ? (
          <button
            type="button"
            className="rounded border px-2 py-1 text-[10px] font-medium tracking-wide uppercase"
            style={{ borderColor: "var(--border2)", color: "var(--text)" }}
            title="Contrast text for the current fill"
            onClick={onApplyReadable}
          >
            Readable
          </button>
        ) : null}
      </div>
      <FlexibleColorInput
        aria-label={label}
        value={value}
        onChange={onChange}
        onCommitHex={onCommitHex}
      />
    </div>
  );
}

interface VaultSettingsPopoverProps {
  popover: VaultSettingsState | null;
  canvasW: number;
  onClose: () => void;
}

export function VaultSettingsPopover({
  popover,
  canvasW,
  onClose,
}: VaultSettingsPopoverProps) {
  const [pinMode, setPinMode] = useState<"set" | "unlock" | null>(null);
  const updateVault = useVaultStore((s) => s.updateVault);
  const [saving, setSaving] = useState(false);
  const isDark = useIsDarkTheme();

  const [fill, setFill] = useState("");
  const [border, setBorder] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    if (!popover) return;
    const { fill: f, border: b, text: t } = getVaultFormSlice(
      popover.vault,
      isDark
    );
    setFill(f);
    setBorder(b);
    setText(t);
  }, [popover?.vaultId, popover?.vault, isDark]);

  const baseHex = useMemo(
    () => (popover ? normalizeVaultBaseHex(popover.vault.color) : "#888780"),
    [popover?.vault]
  );

  const themeHint = useMemo(
    () =>
      `Match ${isDark ? "dark" : "light"} canvas (vault ${baseHex})`,
    [isDark, baseHex]
  );

  const fillTheme = useMemo(
    () => suggestedPillFill(baseHex, isDark),
    [baseHex, isDark]
  );
  const borderTheme = useMemo(
    () => suggestedPillBorder(baseHex, isDark),
    [baseHex, isDark]
  );

  const fillForContrast = useMemo(
    () => effectiveHexOrFallback(fill, fillTheme),
    [fill, fillTheme]
  );

  const applyThemeFromVaultColour = useCallback(() => {
    setFill(fillTheme);
    setBorder(borderTheme);
    setText(suggestedReadableTextForBackground(fillTheme));
  }, [fillTheme, borderTheme]);

  /** Border is primary: suggests fill + label text. */
  const commitBorderHex = useCallback(
    (hex: string) => {
      setBorder(hex);
      const f = suggestedPillFill(hex, isDark);
      setFill(f);
      setText(suggestedReadableTextForBackground(f));
    },
    [isDark]
  );

  /** Fill committed: refresh border + text for contrast. */
  const commitFillHex = useCallback(
    (hex: string) => {
      setFill(hex);
      setBorder(suggestedPillBorder(hex, isDark));
      setText(suggestedReadableTextForBackground(hex));
    },
    [isDark]
  );

  if (!popover) return null;
  const left = Math.min(popover.x, canvasW - 300);

  async function saveTheme() {
    if (!popover) return;
    setSaving(true);
    try {
      const normalize = (raw: string): string | null | "invalid" => {
        const t = raw.trim();
        if (!t) return null;
        const hex = parseCssColorToHex6(t);
        if (!hex) return "invalid";
        return hex;
      };
      const nf = normalize(fill);
      const nb = normalize(border);
      const nt = normalize(text);
      if (nf === "invalid" || nb === "invalid" || nt === "invalid") {
        toast.error(
          "Fix invalid colours — use hex (ff6600 or #FF6600), rgb(), hsl(), or CSS names."
        );
        return;
      }
      const supabase = createClient();
      const mode = isDark ? "dark" : "light";
      const prev = popover.vault.colorOverrides ?? {};
      const nextOverrides = {
        ...prev,
        [mode]: {
          pillFill: nf,
          pillText: nt,
          cardBg: nf,
          cardAccent: nb,
          cardText: nt,
        },
      };
      const payload = {
        color_overrides: nextOverrides as Json,
        pill_fill_bg: null,
        pill_border_color: nb,
        pill_text_color: null,
        default_card_bg: null,
        default_card_accent: null,
        default_card_text: null,
      };
      const { error } = await supabase
        .from("category_vaults")
        .update(payload)
        .eq("id", popover.vaultId);
      if (error) {
        toast.error(supabaseErrorMessage(error));
        return;
      }
      setFill(nf ?? "");
      setBorder(nb ?? "");
      setText(nt ?? "");
      updateVault(popover.vaultId, {
        colorOverrides: parseVaultColorOverrides(nextOverrides),
        pillFillBg: null,
        pillBorderColor: payload.pill_border_color,
        pillTextColor: null,
        defaultCardAccent: null,
        defaultCardBg: null,
        defaultCardText: null,
      });
      toast.success("Colours saved");
    } catch (e: unknown) {
      console.error(e);
      toast.error(supabaseErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="vault-settings-panel fixed z-50 max-h-[min(90vh,560px)] w-[min(calc(100vw-24px),300px)] overflow-y-auto rounded-xl border p-3 text-sm shadow-xl"
        style={{
          left,
          top: popover.y,
          backgroundColor: "var(--popover-glass)",
          backdropFilter: "blur(24px) saturate(1.75)",
          WebkitBackdropFilter: "blur(24px) saturate(1.75)",
          borderColor: "var(--border2)",
          color: "var(--text)",
          boxShadow: "var(--shadow-lg)",
        }}
      >
        <div className="mb-2 font-semibold">{popover.vault.name}</div>
        <p className="mb-3 text-xs" style={{ color: "var(--muted)" }}>
          Border, fill, and text apply to the vault header pill and default
          memory cards. Per-card overrides live in node details.
        </p>
        <p className="mb-3 text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
          Start with <strong style={{ color: "var(--text)" }}>border</strong> — we
          suggest fill and label text for contrast. Colours are saved per{" "}
          <strong style={{ color: "var(--text)" }}>
            {isDark ? "dark" : "light"}
          </strong>{" "}
          mode so you can tune each separately; unsaved edits reset when you
          switch appearance. Type <code className="text-[10px]">ff6600</code>{" "}
          without # — we normalize to hex.
        </p>

        <div className="mb-3 space-y-4 border-b pb-3" style={{ borderColor: "var(--border)" }}>
          <div className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            Vault border, fill &amp; text
          </div>
          <ThemeColorRow
            label="Border"
            value={border}
            onChange={setBorder}
            onCommitHex={commitBorderHex}
            themeSuggestion={borderTheme}
            themeHint={themeHint}
            onThemeClick={applyThemeFromVaultColour}
          />
          <ThemeColorRow
            label="Fill"
            value={fill}
            onChange={setFill}
            onCommitHex={commitFillHex}
            themeSuggestion={fillTheme}
            themeHint={themeHint}
            onThemeClick={applyThemeFromVaultColour}
          />
          <ThemeColorRow
            label="Label text"
            value={text}
            onChange={setText}
            onCommitHex={(hex) => setText(hex)}
            themeSuggestion={suggestedReadableTextForBackground(fillTheme)}
            themeHint={`Readable on theme fill (${isDark ? "dark" : "light"})`}
            onThemeClick={() =>
              setText(suggestedReadableTextForBackground(fillTheme))
            }
            showReadable
            readableBgHex={fillForContrast}
            onApplyReadable={() =>
              setText(suggestedReadableTextForBackground(fillForContrast))
            }
          />
        </div>

        <button
          type="button"
          className="mb-3 w-full rounded-md border px-3 py-2 text-xs font-medium"
          style={{ borderColor: "var(--border)" }}
          disabled={saving}
          onClick={() => void saveTheme()}
        >
          {saving ? "Saving…" : "Save colours"}
        </button>

        <p className="mb-2 text-xs" style={{ color: "var(--muted)" }}>
          Locked: {popover.vault.isLocked ? "yes" : "no"}
        </p>
        <div className="flex flex-col gap-2">
          {!popover.vault.isLocked ? (
            <button
              type="button"
              className="rounded border px-2 py-1 text-left text-xs"
              style={{ borderColor: "var(--border)" }}
              onClick={() => setPinMode("set")}
            >
              Set PIN & lock
            </button>
          ) : (
            <button
              type="button"
              className="rounded border px-2 py-1 text-left text-xs"
              style={{ borderColor: "var(--border)" }}
              onClick={() => setPinMode("unlock")}
            >
              Unlock with PIN
            </button>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={popover.vault.isExportable !== false}
              onChange={async (e) => {
                const supabase = createClient();
                const { error } = await supabase
                  .from("category_vaults")
                  .update({ is_exportable: e.target.checked })
                  .eq("id", popover.vaultId);
                if (error) {
                  toast.error(supabaseErrorMessage(error));
                  return;
                }
                updateVault(popover.vaultId, {
                  isExportable: e.target.checked,
                });
              }}
            />
            Exportable
          </label>
        </div>
      </div>
      {pinMode && (
        <PinModal
          mode={pinMode}
          onSet={async (hash) => {
            const supabase = createClient();
            const { error } = await supabase
              .from("category_vaults")
              .update({ pin_hash: hash, is_locked: true })
              .eq("id", popover.vaultId);
            if (error) {
              toast.error(supabaseErrorMessage(error));
              return;
            }
            updateVault(popover.vaultId, {
              pinHash: hash,
              isLocked: true,
            });
            setPinMode(null);
            onClose();
          }}
          onUnlock={async (hash) => {
            if (hash !== popover.vault.pinHash) throw new Error("bad");
            sessionStorage.setItem(`vault-unlocked-${popover.vaultId}`, "1");
            setPinMode(null);
            onClose();
          }}
          onClose={() => setPinMode(null)}
        />
      )}
    </>
  );
}
