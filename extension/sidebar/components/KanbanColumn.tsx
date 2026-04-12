import React, { useCallback } from "react";
import type { MemoryNode } from "../types";
import { KanbanCard, type KanbanGroupMode } from "./KanbanCard";

interface KanbanColumnProps {
  label: string;
  columnKey: string;
  nodes: MemoryNode[];
  groupMode: KanbanGroupMode;
  onCardClick: (nodeId: string) => void;
  onDrop?: (nodeId: string, targetColumn: string) => void;
}

export function KanbanColumn({
  label,
  columnKey,
  nodes,
  groupMode,
  onCardClick,
  onDrop,
}: KanbanColumnProps) {
  const isDragTarget = groupMode === "vault" && !!onDrop;

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!isDragTarget) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
    },
    [isDragTarget]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      if (!isDragTarget) return;
      e.preventDefault();
      const nodeId = e.dataTransfer.getData("text/plain");
      if (nodeId) onDrop!(nodeId, columnKey);
    },
    [isDragTarget, onDrop, columnKey]
  );

  return (
    <div
      className="memorey-kanban-column"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="memorey-kanban-column__header">
        <span className="memorey-kanban-column__label">{label}</span>
        <span className="memorey-kanban-column__count">{nodes.length}</span>
      </div>
      <div className="memorey-kanban-column__cards">
        {nodes.map((node) => (
          <KanbanCard
            key={node.id}
            node={node}
            groupMode={groupMode}
            draggable={isDragTarget}
            onClick={() => onCardClick(node.id)}
          />
        ))}
      </div>
    </div>
  );
}
