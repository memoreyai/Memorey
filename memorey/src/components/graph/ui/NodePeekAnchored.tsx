"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type MutableRefObject,
} from "react";
import { useGraphStore } from "@/store/graphStore";
import { graphNodeCardWorldDimensions } from "../lib/graphNodeDimensions";
import type { Transform } from "../types/canvas.types";

type Box = {
  left: number;
  top: number;
  width: number;
  height: number;
  cx: number;
  cy: number;
};

function usePeekScreenBox(
  peekNodeId: string | null,
  transformRef: MutableRefObject<Transform>,
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>
): Box | null {
  const [box, setBox] = useState<Box | null>(null);
  const lastKey = useRef("");

  useEffect(() => {
    if (!peekNodeId) {
      lastKey.current = "";
      queueMicrotask(() => setBox(null));
      return;
    }

    let rafId = 0;
    const tick = () => {
      const graphNode = useGraphStore
        .getState()
        .graphData.nodes.find((n) => n.id === peekNodeId);
      const pos = nodePositionsRef.current.get(peekNodeId);
      const tr = transformRef.current;
      const { w, h } = graphNode
        ? graphNodeCardWorldDimensions(graphNode)
        : { w: 200, h: 70 };
      if (!pos) {
        rafId = requestAnimationFrame(tick);
        return;
      }
      const sw = w * tr.scale;
      const sh = h * tr.scale;
      const cx = pos.x * tr.scale + tr.x;
      const cy = pos.y * tr.scale + tr.y;
      const left = cx - sw / 2;
      const top = cy - sh / 2;
      const key = `${left.toFixed(2)}|${top.toFixed(2)}|${sw.toFixed(2)}|${sh.toFixed(2)}`;
      if (key !== lastKey.current) {
        lastKey.current = key;
        setBox({ left, top, width: sw, height: sh, cx, cy });
      }
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [peekNodeId, transformRef, nodePositionsRef]);

  return box;
}

function clampExpandedRect(
  box: Box,
  targetW: number,
  targetH: number,
  containerW: number,
  containerH: number
): { left: number; top: number; width: number; height: number } {
  let left = box.cx - targetW / 2;
  let top = box.cy - targetH / 2;
  const pad = 8;
  left = Math.max(pad, Math.min(left, containerW - targetW - pad));
  top = Math.max(pad, Math.min(top, containerH - targetH - pad));
  return { left, top, width: targetW, height: targetH };
}

export function NodePeekAnchored({
  nodeId,
  transformRef,
  nodePositionsRef,
  canvasW,
  canvasH,
  onClose,
  onOpenFull,
}: {
  nodeId: string;
  transformRef: MutableRefObject<Transform>;
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  canvasW: number;
  canvasH: number;
  onClose: () => void;
  onOpenFull: () => void;
}) {
  const box = usePeekScreenBox(nodeId, transformRef, nodePositionsRef);
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === nodeId));
  const [expanded, setExpanded] = useState(false);
  const didPlayEntrance = useRef(false);

  useLayoutEffect(() => {
    if (!box) {
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
  }, [box]);

  if (!node || !box) return null;

  const W = canvasW;
  const H = canvasH;
  const targetW = Math.min(320, Math.max(box.width * 1.1, 260), W - 16);
  const targetH = Math.min(
    Math.max(200, box.height * 2.4),
    Math.floor(H * 0.5)
  );
  const layout = expanded
    ? clampExpandedRect(box, targetW, targetH, W, H)
    : {
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      };

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
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-lg)",
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
              fontSize: expanded ? 13 : 11,
              fontWeight: 600,
              color: "var(--text)",
              lineHeight: 1.3,
              overflow: "hidden",
              display: "-webkit-box",
              WebkitLineClamp: expanded ? 3 : 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {node.title || "Untitled"}
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
        {expanded ? (
          <>
            {node.ogImage ? (
              <div
                style={{
                  flexShrink: 0,
                  borderRadius: "var(--r-md)",
                  overflow: "hidden",
                  border: "1px solid var(--border2)",
                  marginBottom: 8,
                  maxHeight: 200,
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
                    maxHeight: 200,
                    objectFit: "cover",
                  }}
                />
              </div>
            ) : null}
            <div
              style={{
                fontSize: 12,
                color: "var(--text2)",
                flex: 1,
                minHeight: 0,
                overflow: "auto",
                whiteSpace: "pre-wrap",
              }}
            >
              {(node.value || "").slice(0, 400)}
              {(node.value || "").length > 400 ? "…" : ""}
            </div>
            <button
              type="button"
              onClick={onOpenFull}
              style={{
                marginTop: 10,
                padding: "6px 10px",
                background: "var(--orange)",
                border: "none",
                borderRadius: "var(--r-md)",
                color: "#fff",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                flexShrink: 0,
              }}
            >
              Open full details
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
