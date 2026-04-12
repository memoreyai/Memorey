"use client";

import type { EdgeStyle } from "../types/canvas.types";

interface EdgeStylePickerProps {
  edgeStyle: EdgeStyle;
  onChange: (s: EdgeStyle) => void;
}

const OPTIONS: { id: EdgeStyle; label: string }[] = [
  { id: "orthogonal-dashed", label: "Ortho dash" },
  { id: "orthogonal-dotted", label: "Ortho dot" },
  { id: "curved-dashed", label: "Curve dash" },
  { id: "curved-dotted", label: "Curve dot" },
];

export function EdgeStylePicker({ edgeStyle, onChange }: EdgeStylePickerProps) {
  return (
    <div
      className="grid grid-cols-2 gap-2 p-2"
      style={{ minWidth: 200 }}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className="rounded-md border px-2 py-2 text-left text-xs transition-colors"
          style={{
            borderColor:
              edgeStyle === o.id ? "var(--orange)" : "var(--border)",
            backgroundColor:
              edgeStyle === o.id ? "var(--orange-dim)" : "var(--surface)",
            color: "var(--text)",
          }}
        >
          <svg width="100%" height={28} className="mb-1" aria-hidden>
            <path
              d="M4 14 L44 14"
              fill="none"
              stroke="var(--muted)"
              strokeWidth={2}
              strokeDasharray={o.id.includes("dotted") ? "2 4" : "6 4"}
            />
          </svg>
          {o.label}
        </button>
      ))}
    </div>
  );
}
