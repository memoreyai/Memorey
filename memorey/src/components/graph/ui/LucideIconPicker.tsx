"use client";

import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";
import { loadLucideIconNames } from "@/lib/lucideIconNames";

interface LucideIconPickerProps {
  value: string | null;
  onChange: (name: string | null) => void;
  accentColor: string;
  /** When search is empty, these names are listed first (must exist in Lucide). */
  preferredIconNames?: string[];
}

type LucideModule = Record<string, unknown>;

function isRenderableIcon(v: unknown): boolean {
  if (typeof v === "function") return true;
  if (v !== null && typeof v === "object") {
    return (
      "render" in v &&
      typeof (v as { render?: unknown }).render === "function"
    );
  }
  return false;
}

export function LucideIconPicker({
  value,
  onChange,
  accentColor,
  preferredIconNames,
}: LucideIconPickerProps) {
  const [names, setNames] = useState<string[]>([]);
  const [lucideMod, setLucideMod] = useState<LucideModule | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    let cancelled = false;
    void Promise.all([loadLucideIconNames(), import("lucide-react")]).then(
      ([n, mod]) => {
        if (cancelled) return;
        setNames(n.sort((a, b) => a.localeCompare(b)));
        setLucideMod(mod as LucideModule);
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) {
      const pref = (preferredIconNames ?? []).filter((n) => names.includes(n));
      const prefSet = new Set(pref);
      const rest = names.filter((n) => !prefSet.has(n));
      return [...pref, ...rest];
    }
    return names.filter((n) => n.toLowerCase().includes(needle));
  }, [names, q, preferredIconNames]);

  return (
    <div className="space-y-2">
      <div className="text-[11px]" style={{ color: "var(--muted)" }}>
        Search the full Lucide set — type to filter (e.g. goal, flag,
        briefcase).
      </div>
      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Type to filter…"
        className="w-full rounded border bg-transparent px-2 py-1.5 text-xs outline-none"
        style={{ borderColor: "var(--border)", color: "var(--text)" }}
      />
      <div
        className="text-[10px] tabular-nums"
        style={{ color: "var(--muted)" }}
      >
        {names.length === 0 ? (
          "Loading icon list…"
        ) : (
          <>
            Showing {filtered.length} of {names.length}
            {q.trim() ? ` · match “${q.trim()}”` : ""}
          </>
        )}
      </div>
      <div
        className="flex max-h-[min(50vh,420px)] min-h-[72px] flex-wrap content-start gap-1 overflow-y-auto overflow-x-hidden rounded border p-1.5"
        style={{
          borderColor: "var(--border2)",
          background: "var(--bg2)",
        }}
      >
        <button
          type="button"
          className="rounded border px-2 py-1 text-[10px]"
          style={{
            borderColor: "var(--border)",
            background: !value ? "var(--bg4)" : "transparent",
          }}
          onClick={() => onChange(null)}
        >
          None
        </button>
        {filtered.map((name) => (
          <IconPreviewButton
            key={name}
            name={name}
            lucideMod={lucideMod}
            selected={value === name}
            accentColor={accentColor}
            onPick={() => onChange(name)}
          />
        ))}
      </div>
    </div>
  );
}

function IconPreviewButton({
  name,
  lucideMod,
  selected,
  accentColor,
  onPick,
}: {
  name: string;
  lucideMod: LucideModule | null;
  selected: boolean;
  accentColor: string;
  onPick: () => void;
}) {
  const Icon = useMemo(() => {
    if (!lucideMod) return null;
    const I = lucideMod[name];
    return isRenderableIcon(I)
      ? (I as ComponentType<{
          size?: number;
          strokeWidth?: number;
          color?: string;
        }>)
      : null;
  }, [lucideMod, name]);

  return (
    <button
      type="button"
      title={name}
      onClick={onPick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded border transition-colors"
      style={{
        borderColor: selected ? accentColor : "var(--border2)",
        background: selected ? `${accentColor}22` : "var(--bg2)",
        contentVisibility: "auto",
      }}
    >
      {Icon ? (
        <Icon size={16} strokeWidth={1.75} color={accentColor} />
      ) : (
        <span className="text-[8px] text-[var(--muted)]">…</span>
      )}
    </button>
  );
}
