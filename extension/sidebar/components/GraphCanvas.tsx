import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MemoryNode, MemoryEdge } from "memorey-core";
import { GraphNode, getVaultColor } from "./GraphNode";
import { GraphEdge } from "./GraphEdge";
import { MiniMap } from "./MiniMap";

// ─── Force layout types ──────────────────────────────────────
interface LayoutNode {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface LayoutEdge {
  from: number;
  to: number;
}

// ─── Persistent layout cache ─────────────────────────────────
const positionCache = new Map<string, { x: number; y: number }>();

function forceLayout(nodes: LayoutNode[], edges: LayoutEdge[], iterations: number = 80) {
  if (nodes.length === 0) return;

  const area = 600 * 500;
  const k = Math.sqrt(area / Math.max(nodes.length, 1));

  for (let iter = 0; iter < iterations; iter++) {
    const temp = Math.max(0.01, 1 - iter / iterations);

    // Repulsion between all pairs
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = nodes[j].x - nodes[i].x;
        let dy = nodes[j].y - nodes[i].y;
        const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.5);
        const force = (k * k) / dist;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        nodes[i].vx -= fx;
        nodes[i].vy -= fy;
        nodes[j].vx += fx;
        nodes[j].vy += fy;
      }
    }

    // Attraction along edges (spring)
    for (const e of edges) {
      const a = nodes[e.from];
      const b = nodes[e.to];
      let dx = b.x - a.x;
      let dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.5);
      const force = (dist * dist) / k;
      const fx = (dx / dist) * force * 0.08;
      const fy = (dy / dist) * force * 0.08;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }

    // Update positions with damping
    for (const n of nodes) {
      const speed = Math.sqrt(n.vx * n.vx + n.vy * n.vy);
      const maxSpeed = 8 * temp;
      if (speed > maxSpeed && speed > 0) {
        n.vx = (n.vx / speed) * maxSpeed;
        n.vy = (n.vy / speed) * maxSpeed;
      }
      n.x += n.vx;
      n.y += n.vy;
      n.vx *= 0.85;
      n.vy *= 0.85;
    }
  }
}

// ─── Tooltip ─────────────────────────────────────────────────
interface TooltipState {
  nodeId: string;
  screenX: number;
  screenY: number;
}

// ─── Main component ─────────────────────────────────────────
interface GraphCanvasProps {
  nodes: MemoryNode[];
  edges: MemoryEdge[];
  onNodeDoubleClick: (nodeId: string) => void;
}

