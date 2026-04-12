"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type ReactNode,
} from "react";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUp,
  Check,
  CheckCircle,
  Copy,
  Download,
  GitBranch,
  Layers,
  Link,
  Link2,
  Loader2,
  Lock,
  Moon,
  MousePointer,
  Move,
  Plus,
  RotateCcw,
  Shield,
  Sun,
  Trash2,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";
import DOMPurify from "isomorphic-dompurify";
import { drawGrid } from "@/components/graph/canvas/grid";
import {
  CANVAS_MAIN_BG_DARK,
  CANVAS_MAIN_BG_LIGHT,
} from "@/components/graph/constants/colors";
import { LandingNodePeek } from "@/components/landing/LandingNodePeek";
import {
  drawLandingMemoryCard,
  drawLandingYouCard,
  landingNodeHalfExtent,
  strokeLandingNodeScreenOutline,
} from "./landingGraphCanvasDraw";
import {
  VAULTS,
  mkn,
  SEED_NODES,
  SEED_EDGES,
  MARQUEE_ITEMS,
  PLANS,
  type GraphNode,
} from "./landingPageData";

const LANDING_VAULT_FALLBACK: Record<string, { cx: number; cy: number }> = {
  personal: { cx: -320, cy: -100 },
  work: { cx: 0, cy: -360 },
  health: { cx: 480, cy: -120 },
  lifestyle: { cx: 320, cy: 260 },
  study: { cx: -80, cy: 400 },
  finance: { cx: -460, cy: 130 },
};

const LANDING_SEED_GRAPH_CENTROID = (() => {
  let sx = 0;
  let sy = 0;
  for (const n of SEED_NODES) {
    sx += n.x;
    sy += n.y;
  }
  const k = SEED_NODES.length || 1;
  return { x: sx / k, y: sy / k };
})();

function landingRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function landingVaultWorldBounds(
  nodes: GraphNode[],
  vault: string,
): { minX: number; maxX: number; minY: number; maxY: number } | null {
  const ns = nodes.filter((n) => n.vault === vault);
  if (ns.length === 0) return null;
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const n of ns) {
    const { hw, hh } = landingNodeHalfExtent(n);
    const pad = 24;
    minX = Math.min(minX, n.x - hw - pad);
    maxX = Math.max(maxX, n.x + hw + pad);
    minY = Math.min(minY, n.y - hh - pad);
    maxY = Math.max(maxY, n.y + hh + pad);
  }
  return { minX, maxX, minY, maxY };
}

type LandingChatMsg =
  | { role: "user"; text: string }
  | { role: "system"; text: string }
  | {
      role: "ai";
      html: string;
      chips?: { label: string; vault: string; detail?: string }[];
    };

function getSubtree(
  rid: number,
  nodes: GraphNode[],
  edges: { a: number; b: number }[],
) {
  const out: GraphNode[] = [];
  const q = [rid];
  const vis = new Set<number>();
  while (q.length) {
    const id = q.shift()!;
    if (vis.has(id)) continue;
    vis.add(id);
    const n = nodes.find((x) => x.id === id);
    if (n) {
      out.push(n);
      edges.forEach((e) => {
        if (e.a === id && !vis.has(e.b)) q.push(e.b);
      });
    }
  }
  return out;
}

const PROOF = [
  "Works with every AI",
  "You own every node",
  "Zero platform lock-in",
  "6 private vaults",
];

function themeStyle(isDark: boolean): CSSProperties {
  if (isDark) {
    return {
      "--bg": "#0A0905",
      "--bg1": "#111009",
      "--bg2": "#18160E",
      "--bg3": "#211E13",
      "--bg4": "#2A2718",
      "--border": "rgba(255,255,255,0.07)",
      "--border2": "rgba(255,255,255,0.13)",
      "--white": "#FFF8F0",
      "--text": "#C8C0A8",
      "--muted": "#7A7258",
      "--faint": "#3A3520",
      "--orange": "#FF6600",
      "--orange-dim": "rgba(255,102,0,0.12)",
      "--orange-glow": "rgba(255,102,0,0.25)",
      "--orange-light": "#FF8533",
    } as CSSProperties;
  }
  return {
    "--bg": "#FDFAF5",
    "--bg1": "#F5F0E8",
    "--bg2": "#EDE7DA",
    "--bg3": "#E4DDD0",
    "--bg4": "#D9D2C4",
    "--border": "rgba(0,0,0,0.08)",
    "--border2": "rgba(0,0,0,0.14)",
    "--white": "#1A1814",
    "--text": "#4A4438",
    "--muted": "#7A7060",
    "--faint": "#B0A898",
    "--orange": "#FF6600",
    "--orange-dim": "rgba(255,102,0,0.1)",
    "--orange-glow": "rgba(255,102,0,0.2)",
    "--orange-light": "#CC5200",
  } as CSSProperties;
}

