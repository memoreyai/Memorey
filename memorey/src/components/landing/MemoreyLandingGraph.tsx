"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";

const BG = "#0A0A0B";
const TEAL = "rgba(93, 202, 165, 0.92)";
const AMBER = "rgba(212, 165, 116, 0.88)";
const MUTED = "rgba(107, 105, 102, 0.75)";
const STUDY = "rgba(120, 180, 160, 0.85)";
const INK = "#F0EFE9";

type GNode = {
  id: string;
  name: string;
  group: "Person" | "Work" | "Goals" | "Personal" | "Study";
};

function buildData() {
  const work: string[] = [
    "Building Memorey (AI memory startup)",
    "Prefers Next.js 14 + TypeScript",
    "Co-founder looking for early adopters",
    "Supabase + Vercel stack",
    "Early user feedback loops",
    "Portable graph memory vision",
  ];
  const goals: string[] = [
    "Launch publicly by Q2 2026",
    "Reach $3K MRR before Acquire.com",
    "Build in public on Twitter",
    "First 500 on waitlist",
    "Ship weekly",
    "Founder-led growth",
  ];
  const personal: string[] = [
    "Based in Bengaluru, India",
    "Works best late evenings",
    "Coffee before code",
    "Minimal meetings",
    "IST timezone",
    "Indie builder mindset",
  ];
  const study: string[] = [
    "Reading 'Zero to One'",
    "Learning MCP protocol",
    "Exploring graph databases",
    "Force-directed layouts",
    "Privacy-first architecture",
    "Diff-based approvals",
  ];

  const nodes: GNode[] = [
    { id: "v", name: "V", group: "Person" },
    ...work.map((name, i) => ({ id: `w${i}`, name, group: "Work" as const })),
    ...goals.map((name, i) => ({ id: `g${i}`, name, group: "Goals" as const })),
    ...personal.map((name, i) => ({ id: `p${i}`, name, group: "Personal" as const })),
    ...study.map((name, i) => ({ id: `s${i}`, name, group: "Study" as const })),
  ];

  const links: { source: string; target: string }[] = [];
  const w = work.map((_, i) => `w${i}`);
  const g = goals.map((_, i) => `g${i}`);
  const p = personal.map((_, i) => `p${i}`);
  const s = study.map((_, i) => `s${i}`);

  const chain = (ids: string[]) => {
    for (let k = 0; k < ids.length - 1; k++) {
      links.push({ source: ids[k], target: ids[k + 1] });
    }
  };
  chain(w);
  chain(g);
  chain(p);
  chain(s);

  links.push({ source: "v", target: w[0] });
  links.push({ source: "v", target: g[0] });
  links.push({ source: "v", target: p[0] });
  links.push({ source: "v", target: s[0] });
  links.push({ source: w[2], target: g[1] });
  links.push({ source: g[2], target: s[1] });
  links.push({ source: p[1], target: w[1] });
  links.push({ source: s[2], target: w[0] });

  return { nodes, links };
}

function nodeColor(g: GNode["group"]) {
  if (g === "Person") return INK;
  if (g === "Work") return TEAL;
  if (g === "Goals") return AMBER;
  if (g === "Study") return STUDY;
  return MUTED;
}

export default function MemoreyLandingGraph() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fgRef = useRef<ForceGraphMethods>(undefined);
  const [dims, setDims] = useState({ w: 900, h: 420 });
  const data = useMemo(() => buildData(), []);
  const fitted = useRef(false);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setDims({
        w: Math.max(300, Math.floor(r.width)),
        h: Math.max(280, Math.min(480, Math.floor(r.height))),
      });
    });
    ro.observe(el);
    const r = el.getBoundingClientRect();
    setDims({
      w: Math.max(300, Math.floor(r.width)),
      h: Math.max(280, Math.min(480, Math.floor(r.height))),
    });
    return () => ro.disconnect();
  }, []);

  const paintNode = useCallback((node: object, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GNode & { x?: number; y?: number };
    if (n.x === undefined || n.y === undefined) return;
    const isPerson = n.group === "Person";
    const r = isPerson ? 14 / globalScale : 4.2 / globalScale;

    if (isPerson) {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = TEAL;
      ctx.fill();
      ctx.strokeStyle = "rgba(93, 202, 165, 0.4)";
      ctx.lineWidth = 2 / globalScale;
      ctx.stroke();
      ctx.font = `bold ${12 / globalScale}px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#0A0A0B";
      ctx.fillText("V", n.x, n.y);
    } else {
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
      ctx.fillStyle = nodeColor(n.group);
      ctx.fill();
    }

    if (globalScale > 0.35 && !isPerson) {
      ctx.font = `${9 / globalScale}px var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif`;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(240, 239, 233, 0.72)";
      let label = n.name;
      if (label.length > 42) label = `${label.slice(0, 40)}…`;
      ctx.fillText(label, n.x + r + 4 / globalScale, n.y);
    }
  }, []);

  return (
    <div
      ref={wrapRef}
      className="relative w-full overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0A0A0B]"
      style={{ height: "min(52vh, 520px)", minHeight: 300 }}
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
          const n = node as GNode & { x?: number; y?: number };
          if (n.x === undefined || n.y === undefined) return;
          const isPerson = n.group === "Person";
          const r = (isPerson ? 18 : 10) / globalScale;
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fill();
        }}
        linkColor={() => "rgba(93, 202, 165, 0.22)"}
        linkWidth={0.6}
        cooldownTicks={120}
        d3AlphaDecay={0.02}
        d3VelocityDecay={0.35}
        enableZoomInteraction
        enablePanInteraction
        enableNodeDrag
        onEngineStop={() => {
          if (!fitted.current && fgRef.current) {
            fitted.current = true;
            requestAnimationFrame(() => {
              fgRef.current?.zoomToFit?.(400, 80);
            });
          }
        }}
      />
      <div className="flex flex-wrap justify-center gap-x-6 gap-y-1 border-t border-[rgba(255,255,255,0.08)] px-4 py-2.5">
        {(
          [
            ["Work", TEAL],
            ["Goals", AMBER],
            ["Personal", MUTED],
            ["Study", STUDY],
          ] as const
        ).map(([g, c]) => (
          <span
            key={g}
            className="text-[10px] font-medium tracking-[0.15em] uppercase"
            style={{ color: c }}
          >
            {g}
          </span>
        ))}
        <span className="text-[10px] tracking-[0.15em] uppercase text-[#F0EFE9]/50">
          · You at center
        </span>
      </div>
    </div>
  );
}
