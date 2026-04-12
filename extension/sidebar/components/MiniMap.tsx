import React, { useCallback, useRef } from "react";

interface MiniMapProps {
  /** Bounding box of all nodes in world coordinates */
  worldBounds: { minX: number; minY: number; maxX: number; maxY: number };
  /** Current viewport in world coordinates */
  viewport: { x: number; y: number; width: number; height: number };
  /** Node positions for rendering dots */
  nodePositions: Array<{ x: number; y: number; color: string }>;
  /** Called when user clicks to jump the main canvas */
  onNavigate: (worldX: number, worldY: number) => void;
}

const MINIMAP_W = 140;
const MINIMAP_H = 90;
const PADDING = 20;

export function MiniMap({ worldBounds, viewport, nodePositions, onNavigate }: MiniMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  const worldW = Math.max(worldBounds.maxX - worldBounds.minX, 1) + PADDING * 2;
  const worldH = Math.max(worldBounds.maxY - worldBounds.minY, 1) + PADDING * 2;
  const scale = Math.min(MINIMAP_W / worldW, MINIMAP_H / worldH);
  const offsetX = -worldBounds.minX + PADDING;
  const offsetY = -worldBounds.minY + PADDING;

  const toMiniX = (wx: number) => (wx + offsetX) * scale;
  const toMiniY = (wy: number) => (wy + offsetY) * scale;

  const vpX = toMiniX(viewport.x);
  const vpY = toMiniY(viewport.y);
  const vpW = viewport.width * scale;
  const vpH = viewport.height * scale;

  const handleClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const worldX = mx / scale - offsetX;
      const worldY = my / scale - offsetY;
      onNavigate(worldX, worldY);
    },
    [scale, offsetX, offsetY, onNavigate]
  );

  return (
    <div className="memorey-minimap">
      <svg
        ref={svgRef}
        width={MINIMAP_W}
        height={MINIMAP_H}
        onClick={handleClick}
        className="memorey-minimap__svg"
      >
        <rect width={MINIMAP_W} height={MINIMAP_H} fill="var(--memorey-surface, #f5f5f5)" rx="4" />
        {nodePositions.map((pos, i) => (
          <circle
            key={i}
            cx={toMiniX(pos.x)}
            cy={toMiniY(pos.y)}
            r={2}
            fill={pos.color}
            opacity={0.7}
          />
        ))}
        <rect
          x={vpX}
          y={vpY}
          width={Math.max(vpW, 4)}
          height={Math.max(vpH, 4)}
          fill="none"
          stroke="var(--memorey-orange, #FF6600)"
          strokeWidth={1.5}
          rx={2}
          opacity={0.8}
        />
      </svg>
    </div>
  );
}