export default function LandingPage() {
  const [isDark, setIsDark] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [annual, setAnnual] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef(SEED_NODES.map((n) => ({ ...n })));
  const edgesRef = useRef([...SEED_EDGES]);
  const nodeIdRef = useRef(100);
  const rafRef = useRef<number | undefined>(undefined);
  const ptRef = useRef(0);
  const scaleRef = useRef(1);
  const offXRef = useRef(0);
  const offYRef = useRef(0);
  const dragNodeRef = useRef<GraphNode | null>(null);
  const dragOXRef = useRef(0);
  const dragOYRef = useRef(0);
  const panningRef = useRef(false);
  const panSRef = useRef({ x: 0, y: 0 });
  const panORef = useRef({ x: 0, y: 0 });
  const filterRef = useRef("all");
  const selNodeRef = useRef<GraphNode | null>(null);
  const [selNode, setSelNode] = useState<GraphNode | null>(null);
  const [exportPanel, setExportPanel] = useState(false);
  const [exportFmt, setExportFmt] = useState<"json" | "toml" | "md">("json");
  const [exportContent, setExportContent] = useState("");
  const [toast, setToast] = useState<ReactNode>(null);
  const [chatMsgs, setChatMsgs] = useState<LandingChatMsg[]>([
    {
      role: "system",
      text:
        "Tell me about yourself — your job, goals, preferences, health, or anything else. I'll map it to your memory graph in real time.",
    },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const chatHistoryRef = useRef<{ role: string; content: string }[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const landingOptimisticNodeIdRef = useRef<number | null>(null);
  const dimmedRef = useRef(new Set<string>());
  const [activeFilter, setActiveFilter] = useState("all");
  const connectModeRef = useRef(false);
  const connectSourceRef = useRef<GraphNode | null>(null);
  const connectCursorRef = useRef({ x: 0, y: 0 });
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<GraphNode | null>(null);
  const [peekNodeId, setPeekNodeId] = useState<number | null>(null);
  const peekNodeIdRef = useRef<number | null>(null);
  const setPeekNodeIdRef = useRef(setPeekNodeId);

  const C = {
    bg: "var(--bg)",
    bg1: "var(--bg1)",
    bg2: "var(--bg2)",
    bg3: "var(--bg3)",
    bg4: "var(--bg4)",
    border: "var(--border)",
    border2: "var(--border2)",
    white: "var(--white)",
    text: "var(--text)",
    muted: "var(--muted)",
    faint: "var(--faint)",
    orange: "var(--orange)",
    orangeDim: "var(--orange-dim)",
    orangeGlow: "var(--orange-glow)",
    orangeLight: "var(--orange-light)",
  };

  useEffect(() => {
    const saved = localStorage.getItem("memorey-theme");
    const dark = saved ? saved === "dark" : true;
    queueMicrotask(() => setIsDark(dark));
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("memorey-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  setPeekNodeIdRef.current = setPeekNodeId;
  useEffect(() => {
    peekNodeIdRef.current = peekNodeId;
  }, [peekNodeId]);

  useEffect(() => {
    if (peekNodeId == null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPeekNodeId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peekNodeId]);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("on");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.06 },
    );
    document.querySelectorAll(".reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  const w2s = useCallback(
    (x: number, y: number, W: number, H: number) => ({
      x: x * scaleRef.current + W / 2 + offXRef.current,
      y: y * scaleRef.current + H / 2 + offYRef.current,
    }),
    [],
  );

  const s2w = useCallback(
    (x: number, y: number, W: number, H: number) => ({
      x: (x - W / 2 - offXRef.current) / scaleRef.current,
      y: (y - H / 2 - offYRef.current) / scaleRef.current,
    }),
    [],
  );

  const nodeAt = useCallback(
    (sx: number, sy: number, W: number, H: number) => {
      const w = s2w(sx, sy, W, H);
      const nodes = nodesRef.current;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i];
        const { hw, hh } = landingNodeHalfExtent(n);
        if (
          Math.abs(w.x - n.x) <= hw &&
          Math.abs(w.y - n.y) <= hh
        ) {
          return n;
        }
      }
      return null;
    },
    [s2w],
  );

  const showToast = useCallback((content: ReactNode) => {
    setToast(content);
    setTimeout(() => setToast(null), 2400);
  }, []);

  const spawnNode = useCallback(
    (
      label: string,
      vault: string,
      px: number | null,
      py: number | null,
      parentId: number | null,
    ) => {
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const parent =
        parentId !== null
          ? parentId
          : (
              nodes.find((n) => n.vault === vault && n.parent === 0) || nodes[0]
            ).id;
      const np = nodes.find((n) => n.id === parent);
      const ang = Math.random() * Math.PI * 2;
      const dist = 110 + Math.random() * 70;
      const bx =
        px !== null ? px : np ? np.x + Math.cos(ang) * dist : 0;
      const by =
        py !== null ? py : np ? np.y + Math.sin(ang) * dist : 0;
      const n = mkn(
        nodeIdRef.current++,
        bx,
        by,
        10,
        vault,
        label.length > 18 ? `${label.slice(0, 16)}...` : label,
        label,
        parent,
        true,
      );
      nodes.push(n);
      edges.push({ a: parent, b: n.id });
      return n;
    },
    [],
  );

  function buildExport(n: GraphNode, fmt: "json" | "toml" | "md") {
    const sub = getSubtree(n.id, nodesRef.current, edgesRef.current);
    const vault = VAULTS[n.vault]?.label || n.vault;
    if (fmt === "json") {
      setExportContent(
        JSON.stringify(
          {
            node: { label: n.label, vault, detail: n.detail },
            memories: sub
              .filter((x) => x.id !== n.id)
              .map((x) => ({ label: x.label, detail: x.detail })),
            meta: { total_nodes: sub.length, exported_at: new Date().toISOString() },
          },
          null,
          2,
        ),
      );
    } else if (fmt === "toml") {
      const lines = [
        `# memorey · ${n.label}`,
        `[node]`,
        `label = "${n.label}"`,
        `vault = "${vault}"`,
        ``,
        `[memories]`,
      ];
      sub
        .filter((x) => x.id !== n.id)
        .forEach((x) => {
          const k = x.label.toLowerCase().replace(/[^a-z0-9]/g, "_");
          lines.push(`${k} = "${x.detail}"`);
        });
      setExportContent(lines.join("\n"));
    } else {
      const lines = [
        `# ${n.label} — Memorey Export`,
        `> Vault: ${vault} · ${sub.length} nodes`,
        ``,
      ];
      sub
        .filter((x) => x.id !== n.id)
        .forEach((x) => lines.push(`- **${x.label}:** ${x.detail}`));
      setExportContent(lines.join("\n"));
    }
  }

  function stripLandingOptimisticNode() {
    const oid = landingOptimisticNodeIdRef.current;
    if (oid == null) return;
    nodesRef.current = nodesRef.current.filter((n) => n.id !== oid);
    edgesRef.current = edgesRef.current.filter(
      (e) => e.a !== oid && e.b !== oid,
    );
    landingOptimisticNodeIdRef.current = null;
  }

  async function sendChat() {
    if (isSending || !chatInput.trim()) return;
    const text = chatInput.trim();
    setChatInput("");
    setIsSending(true);
    stripLandingOptimisticNode();
    const preview =
      text.length > 22 ? `${text.slice(0, 20)}…` : text;
    const optimistic = spawnNode(
      preview || "…",
      "personal",
      null,
      null,
      null,
    );
    optimistic.fresh = true;
    optimistic.detail = text;
    landingOptimisticNodeIdRef.current = optimistic.id;
    setChatMsgs((prev) => [...prev, { role: "user", text }]);
    chatHistoryRef.current.push({ role: "user", content: text });
    setChatMsgs((prev) => [
      ...prev,
      {
        role: "ai",
        html: '<span style="opacity:0.5">Mapping to your vaults...</span>',
        chips: [],
      },
    ]);

    try {
      const resp = await fetch("/api/landing-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: chatHistoryRef.current }),
      });
      const data = (await resp.json()) as {
        content?: { type: string; text: string }[];
      };
      const raw = data.content?.[0]?.text ?? "{}";
      let parsed: { reply?: string; nodes?: { label: string; vault: string; detail?: string }[] } =
        { reply: "Mapped to your graph.", nodes: [] };
      try {
        parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
      } catch {
        /* keep default */
      }

      chatHistoryRef.current.push({
        role: "assistant",
        content: parsed.reply ?? "",
      });

      stripLandingOptimisticNode();

      const chips: { label: string; vault: string; detail?: string }[] = [];
      if (parsed.nodes?.length) {
        parsed.nodes.forEach((nd, i) => {
          const vault = nd.vault in VAULTS ? nd.vault : "personal";
          const node = spawnNode(nd.label, vault, null, null, null);
          node.detail = nd.detail || nd.label;
          setTimeout(() => {
            showToast(
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  flexWrap: "wrap",
                }}
              >
                <Check
                  size={13}
                  style={{ color: "var(--orange)", flexShrink: 0, marginTop: 2 }}
                  strokeWidth={2.5}
                />
                <span>{node.label}</span>
                <ArrowRight
                  size={12}
                  style={{ color: "var(--orange)", flexShrink: 0 }}
                />
                <span>{VAULTS[vault]?.label}</span>
              </span>,
            );
          }, i * 320);
          chips.push({
            label: nd.label,
            vault: nd.vault in VAULTS ? nd.vault : "personal",
            detail: nd.detail,
          });
        });
      }

      setChatMsgs((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "ai",
          html: parsed.reply ?? "",
          chips,
        };
        return next;
      });
    } catch {
      stripLandingOptimisticNode();
      setChatMsgs((prev) => {
        const next = [...prev];
        next[next.length - 1] = {
          role: "ai",
          html: '<span style="color:#FF5B8A">Connection error — please try again.</span>',
        };
        return next;
      });
      chatHistoryRef.current.pop();
    }
    setIsSending(false);
  }

  useEffect(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [chatMsgs]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let W = 0;
    let H = 0;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const parent = canvas.parentElement!;
      const rect = parent.getBoundingClientRect();
      W = Math.max(200, Math.floor(rect.width));
      H = Math.max(280, Math.floor(parent.clientHeight) || 520);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = () => {
      ptRef.current += 0.02;
      const pt = ptRef.current;
      const scale = scaleRef.current;
      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const filter = filterRef.current;
      const dimmed = dimmedRef.current;
      const sel = selNodeRef.current;
      const dark = document.documentElement.getAttribute("data-theme") !== "light";

      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = dark ? CANVAS_MAIN_BG_DARK : CANVAS_MAIN_BG_LIGHT;
      ctx.fillRect(0, 0, W, H);

      let gcX = 0;
      let gcY = 0;
      for (const n of nodes) {
        gcX += n.x;
        gcY += n.y;
      }
      const gn = nodes.length || 1;
      gcX /= gn;
      gcY /= gn;
      const gridPanX =
        W / 2 +
        offXRef.current +
        (gcX - LANDING_SEED_GRAPH_CENTROID.x) * scale;
      const gridPanY =
        H / 2 +
        offYRef.current +
        (gcY - LANDING_SEED_GRAPH_CENTROID.y) * scale;

      drawGrid(ctx, W, H, gridPanX, gridPanY, scale, dark);

      const drawVaultChrome = (vaultId: string) => {
        if (dimmed.has(vaultId)) return;
        const col = VAULTS[vaultId]?.color || "#FF6600";
        const b = landingVaultWorldBounds(nodes, vaultId);
        const fb = LANDING_VAULT_FALLBACK[vaultId];
        if (b) {
          const pTL = w2s(b.minX, b.minY, W, H);
          const pBR = w2s(b.maxX, b.maxY, W, H);
          const left = Math.min(pTL.x, pBR.x);
          const top = Math.min(pTL.y, pBR.y);
          const rw = Math.max(24, Math.abs(pBR.x - pTL.x));
          const rh = Math.max(24, Math.abs(pBR.y - pTL.y));
          ctx.fillStyle = dark ? `${col}0A` : `${col}08`;
          landingRoundRect(ctx, left, top, rw, rh, 14);
          ctx.fill();
          ctx.strokeStyle = dark ? `${col}18` : `${col}14`;
          ctx.lineWidth = 0.75;
          ctx.stroke();
        } else if (fb) {
          const s = w2s(fb.cx, fb.cy, W, H);
          const blobRadius = 130 * scale;
          const grad = ctx.createRadialGradient(
            s.x,
            s.y,
            0,
            s.x,
            s.y,
            blobRadius,
          );
          grad.addColorStop(0, `${col}18`);
          grad.addColorStop(0.6, `${col}08`);
          grad.addColorStop(1, "transparent");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, blobRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      };

      if (filter === "all") {
        for (const vaultId of Object.keys(VAULTS)) {
          drawVaultChrome(vaultId);
        }
      } else if (filter !== "all" && VAULTS[filter]) {
        drawVaultChrome(filter);
      }

      const subIds = sel
        ? new Set(getSubtree(sel.id, nodes, edges).map((n) => n.id))
        : new Set<number>();

      edges.forEach(({ a, b }) => {
        const na = nodes.find((n) => n.id === a);
        const nb = nodes.find((n) => n.id === b);
        if (!na || !nb) return;
        const faded =
          (filter !== "all" &&
            na.vault !== filter &&
            nb.vault !== filter &&
            na.id !== 0 &&
            nb.id !== 0) ||
          (dimmed.has(na.vault) && na.id !== 0) ||
          (dimmed.has(nb.vault) && nb.id !== 0);
        const sa = w2s(na.x, na.y, W, H);
        const sb = w2s(nb.x, nb.y, W, H);
        const inSub = subIds.has(a) && subIds.has(b);
        const col = VAULTS[na.vault]?.color || "#FF6600";
        if (inSub) {
          ctx.beginPath();
          ctx.moveTo(sa.x, sa.y);
          ctx.lineTo(sb.x, sb.y);
          ctx.strokeStyle = `${col}55`;
          ctx.lineWidth = 6;
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        ctx.strokeStyle = inSub
          ? `${col}CC`
          : faded
            ? dark
              ? "rgba(255,255,255,0.03)"
              : "rgba(0,0,0,0.04)"
            : dark
              ? "rgba(255,255,255,0.1)"
              : "rgba(0,0,0,0.12)";
        ctx.lineWidth = inSub ? 2 : 1.5;
        ctx.stroke();
      });

      const frameCount = Math.floor(pt * 80);
      nodes.forEach((n) => {
        const faded =
          (filter !== "all" && n.vault !== filter && n.id !== 0) ||
          (dimmed.has(n.vault) && n.id !== 0);
        const s = w2s(n.x, n.y, W, H);
        const inSub = subIds.has(n.id);
        const isPeek =
          peekNodeIdRef.current !== null && n.id === peekNodeIdRef.current;

        ctx.save();
        ctx.translate(s.x, s.y);
        ctx.scale(scale, scale);
        if (n.id === 0) {
          drawLandingYouCard(ctx, n, {
            dark,
            frameCount,
            isPeek,
            inSub,
          });
        } else {
          drawLandingMemoryCard(ctx, n, {
            dark,
            frameCount,
            isPeek,
            inSub,
            faded,
            showOgPreview: isPeek && Boolean(n.ogImage),
            requestRedraw: () => {
              ptRef.current += 0.0001;
            },
          });
        }
        ctx.restore();
      });

      // CONNECT MODE PREVIEW LINE
      if (connectModeRef.current && connectSourceRef.current) {
        const src = connectSourceRef.current;
        const ss = w2s(src.x, src.y, W, H);
        const cx = connectCursorRef.current.x;
        const cy = connectCursorRef.current.y;
        const col = VAULTS[src.vault]?.color || "#FF6600";
        const hoverTarget = nodeAt(cx, cy, W, H);

        ctx.save();
        ctx.setLineDash([6, 4]);
        ctx.lineDashOffset = -pt * 8;
        ctx.beginPath();
        ctx.moveTo(ss.x, ss.y);

        if (hoverTarget && hoverTarget.id !== src.id) {
          const ts = w2s(hoverTarget.x, hoverTarget.y, W, H);
          ctx.lineTo(ts.x, ts.y);
          ctx.strokeStyle = col;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.restore();

          strokeLandingNodeScreenOutline(ctx, ts.x, ts.y, hoverTarget, scale, {
            stroke: `${col}AA`,
            lineWidth: 2,
            dash: [4, 3],
            dashOffset: -pt * 6,
          });
        } else {
          ctx.lineTo(cx, cy);
          ctx.strokeStyle = col + "CC";
          ctx.lineWidth = 1.5;
          ctx.stroke();
          ctx.restore();

          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, 5, 0, Math.PI * 2);
          ctx.fillStyle = col + "88";
          ctx.fill();
          ctx.restore();
        }

        strokeLandingNodeScreenOutline(ctx, ss.x, ss.y, src, scale, {
          stroke: col,
          lineWidth: 2,
        });
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);

    const getXY = (e: MouseEvent | TouchEvent) => {
      const rect = canvas.getBoundingClientRect();
      if ("touches" in e && e.touches[0])
        return {
          x: e.touches[0].clientX - rect.left,
          y: e.touches[0].clientY - rect.top,
        };
      const me = e as MouseEvent;
      return { x: me.clientX - rect.left, y: me.clientY - rect.top };
    };

    let lastClick = 0;

    const onMouseDown = (e: MouseEvent) => {
      const { x, y } = getXY(e);
      const h = nodeAt(x, y, W, H);
      if (h && !e.shiftKey) {
        dragNodeRef.current = h;
        const s = w2s(h.x, h.y, W, H);
        dragOXRef.current = x - s.x;
        dragOYRef.current = y - s.y;
      } else if (!h) {
        panningRef.current = true;
        panSRef.current = { x, y };
        panORef.current = { x: offXRef.current, y: offYRef.current };
      }
    };

    const onMouseMove = (e: MouseEvent) => {
      const { x, y } = getXY(e);

      connectCursorRef.current = { x, y };

      if (dragNodeRef.current && !connectModeRef.current) {
        const w = s2w(x - dragOXRef.current, y - dragOYRef.current, W, H);
        dragNodeRef.current.x = w.x;
        dragNodeRef.current.y = w.y;
      } else if (panningRef.current) {
        offXRef.current = panORef.current.x + (x - panSRef.current.x);
        offYRef.current = panORef.current.y + (y - panSRef.current.y);
      } else if (connectModeRef.current) {
        canvas.style.cursor = "crosshair";
      } else {
        const h = nodeAt(x, y, W, H);
        canvas.style.cursor = h ? "pointer" : "grab";
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      const now = Date.now();
      const { x, y } = getXY(e);
      const wasDrag = !!dragNodeRef.current;
      dragNodeRef.current = null;
      panningRef.current = false;

      if (connectModeRef.current) {
        const h = nodeAt(x, y, W, H);
        if (h) {
          if (!connectSourceRef.current) {
            connectSourceRef.current = h;
            setConnectSource(h);
            showToast(
              <span>
                Source: {h.label} — now click the target node
              </span>,
            );
          } else {
            const src = connectSourceRef.current;
            const tgt = h;
            if (src.id !== tgt.id) {
              const alreadyExists = edgesRef.current.some(
                (ed) =>
                  (ed.a === src.id && ed.b === tgt.id) ||
                  (ed.a === tgt.id && ed.b === src.id),
              );
              if (!alreadyExists) {
                edgesRef.current.push({ a: src.id, b: tgt.id });
                showToast(
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      flexWrap: "wrap",
                    }}
                  >
                    <Check
                      size={13}
                      style={{
                        color: "var(--orange)",
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                      strokeWidth={2.5}
                    />
                    <span>Connected:</span>
                    <span>{src.label}</span>
                    <ArrowLeftRight
                      size={12}
                      style={{ color: "var(--orange)", flexShrink: 0 }}
                    />
                    <span>{tgt.label}</span>
                  </span>,
                );
              } else {
                showToast(<span>Connection already exists</span>);
              }
            }
            connectSourceRef.current = null;
            setConnectSource(null);
            connectModeRef.current = false;
            setConnectMode(false);
          }
        }
        return;
      }

      if (!wasDrag && now - lastClick > 180) {
        lastClick = now;
        const h = nodeAt(x, y, W, H);
        if (h) {
          setPeekNodeIdRef.current((prev) =>
            prev === h.id ? null : h.id,
          );
          selNodeRef.current = null;
          setSelNode(null);
          setExportPanel(false);
        } else {
          setPeekNodeIdRef.current(null);
          selNodeRef.current = null;
          setSelNode(null);
          setExportPanel(false);
        }
      }
    };

    const endPan = () => {
      dragNodeRef.current = null;
      panningRef.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      scaleRef.current = Math.min(
        Math.max(scaleRef.current * (e.deltaY > 0 ? 0.88 : 1.13), 0.18),
        5,
      );
    };

    const onDblClick = (e: MouseEvent) => {
      const { x, y } = getXY(e);
      if (nodeAt(x, y, W, H)) return;
      const w = s2w(x, y, W, H);
      spawnNode("New memory", "personal", w.x, w.y, null);
      showToast(<span>Node created!</span>);
    };

    canvas.addEventListener("mousedown", onMouseDown);
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseup", onMouseUp);
    canvas.addEventListener("mouseleave", endPan);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("dblclick", onDblClick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousedown", onMouseDown);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseup", onMouseUp);
      canvas.removeEventListener("mouseleave", endPan);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("dblclick", onDblClick);
    };
  }, [nodeAt, s2w, w2s, spawnNode, showToast]);

  const tv = themeStyle(isDark);
  const navBg = scrolled
    ? isDark
      ? "rgba(10,9,5,0.92)"
      : "rgba(253,250,245,0.94)"
    : "transparent";

  return (
    <div
      style={{
        ...tv,
        background: C.bg,
        color: C.text,
        fontFamily: 'var(--font-inter, "Inter", ui-sans-serif), sans-serif',
        lineHeight: 1.65,
        overflowX: "hidden",
        minHeight: "100vh",
      }}
    >
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 500,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "0.9rem 1.25rem",
          background: navBg,
          backdropFilter: scrolled ? "blur(20px)" : "none",
          borderBottom: scrolled ? `1px solid ${C.border}` : "none",
          transition: "all 0.3s",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontFamily: "var(--font-syne, ui-sans-serif)",
            fontSize: "1.3rem",
            fontWeight: 800,
            color: C.white,
            letterSpacing: "-0.03em",
          }}
        >
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: "50%",
              background: C.orange,
              boxShadow: `0 0 16px ${C.orangeGlow}`,
              flexShrink: 0,
            }}
          />
          memorey
        </div>
        <ul
          className="hidden list-none gap-8 md:flex"
          style={{ margin: 0, padding: 0 }}
        >
          {(
            [
              ["Memory Graph", "#playground"],
              ["How it works", "#how"],
              ["Privacy", "#privacy"],
              ["Pricing", "#pricing"],
            ] as const
          ).map(([label, href]) => (
            <li key={href}>
              <a
                href={href}
                style={{
                  color: C.muted,
                  textDecoration: "none",
                  fontSize: "0.82rem",
                  letterSpacing: "0.02em",
                }}
              >
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setIsDark(!isDark)}
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `1px solid ${C.border2}`,
              background: "transparent",
              color: C.muted,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {isDark ? (
              <Sun size={16} style={{ verticalAlign: "middle" }} />
            ) : (
              <Moon size={16} style={{ verticalAlign: "middle" }} />
            )}
          </button>
          <a
            href="/login"
            style={{
              border: `1px solid ${C.border2}`,
              color: C.muted,
              padding: "0.46rem 1rem",
              fontSize: "0.82rem",
              borderRadius: 6,
              textDecoration: "none",
            }}
          >
            Sign in
          </a>
          <a
            href="/login"
            style={{
              background: C.orange,
              color: "#fff",
              padding: "0.5rem 1.2rem",
              fontSize: "0.82rem",
              fontWeight: 500,
              borderRadius: 6,
              textDecoration: "none",
              boxShadow: `0 0 20px ${C.orangeGlow}`,
            }}
          >
            Start free
          </a>
        </div>
      </nav>

      <section
        style={{
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          padding: "7rem 1.5rem 5rem",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {[
          {
            w: 650,
            h: 650,
            bg: "radial-gradient(circle,rgba(255,102,0,.18) 0%,transparent 70%)",
            top: "-20%",
            left: "50%",
            transform: "translateX(-50%)",
          },
          {
            w: 400,
            h: 400,
            bg: "radial-gradient(circle,rgba(245,197,66,.1) 0%,transparent 70%)",
            top: "20%",
            left: "-10%",
          },
          {
            w: 350,
            h: 350,
            bg: "radial-gradient(circle,rgba(255,91,138,.08) 0%,transparent 70%)",
            bottom: "0",
            right: "-5%",
          },
        ].map((orb, i) => {
          const { w, h, bg, ...pos } = orb;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                borderRadius: "50%",
                filter: "blur(130px)",
                width: w,
                height: h,
                background: bg,
                pointerEvents: "none",
                ...pos,
              }}
            />
          );
        })}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
            fontSize: "0.65rem",
            color: "#FF8533",
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            border: "1px solid rgba(255,102,0,0.3)",
            background: C.orangeDim,
            padding: "0.3rem 0.9rem",
            borderRadius: 100,
            marginBottom: "1.8rem",
            animation: "up 0.7s 0.1s both",
          }}
        >
          <div
            style={{
              width: 5,
              height: 5,
              borderRadius: "50%",
              background: C.orange,
              animation: "pulse-ring 2s infinite",
            }}
          />
          Now open — human-first memory OS
        </div>
        <h1
          style={{
            fontFamily: "var(--font-syne)",
            fontSize: "clamp(2.6rem,7vw,6.2rem)",
            fontWeight: 800,
            lineHeight: 0.96,
            letterSpacing: "-0.04em",
            color: C.white,
            maxWidth: 860,
            margin: "0 0 1.6rem",
            animation: "up 0.8s 0.25s both",
          }}
        >
          Every AI you use
          <br />
          starts from{" "}
          <span
            style={{
              background: "linear-gradient(135deg,#FF6600,#F5C542)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            zero.
          </span>
        </h1>
        <p
          style={{
            fontSize: "1.05rem",
            color: C.muted,
            maxWidth: 500,
            lineHeight: 1.8,
            fontWeight: 300,
            animation: "up 0.8s 0.4s both",
            margin: "0 0 2.4rem",
          }}
        >
          Memorey doesn&apos;t. One graph of who you are — portable across every
          AI, owned entirely by you.
        </p>
        <div
          style={{
            display: "flex",
            gap: "0.9rem",
            flexWrap: "wrap",
            justifyContent: "center",
            animation: "up 0.8s 0.55s both",
          }}
        >
          <a
            href="/login"
            style={{
              background: C.orange,
              color: "#fff",
              padding: "0.88rem 2.2rem",
              fontWeight: 500,
              fontSize: "0.97rem",
              borderRadius: 8,
              textDecoration: "none",
              boxShadow: `0 4px 32px ${C.orangeGlow}`,
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Start free
              <ArrowRight
                size={16}
                style={{ verticalAlign: "middle" }}
                strokeWidth={2}
              />
            </span>
          </a>
          <button
            type="button"
            onClick={() =>
              document.getElementById("playground")?.scrollIntoView({
                behavior: "smooth",
              })
            }
            style={{
              background: "transparent",
              border: `1px solid ${C.border2}`,
              color: C.text,
              padding: "0.88rem 2.2rem",
              fontSize: "0.97rem",
              borderRadius: 8,
              cursor: "pointer",
            }}
          >
            Try the graph demo
          </button>
        </div>
        <p
          style={{
            marginTop: "0.9rem",
            fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
            fontSize: "0.64rem",
            color: C.muted,
            animation: "up 0.8s 0.7s both",
          }}
        >
          Free forever · No credit card · Works with every AI
        </p>
        <div
          style={{
            marginTop: "4rem",
            display: "flex",
            alignItems: "center",
            gap: "1.5rem",
            flexWrap: "wrap",
            justifyContent: "center",
            animation: "up 0.8s 0.85s both",
          }}
        >
          {PROOF.flatMap((item, i, arr) => {
            const nodes = [
              <span
                key={`p-${i}`}
                style={{
                  fontSize: "0.8rem",
                  color: C.muted,
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Check
                  size={13}
                  style={{
                    color: C.orange,
                    flexShrink: 0,
                    verticalAlign: "middle",
                  }}
                  strokeWidth={2.5}
                />{" "}
                {item}
              </span>,
            ];
            if (i < arr.length - 1)
              nodes.push(
                <div
                  key={`sep-${i}`}
                  style={{ width: 1, height: 14, background: C.border2 }}
                />,
              );
            return nodes;
          })}
        </div>
      </section>

      <div
        style={{
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
          overflow: "hidden",
          background:
            "linear-gradient(180deg,rgba(255,102,0,0.04) 0%,transparent 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            width: "max-content",
            animation: "scroll-marquee 30s linear infinite",
          }}
        >
          {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "1rem 2rem",
                borderRight: `1px solid ${C.border}`,
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: "var(--orange)",
                  flexShrink: 0,
                  margin: "0 2px",
                  verticalAlign: "middle",
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                  fontSize: "0.63rem",
                  color: C.muted,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                }}
              >
                {item}
              </span>
            </div>
          ))}
        </div>
      </div>

      <section
        id="playground"
        style={{
          background: C.bg1,
          borderTop: `1px solid ${C.border}`,
          borderBottom: `1px solid ${C.border}`,
        }}
      >
        <div style={{ padding: "4rem 2rem 0", maxWidth: 1080, margin: "0 auto" }}>
          <div className="reveal">
            <p
              style={{
                fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                fontSize: "0.63rem",
                color: C.orange,
                letterSpacing: "0.15em",
                textTransform: "uppercase",
                marginBottom: "1rem",
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  width: 20,
                  height: 1,
                  background: C.orange,
                }}
              />
              Live Memory Graph
            </p>
            <h2
              style={{
                fontFamily: "var(--font-syne)",
                fontSize: "clamp(1.9rem,4vw,3.1rem)",
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: "-0.03em",
                color: C.white,
                maxWidth: 660,
                marginBottom: "0.9rem",
              }}
            >
              Your memory,{" "}
              <span
                style={{
                  background: "linear-gradient(135deg,#FF6600,#F5C542)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                one graph.
              </span>
            </h2>
            <p
              style={{
                color: C.muted,
                maxWidth: 480,
                fontSize: "0.97rem",
                lineHeight: 1.85,
                fontWeight: 300,
              }}
            >
              Tell Memorey about yourself — it extracts memories, places them in
              the right vault, and shows them on the graph. Click a node for a
              preview, then open export from the card.
            </p>
          </div>
        </div>

        <div style={{ padding: "1.5rem 2rem 3rem", maxWidth: 1080, margin: "0 auto" }}>
          <div
            className="reveal overflow-hidden rounded-[12px] border"
            style={{
              borderColor: C.border2,
              background: C.bg,
              boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.7rem 1rem",
                background: C.bg2,
                borderBottom: `1px solid ${C.border}`,
                flexWrap: "wrap",
                gap: "0.5rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
                  <div
                    key={c}
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: "50%",
                      background: c,
                    }}
                  />
                ))}
                <span
                  style={{
                    fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                    fontSize: "0.62rem",
                    color: C.muted,
                    letterSpacing: "0.05em",
                    marginLeft: 6,
                  }}
                >
                  memorey.graph.live
                </span>
              </div>
              <div style={{ display: "flex", gap: "0.3rem", flexWrap: "wrap" }}>
                {[
                  { id: "all", label: "All", color: C.orange },
                  ...Object.entries(VAULTS).map(([id, v]) => ({
                    id,
                    label: v.label,
                    color: v.color,
                  })),
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => {
                      filterRef.current = f.id;
                      setActiveFilter(f.id);
                    }}
                    style={{
                      background:
                        activeFilter === f.id ? "var(--orange-dim)" : "transparent",
                      border: `1px solid ${activeFilter === f.id ? C.orange : C.border}`,
                      color: activeFilter === f.id ? C.orange : C.muted,
                      fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                      fontSize: "0.58rem",
                      padding: "0.2rem 0.55rem",
                      cursor: "pointer",
                      borderRadius: 4,
                      display: "flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: f.color,
                        flexShrink: 0,
                      }}
                    />
                    {f.id === "all" ? "All" : f.label}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    const next = !connectModeRef.current;
                    connectModeRef.current = next;
                    connectSourceRef.current = null;
                    setConnectSource(null);
                    setConnectMode(next);
                    showToast(
                      next
                        ? "Click source node, then target"
                        : "Connect mode off",
                    );
                  }}
                  style={{
                    background: connectMode ? "var(--orange-dim)" : "transparent",
                    border: `1px solid ${connectMode ? "var(--orange)" : C.border}`,
                    color: connectMode ? "var(--orange)" : C.muted,
                    fontFamily: "var(--font-mono, monospace)",
                    fontSize: "0.58rem",
                    padding: "0.2rem 0.55rem",
                    cursor: "pointer",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    whiteSpace: "nowrap",
                    transition: "all 0.2s",
                  }}
                >
                  <Link2 size={16} style={{ flexShrink: 0 }} strokeWidth={2} />
                  {connectMode ? "Cancel connect" : "Connect nodes"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    scaleRef.current = 1;
                    offXRef.current = 0;
                    offYRef.current = 0;
                    filterRef.current = "all";
                    setActiveFilter("all");
                    nodesRef.current = SEED_NODES.map((n) => ({ ...n }));
                    edgesRef.current = [...SEED_EDGES];
                    nodeIdRef.current = 100;
                    connectModeRef.current = false;
                    setConnectMode(false);
                    connectSourceRef.current = null;
                    setConnectSource(null);
                    selNodeRef.current = null;
                    setSelNode(null);
                    setExportPanel(false);
                    landingOptimisticNodeIdRef.current = null;
                    setPeekNodeId(null);
                    showToast(
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <RotateCcw
                          size={13}
                          style={{ color: "var(--orange)", flexShrink: 0 }}
                        />
                        Graph reset
                      </span>,
                    );
                  }}
                  style={{
                    background: "transparent",
                    border: `1px solid ${C.border}`,
                    color: C.muted,
                    fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                    fontSize: "0.58rem",
                    padding: "0.2rem 0.55rem",
                    cursor: "pointer",
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                  aria-label="Reset graph"
                >
                  <RotateCcw size={16} strokeWidth={2} />
                </button>
              </div>
            </div>

            <div
              style={{
                padding: "0.7rem 1rem",
                borderBottom: `1px solid ${C.border}`,
                background: C.bg2,
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                  fontSize: "0.57rem",
                  color: C.muted,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginRight: "0.3rem",
                }}
              >
                vaults
              </span>
              {Object.entries(VAULTS).map(([id, v]) => (
                <div
                  key={id}
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    const d = dimmedRef.current;
                    if (d.has(id)) d.delete(id);
                    else d.add(id);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      const d = dimmedRef.current;
                      if (d.has(id)) d.delete(id);
                      else d.add(id);
                    }
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                    fontSize: "0.58rem",
                    cursor: "pointer",
                    padding: "0.2rem 0.5rem",
                    borderRadius: 4,
                    border: "1px solid transparent",
                    whiteSpace: "nowrap",
                  }}
                >
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: v.color,
                      flexShrink: 0,
                    }}
                  />
                  <span style={{ color: C.text }}>{v.label}</span>
                  <span
                    style={{
                      color: C.muted,
                      fontSize: "0.53rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    {id === "finance" && (
                      <Lock
                        size={14}
                        style={{
                          color: "var(--orange)",
                          flexShrink: 0,
                          verticalAlign: "middle",
                        }}
                      />
                    )}
                    {v.desc}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid min-h-[520px] grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px]">
                <div
                  className="relative min-h-[400px] overflow-hidden border-b lg:border-b-0 lg:border-r"
                  style={{
                    position: "relative",
                    borderColor: C.border,
                    borderRight: `1px solid ${C.border}`,
                    overflow: "hidden",
                    outline: connectMode ? `2px solid ${C.orangeGlow}` : "none",
                    outlineOffset: "-2px",
                    transition: "outline 0.2s",
                  }}
                >
                  <canvas
                    ref={canvasRef}
                    style={{
                      width: "100%",
                      height: 520,
                      display: "block",
                      cursor: "grab",
                    }}
                  />
                  {peekNodeId !== null ? (
                    <LandingNodePeek
                      key={peekNodeId}
                      peekNodeId={peekNodeId}
                      nodesRef={nodesRef}
                      scaleRef={scaleRef}
                      offXRef={offXRef}
                      offYRef={offYRef}
                      canvasRef={canvasRef}
                      onClose={() => setPeekNodeId(null)}
                      onOpenFull={(node) => {
                        setPeekNodeId(null);
                        selNodeRef.current = node;
                        setSelNode(node);
                        setExportFmt("json");
                        setExportPanel(true);
                        buildExport(node, "json");
                      }}
                    />
                  ) : null}
                  {connectMode && (
                    <div
                      style={{
                        position: "absolute",
                        top: 12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: "var(--orange-dim)",
                        border: "1px solid var(--orange)",
                        color: "var(--orange)",
                        fontFamily: "var(--font-mono, monospace)",
                        fontSize: "0.62rem",
                        padding: "0.3rem 0.9rem",
                        borderRadius: 100,
                        pointerEvents: "none",
                        zIndex: 20,
                        whiteSpace: "nowrap",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                        }}
                      >
                        <Link2
                          size={14}
                          style={{ flexShrink: 0 }}
                          strokeWidth={2}
                        />
                        {connectSource
                          ? `Source: ${connectSource.label} — click target node`
                          : "Click a node to start connecting"}
                      </span>
                    </div>
                  )}
                  {exportPanel && selNode && (
                    <div
                      style={{
                        position: "absolute",
                        left: "1rem",
                        right: "1rem",
                        top: "3.5rem",
                        background: C.bg3,
                        border: `1px solid ${C.border2}`,
                        borderRadius: 10,
                        zIndex: 80,
                        boxShadow: "0 24px 80px rgba(0,0,0,0.7)",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "0.6rem 0.9rem",
                          background: C.bg4,
                          borderBottom: `1px solid ${C.border}`,
                          borderRadius: "10px 10px 0 0",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "0.7rem",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                              fontSize: "0.62rem",
                              color: C.orange,
                            }}
                          >
                            export: {selNode.label}
                          </span>
                          <div style={{ display: "flex", gap: "0.25rem" }}>
                            {(["json", "toml", "md"] as const).map((fmt) => (
                              <button
                                key={fmt}
                                type="button"
                                onClick={() => {
                                  setExportFmt(fmt);
                                  buildExport(selNode, fmt);
                                }}
                                style={{
                                  background:
                                    exportFmt === fmt
                                      ? "var(--orange-dim)"
                                      : "transparent",
                                  border: `1px solid ${exportFmt === fmt ? C.orange : C.border}`,
                                  color:
                                    exportFmt === fmt ? C.orange : C.muted,
                                  fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                                  fontSize: "0.57rem",
                                  padding: "0.22rem 0.65rem",
                                  cursor: "pointer",
                                  borderRadius: 4,
                                  textTransform: "uppercase",
                                }}
                              >
                                {fmt}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setExportPanel(false);
                            selNodeRef.current = null;
                            setSelNode(null);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: C.muted,
                            cursor: "pointer",
                            fontSize: "0.95rem",
                          }}
                        >
                          <X size={16} style={{ verticalAlign: "middle" }} />
                        </button>
                      </div>
                      <pre
                        style={{
                          padding: "0.9rem 1rem",
                          fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                          fontSize: "0.68rem",
                          lineHeight: 1.85,
                          color: C.text,
                          maxHeight: 200,
                          overflowY: "auto",
                          whiteSpace: "pre-wrap",
                          wordBreak: "break-word",
                          margin: 0,
                        }}
                      >
                        {exportContent}
                      </pre>
                      <div
                        style={{
                          display: "flex",
                          gap: "0.45rem",
                          padding: "0.65rem 0.9rem",
                          borderTop: `1px solid ${C.border}`,
                          background: C.bg4,
                          borderRadius: "0 0 10px 10px",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => {
                            const a = document.createElement("a");
                            a.href = URL.createObjectURL(
                              new Blob([exportContent], { type: "text/plain" }),
                            );
                            a.download = `memorey_${selNode.label.toLowerCase().replace(/\W+/g, "_")}.${exportFmt}`;
                            a.click();
                            showToast(
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <Check
                                  size={13}
                                  style={{
                                    color: "var(--orange)",
                                    flexShrink: 0,
                                    marginTop: 2,
                                  }}
                                  strokeWidth={2.5}
                                />
                                Downloaded
                              </span>,
                            );
                          }}
                          style={{
                            background: C.orange,
                            color: "#fff",
                            border: "none",
                            padding: "0.4rem 0.9rem",
                            fontWeight: 500,
                            fontSize: "0.77rem",
                            cursor: "pointer",
                            borderRadius: 5,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Download size={16} strokeWidth={2} />
                          Download
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(exportContent);
                            showToast(
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                <Check
                                  size={13}
                                  style={{
                                    color: "var(--orange)",
                                    flexShrink: 0,
                                    marginTop: 2,
                                  }}
                                  strokeWidth={2.5}
                                />
                                Copied
                              </span>,
                            );
                          }}
                          style={{
                            background: "transparent",
                            border: `1px solid ${C.border2}`,
                            color: C.muted,
                            padding: "0.4rem 0.9rem",
                            fontSize: "0.77rem",
                            cursor: "pointer",
                            borderRadius: 5,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                          }}
                        >
                          <Copy size={16} strokeWidth={2} />
                          Copy
                        </button>
                      </div>
                    </div>
                  )}
                  {toast && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "1rem",
                        left: "50%",
                        transform: "translateX(-50%)",
                        background: C.bg4,
                        border: `1px solid ${C.orange}`,
                        color: C.orange,
                        fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                        fontSize: "0.62rem",
                        padding: "0.4rem 1rem",
                        borderRadius: 100,
                        whiteSpace: "nowrap",
                        pointerEvents: "none",
                      }}
                    >
                      {toast}
                    </div>
                  )}
                </div>

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    background: C.bg1,
                    minHeight: 320,
                  }}
                >
                  <div
                    style={{
                      padding: "0.7rem 1rem",
                      borderBottom: `1px solid ${C.border}`,
                      background: C.bg2,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                        fontSize: "0.62rem",
                        color: C.orange,
                        letterSpacing: "0.06em",
                      }}
                    >
                      memorey_chat
                    </span>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                        fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                        fontSize: "0.57rem",
                        color: C.muted,
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: "#A8E063",
                          boxShadow: "0 0 6px #A8E063",
                        }}
                      />
                      AI active
                    </div>
                  </div>
                  <div
                    ref={chatScrollRef}
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "0.8rem 1rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.7rem",
                      maxHeight: 380,
                      minHeight: 200,
                    }}
                  >
                    {chatMsgs.map((msg, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.2rem",
                        }}
                      >
                        {msg.role !== "system" && (
                          <div
                            style={{
                              fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                              fontSize: "0.54rem",
                              color: C.muted,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              textAlign:
                                msg.role === "user" ? "right" : "left",
                            }}
                          >
                            {msg.role === "user" ? "You" : "Memorey"}
                          </div>
                        )}
                        <div
                          style={{
                            fontSize: "0.82rem",
                            lineHeight: 1.65,
                            fontWeight: 300,
                            padding: "0.6rem 0.8rem",
                            borderRadius: 8,
                            background:
                              msg.role === "user"
                                ? "var(--orange-dim)"
                                : msg.role === "system"
                                  ? "transparent"
                                  : C.bg3,
                            color:
                              msg.role === "user" ? C.white : C.text,
                            border:
                              msg.role === "user"
                                ? "1px solid rgba(255,102,0,0.2)"
                                : msg.role === "system"
                                  ? `1px dashed ${C.border}`
                                  : `1px solid ${C.border}`,
                            textAlign:
                              msg.role === "user" ? "right" : "left",
                            fontFamily:
                              msg.role === "system"
                                ? 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)'
                                : "inherit",
                          }}
                        >
                          {msg.role === "ai" ? (
                            <span
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(msg.html),
                              }}
                            />
                          ) : (
                            msg.text
                          )}
                        </div>
                        {msg.role === "ai" && msg.chips?.length ? (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "0.3rem",
                              marginTop: "0.4rem",
                            }}
                          >
                            {msg.chips.map((c, j) => {
                              const v = VAULTS[c.vault] || VAULTS.personal;
                              return (
                                <div
                                  key={j}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "0.3rem",
                                    fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                                    fontSize: "0.57rem",
                                    padding: "0.18rem 0.55rem",
                                    borderRadius: 100,
                                    border: `1px solid ${v.color}66`,
                                    color: v.color,
                                    background: `${v.color}12`,
                                  }}
                                >
                                  <div
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: "50%",
                                      background: v.color,
                                    }}
                                  />
                                  {c.label}
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                  <div
                    style={{
                      padding: "0.7rem",
                      borderTop: `1px solid ${C.border}`,
                      background: C.bg2,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "0.5rem",
                        alignItems: "flex-end",
                      }}
                    >
                      <textarea
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            void sendChat();
                          }
                        }}
                        placeholder="e.g. I'm a developer in Bengaluru..."
                        rows={2}
                        style={{
                          flex: 1,
                          background: C.bg3,
                          border: `1px solid ${C.border2}`,
                          borderRadius: 8,
                          padding: "0.6rem 0.85rem",
                          fontSize: "0.85rem",
                          color: C.white,
                          outline: "none",
                          resize: "none",
                          minHeight: 40,
                          maxHeight: 120,
                          caretColor: C.orange,
                          lineHeight: 1.5,
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void sendChat()}
                        disabled={isSending}
                        style={{
                          background: isSending ? C.faint : C.orange,
                          border: "none",
                          color: "#fff",
                          width: 38,
                          height: 38,
                          borderRadius: 8,
                          cursor: isSending ? "not-allowed" : "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          fontSize: 16,
                        }}
                      >
                        {isSending ? (
                          <Loader2
                            size={18}
                            className="animate-spin"
                            style={{ verticalAlign: "middle" }}
                          />
                        ) : (
                          <ArrowUp size={18} style={{ verticalAlign: "middle" }} />
                        )}
                      </button>
                    </div>
                    <div
                      style={{
                        fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                        fontSize: "0.56rem",
                        color: C.faint,
                        marginTop: "0.4rem",
                      }}
                    >
                      Enter to send · Shift+Enter for new line
                    </div>
                  </div>
                </div>
            </div>

            <div
              style={{
                display: "flex",
                gap: "1.5rem",
                flexWrap: "wrap",
                padding: "0.5rem 1rem",
                borderTop: `1px solid ${C.border}`,
                background: C.bg2,
                fontFamily:
                  'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                fontSize: "0.57rem",
                color: C.faint,
              }}
            >
              <span
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <MousePointer
                  size={11}
                  style={{ color: "var(--orange)", flexShrink: 0 }}
                />
                <span>Click node to preview · export from card</span>
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <Move size={11} style={{ color: "var(--orange)", flexShrink: 0 }} />
                <span>Drag to rearrange</span>
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <ZoomIn
                  size={11}
                  style={{ color: "var(--orange)", flexShrink: 0 }}
                />
                <span>Scroll to zoom</span>
              </span>
              <span
                style={{ display: "flex", alignItems: "center", gap: 5 }}
              >
                <Plus size={11} style={{ color: "var(--orange)", flexShrink: 0 }} />
                <span>Double-click to add node</span>
              </span>
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  fontFamily: "var(--font-mono, monospace)",
                }}
              >
                <Link2 size={11} style={{ color: "var(--orange)", flexShrink: 0 }} />
                <span>Connect nodes button to link two nodes</span>
              </span>
            </div>
          </div>
        </div>
      </section>

      <HowSection C={C} />
      <DiffSection C={C} />
      <PrivacySection C={C} />
      <Manifesto C={C} />
      <PricingSection C={C} annual={annual} setAnnual={setAnnual} />
      <FinalCta C={C} />
      <Footer C={C} />
    </div>
  );
}

