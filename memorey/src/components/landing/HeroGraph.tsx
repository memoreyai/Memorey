"use client";

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from "react";
import dynamic from "next/dynamic";
import type { ForceGraphMethods } from "react-force-graph-2d";

const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
  loading: () => (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        className="hero-graph-loader-dot"
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: "var(--accent, #5DCAA5)",
        }}
      />
    </div>
  ),
});

const VAULT_COLORS: Record<string, string> = {
  center: "#F0EFE9",
  Work: "#378ADD",
  Goals: "#7F77DD",
  Personal: "#5DCAA5",
  Finance: "#EF9F27",
  Study: "#D4537E",
};

type HeroNode = {
  id: string;
  label: string;
  vault: string;
  size: number;
  pinned?: boolean;
};

type SimNode = HeroNode & { x?: number; y?: number };

const NODES: HeroNode[] = [
  { id: "me", label: "You", vault: "center", size: 10, pinned: true },
  { id: "n1", label: "Building Memorey", vault: "Work", size: 6 },
  { id: "n2", label: "Next.js 14 + TypeScript", vault: "Work", size: 5 },
  { id: "n3", label: "Supabase + pgvector", vault: "Work", size: 5 },
  { id: "n4", label: "Prefers dark mode", vault: "Work", size: 4 },
  { id: "n5", label: "$3K MRR by Q3", vault: "Goals", size: 6 },
  { id: "n6", label: "Launch on Acquire.co", vault: "Goals", size: 5 },
  { id: "n7", label: "Build in public", vault: "Goals", size: 4 },
  { id: "n8", label: "Based in Bengaluru", vault: "Personal", size: 5 },
  { id: "n9", label: "Vikram", vault: "Personal", size: 6 },
  { id: "n10", label: "Founder + solo dev", vault: "Personal", size: 5 },
  { id: "n11", label: "$1K budget", vault: "Finance", size: 5 },
  { id: "n12", label: "Dodo Payments (active)", vault: "Finance", size: 4 },
  { id: "n13", label: "Zero to One", vault: "Study", size: 4 },
  { id: "n14", label: "MCP protocol", vault: "Study", size: 5 },
];

const LINKS = [
  { source: "me", target: "n1" },
  { source: "me", target: "n5" },
  { source: "me", target: "n9" },
  { source: "me", target: "n11" },
  { source: "me", target: "n13" },
  { source: "n1", target: "n2" },
  { source: "n1", target: "n3" },
  { source: "n1", target: "n4" },
  { source: "n5", target: "n6" },
  { source: "n5", target: "n7" },
  { source: "n9", target: "n8" },
  { source: "n9", target: "n10" },
  { source: "n11", target: "n12" },
  { source: "n13", target: "n14" },
  { source: "n2", target: "n14" },
  { source: "n5", target: "n11" },
];

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
  ctx.fill();
}

