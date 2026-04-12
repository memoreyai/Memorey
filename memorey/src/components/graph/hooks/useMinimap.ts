"use client";

import { useCallback, type MutableRefObject } from "react";
import type { Transform } from "../types/canvas.types";
import type { CanvasDims } from "../types/canvas.types";
import { MASTER_W, MASTER_H, NODE_W, NODE_H } from "../constants/dimensions";

export function useMinimap(opts: {
  transformRef: MutableRefObject<Transform>;
  dimsRef: MutableRefObject<CanvasDims>;
  minimapBoundsRef: MutableRefObject<{ x: number; y: number; w: number; h: number }>;
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  vaultGroupPositionsRef: MutableRefObject<
    Map<string, { x: number; y: number }>
  >;
}): { handleMinimapClick: (clientX: number, clientY: number) => void } {
  const handleMinimapClick = useCallback(
    (clientX: number, clientY: number) => {
      const {
        minimapBoundsRef,
        nodePositionsRef,
        vaultGroupPositionsRef,
        dimsRef,
        transformRef,
      } = opts;
      const { x: mx, y: my, w: mw, h: mh } = minimapBoundsRef.current;
      const lx = clientX - mx;
      const ly = clientY - my;
      if (lx < 0 || ly < 0 || lx > mw || ly > mh) return;

      let minX = -MASTER_W;
      let maxX = MASTER_W;
      let minY = -MASTER_H;
      let maxY = MASTER_H;
      for (const [, p] of nodePositionsRef.current) {
        minX = Math.min(minX, p.x - NODE_W);
        maxX = Math.max(maxX, p.x + NODE_W);
        minY = Math.min(minY, p.y - NODE_H);
        maxY = Math.max(maxY, p.y + NODE_H);
      }
      for (const [, p] of vaultGroupPositionsRef.current) {
        minX = Math.min(minX, p.x - 100);
        maxX = Math.max(maxX, p.x + 100);
        minY = Math.min(minY, p.y - 80);
        maxY = Math.max(maxY, p.y + 120);
      }
      const bw = Math.max(400, maxX - minX);
      const bh = Math.max(400, maxY - minY);
      const pad = 40;
      const scale = Math.min(mw / (bw + pad * 2), mh / (bh + pad * 2));
      const ox = mw / 2 - ((minX + maxX) / 2) * scale;
      const oy = mh / 2 - ((minY + maxY) / 2) * scale;

      const wx = (lx - ox) / scale;
      const wy = (ly - oy) / scale;
      const { W, H } = dimsRef.current;
      const tr = transformRef.current;
      transformRef.current = {
        ...tr,
        x: W / 2 - wx * tr.scale,
        y: H / 2 - wy * tr.scale,
      };
    },
    [opts]
  );

  return { handleMinimapClick };
}
