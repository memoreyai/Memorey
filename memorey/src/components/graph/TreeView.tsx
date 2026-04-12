"use client";

import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import type { HierarchyNode } from "d3-hierarchy";
import type { MemoryNode, NodeEdge, CategoryVault } from "@/types/memorey";
import type { Canvas } from "@/store/canvasStore";
import {
  applyInitialCollapse,
  buildMasterTreeData,
  buildTreeData,
  collapseToVaultsOnly,
  expandAllTree,
  getCrossLinkColor,
  isCrossVault,
  isTreeParentChild,
  type TreeNodeData,
} from "./buildTreeData";

export type Edge = NodeEdge;
export type Vault = CategoryVault;

export interface TreeViewProps {
  nodes: MemoryNode[];
  edges: Edge[];
  vaults: Vault[];
  canvasName: string;
  canvasEmoji: string;
  masterNodeBio?: string;
  isMasterView: boolean;
  canvases?: Canvas[];
  onNodeClick?: (node: MemoryNode) => void;
}

const TRANSITION_MS = 250;
const V_SPACING = 28;
const MIN_H_GAP = 180;

function crossLinkPath(
  source: { x: number; y: number },
  target: { x: number; y: number },
  strong: boolean
): string {
  const midY = (source.x + target.x) / 2;
  const midX = (source.y + target.y) / 2;
  const dx = target.y - source.y;
  const dy = target.x - source.x;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;
  const offset = Math.min(dist * (strong ? 0.45 : 0.3), strong ? 120 : 80);
  const cpX = midX - (dy / dist) * offset;
  const cpY = midY + (dx / dist) * offset;
  return `M${source.y},${source.x} Q${cpX},${cpY} ${target.y},${target.x}`;
}