const iconBox = {
  width: 34,
  height: 34,
  borderRadius: 8,
  background: "var(--orange-dim)",
  border: "1px solid rgba(255,102,0,0.2)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
} as const;

function HowSection({ C }: { C: Record<string, string> }) {
  const steps = [
    {
      n: "01",
      title: "Seed your graph",
      body: "Paste a link, type about yourself, or import an export. Memorey places everything in the right vault automatically.",
      Icon: Link,
    },
    {
      n: "02",
      title: "Review every diff",
      body: "See old vs. new before anything saves. Max 8 nodes per review. You confirm, reject, or edit each one.",
      Icon: GitBranch,
    },
    {
      n: "03",
      title: "Six private vaults",
      body: "Work, Personal, Health, Lifestyle, Study, Finance — each vault is isolated. Share one without touching another.",
      Icon: Layers,
    },
    {
      n: "04",
      title: "Brief any AI",
      body: "Export as JSON, TOML or Markdown. Or use the browser extension to inject context directly.",
      Icon: Zap,
    },
  ];
  return (
    <section id="how" style={{ background: C.bg1, padding: "6rem 2rem" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div className="reveal">
          <p
            style={{
              fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
              fontSize: "0.63rem",
              color: C.orange,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "1rem",
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
            }}
          >
            <span
              style={{
                display: "inline-block",
                width: 20,
                height: 1,
                background: C.orange,
              }}
            />
            The Flow
          </p>
          <h2
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.9rem,4vw,3.1rem)",
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.03em",
              color: C.white,
              maxWidth: 660,
            }}
          >
            Memory that works{" "}
            <span
              style={{
                background: "linear-gradient(135deg,#FF6600,#F5C542)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              with you.
            </span>
          </h2>
        </div>
        <div
          className="reveal grid gap-px border"
          style={{
            marginTop: "2.5rem",
            borderColor: C.border,
            borderRadius: 12,
            overflow: "hidden",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {steps.map((s) => {
            const StepIcon = s.Icon;
            return (
            <div
              key={s.n}
              style={{
                background: C.bg1,
                padding: "1.8rem 1.4rem",
              }}
            >
              <div style={{ marginBottom: "0.85rem", ...iconBox }}>
                <StepIcon size={20} style={{ color: "var(--orange)" }} />
              </div>
              <div
                style={{
                  fontFamily: "var(--font-syne)",
                  fontSize: "2.6rem",
                  fontWeight: 800,
                  color: C.bg4,
                  lineHeight: 1,
                  marginBottom: "0.9rem",
                }}
              >
                {s.n}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-syne)",
                  fontSize: "0.97rem",
                  fontWeight: 600,
                  color: C.white,
                  marginBottom: "0.4rem",
                }}
              >
                {s.title}
              </div>
              <div
                style={{
                  fontSize: "0.83rem",
                  color: C.muted,
                  lineHeight: 1.7,
                  fontWeight: 300,
                }}
              >
                {s.body}
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function DiffSection({ C }: { C: Record<string, string> }) {
  const rows = [
    {
      tag: "updated",
      tagColor: "#FF6600",
      key: "health.diet",
      old: "vegetarian",
      val: "vegan",
    },
    {
      tag: "new",
      tagColor: "#A8E063",
      key: "health.fitness",
      val: "marathon training — target Dec 2025",
    },
    {
      tag: "updated",
      tagColor: "#FF6600",
      key: "work.stack",
      old: "React, Node.js",
      val: "React, Node.js, Rust",
    },
  ];
  return (
    <section style={{ padding: "6rem 2rem" }}>
      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          display: "grid",
          gap: "3.5rem",
          alignItems: "center",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        }}
      >
        <div className="reveal">
          <p
            style={{
              fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
              fontSize: "0.63rem",
              color: C.orange,
              letterSpacing: "0.15em",
              textTransform: "uppercase",
              marginBottom: "1rem",
            }}
          >
            Update Preview
          </p>
          <h2
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.9rem,4vw,3.1rem)",
              fontWeight: 700,
              color: C.white,
              marginBottom: "0.9rem",
            }}
          >
            You see everything before it changes.
          </h2>
          <p
            style={{
              color: C.muted,
              fontSize: "0.97rem",
              lineHeight: 1.85,
              fontWeight: 300,
            }}
          >
            No silent updates. Every change is a diff you approve. The link is
            deleted when parsing completes.
          </p>
        </div>
        <div
          className="reveal overflow-hidden rounded-[12px] border"
          style={{ borderColor: C.border2, background: C.bg1 }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "0.7rem 1.1rem",
              borderBottom: `1px solid ${C.border}`,
              background: C.bg2,
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                fontSize: "0.62rem",
                color: C.muted,
              }}
            >
              memory_update_preview
            </span>
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                fontSize: "0.57rem",
                color: C.orange,
                background: "var(--orange-dim)",
                padding: "0.13rem 0.5rem",
                border: "1px solid rgba(255,102,0,0.25)",
                borderRadius: 100,
              }}
            >
              4 nodes · Work + Health
            </span>
          </div>
          <div
            style={{
              padding: "0.8rem 1.1rem",
              borderBottom: `1px solid ${C.border}`,
              background: "rgba(255,102,0,0.04)",
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                fontSize: "0.57rem",
                color: C.orange,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                display: "block",
                marginBottom: "0.3rem",
              }}
            >
              TL;DR
            </span>
            <span
              style={{ fontSize: "0.85rem", color: C.white, fontWeight: 300 }}
            >
              Diet updated to vegan. Marathon goal added. Stack extended with
              Rust.
            </span>
          </div>
          <div
            style={{
              padding: "0.65rem 1.1rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            {rows.map((d, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "0.65rem",
                  padding: "0.55rem 0.75rem",
                  border: `1px solid ${C.border}`,
                  borderRadius: 7,
                  fontSize: "0.78rem",
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                    fontSize: "0.53rem",
                    textTransform: "uppercase",
                    padding: "0.1rem 0.38rem",
                    border: `1px solid ${d.tagColor}55`,
                    color: d.tagColor,
                    background: `${d.tagColor}12`,
                    borderRadius: 3,
                    flexShrink: 0,
                  }}
                >
                  {d.tag}
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                      fontSize: "0.58rem",
                      color: C.muted,
                      marginBottom: 2,
                    }}
                  >
                    {d.key}
                  </div>
                  {"old" in d && d.old ? (
                    <div
                      style={{
                        color: C.faint,
                        textDecoration: "line-through",
                        fontSize: "0.73rem",
                      }}
                    >
                      {d.old}
                    </div>
                  ) : null}
                  <div style={{ color: C.white, fontWeight: 300 }}>{d.val}</div>
                </div>
              </div>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.45rem",
              padding: "0.8rem 1.1rem",
              borderTop: `1px solid ${C.border}`,
              background: C.bg2,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <button
              type="button"
              style={{
                background: C.orange,
                color: "#fff",
                border: "none",
                padding: "0.5rem 1.1rem",
                fontSize: "0.8rem",
                fontWeight: 500,
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Confirm Update
            </button>
            <button
              type="button"
              style={{
                background: "transparent",
                border: `1px solid ${C.border2}`,
                color: C.muted,
                padding: "0.5rem 1.1rem",
                fontSize: "0.8rem",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Reject All
            </button>
            <span
              style={{
                marginLeft: "auto",
                fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                fontSize: "0.57rem",
                color: C.faint,
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Trash2 size={14} style={{ flexShrink: 0, color: C.muted }} />
              link deleted
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

function PrivacySection({ C }: { C: Record<string, string> }) {
  const cards: {
    title: string;
    body: string;
    node: ReactNode;
  }[] = [
    {
      title: "Links Deleted Immediately",
      body: "Chat links are parsed and purged the moment we finish extracting. We store nodes — never the original conversation.",
      node: (
        <div style={{ ...iconBox, marginBottom: "0.9rem" }}>
          <Trash2 size={15} style={{ color: "var(--orange)" }} />
        </div>
      ),
    },
    {
      title: "Six Isolated Vaults",
      body: "Each vault is independently protected at the database level, not just in app logic.",
      node: (
        <div style={{ ...iconBox, marginBottom: "0.9rem" }}>
          <Layers size={15} style={{ color: "var(--orange)" }} />
        </div>
      ),
    },
    {
      title: "You Confirm Everything",
      body: "No silent updates. Every change is a diff you approve. You are always the last checkpoint.",
      node: (
        <div style={{ ...iconBox, marginBottom: "0.9rem" }}>
          <CheckCircle size={15} style={{ color: "var(--orange)" }} />
        </div>
      ),
    },
    {
      title: "Meaning, Not Data",
      body: "AI receives a structured summary — not your raw conversation. Private details stay in the vault.",
      node: (
        <div style={{ ...iconBox, marginBottom: "0.9rem" }}>
          <Shield size={15} style={{ color: "var(--orange)" }} />
        </div>
      ),
    },
  ];
  return (
    <section id="privacy" style={{ background: C.bg1, padding: "6rem 2rem" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div className="reveal">
          <h2
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.9rem,4vw,3.1rem)",
              fontWeight: 700,
              color: C.white,
            }}
          >
            Privacy by design
          </h2>
        </div>
        <div
          className="reveal mt-10 grid gap-px border"
          style={{
            borderColor: C.border,
            borderRadius: 12,
            overflow: "hidden",
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {cards.map((p) => (
            <div key={p.title} style={{ background: C.bg1, padding: "1.8rem" }}>
              {p.node}
              <div
                style={{
                  fontFamily: "var(--font-syne)",
                  fontSize: "0.97rem",
                  fontWeight: 600,
                  color: C.white,
                  marginBottom: "0.4rem",
                }}
              >
                {p.title}
              </div>
              <div
                style={{
                  fontSize: "0.83rem",
                  color: C.muted,
                  lineHeight: 1.7,
                  fontWeight: 300,
                }}
              >
                {p.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Manifesto({ C }: { C: Record<string, string> }) {
  return (
    <div
      style={{
        background: C.bg1,
        borderTop: `1px solid ${C.border}`,
        borderBottom: `1px solid ${C.border}`,
        padding: "6rem 2rem",
        textAlign: "center",
        position: "relative",
      }}
    >
      <p
        className="reveal mx-auto max-w-3xl px-4"
        style={{
          fontFamily: "var(--font-syne)",
          fontSize: "clamp(1.5rem,3.2vw,2.4rem)",
          fontWeight: 600,
          color: C.white,
          lineHeight: 1.35,
        }}
      >
        &quot;AI should{" "}
        <span
          style={{
            background: "linear-gradient(135deg,#FF6600,#F5C542)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          earn read access
        </span>{" "}
        — not assume it. Your memory is the most personal data you own.&quot;
      </p>
      <p
        className="reveal mt-6"
        style={{
          fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
          fontSize: "0.63rem",
          color: C.faint,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
        }}
      >
        — The Memorey Principle
      </p>
    </div>
  );
}

function PricingSection({
  C,
  annual,
  setAnnual,
}: {
  C: Record<string, string>;
  annual: boolean;
  setAnnual: (v: boolean) => void;
}) {
  return (
    <section id="pricing" style={{ padding: "6rem 2rem" }}>
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div className="reveal mb-12 text-center">
          <h2
            style={{
              fontFamily: "var(--font-syne)",
              fontSize: "clamp(1.9rem,4vw,3.1rem)",
              fontWeight: 700,
              color: C.white,
            }}
          >
            Simple pricing
          </h2>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              justifyContent: "center",
              marginTop: 24,
            }}
          >
            <span style={{ fontSize: 14, color: annual ? C.muted : C.white }}>
              Monthly
            </span>
            <button
              type="button"
              aria-label="Toggle annual billing"
              onClick={() => setAnnual(!annual)}
              style={{
                width: 44,
                height: 24,
                borderRadius: 12,
                background: annual ? C.orange : C.border2,
                border: "none",
                cursor: "pointer",
                position: "relative",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  top: 3,
                  left: annual ? 23 : 3,
                  width: 18,
                  height: 18,
                  borderRadius: "50%",
                  background: "white",
                  transition: "left 0.2s",
                }}
              />
            </button>
            <span style={{ fontSize: 14, color: annual ? C.white : C.muted }}>
              Annual{" "}
              <span
                style={{
                  background: "var(--orange-dim)",
                  color: C.orange,
                  fontSize: 11,
                  padding: "2px 7px",
                  borderRadius: 8,
                  fontWeight: 500,
                }}
              >
                Save ~21%
              </span>
            </span>
          </div>
        </div>
        <div
          className="reveal grid gap-px border"
          style={{
            borderColor: C.border,
            borderRadius: 12,
            overflow: "hidden",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          }}
        >
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              style={{
                background: plan.featured ? C.bg2 : C.bg1,
                padding: "2rem",
                position: "relative",
              }}
            >
              {plan.badge && (
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    right: 0,
                    fontFamily:
                      'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#fff",
                    background: C.orange,
                    padding: "0.24rem 0.7rem",
                    borderRadius: "0 0 0 6px",
                  }}
                >
                  {plan.badge}
                </div>
              )}
              <div
                style={{
                  fontFamily:
                    'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  marginBottom: "0.8rem",
                  color: plan.featured ? C.orange : C.muted,
                }}
              >
                {plan.name}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-syne)",
                  fontSize: "clamp(2.4rem, 3.5vw, 3.2rem)",
                  fontWeight: 800,
                  letterSpacing: "-0.05em",
                  fontVariantNumeric: "tabular-nums",
                  fontFeatureSettings: '"tnum"',
                  color: C.white,
                  lineHeight: 1,
                }}
              >
                <sup style={{ fontSize: "1.1rem" }}>$</sup>
                {annual ? plan.annualPrice : plan.monthlyPrice}
                <sub style={{ fontSize: "0.85rem", color: C.muted }}>/mo</sub>
              </div>
              {annual && plan.monthlyPrice > 0 && (
                <div
                  style={{
                    fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
                    fontSize: "0.6rem",
                    color: C.muted,
                  }}
                >
                  billed ${plan.annualPrice * 12} / year
                </div>
              )}
              <div
                style={{
                  fontSize: "0.88rem",
                  lineHeight: 1.7,
                  fontWeight: 400,
                  color: C.muted,
                  margin: "1rem 0",
                  paddingBottom: "1rem",
                  borderBottom: `1px solid ${C.border}`,
                }}
              >
                {plan.tagline}
              </div>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 1.6rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.5rem",
                }}
              >
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      fontSize: "0.85rem",
                      lineHeight: 1.75,
                      color: C.text,
                      fontWeight: 400,
                      letterSpacing: "0.01em",
                      display: "flex",
                      gap: "0.45rem",
                    }}
                  >
                    <Check
                      size={13}
                      style={{
                        color: C.orange,
                        flexShrink: 0,
                        marginTop: 3,
                      }}
                      strokeWidth={2.5}
                    />
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/login"
                style={{
                  display: "block",
                  width: "100%",
                  padding: "0.76rem",
                  fontSize: "0.86rem",
                  fontWeight: 500,
                  textAlign: "center",
                  textDecoration: "none",
                  borderRadius: 7,
                  background:
                    plan.ctaStyle === "solid" ? C.orange : "transparent",
                  color: plan.ctaStyle === "solid" ? "#fff" : C.muted,
                  border:
                    plan.ctaStyle === "ghost"
                      ? `1px solid ${C.border2}`
                      : "none",
                  boxShadow:
                    plan.ctaStyle === "solid"
                      ? `0 4px 20px ${C.orangeGlow}`
                      : "none",
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta({ C }: { C: Record<string, string> }) {
  return (
    <section style={{ padding: "8rem 2rem", textAlign: "center" }}>
      <div className="reveal">
        <h2
          style={{
            fontFamily: "var(--font-syne)",
            fontSize: "clamp(2rem,4.5vw,3.5rem)",
            fontWeight: 700,
            color: C.white,
            maxWidth: 580,
            margin: "0 auto 1rem",
          }}
        >
          Own your memory. Brief every AI.
        </h2>
        <p
          style={{
            color: C.muted,
            maxWidth: 420,
            margin: "0 auto 2rem",
            fontSize: "0.97rem",
          }}
        >
          No credit card required for free tier.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            background: C.orange,
            color: "#fff",
            padding: "0.88rem 2.2rem",
            fontWeight: 500,
            borderRadius: 8,
            textDecoration: "none",
            boxShadow: `0 4px 32px ${C.orangeGlow}`,
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            Start remembering
            <ArrowRight size={16} strokeWidth={2} />
          </span>
        </a>
      </div>
    </section>
  );
}

function Footer({ C }: { C: Record<string, string> }) {
  return (
    <footer
      style={{
        borderTop: `1px solid ${C.border}`,
        padding: "1.7rem 2rem",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1rem",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          fontFamily: "var(--font-syne)",
          fontWeight: 700,
          color: C.muted,
        }}
      >
        <div
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: C.orange,
          }}
        />
        memorey
      </div>
      <div style={{ display: "flex", gap: "1.4rem" }}>
        {[
          { label: "Privacy", href: "/privacy" },
          { label: "Terms", href: "/terms" },
          { label: "Contact", href: "/contact" },
        ].map((l) => (
          <a
            key={l.label}
            href={l.href}
            style={{ fontSize: "0.8rem", color: C.muted, textDecoration: "none" }}
          >
            {l.label}
          </a>
        ))}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
          fontSize: "0.58rem",
          color: C.faint,
        }}
      >
        © {new Date().getFullYear()} Memorey
      </div>
    </footer>
  );
}
