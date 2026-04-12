import React, { useState } from "react";
import type { MemoryEdge } from "../types";

interface GraphEdgeProps {
  edge: MemoryEdge;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export function GraphEdge({ edge, x1, y1, x2, y2 }: GraphEdgeProps) {
  const [hovered, setHovered] = useState(false);
  const thickness = Math.max(1, Math.min(edge.weight * 3, 5));
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2 - 8;

  return (
    <g
      className="memorey-graph-edge"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={hovered ? "#FF6600" : "var(--memorey-border, #ccc)"}
        strokeWidth={hovered ? thickness + 1 : thickness}
        strokeOpacity={hovered ? 0.9 : 0.4}
      />
      {/* Invisible wider hit area for hover */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={12}
      />
      {hovered && (
        <text
          x={midX}
          y={midY}
          textAnchor="middle"
          fontSize="9"
          fill="var(--memorey-text-secondary, #666)"
          className="memorey-graph-edge__label"
        >
          {edge.relation}
        </text>
      )}
    </g>
  );
}
