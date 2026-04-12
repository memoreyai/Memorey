import React, { useCallback } from "react";
import type { MemoryNode } from "memorey-core";
import { StatusBadge } from "./StatusBadge";

function confidenceColor(c: number): string {
  if (c >= 0.8) return "var(--memorey-success)";
  if (c >= 0.5) return "var(--memorey-warning)";
  return "var(--memorey-error)";
}

export type KanbanGroupMode = "vault" | "status" | "source";

interface KanbanCardProps {
  node: MemoryNode;
  groupMode: KanbanGroupMode;
  draggable: boolean;
  onClick: () => void;
}

export function KanbanCard({ node, groupMode, draggable, onClick }: KanbanCardProps) {
  const truncated = node.fact.length > 80 ? node.fact.slice(0, 77) + "..." : node.fact;
  const pct = Math.round(node.confidence * 100);

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      e.dataTransfer.setData("text/plain", node.id);
      e.dataTransfer.effectAllowed = "move";
    },
    [node.id]
  );

  return (
    <div
      className="memorey-kanban-card"
      onClick={onClick}
      draggable={draggable}
      onDragStart={draggable ? handleDragStart : undefined}
      role="button"
      tabIndex={0}
    >
      <div className="memorey-kanban-card__fact">{truncated}</div>
      <div className="memorey-kanban-card__footer">
        {groupMode !== "vault" && (
          <span
            className="memorey-kanban-card__vault-dot"
            title={node.vault}
          />
        )}
        {groupMode !== "status" && (
          <StatusBadge status={node.status} />
        )}
        <div className="memorey-kanban-card__confidence-bar">
          <div
            className="memorey-kanban-card__confidence-fill"
            style={{ width: `${pct}%`, background: confidenceColor(node.confidence) }}
          />
        </div>
      </div>
    </div>
  );
}
