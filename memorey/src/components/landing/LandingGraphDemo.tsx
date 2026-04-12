"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";

const BG = "#0A0A0B";
const ACCENT = "rgba(93, 202, 165, 0.9)";
const MUTED = "rgba(136, 135, 128, 0.6)";
const GOALS_COLOR = "rgba(224, 92, 92, 0.78)";

/** Exactly 20 nodes: Work 8, Goals 6, Personal 6 */
const WORK = [
  "Sprint scope",
  "API design",
  "Q3 roadmap",
  "Standup",
  "RFC-042",
  "Infra",
  "Hiring",
  "Release",
];
const GOALS = ["Marathon", "24 books", "Side project", "Rust", "Routine", "Savings"];
const PERSONAL = ["Mom’s day", "Dentist", "Lease", "Coffee Sam", "Therapist", "Tax"];

function buildGraph() {
  const nodes: { id: string; name: string; group: string }[] = [];
  const links: { source: string; target: string }[] = [];

  WORK.forEach((name, i) => nodes.push({ id: `w${i}`, name, group: "Work" }));
  GOALS.forEach((name, i) => nodes.push({ id: `g${i}`, name, group: "Goals" }));
  PERSONAL.forEach((name, i) => nodes.push({ id: `p${i}`, name, group: "Personal" }));

  const workIds = WORK.map((_, i) => `w${i}`);
  const goalIds = GOALS.map((_, i) => `g${i}`);
  const personalIds = PERSONAL.map((_, i) => `p${i}`);

  const chain = (ids: string[]) => {
    for (let k = 0; k < ids.length - 1; k++) {
      links.push({ source: ids[k], target: ids[k + 1] });
    }
  };
  chain(workIds);
  chain(goalIds);
  chain(personalIds);

  links.push({ source: workIds[1], target: goalIds[1] });
  links.push({ source: goalIds[3], target: personalIds[2] });
  links.push({ source: workIds[4], target: personalIds[0] });
  links.push({ source: goalIds[0], target: workIds[6] });

  return { nodes, links };
}

export function LandingGraphDemo() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods>(undefined);
  const [dims, setDims] = useState({ w: 800, h: 440 });
  const data = useMemo(() => buildGraph(), []);
  const fitted = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const LEGEND = 44;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDims({
        w: Math.max(320, Math.floor(r.width)),
        h: Math.max(240, Math.floor(r.height) - LEGEND),
      });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setDims({
      w: Math.max(320, Math.floor(r.width)),
      h: Math.max(240, Math.floor(r.height) - LEGEND),
    });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => {
      fgRef.current?.d3ReheatSimulation?.();
    }, 7000);
    return () => clearInterval(id);
  }, []);

  const nodeColor = useCallback((n: { group: string }) => {
    if (n.group === "Work") return ACCENT;
    if (n.group === "Goals") return GOALS_COLOR;
    return MUTED;
  }, []);

  const paintNode = useCallback(
    (node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const n = node as { x?: number; y?: number; name?: string; group?: string };
      const r = 5 / globalScale;
      if (n.x === undefined || n.y === undefined) return;
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor(n as { group: string });
      ctx.fill();
      if (globalScale > 0.5) {
        ctx.font = `${10 / globalScale}px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif`;
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(245, 244, 240, 0.7)";
        ctx.fillText(n.name ?? "", n.x + r + 3 / globalScale, n.y);
      }
    },
    [nodeColor]
  );

  return (
    <div
      ref={wrapRef}
      className="relative h-[min(52vh,520px)] w-full min-h-[300px] overflow-hidden rounded-lg border border-[#1E1E22] bg-[#0A0A0B]"
      style={{ transform: "translateZ(0)" }}
    >
      <ForceGraph2D
        ref={fgRef}
        graphData={data}
        width={dims.w}
        height={dims.h}
        backgroundColor={BG}
        nodeLabel="name"
        nodeCanvasObject={paintNode}
        nodePointerAreaPaint={(node, color, ctx, globalScale) => {
          const n = node as { x?: number; y?: number };
          if (n.x === undefined || n.y === undefined) return;
          const r = 8 / globalScale;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={() => "rgba(93, 202, 165, 0.2)"}
        linkWidth={0.55}
        cooldownTicks={100}
        d3AlphaDecay={0.012}
        d3VelocityDecay={0.38}
        enableZoomInteraction={false}
        enablePanInteraction={false}
        enableNodeDrag={false}
        onEngineStop={() => {
          if (!fitted.current && fgRef.current) {
            fitted.current = true;
            window.requestAnimationFrame(() => {
              fgRef.current?.zoomToFit?.(400, 56);
            });
          }
        }}
      />
      <div className="flex justify-center gap-8 border-t border-[#1E1E22] bg-[#0A0A0B] px-4 py-2.5">
        {(["Work", "Goals", "Personal"] as const).map((g) => (
          <span
            key={g}
            className="text-[11px] font-medium tracking-[0.2em] uppercase"
            style={{
              color: g === "Work" ? ACCENT : g === "Goals" ? GOALS_COLOR : MUTED,
            }}
          >
            {g}
          </span>
        ))}
      </div>
    </div>
  );
}