export default function HeroGraph() {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraphMethods | undefined>(undefined);
  const [dimensions, setDimensions] = useState({ width: 500, height: 500 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [entranceOn, setEntranceOn] = useState(false);

  const graphData = useMemo(
    () => ({
      nodes: NODES.map((n) => ({ ...n })),
      links: LINKS.map((l) => ({ ...l })),
    }),
    []
  );

  useEffect(() => {
    const check = () => {
      setIsDark(document.documentElement.getAttribute("data-theme") !== "light");
    };
    check();
    const observer = new MutationObserver(check);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        const { width, height } = e.contentRect;
        setDimensions({
          width: Math.max(1, Math.floor(width)),
          height: Math.max(1, Math.floor(height)),
        });
      }
    });
    ro.observe(containerRef.current);
    setDimensions({
      width: Math.max(1, containerRef.current.offsetWidth),
      height: Math.max(1, containerRef.current.offsetHeight),
    });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    if (!mounted) return;
    const t = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEntranceOn(true));
    });
    return () => cancelAnimationFrame(t);
  }, [mounted]);

  const handleEngineStop = useCallback(() => {
    const g = graphRef.current;
    if (!g) return;
    g.zoomToFit(400, 60);
    const centerNode = graphData.nodes.find((n) => n.id === "me") as
      | (HeroNode & { fx?: number; fy?: number })
      | undefined;
    if (centerNode) {
      centerNode.fx = 0;
      centerNode.fy = 0;
    }
  }, [graphData.nodes]);

  const paintNode = useCallback(
    (node: HeroNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const isHovered = hoveredNode === node.id;
      const isSelected = selectedNode === node.id;
      const isCenter = node.id === "me";
      const color = VAULT_COLORS[node.vault] || "#888";
      const r = isCenter ? 14 : (node.size || 5) * (isHovered ? 1.5 : 1);
      const x = node.x ?? 0;
      const y = node.y ?? 0;

      if (isHovered || isSelected) {
        ctx.beginPath();
        ctx.arc(x, y, r * 2.2, 0, 2 * Math.PI);
        const gradient = ctx.createRadialGradient(x, y, r * 0.5, x, y, r * 2.2);
        gradient.addColorStop(0, color + "44");
        gradient.addColorStop(1, color + "00");
        ctx.fillStyle = gradient;
        ctx.fill();
      }

      ctx.beginPath();
      ctx.arc(x, y, r, 0, 2 * Math.PI);
      ctx.fillStyle = isCenter
        ? isDark
          ? "#F0EFE9"
          : "#1A1917"
        : color;
      ctx.strokeStyle = isCenter
        ? isDark
          ? "#0A0A0B"
          : "#FAFAF8"
        : color + "CC";
      ctx.lineWidth = isCenter ? 2 : 1;
      ctx.fill();
      ctx.stroke();

      if (isCenter) {
        ctx.font = `bold ${Math.max(8, (10 / globalScale) * 2)}px ui-sans-serif, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = isDark ? "#0A0A0B" : "#FAFAF8";
        ctx.fillText("YOU", x, y);
        return;
      }

      const shouldShowLabel = isHovered || isSelected || globalScale > 1.5;
      if (shouldShowLabel) {
        const fontSize = Math.max(9, Math.min(13, (11 / globalScale) * 2));
        ctx.font = `500 ${fontSize}px ui-sans-serif, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        const labelWidth = ctx.measureText(node.label).width;
        const padding = 4;
        const pillX = x - labelWidth / 2 - padding;
        const pillY = y + r + 4;
        const pillW = labelWidth + padding * 2;
        const pillH = fontSize + 6;
        ctx.fillStyle = isDark ? "rgba(10,10,11,0.85)" : "rgba(255,255,255,0.92)";
        fillRoundRect(ctx, pillX, pillY, pillW, pillH, 4);
        ctx.fillStyle = isDark ? "#F0EFE9" : "#1A1917";
        ctx.fillText(node.label, x, pillY + 3);
        const badgeFontSize = Math.max(7, fontSize - 3);
        ctx.font = `${badgeFontSize}px ui-sans-serif, sans-serif`;
        ctx.fillStyle = color;
        ctx.fillText(node.vault.toUpperCase(), x, pillY + pillH + 3);
      } else {
        const fontSize = Math.max(7, Math.min(10, (9 / globalScale) * 2));
        ctx.font = `${fontSize}px ui-sans-serif, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = isDark ? "rgba(240,239,233,0.5)" : "rgba(26,25,23,0.5)";
        ctx.fillText(node.label, x, y + r + 3);
      }
    },
    [hoveredNode, selectedNode, isDark]
  );

  const paintLink = useCallback(
    (link: { source: SimNode | string; target: SimNode | string }, ctx: CanvasRenderingContext2D) => {
      const src = link.source as SimNode;
      const tgt = link.target as SimNode;
      if (typeof src !== "object" || typeof tgt !== "object") return;
      const sx = src.x ?? 0;
      const sy = src.y ?? 0;
      const tx = tgt.x ?? 0;
      const ty = tgt.y ?? 0;
      const isHighlighted =
        hoveredNode === src.id ||
        hoveredNode === tgt.id ||
        selectedNode === src.id ||
        selectedNode === tgt.id;
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(tx, ty);
      ctx.strokeStyle = isHighlighted
        ? isDark
          ? "rgba(93,202,165,0.5)"
          : "rgba(15,122,92,0.4)"
        : isDark
          ? "rgba(255,255,255,0.08)"
          : "rgba(0,0,0,0.08)";
      ctx.lineWidth = isHighlighted ? 1.5 : 0.8;
      ctx.stroke();
    },
    [hoveredNode, selectedNode, isDark]
  );

  const nodePointerAreaPaint = useCallback(
    (node: HeroNode & { x?: number; y?: number }, color: string, ctx: CanvasRenderingContext2D) => {
      const isCenter = node.id === "me";
      const base = isCenter ? 14 : (node.size || 5) * 1.8;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(node.x ?? 0, node.y ?? 0, base + 10, 0, 2 * Math.PI);
      ctx.fill();
    },
    []
  );

  const selected = selectedNode
    ? NODES.find((n) => n.id === selectedNode)
    : null;

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {selected && selected.id !== "me" && (
        <div
          style={{
            position: "absolute",
            top: 16,
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            background: isDark ? "rgba(17,17,19,0.96)" : "rgba(255,255,255,0.96)",
            border: `1px solid ${(VAULT_COLORS[selected.vault] || "#888")}55`,
            borderRadius: 10,
            padding: "10px 16px",
            display: "flex",
            gap: 10,
            alignItems: "center",
            backdropFilter: "blur(8px)",
            boxShadow: `0 4px 24px ${(VAULT_COLORS[selected.vault] || "#888")}22`,
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: VAULT_COLORS[selected.vault] || "#888",
              flexShrink: 0,
            }}
          />
          <div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 500,
                color: isDark ? "#F0EFE9" : "#1A1917",
              }}
            >
              {selected.label}
            </div>
            <div style={{ fontSize: 11, color: VAULT_COLORS[selected.vault], marginTop: 2 }}>
              {selected.vault} vault
            </div>
          </div>
        </div>
      )}

      <div
        style={{
          position: "absolute",
          bottom: 14,
          left: 0,
          right: 0,
          textAlign: "center",
          zIndex: 5,
          fontSize: 11,
          color: isDark ? "rgba(240,239,233,0.3)" : "rgba(26,25,23,0.3)",
          pointerEvents: "none",
          fontFamily: "ui-monospace, monospace",
          letterSpacing: "0.03em",
        }}
      >
        hover to explore · click to inspect · scroll to zoom
      </div>

      {mounted && (
        <div
          className={entranceOn ? "hero-graph-canvas-enter hero-graph-canvas-enter-active" : "hero-graph-canvas-enter"}
          style={{ width: "100%", height: "100%" }}
        >
          <ForceGraph2D
            ref={graphRef as React.MutableRefObject<ForceGraphMethods | undefined>}
            graphData={graphData}
            width={dimensions.width}
            height={dimensions.height}
            backgroundColor="transparent"
            d3AlphaDecay={0.015}
            d3VelocityDecay={0.35}
            cooldownTicks={120}
            onEngineStop={handleEngineStop}
            enableNodeDrag
            enableZoomInteraction
            enablePanInteraction
            minZoom={0.4}
            maxZoom={4}
            nodeCanvasObject={paintNode as (n: object, ctx: CanvasRenderingContext2D, s: number) => void}
            nodeCanvasObjectMode={() => "replace"}
            nodePointerAreaPaint={nodePointerAreaPaint as (n: object, c: string, ctx: CanvasRenderingContext2D, s: number) => void}
            linkCanvasObject={paintLink as (l: object, ctx: CanvasRenderingContext2D, s: number) => void}
            linkCanvasObjectMode={() => "replace"}
            nodeRelSize={5}
            onNodeHover={(node) => {
              setHoveredNode(node ? (node as HeroNode).id : null);
              if (containerRef.current) {
                containerRef.current.style.cursor = node ? "pointer" : "default";
              }
            }}
            onNodeClick={(node) => {
              const id = (node as HeroNode).id;
              setSelectedNode((prev) => (prev === id ? null : id));
            }}
            onBackgroundClick={() => setSelectedNode(null)}
            linkWidth={0}
            linkColor={() => "transparent"}
          />
        </div>
      )}
    </div>
  );
}
