import React from "react";
import type { MemoryNode, ApprovalStatus } from "../types";

const VAULT_COLORS: Record<string, string> = {
  identity: "#8B5CF6",
  work: "#3B82F6",
  preferences: "#EC4899",
  knowledge: "#10B981",
  relationships: "#F59E0B",
  projects: "#6366F1",
  history: "#78716C",
  context: "#06B6D4",
};

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = ((hash % 360) + 360) % 360;
  return `hsl(${hue}, 65%, 50%)`;
}

function getVaultColor(vault: string): string {
  return VAULT_COLORS[vault] ?? hashColor(vault);
}

const STATUS_BORDER: Record<ApprovalStatus, { dash: string; color: string }> = {
  approved: { dash: "none", color: "#22C55E" },
  auto_approved: { dash: "none", color: "#22C55E" },
  pending: { dash: "6,3", color: "#F59E0B" },
  rejected: { dash: "2,3", color: "#EF4444" },
};

interface GraphNodeProps {
  node: MemoryNode;
  x: number;
  y: number;
  selected: boolean;
  onMouseDown: (e: React.MouseEvent, nodeId: string) => void;
  onClick: (nodeId: string) => void;
  onDoubleClick: (nodeId: string) => void;
}

export function GraphNode({
  node,
  x,
  y,
  selected,
  onMouseDown,
  onClick,
  onDoubleClick,
}: GraphNodeProps) {
  const radius = 14 + node.confidence * 10;
  const fillColor = getVaultColor(node.vault);
  const border = STATUS_BORDER[node.status] ?? STATUS_BORDER.pending;
  const label =
    node.fact.length > 24 ? node.fact.slice(0, 22) + "..." : node.fact;

  return (
    <g
      className="memorey-graph-node"
      onMouseDown={(e) => onMouseDown(e, node.id)}
      onClick={(e) => {
        e.stopPropagation();
        onClick(node.id);
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        onDoubleClick(node.id);
      }}
      style={{ cursor: "pointer" }}
    >
      <circle
        cx={x}
        cy={y}
        r={radius}
        fill={fillColor + "33"}
        stroke={selected ? "#FF6600" : border.color}
        strokeWidth={selected ? 3 : 2}
        strokeDasharray={selected ? "none" : border.dash}
      />
      <circle cx={x} cy={y} r={radius * 0.45} fill={fillColor} opacity={0.9} />
      <text
        x={x}
        y={y + radius + 14}
        textAnchor="middle"
        className="memorey-graph-node__label"
        fontSize="10"
        fill="var(--memorey-text-secondary, #666)"
      >
        {label}
      </text>
    </g>
  );
}

export { getVaultColor };
