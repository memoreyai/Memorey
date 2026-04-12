import type { MutableRefObject } from "react";
import type { Transform } from "../types/canvas.types";
import type { CanvasDims } from "../types/canvas.types";
import type { MasterCanvasRegion } from "./types";
import {
  MASTER_W,
  MASTER_H,
  VAULT_HEADER_H,
  NODE_W,
  NODE_H,
} from "../constants/dimensions";
import { VAULT_HEADER_MAX_W } from "../canvas/vaultHeaderLayout";
import { MIN_SCALE, MAX_SCALE, FIT_ANIM_DURATION_MS } from "../constants/layout";

export interface FitAnimState {
  startTime: number;
  duration: number;
  from: Transform;
  to: Transform;
}

export function fitCanvasToNodes(
  nodePositions: Map<string, { x: number; y: number }>,
  vaultGroupPositions: Map<string, { x: number; y: number }>,
  dims: CanvasDims,
  padding = 120,
  canvasRegions?: Map<string, MasterCanvasRegion>
): Transform {
  let minX = -MASTER_W / 2;
  let maxX = MASTER_W / 2;
  let minY = -MASTER_H / 2;
  let maxY = MASTER_H / 2;

  if (canvasRegions && canvasRegions.size > 0) {
    for (const [, r] of canvasRegions) {
      minX = Math.min(minX, r.cx - r.halfW);
      maxX = Math.max(maxX, r.cx + r.halfW);
      minY = Math.min(minY, r.cy - r.halfH);
      maxY = Math.max(maxY, r.cy + r.halfH);
    }
  }

  for (const [, p] of vaultGroupPositions) {
    minX = Math.min(minX, p.x - VAULT_HEADER_MAX_W / 2);
    maxX = Math.max(maxX, p.x + VAULT_HEADER_MAX_W / 2);
    minY = Math.min(minY, p.y - VAULT_HEADER_H / 2);
    maxY = Math.max(maxY, p.y + VAULT_HEADER_H / 2 + 200);
  }

  for (const [, p] of nodePositions) {
    minX = Math.min(minX, p.x - NODE_W / 2);
    maxX = Math.max(maxX, p.x + NODE_W / 2);
    minY = Math.min(minY, p.y - NODE_H / 2);
    maxY = Math.max(maxY, p.y + NODE_H / 2);
  }

  const worldW = Math.max(80, maxX - minX);
  const worldH = Math.max(80, maxY - minY);
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;

  const scale = Math.min(
    MAX_SCALE,
    Math.max(
      MIN_SCALE,
      Math.min(
        (dims.W - padding * 2) / worldW,
        (dims.H - padding * 2) / worldH
      )
    )
  );

  return {
    scale,
    x: dims.W / 2 - cx * scale,
    y: dims.H / 2 - cy * scale,
  };
}

export function startFitAnimation(
  fitAnimRef: MutableRefObject<FitAnimState | null>,
  from: Transform,
  to: Transform
): void {
  fitAnimRef.current = {
    startTime: performance.now(),
    duration: FIT_ANIM_DURATION_MS,
    from: { ...from },
    to: { ...to },
  };
}

export function panToNode(
  nodePos: { x: number; y: number },
  dims: CanvasDims,
  transform: Transform
): Transform {
  return {
    ...transform,
    x: dims.W / 2 - nodePos.x * transform.scale,
    y: dims.H / 2 - nodePos.y * transform.scale,
  };
}
