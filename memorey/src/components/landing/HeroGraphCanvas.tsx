"use client";

import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number };

const NODE_COUNT = 40;
const MAX_DIST = 120;
const DOT = "rgba(93, 202, 165, 0.4)";

/** Fills parent; lightweight graph dots + lines. Pauses off-screen / hidden tab / reduced motion. */
export function HeroGraphCanvas() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduced) {
      const wrapEl = wrap;
      const canvasEl = canvas;
      const drawCtx = ctx;
      function drawStatic() {
        if (!wrapEl || !canvasEl) return;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = wrapEl.clientWidth;
        const h = wrapEl.clientHeight;
        if (w < 1 || h < 1) return;
        canvasEl.width = Math.floor(w * dpr);
        canvasEl.height = Math.floor(h * dpr);
        canvasEl.style.width = `${w}px`;
        canvasEl.style.height = `${h}px`;
        drawCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const staticNodes = Array.from({ length: NODE_COUNT }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
        }));
        drawCtx.clearRect(0, 0, w, h);
        for (let i = 0; i < staticNodes.length; i++) {
          for (let j = i + 1; j < staticNodes.length; j++) {
            const a = staticNodes[i];
            const b = staticNodes[j];
            const d = Math.hypot(a.x - b.x, a.y - b.y);
            if (d < MAX_DIST) {
              const t = 1 - d / MAX_DIST;
              drawCtx.strokeStyle = `rgba(93, 202, 165, ${0.15 * t})`;
              drawCtx.lineWidth = 0.5;
              drawCtx.beginPath();
              drawCtx.moveTo(a.x, a.y);
              drawCtx.lineTo(b.x, b.y);
              drawCtx.stroke();
            }
          }
        }
        drawCtx.fillStyle = DOT;
        for (const n of staticNodes) {
          drawCtx.beginPath();
          drawCtx.arc(n.x, n.y, 1.15, 0, Math.PI * 2);
          drawCtx.fill();
        }
      }
      const ro = new ResizeObserver(drawStatic);
      ro.observe(wrapEl);
      drawStatic();
      return () => ro.disconnect();
    }

    const wrapA = wrap;
    const canvasA = canvas;
    const ctxA = ctx;

    let nodes: Node[] = [];
    let raf = 0;
    let visible = true;

    const io = new IntersectionObserver(
      ([e]) => {
        visible = e.isIntersecting;
      },
      { threshold: 0.05 }
    );
    io.observe(wrapA);

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = wrapA.clientWidth;
      const h = wrapA.clientHeight;
      if (w < 1 || h < 1) return;
      canvasA.width = Math.floor(w * dpr);
      canvasA.height = Math.floor(h * dpr);
      canvasA.style.width = `${w}px`;
      canvasA.style.height = `${h}px`;
      ctxA.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = Array.from({ length: NODE_COUNT }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.28,
        vy: (Math.random() - 0.5) * 0.28,
      }));
    }

    const ro = new ResizeObserver(resize);
    ro.observe(wrapA);
    resize();

    function tick() {
      if (!visible || document.hidden) {
        raf = requestAnimationFrame(tick);
        return;
      }
      const w = wrapA.clientWidth;
      const h = wrapA.clientHeight;
      if (w < 1 || h < 1) {
        raf = requestAnimationFrame(tick);
        return;
      }

      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x <= 0 || n.x >= w) n.vx *= -1;
        if (n.y <= 0 || n.y >= h) n.vy *= -1;
        n.x = Math.max(0, Math.min(w, n.x));
        n.y = Math.max(0, Math.min(h, n.y));
      }

      ctxA.clearRect(0, 0, w, h);

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < MAX_DIST) {
            const t = 1 - d / MAX_DIST;
            ctxA.strokeStyle = `rgba(93, 202, 165, ${0.15 * t})`;
            ctxA.lineWidth = 0.5;
            ctxA.beginPath();
            ctxA.moveTo(a.x, a.y);
            ctxA.lineTo(b.x, b.y);
            ctxA.stroke();
          }
        }
      }

      ctxA.fillStyle = DOT;
      for (const n of nodes) {
        ctxA.beginPath();
        ctxA.arc(n.x, n.y, 1.15, 0, Math.PI * 2);
        ctxA.fill();
      }

      raf = requestAnimationFrame(tick);
    }

    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
    };
  }, []);

  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  );
}
