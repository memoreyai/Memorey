"use client";

import { useEffect, type RefObject, type MutableRefObject } from "react";
import type { Transform } from "../types/canvas.types";
import type { CanvasDims } from "../types/canvas.types";

export function useCanvasSetup(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  containerRef: RefObject<HTMLDivElement | null>,
  transformRef: MutableRefObject<Transform>,
  dimsRef: MutableRefObject<CanvasDims>,
  dprRef: MutableRefObject<number>,
  onDimsChange?: (dims: CanvasDims) => void
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    const div = containerRef.current;
    if (!canvas || !div) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      dprRef.current = dpr;
      const parent = canvas.parentElement;
      const rect = parent?.getBoundingClientRect() ?? div.getBoundingClientRect();
      const W = rect.width;
      const H = rect.height;
      if (W <= 0 || H <= 0) return;
      const oldW = dimsRef.current.W;
      const oldH = dimsRef.current.H;
      if (oldW > 0) {
        transformRef.current.x += (W - oldW) / 2;
        transformRef.current.y += (H - oldH) / 2;
      }
      const nextDims = { W, H };
      dimsRef.current = nextDims;
      onDimsChange?.(nextDims);
      canvas.width = Math.floor(W * dpr);
      canvas.height = Math.floor(H * dpr);
      canvas.style.width = `${W}px`;
      canvas.style.height = `${H}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas.parentElement ?? canvas);
    return () => ro.disconnect();
  }, [canvasRef, containerRef, dimsRef, dprRef, transformRef, onDimsChange]);
}