export function GraphCanvas({ nodes, edges, onNodeDoubleClick }: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Viewport transform: world coordinates = (screen - pan) / zoom
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // ─── Compute layout positions (memoized by node/edge IDs) ──
  const layoutKey = useMemo(
    () => nodes.map((n) => n.id).join(",") + "|" + edges.map((e) => e.id).join(","),
    [nodes, edges]
  );

  const [positions, setPositions] = useState<Map<string, { x: number; y: number }>>(new Map());

  useEffect(() => {
    if (nodes.length === 0) {
      setPositions(new Map());
      return;
    }

    const nodeIndex = new Map<string, number>();
    const layoutNodes: LayoutNode[] = nodes.map((n, i) => {
      nodeIndex.set(n.id, i);
      const cached = positionCache.get(n.id);
      return {
        id: n.id,
        x: cached?.x ?? (Math.random() - 0.5) * 400,
        y: cached?.y ?? (Math.random() - 0.5) * 300,
        vx: 0,
        vy: 0,
      };
    });

    const layoutEdges: LayoutEdge[] = [];
    for (const e of edges) {
      const fi = nodeIndex.get(e.fromId);
      const ti = nodeIndex.get(e.toId);
      if (fi !== undefined && ti !== undefined) {
        layoutEdges.push({ from: fi, to: ti });
      }
    }

    forceLayout(layoutNodes, layoutEdges, 80);

    const newPos = new Map<string, { x: number; y: number }>();
    for (const ln of layoutNodes) {
      newPos.set(ln.id, { x: ln.x, y: ln.y });
      positionCache.set(ln.id, { x: ln.x, y: ln.y });
    }
    setPositions(newPos);
  }, [layoutKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── World bounds for minimap ──────────────────────────────
  const worldBounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const [, pos] of positions) {
      if (pos.x < minX) minX = pos.x;
      if (pos.y < minY) minY = pos.y;
      if (pos.x > maxX) maxX = pos.x;
      if (pos.y > maxY) maxY = pos.y;
    }
    if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    return { minX, minY, maxX, maxY };
  }, [positions]);

  // ─── Container dimensions for viewport calc ────────────────
  const [containerSize, setContainerSize] = useState({ w: 600, h: 400 });
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      setContainerSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Center on first layout
  const didCenter = useRef(false);
  useEffect(() => {
    if (positions.size > 0 && !didCenter.current) {
      didCenter.current = true;
      const cx = (worldBounds.minX + worldBounds.maxX) / 2;
      const cy = (worldBounds.minY + worldBounds.maxY) / 2;
      setPan({ x: containerSize.w / 2 - cx, y: containerSize.h / 2 - cy });
    }
  }, [positions.size, worldBounds, containerSize]);

  // ─── Viewport in world coords (for minimap) ───────────────
  const viewport = useMemo(
    () => ({
      x: -pan.x / zoom,
      y: -pan.y / zoom,
      width: containerSize.w / zoom,
      height: containerSize.h / zoom,
    }),
    [pan, zoom, containerSize]
  );

  const minimapNodes = useMemo(
    () =>
      nodes.map((n) => {
        const pos = positions.get(n.id) ?? { x: 0, y: 0 };
        return { x: pos.x, y: pos.y, color: getVaultColor(n.vault) };
      }),
    [nodes, positions]
  );

  // ─── Zoom handler ─────────────────────────────────────────
  const handleWheel = useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      const newZoom = Math.min(Math.max(zoom * factor, 0.2), 4);

      // Zoom towards mouse position
      const rect = containerRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const scale = newZoom / zoom;
      setPan({ x: mx - (mx - pan.x) * scale, y: my - (my - pan.y) * scale });
      setZoom(newZoom);
    },
    [zoom, pan]
  );

  // ─── Mouse handlers ───────────────────────────────────────
  const screenToWorld = useCallback(
    (sx: number, sy: number) => ({
      x: (sx - pan.x) / zoom,
      y: (sy - pan.y) / zoom,
    }),
    [pan, zoom]
  );

  const handleMouseDownCanvas = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      // Only pan if click target is the SVG itself (empty space)
      if ((e.target as Element).tagName === "svg" || (e.target as Element).tagName === "rect") {
        setIsPanning(true);
        lastMouse.current = { x: e.clientX, y: e.clientY };
      }
      setTooltip(null);
    },
    []
  );

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, nodeId: string) => {
      e.stopPropagation();
      if (e.button !== 0) return;
      setDraggingNode(nodeId);
      lastMouse.current = { x: e.clientX, y: e.clientY };
    },
    []
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const dx = e.clientX - lastMouse.current.x;
      const dy = e.clientY - lastMouse.current.y;
      lastMouse.current = { x: e.clientX, y: e.clientY };

      if (isPanning) {
        setPan((p) => ({ x: p.x + dx, y: p.y + dy }));
      } else if (draggingNode) {
        setPositions((prev) => {
          const next = new Map(prev);
          const pos = next.get(draggingNode);
          if (pos) {
            const newPos = { x: pos.x + dx / zoom, y: pos.y + dy / zoom };
            next.set(draggingNode, newPos);
            positionCache.set(draggingNode, newPos);
          }
          return next;
        });
      }
    },
    [isPanning, draggingNode, zoom]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setDraggingNode(null);
  }, []);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      if (draggingNode) return;
      const pos = positions.get(nodeId);
      if (!pos) return;
      const sx = pos.x * zoom + pan.x;
      const sy = pos.y * zoom + pan.y;
      setTooltip((prev) => (prev?.nodeId === nodeId ? null : { nodeId, screenX: sx, screenY: sy }));
    },
    [positions, zoom, pan, draggingNode]
  );

  const handleMinimapNavigate = useCallback(
    (worldX: number, worldY: number) => {
      setPan({
        x: containerSize.w / 2 - worldX * zoom,
        y: containerSize.h / 2 - worldY * zoom,
      });
    },
    [containerSize, zoom]
  );

  // ─── Tooltip node ─────────────────────────────────────────
  const tooltipNode = tooltip ? nodes.find((n) => n.id === tooltip.nodeId) : null;

  // ─── Render ────────────────────────────────────────────────
  if (nodes.length === 0) {
    return (
      <div className="memorey-graph-canvas memorey-graph-canvas--empty">
        <div className="memorey-empty">
          <div className="memorey-empty__title">No nodes to display</div>
          <div className="memorey-empty__text">Add some memories to see the graph visualization.</div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="memorey-graph-canvas"
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        onWheel={handleWheel}
        onMouseDown={handleMouseDownCanvas}
        className="memorey-graph-canvas__svg"
      >
        {/* Background */}
        <rect width="100%" height="100%" fill="transparent" />

        <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
          {/* Edges first (below nodes) */}
          {edges.map((edge) => {
            const fromPos = positions.get(edge.fromId);
            const toPos = positions.get(edge.toId);
            if (!fromPos || !toPos) return null;
            return (
              <GraphEdge
                key={edge.id}
                edge={edge}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const pos = positions.get(node.id);
            if (!pos) return null;
            return (
              <GraphNode
                key={node.id}
                node={node}
                x={pos.x}
                y={pos.y}
                selected={tooltip?.nodeId === node.id}
                onMouseDown={handleNodeMouseDown}
                onClick={handleNodeClick}
                onDoubleClick={onNodeDoubleClick}
              />
            );
          })}
        </g>
      </svg>

      {/* Tooltip popover */}
      {tooltipNode && tooltip && (
        <div
          className="memorey-graph-tooltip"
          style={{
            left: Math.min(tooltip.screenX + 12, containerSize.w - 220),
            top: Math.min(tooltip.screenY - 10, containerSize.h - 120),
          }}
        >
          <div className="memorey-graph-tooltip__fact">{tooltipNode.fact}</div>
          <div className="memorey-graph-tooltip__meta">
            <span className="memorey-graph-tooltip__vault">{tooltipNode.vault}</span>
            <span className="memorey-graph-tooltip__confidence">
              {Math.round(tooltipNode.confidence * 100)}%
            </span>
            <span className={`memorey-graph-tooltip__status memorey-graph-tooltip__status--${tooltipNode.status}`}>
              {tooltipNode.status === "auto_approved" ? "auto" : tooltipNode.status}
            </span>
          </div>
        </div>
      )}

      {/* MiniMap */}
      <MiniMap
        worldBounds={worldBounds}
        viewport={viewport}
        nodePositions={minimapNodes}
        onNavigate={handleMinimapNavigate}
      />
    </div>
  );
}