function readCssVar(el: Element | null, name: string, fallback: string): string {
  if (typeof window === "undefined" || !el) return fallback;
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n - 1)}…`;
}

function estimateLabelWidth(label: string, kind: TreeNodeData["kind"]): number {
  const base =
    kind === "master" || kind === "canvas" ? 13 : kind === "vault" ? 12 : 11;
  return Math.min(300, 28 + label.length * (base * 0.52));
}

function maxLabelAtDepth(
  root: HierarchyNode<TreeNodeData>,
  depth = 0
): Map<number, number> {
  const m = new Map<number, number>();
  const w = estimateLabelWidth(root.data.label, root.data.kind);
  m.set(depth, Math.max(m.get(depth) ?? 0, w));
  for (const c of root.children ?? []) {
    const sub = maxLabelAtDepth(c, depth + 1);
    for (const [d, v] of sub) {
      m.set(d, Math.max(m.get(d) ?? 0, v));
    }
  }
  return m;
}

function horizontalGap(root: HierarchyNode<TreeNodeData>): number {
  let max = MIN_H_GAP;
  const perDepth = maxLabelAtDepth(root);
  for (const w of perDepth.values()) {
    max = Math.max(max, w + 48);
  }
  return max;
}

export function TreeView({
  nodes,
  edges,
  vaults,
  canvasName,
  canvasEmoji,
  masterNodeBio,
  isMasterView,
  canvases = [],
  onNodeClick,
}: TreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const zoomStateRef = useRef(d3.zoomIdentity);
  const rootDataRef = useRef<TreeNodeData | null>(null);
  const [layoutTick, setLayoutTick] = useState(0);
  const [showCrossLinks, setShowCrossLinks] = useState(true);
  const hoverNodeIdRef = useRef<string | null>(null);
  const hoverEdgeKeyRef = useRef<string | null>(null);

  const bump = () => setLayoutTick((t) => t + 1);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver(() => bump());
    obs.observe(el);
    const mo = new MutationObserver(() => bump());
    mo.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    return () => {
      obs.disconnect();
      mo.disconnect();
    };
  }, []);

  function rebuildData(): TreeNodeData {
    if (isMasterView && canvases.length > 0) {
      return buildMasterTreeData(nodes, edges, vaults, canvases);
    }
    return buildTreeData(nodes, edges, vaults, {
      canvasName,
      canvasEmoji,
      masterNodeBio,
      masterNodeColor: readCssVar(
        containerRef.current,
        "--orange",
        "#FF6600"
      ),
    });
  }

  useEffect(() => {
    const data = rebuildData();
    applyInitialCollapse(data);
    rootDataRef.current = data;
    bump();
  }, [
    nodes,
    edges,
    vaults,
    canvasName,
    canvasEmoji,
    masterNodeBio,
    isMasterView,
    canvases,
  ]);

  useEffect(() => {
    const container = containerRef.current;
    const svgEl = svgRef.current;
    if (!container || !svgEl || !rootDataRef.current) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 600;

    const cardBg = readCssVar(container, "--card-bg", "#1a1a18");
    const border = readCssVar(container, "--border", "#333");
    const text = readCssVar(container, "--text", "#f2f0eb");
    const textMuted = readCssVar(container, "--muted", "#8a8985");

    const hRoot = d3.hierarchy<TreeNodeData>(
      rootDataRef.current,
      (d) => d.children ?? undefined
    );
    const hGap = horizontalGap(hRoot);
    const treeLayout = d3
      .tree<TreeNodeData>()
      .nodeSize([V_SPACING, hGap])
      .separation((a, b) => (a.parent === b.parent ? 1 : 1.2));

    treeLayout(hRoot as d3.HierarchyNode<TreeNodeData>);

    const svg = d3.select(svgEl);
    svg.selectAll("*").remove();

    svg.attr("width", width).attr("height", height).attr("role", "img");

    const gZoom = svg.append("g").attr("class", "zoom-layer");
    const gMain = gZoom.append("g").attr("class", "tree-main");

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event) => {
        zoomStateRef.current = event.transform;
        gZoom.attr("transform", event.transform.toString());
      });
    zoomRef.current = zoom;
    svg.call(zoom);

    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    hRoot.eachBefore((d) => {
      const p = d as d3.HierarchyPointNode<TreeNodeData>;
      if (p.x > x1) x1 = p.x;
      if (p.x < x0) x0 = p.x;
      if (p.y > y1) y1 = p.y;
      if (p.y < y0) y0 = p.y;
    });

    const margin = { top: 36, left: 72 };
    const gx = margin.left - y0;
    const gy = margin.top - x0;

    gMain.attr("transform", `translate(${gx},${gy})`);

    const treeW = y1 - y0 + hGap + 100;
    const treeH = x1 - x0 + V_SPACING + 64;
    const initialScale = Math.min(
      (width - 100) / Math.max(treeW, 240),
      (height - 120) / Math.max(treeH, 200),
      1.05
    );
    const cx = width / 2 - ((y0 + y1) / 2 + gx) * initialScale;
    const cy = 48 - ((x0 + x1) / 2 + gy) * initialScale;
    const startTransform = d3.zoomIdentity.translate(cx, cy).scale(initialScale);
    zoomStateRef.current = startTransform;
    svg.call(zoom.transform, startTransform);

    const gLink = gMain.append("g").attr("class", "tree-links");
    const gCross = gMain.append("g").attr("class", "cross-links");
    const gNode = gMain.append("g").attr("class", "tree-nodes");

    const linkGen = d3
      .linkHorizontal<
        d3.HierarchyPointLink<TreeNodeData>,
        d3.HierarchyPointNode<TreeNodeData>
      >()
      .x((d) => d.y)
      .y((d) => d.x);

    function updateCrossLinkStyles() {
      const hn = hoverNodeIdRef.current;
      const he = hoverEdgeKeyRef.current;
      gCross.selectAll<SVGPathElement, NodeEdge>("path.cross-link").each(function (
        d
      ) {
        const k = `${d.sourceNodeId}-${d.targetNodeId}`;
        let op = 0.3;
        let sw = 1.5;
        if (he === k) {
          op = 0.85;
          sw = 2.5;
        } else if (
          hn &&
          (d.sourceNodeId === hn || d.targetNodeId === hn)
        ) {
          op = 0.85;
          sw = 2.2;
        }
        d3.select(this).attr("opacity", op).attr("stroke-width", sw);
      });

      gNode.selectAll<SVGGElement, d3.HierarchyPointNode<TreeNodeData>>("g.node").each(
        function (d) {
          const id = d.data.id;
          if (!id || d.data.kind !== "memory") return;
          let hi = false;
          if (hn === id) hi = true;
          if (hn) {
            for (const e of edges) {
              if (
                (e.sourceNodeId === hn && e.targetNodeId === id) ||
                (e.targetNodeId === hn && e.sourceNodeId === id)
              ) {
                hi = true;
                break;
              }
            }
          }
          d3.select(this)
            .select("rect")
            .attr(
              "stroke",
              hi ? readCssVar(container, "--orange", "#FF6600") : border
            )
            .attr("stroke-width", hi ? 2 : 1);
        }
      );
    }

    const t = d3.transition().duration(TRANSITION_MS);

    const nodesDesc = hRoot.descendants();
    const linksData = hRoot.links();

    const pos = new Map<string, { x: number; y: number }>();
    hRoot.eachBefore((d) => {
      const p = d as d3.HierarchyPointNode<TreeNodeData>;
      if (p.data.id) pos.set(p.data.id, { x: p.x, y: p.y });
    });

    const treeLink = gLink
      .selectAll<SVGPathElement, d3.HierarchyPointLink<TreeNodeData>>(
        "path.tree-link"
      )
      .data(linksData, (d) => `${d.source.data.id}-${d.target.data.id}`);

    const treeLinkEnter = treeLink
      .enter()
      .append("path")
      .attr("class", "tree-link")
      .attr("fill", "none")
      .attr("stroke", textMuted)
      .attr("stroke-opacity", 0.9)
      .attr("stroke-width", 1.25)
      .attr("d", (d) => linkGen(d as d3.HierarchyPointLink<TreeNodeData>))
      .attr("opacity", 0);

    treeLinkEnter.transition(t).attr("opacity", 1);

    treeLinkEnter
      .merge(treeLink)
      .transition(t)
      .attr("d", (d) => linkGen(d as d3.HierarchyPointLink<TreeNodeData>));

    treeLink.exit().transition(t).attr("opacity", 0).remove();

    const nodeSel = gNode
      .selectAll<SVGGElement, d3.HierarchyPointNode<TreeNodeData>>("g.node")
      .data(nodesDesc, (d) => d.data.id);

    const nodeEnter = nodeSel
      .enter()
      .append("g")
      .attr("class", "node")
      .attr("opacity", 0);

    nodeEnter.transition(t).attr("opacity", 1);

    const merged = nodeEnter.merge(nodeSel);

    merged.transition(t).attr("transform", (d) => {
      const p = d as d3.HierarchyPointNode<TreeNodeData>;
      return `translate(${p.y},${p.x})`;
    });

    nodeSel.exit().transition(t).attr("opacity", 0).remove();

    merged.each(function (d) {
      const g = d3.select(this);
      const kind = d.data.kind;
      const label = d.data.label;
      const tw = estimateLabelWidth(label, kind);
      const th =
        kind === "master" || kind === "canvas"
          ? 42
          : kind === "vault"
            ? 34
            : 30;

      let fill = cardBg;
      let stroke = border;
      let strokeW = 1;
      let strokeDash: string | null = null;
      let txt = text;

      if (kind === "master" || kind === "canvas") {
        const col =
          d.data.masterColor ?? readCssVar(container, "--orange", "#FF6600");
        fill = col;
        stroke = col;
        txt = "#fff";
      } else if (kind === "vault" && d.data.vault) {
        const vc = d.data.vault.color;
        fill = `${vc}33`;
        stroke = vc;
        txt = text;
      } else if (kind === "memory") {
        fill = cardBg;
        stroke = border;
        if (d.data.edgeLinked) {
          strokeDash = "4,3";
          stroke =
            vaults.find((v) => v.id === d.data.memoryNode?.vaultId)?.color ??
            border;
          strokeW = 1.5;
        }
      }

      g.selectAll("rect").remove();
      g.selectAll("text").remove();
      g.selectAll("title").remove();

      g.append("rect")
        .attr("x", 0)
        .attr("y", -th / 2)
        .attr("width", tw)
        .attr("height", th)
        .attr("rx", 6)
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", strokeW)
        .attr("stroke-dasharray", strokeDash ?? "none")
        .attr("filter", "drop-shadow(0 1px 3px rgba(0,0,0,0.3))");

      const display = kind === "memory" ? truncate(label, 40) : label;
      const prefix =
        kind === "master" || kind === "canvas" ? `${d.data.emoji ?? ""} ` : "";
      g.append("text")
        .attr("x", 12)
        .attr("y", 4)
        .attr("fill", txt)
        .attr("font-size", kind === "master" || kind === "canvas" ? 13 : 11)
        .attr("font-weight",
          kind === "master" || kind === "vault" || kind === "canvas"
            ? 600
            : 400
        )
        .text(kind === "vault" ? display : `${prefix}${display}`.trim());

      if (kind === "memory" && d.data.memoryNode) {
        const mn = d.data.memoryNode;
        g.append("title").text(
          `${mn.title}\n\n${truncate(mn.value ?? "", 220)}`
        );
      } else {
        g.append("title").text(label);
      }

      const hasKids =
        (d.data.children && d.data.children.length > 0) ||
        (d.data._children && d.data._children.length > 0);

      g.selectAll("text.toggle").remove();
      if (hasKids) {
        g.append("text")
          .attr("class", "toggle")
          .attr("x", tw + 8)
          .attr("y", 4)
          .attr("fill", textMuted)
          .attr("font-size", 13)
          .text(d.data.children ? "−" : "+");
      }
    });

    merged
      .style("cursor", (d) =>
        (d.data.children && d.data.children.length > 0) ||
          (d.data._children && d.data._children.length > 0)
          ? "pointer"
          : d.data.kind === "memory"
            ? "pointer"
            : "default"
      )
      .on("click", (event, d) => {
        event.stopPropagation();
        const hasKids =
          (d.data.children && d.data.children.length > 0) ||
          (d.data._children && d.data._children.length > 0);
        if (hasKids) {
          if (d.data.children) {
            d.data._children = d.data.children;
            d.data.children = undefined;
          } else if (d.data._children) {
            d.data.children = d.data._children;
            d.data._children = undefined;
          }
          bump();
        } else if (d.data.memoryNode && onNodeClick) {
          onNodeClick(d.data.memoryNode);
        }
      })
      .on("mouseenter", (_e, d) => {
        if (d.data.kind === "memory" && d.data.id) {
          hoverNodeIdRef.current = d.data.id;
          updateCrossLinkStyles();
        }
      })
      .on("mouseleave", () => {
        hoverNodeIdRef.current = null;
        updateCrossLinkStyles();
      });

    const visibleIds = new Set<string>();
    hRoot.eachBefore((d) => {
      if (d.data.id) visibleIds.add(d.data.id);
    });

    const crossData = showCrossLinks
      ? edges.filter(
          (e) =>
            visibleIds.has(e.sourceNodeId) &&
            visibleIds.has(e.targetNodeId) &&
            !isTreeParentChild(
              e.sourceNodeId,
              e.targetNodeId,
              hRoot as HierarchyNode<TreeNodeData>
            )
        )
      : [];

    const crossSel = gCross
      .selectAll<SVGPathElement, NodeEdge>("path.cross-link")
      .data(crossData, (d) => `${d.sourceNodeId}-${d.targetNodeId}`);

    const crossEnter = crossSel
      .enter()
      .append("path")
      .attr("class", "cross-link")
      .attr("fill", "none")
      .attr("pointer-events", "stroke")
      .attr("stroke", (d) => getCrossLinkColor(d, vaults, nodes))
      .attr("stroke-dasharray", (d) =>
        isCrossVault(d, nodes) ? "6,4" : "none"
      )
      .attr("stroke-width", 1.5)
      .attr("opacity", 0)
      .attr("d", (d) => {
        const s = pos.get(d.sourceNodeId);
        const t = pos.get(d.targetNodeId);
        if (!s || !t) return "";
        return crossLinkPath(s, t, isCrossVault(d, nodes));
      })
      .on("mouseenter", (_e, d) => {
        hoverEdgeKeyRef.current = `${d.sourceNodeId}-${d.targetNodeId}`;
        updateCrossLinkStyles();
      })
      .on("mouseleave", () => {
        hoverEdgeKeyRef.current = null;
        updateCrossLinkStyles();
      });

    crossEnter.transition(t).attr("opacity", 0.3);

    crossEnter
      .merge(crossSel)
      .transition(t)
      .attr("d", (d) => {
        const s = pos.get(d.sourceNodeId);
        const t = pos.get(d.targetNodeId);
        if (!s || !t) return "";
        return crossLinkPath(s, t, isCrossVault(d, nodes));
      });

    crossSel.exit().transition(t).attr("opacity", 0).remove();

    updateCrossLinkStyles();
  }, [
    layoutTick,
    showCrossLinks,
    nodes,
    edges,
    vaults,
    onNodeClick,
  ]);

  const handleExpandAll = () => {
    const d = rootDataRef.current;
    if (!d) return;
    expandAllTree(d);
    bump();
  };

  const handleCollapseAll = () => {
    const d = rootDataRef.current;
    if (!d) return;
    collapseToVaultsOnly(d);
    bump();
  };

  const handleFit = () => {
    const svg = svgRef.current;
    const zb = zoomRef.current;
    if (!svg || !zb) return;
    zoomStateRef.current = d3.zoomIdentity;
    d3.select(svg).transition().duration(TRANSITION_MS).call(zb.transform, d3.zoomIdentity);
  };

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        minHeight: 420,
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 8,
          left: 8,
          zIndex: 2,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <button
          type="button"
          className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1 text-[11px] text-[var(--text)]"
          onClick={handleExpandAll}
        >
          Expand all
        </button>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1 text-[11px] text-[var(--text)]"
          onClick={handleCollapseAll}
        >
          Collapse all
        </button>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1 text-[11px] text-[var(--text)]"
          onClick={handleFit}
        >
          Fit to screen
        </button>
        <button
          type="button"
          className="rounded-md border border-[var(--border)] bg-[var(--card-bg)] px-2 py-1 text-[11px] text-[var(--text)]"
          onClick={() => {
            setShowCrossLinks((v) => !v);
            bump();
          }}
        >
          {showCrossLinks ? "Hide cross-links" : "Show cross-links"}
        </button>
      </div>

      <svg
        ref={svgRef}
        style={{ display: "block", width: "100%", height: "100%" }}
      />

      <div
        style={{
          position: "absolute",
          right: 12,
          bottom: 12,
          zIndex: 2,
          padding: "10px 12px",
          borderRadius: 8,
          background: "color-mix(in srgb, var(--card-bg) 88%, transparent)",
          border: "1px solid var(--border)",
          fontSize: 10,
          color: "var(--muted)",
          lineHeight: 1.5,
          pointerEvents: "none",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg width={28} height={10}>
            <path
              d="M0,5 L28,5"
              stroke="var(--muted)"
              strokeWidth={1.5}
              opacity={0.75}
            />
          </svg>
          Tree hierarchy
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <svg width={28} height={10}>
            <path
              d="M0,5 L28,5"
              stroke="var(--orange)"
              strokeWidth={1.5}
              opacity={0.5}
            />
          </svg>
          Same vault connection
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          <svg width={28} height={10}>
            <path
              d="M0,5 L28,5"
              stroke="var(--muted)"
              strokeWidth={1.5}
              strokeDasharray="6 4"
              opacity={0.45}
            />
          </svg>
          Cross vault connection
        </div>
      </div>
    </div>
  );
}
