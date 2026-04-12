"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { landingNodeHalfExtent } from "./landingGraphCanvasDraw";
import type { GraphNode } from "./landingPageData";
import { VAULTS } from "./landingPageData";

type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

function landingNodeToScreen(
  wx: number,
  wy: number,
  W: number,
  H: number,
  scale: number,
  offX: number,
  offY: number,
) {
  return {
    x: wx * scale + W / 2 + offX,
    y: wy * scale + H / 2 + offY,
  };
}

function estimatePeekCardScreenSize(node: GraphNode, scale: number) {
  const { hw, hh } = landingNodeHalfExtent(node);
  return { sw: hw * scale * 2, sh: hh * scale * 2 };
}

function clampExpandedRect(
  box: Box,
  targetW: number,
  targetH: number,
  containerW: number,
  containerH: number,
): { left: number; top: number; width: number; height: number } {
  let left = box.cx - targetW / 2;
  let top = box.cy - targetH / 2;
  const pad = 8;
  left = Math.max(pad, Math.min(left, containerW - targetW - pad));
  top = Math.max(pad, Math.min(top, containerH - targetH - pad));
  return { left, top, width: targetW, height: targetH };
}

export function LandingNodePeek({
  peekNodeId,
  nodesRef,
  scaleRef,
  offXRef,
  offYRef,
  canvasRef,
  onClose,
  onOpenFull,
}: {
  peekNodeId: number | null;
  nodesRef: MutableRefObject<GraphNode[]>;
  scaleRef: MutableRefObject<number>;
  offXRef: MutableRefObject<number>;
  offYRef: MutableRefObject<number>;
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  onClose: () => void;
  onOpenFull: (node: GraphNode) => void;
}) {
  const [box, setBox] = useState<Box | null>(null);
  const lastKey = useRef("");

  useEffect(() => {
    if (peekNodeId == null) {
      lastKey.current = "";
      queueMicrotask(() => setBox(null));
      return;
    }

    let rafId = 0;
    const tick = () => {
      const canvas = canvasRef.current;
      const node = nodesRef.current.find((n) => n.id === peekNodeId);
      if (!canvas || !node) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const rect = canvas.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      if (W < 2 || H < 2) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const scale = scaleRef.current;
      const offX = offXRef.current;
      const offY = offYRef.current;
      const { sw, sh } = estimatePeekCardScreenSize(node, scale);
      const p = landingNodeToScreen(node.x, node.y, W, H, scale, offX, offY);
      const left = p.x - sw / 2;
      const top = p.y - sh / 2;
      const key = `${left.toFixed(2)}|${top.toFixed(2)}|${sw.toFixed(2)}|${sh.toFixed(2)}`;
      if (key !== lastKey.current) {
        lastKey.current = key;
        setBox({ left, top, width: sw, height: sh, cx: p.x, cy: p.y });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [peekNodeId, canvasRef, nodesRef, scaleRef, offXRef, offYRef]);

  const node =
    peekNodeId == null
      ? null
      : nodesRef.current.find((n) => n.id === peekNodeId) ?? null;

  const [expanded, setExpanded] = useState(false);
  const didPlayEntrance = useRef(false);

  useLayoutEffect(() => {
    if (!box || !node) {
      queueMicrotask(() => setExpanded(false));
      return;
    }
    if (didPlayEntrance.current) return;
    didPlayEntrance.current = true;
    queueMicrotask(() => setExpanded(false));
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setExpanded(true));
    });
    return () => cancelAnimationFrame(id);
  }, [box, node]);

  useEffect(() => {
    didPlayEntrance.current = false;
  }, [peekNodeId]);

  if (!node || !box) return null;

  const canvas = canvasRef.current;
  const W = canvas?.getBoundingClientRect().width ?? 400;
  const H = canvas?.getBoundingClientRect().height ?? 520;
  const targetW = Math.min(320, Math.max(box.width * 1.12, 260), W - 16);
  const targetH = Math.min(
    Math.max(200, box.height * 2.5),
    Math.floor(H * 0.55),
  );
  const layout = expanded
    ? clampExpandedRect(box, targetW, targetH, W, H)
    : {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };

  const vaultLabel = VAULTS[node.vault]?.label ?? node.vault;
  const accent = VAULTS[node.vault]?.color ?? "var(--orange)";

  return (
    <>
      <button
        type="button"
        aria-label="Close preview"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 35,
          border: "none",
          padding: 0,
          margin: 0,
          cursor: "default",
          background: "rgba(0,0,0,0.22)",
          pointerEvents: "auto",
        }}
      />
      <div
        className="flex flex-col overflow-hidden shadow-lg"
        style={{
          position: "absolute",
          zIndex: 40,
          left: layout.left,
          top: layout.top,
          width: layout.width,
          height: layout.height,
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: 12,
          boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
          padding: expanded ? 12 : 8,
          pointerEvents: "auto",
          transition:
            "left 0.22s cubic-bezier(0.22, 1, 0.36, 1), top 0.22s cubic-bezier(0.22, 1, 0.36, 1), width 0.22s cubic-bezier(0.22, 1, 0.36, 1), height 0.22s cubic-bezier(0.22, 1, 0.36, 1), padding 0.22s ease",
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Memory preview"
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: expanded ? 8 : 4,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              fontSize: expanded ? 12 : 10,
              fontWeight: 600,
              color: accent,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            {vaultLabel}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--muted)",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
              flexShrink: 0,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div
          style={{
            fontSize: expanded ? 13 : 11,
            fontWeight: 600,
            color: "var(--white)",
            lineHeight: 1.3,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: expanded ? 3 : 2,
            WebkitBoxOrient: "vertical",
            marginBottom: expanded ? 6 : 2,
          }}
        >
          {node.label}
        </div>
        {expanded ? (
          <>
            {node.ogImage ? (
              <div
                style={{
                  flexShrink: 0,
                  borderRadius: 8,
                  overflow: "hidden",
                  border: "1px solid var(--border2)",
                  marginBottom: 8,
                  maxHeight: 160,
                  background: "var(--bg2)",
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={node.ogImage}
                  alt=""
                  style={{
                    display: "block",
                    width: "100%",
                    height: "auto",
                    maxHeight: 160,
                    objectFit: "cover",
                  }}
                />
              </div>
            ) : null}
            <div
              style={{
                fontSize: 12,
                color: "var(--text)",
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                whiteSpace: "pre-wrap",
                opacity: 0.92,
              }}
            >
              {(node.detail || "").slice(0, 400)}
              {(node.detail || "").length > 400 ? "…" : ""}
            </div>
            <button
              type="button"
              onClick={() => onOpenFull(node)}
              style={{
                marginTop: 10,
                padding: "6px 10px",
                background: "var(--orange)",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Open export
            </button>
          </>
        ) : (
          <div
            style={{
              fontSize: 10,
              color: "var(--muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            …
          </div>
        )}
      </div>
    </>
  );
}
