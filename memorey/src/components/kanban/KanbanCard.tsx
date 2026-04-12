"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatDistanceToNow } from "date-fns";
import type { KanbanStatus } from "@/types/memorey";

export function statusColor(s: string) {
  if (s === "todo") return "#888780";
  if (s === "doing") return "#F5C542";
  if (s === "done") return "#5DCAA5";
  return "#888780";
}

export interface KanbanCardNode {
  id: string;
  title: string;
  value: string;
  kanban_status?: KanbanStatus | null;
  vaultName: string;
  vaultColor: string;
  createdAt: string;
  canvasEmoji?: string | null;
  masterView?: boolean;
  /** Master kanban search: dim non-matching cards */
  searchDimmed?: boolean;
  /** Master kanban search: subtle highlight when query matches */
  searchHighlight?: boolean;
}

const CARD_DRAG_PREFIX = "card-";

export function kanbanCardDragId(nodeId: string) {
  return `${CARD_DRAG_PREFIX}${nodeId}`;
}

export function parseKanbanCardDragId(id: string | number): string | null {
  const s = String(id);
  if (!s.startsWith(CARD_DRAG_PREFIX)) return null;
  return s.slice(CARD_DRAG_PREFIX.length) || null;
}

export function KanbanCard({
  node,
  linkedCount,
  onRemoveFromBoard,
  onOpenDetail,
}: {
  node: KanbanCardNode;
  linkedCount: number;
  onRemoveFromBoard: (nodeId: string) => void;
  onOpenDetail?: (nodeId: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({ id: kanbanCardDragId(node.id) });

  const masterCardChrome = Boolean(node.masterView);

  const cardBoxShadow = node.searchDimmed
    ? "none"
    : node.searchHighlight
      ? "0 0 0 2px color-mix(in oklab, var(--accent) 55%, transparent)"
      : masterCardChrome
        ? "0 1px 2px color-mix(in oklab, var(--text) 4%, transparent)"
        : undefined;

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : node.searchDimmed ? 0.38 : 1,
  };

  const vaultColor = node.vaultColor;

  return (
    <div
      ref={setNodeRef}
      className="kanban-card"
      style={{
        ...style,
        position: "relative",
        background: masterCardChrome
          ? "color-mix(in oklab, var(--card-bg) 92%, var(--bg2))"
          : "var(--card-bg)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${vaultColor}`,
        borderRadius: 8,
        padding: "10px 12px",
        paddingRight: masterCardChrome ? 44 : 12,
        marginBottom: 8,
        cursor: "grab",
        userSelect: "none" as const,
        transition: "box-shadow 0.15s, opacity 0.15s",
        touchAction: "none",
        boxShadow: cardBoxShadow,
      }}
      {...listeners}
      {...attributes}
    >
      {node.masterView && node.canvasEmoji ? (
        <span
          className="pointer-events-none absolute right-2 top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border px-1 leading-none"
          title="Canvas"
          aria-hidden
          style={{
            borderColor: "var(--border)",
            background: "var(--bg3)",
            color: "var(--text)",
            fontSize: 13,
            opacity: node.searchDimmed ? 0.55 : 1,
            filter: node.searchDimmed ? "grayscale(0.25)" : undefined,
            boxShadow: "0 1px 0 color-mix(in oklab, var(--text) 6%, transparent)",
          }}
        >
          {node.canvasEmoji}
        </span>
      ) : null}

      <div className="flex items-center gap-2 pr-7">
        <span
          className="inline-block size-2 shrink-0 rounded-full"
          style={{ backgroundColor: vaultColor }}
          title={node.vaultName}
          aria-hidden
        />
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            letterSpacing: "0.08em",
            color: vaultColor,
            textTransform: "uppercase" as const,
          }}
          className="min-w-0 truncate"
        >
          {node.vaultName}
        </span>
      </div>

      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: "var(--text)",
          margin: "6px 0 4px",
          lineHeight: 1.4,
          cursor: onOpenDetail ? "pointer" : undefined,
        }}
        onPointerDown={(e) => { if (onOpenDetail) e.stopPropagation(); }}
        onClick={() => onOpenDetail?.(node.id)}
      >
        {node.title}
      </div>

      {node.value?.trim() && (
        <div
          style={{
            fontSize: 11,
            color: "var(--text2)",
            lineHeight: 1.5,
            marginBottom: 8,
          }}
        >
          {node.value.slice(0, 80)}
          {node.value.length > 80 ? "…" : ""}
        </div>
      )}

      <div
        style={{
          fontSize: 10,
          color: "var(--text2)",
          marginBottom: 6,
        }}
      >
        {formatDistanceToNow(new Date(node.createdAt), { addSuffix: true })}
      </div>

      <div
        style={{ display: "flex", gap: 4, marginTop: 6, flexWrap: "wrap" }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onRemoveFromBoard(node.id)}
          style={{
            marginLeft: "auto",
            fontSize: 10,
            color: "var(--faint)",
            background: "none",
            border: "none",
            cursor: "pointer",
          }}
          title="Remove from Kanban"
        >
          × Remove
        </button>
      </div>

      {linkedCount > 0 && (
        <div
          style={{
            fontSize: 10,
            color: "var(--muted)",
            marginTop: 6,
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="12" r="3" />
            <line x1="9" y1="12" x2="15" y2="12" />
          </svg>
          {linkedCount} linked {linkedCount === 1 ? "memory" : "memories"}
        </div>
      )}
    </div>
  );
}
