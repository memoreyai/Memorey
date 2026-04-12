import React from "react";
import type { MemoryNode } from "memorey-core";
import { KanbanColumn } from "./KanbanColumn";
import type { KanbanGroupMode } from "./KanbanCard";

interface ColumnData {
  key: string;
  label: string;
  nodes: MemoryNode[];
}

interface KanbanBoardProps {
  columns: ColumnData[];
  groupMode: KanbanGroupMode;
  onCardClick: (nodeId: string) => void;
  onDrop?: (nodeId: string, targetColumn: string) => void;
}

export function KanbanBoard({ columns, groupMode, onCardClick, onDrop }: KanbanBoardProps) {
  if (columns.length === 0) {
    return (
      <div className="memorey-empty">
        <div className="memorey-empty__title">No facts yet</div>
        <div className="memorey-empty__text">Extract some facts to see them here.</div>
      </div>
    );
  }

  return (
    <div className="memorey-kanban-board">
      {columns.map((col) => (
        <KanbanColumn
          key={col.key}
          label={col.label}
          columnKey={col.key}
          nodes={col.nodes}
          groupMode={groupMode}
          onCardClick={onCardClick}
          onDrop={onDrop}
        />
      ))}
    </div>
  );
}
