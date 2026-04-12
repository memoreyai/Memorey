"use client";

interface BulkActionBarProps {
  selectedCount: number;
  onSelectAll: () => void;
  onExport: () => void;
  onMove: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}

export function BulkActionBar({
  selectedCount,
  onSelectAll,
  onExport,
  onMove,
  onDelete,
  onDeselect,
}: BulkActionBarProps) {
  if (selectedCount <= 0) return null;
  return (
    <div
      className="fixed left-1/2 top-4 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border px-3 py-2 shadow-lg"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <span className="px-2 text-sm">{selectedCount} selected</span>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs"
        style={{ color: "var(--muted)" }}
        onClick={onSelectAll}
      >
        All
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs"
        style={{ color: "var(--text)" }}
        onClick={onExport}
      >
        Export
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs"
        style={{ color: "var(--text)" }}
        onClick={onMove}
      >
        Move
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs"
        style={{ color: "var(--destructive, #e11)" }}
        onClick={onDelete}
      >
        Delete
      </button>
      <button
        type="button"
        className="rounded-md px-2 py-1 text-xs"
        style={{ color: "var(--muted)" }}
        onClick={onDeselect}
      >
        Deselect
      </button>
    </div>
  );
}
