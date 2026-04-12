"use client";

import { useMemo } from "react";
import {
  parseCssColorToHex6,
  hexToRgbComponents,
  rgbComponentsToHex,
} from "@/lib/parseCssColor";

const PICKER_FALLBACK = "#888780";

interface FlexibleColorInputProps {
  /** Raw value (may be empty, hex, rgb(), hsl(), named colour, ff6600 without #) */
  value: string;
  onChange: (raw: string) => void;
  /** Fired when a valid opaque hex is committed (picker, blur, Enter, RGB) */
  onCommitHex?: (hex: string) => void;
  "aria-label": string;
}

/**
 * Full-area native colour picker, RGB inputs, then hex text (any format on commit).
 */
export function FlexibleColorInput({
  value,
  onChange,
  onCommitHex,
  "aria-label": ariaLabel,
}: FlexibleColorInputProps) {
  const resolvedHex = useMemo(
    () => parseCssColorToHex6(value) ?? PICKER_FALLBACK,
    [value]
  );
  const rgb = useMemo(
    () => hexToRgbComponents(resolvedHex) ?? { r: 136, g: 135, b: 128 },
    [resolvedHex]
  );

  function applyHex(hex: string) {
    onChange(hex);
    onCommitHex?.(hex);
  }

  function commitIfValid(raw: string) {
    if (!raw.trim()) {
      onChange("");
      return;
    }
    const hex = parseCssColorToHex6(raw);
    if (hex) {
      onChange(hex);
      onCommitHex?.(hex);
    }
  }

  function setChannel(
    key: "r" | "g" | "b",
    num: number
  ) {
    if (Number.isNaN(num)) return;
    const next = { ...rgb, [key]: num };
    const hex = rgbComponentsToHex(next.r, next.g, next.b);
    applyHex(hex);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <input
        type="color"
        value={resolvedHex}
        onChange={(e) => {
          const hex = e.target.value.toUpperCase();
          applyHex(hex);
        }}
        className="box-border h-12 w-full min-w-0 cursor-pointer rounded-md border p-1"
        style={{ borderColor: "var(--border)" }}
        aria-label={ariaLabel}
      />
      <div className="grid grid-cols-3 gap-2">
        {(["r", "g", "b"] as const).map((k) => (
          <label key={k} className="flex flex-col gap-0.5 text-[10px] uppercase tracking-wide" style={{ color: "var(--muted)" }}>
            {k === "r" ? "R" : k === "g" ? "G" : "B"}
            <input
              type="number"
              min={0}
              max={255}
              value={rgb[k]}
              onChange={(e) => setChannel(k, Number(e.target.value))}
              className="w-full rounded border bg-transparent px-1.5 py-1 font-mono text-[11px] outline-none"
              style={{ borderColor: "var(--border)", color: "var(--text)" }}
            />
          </label>
        ))}
      </div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commitIfValid(value);
            (e.target as HTMLInputElement).blur();
          }
        }}
        onBlur={() => commitIfValid(value)}
        className="w-full rounded border bg-transparent px-2 py-1.5 font-mono text-[11px] outline-none"
        style={{ borderColor: "var(--border)", color: "var(--text)" }}
        placeholder="Hex · ff6600 · #RGB · rgb()"
        spellCheck={false}
        autoComplete="off"
        aria-label={`${ariaLabel} (text)`}
      />
    </div>
  );
}
