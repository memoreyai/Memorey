"use client";

import type { RefObject } from "react";
import { Search } from "lucide-react";
import type { SearchMode } from "../types/canvas.types";

const SEARCH_ICON_SIZE = 18;

interface SearchBarProps {
  searchExpanded: boolean;
  searchQuery: string;
  searchMode: SearchMode;
  searchResultCount: number;
  semanticLoading: boolean;
  onExpand: () => void;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClear: () => void;
  inputRef: RefObject<HTMLInputElement | null>;
}

export function SearchBar({
  searchExpanded,
  searchQuery,
  searchMode,
  searchResultCount,
  semanticLoading,
  onExpand,
  onChange,
  onSubmit,
  onClear,
  inputRef,
}: SearchBarProps) {
  if (!searchExpanded) {
    return (
      <button
        type="button"
        aria-label="Open search"
        onClick={onExpand}
        style={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "var(--surface)",
          border: "1px solid var(--border2)",
          boxShadow: "var(--shadow-md)",
          color: "var(--text)",
          cursor: "pointer",
          flexShrink: 0,
          marginLeft: "auto",
        }}
      >
        <Search size={SEARCH_ICON_SIZE} strokeWidth={2} aria-hidden />
      </button>
    );
  }
  return (
    <div
      className="flex min-h-0 max-h-full w-full max-w-full items-center gap-2 overflow-hidden rounded-full border px-3 py-2 shadow-md md:max-w-[min(100%,320px)]"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border2)",
        color: "var(--text)",
        marginLeft: "auto",
      }}
    >
      <Search
        size={SEARCH_ICON_SIZE}
        strokeWidth={2}
        style={{ flexShrink: 0, color: "var(--muted)", alignSelf: "center" }}
        aria-hidden
      />
      <input
        ref={inputRef}
        value={searchQuery}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onSubmit();
        }}
        placeholder="Search memories…"
        className="min-h-0 min-w-0 flex-1 bg-transparent text-sm outline-none"
        style={{ color: "var(--text)" }}
      />
      <span className="shrink-0 text-xs" style={{ color: "var(--muted)" }}>
        {semanticLoading
          ? "…"
          : `${searchResultCount} · ${searchMode}`}
      </span>
      <button
        type="button"
        className="shrink-0 text-xs"
        style={{ color: "var(--muted)" }}
        onClick={onClear}
      >
        ✕
      </button>
    </div>
  );
}
