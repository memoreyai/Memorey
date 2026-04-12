import type { Transform } from "../types/canvas.types";

export function screenToWorld(
  sx: number,
  sy: number,
  transform: Transform
): { x: number; y: number } {
  return {
    x: (sx - transform.x) / transform.scale,
    y: (sy - transform.y) / transform.scale,
  };
}

export function worldToScreen(
  wx: number,
  wy: number,
  transform: Transform
): { x: number; y: number } {
  return {
    x: wx * transform.scale + transform.x,
    y: wy * transform.scale + transform.y,
  };
}

export function getVisibleCentre(
  transform: Transform,
  dims: { W: number; H: number }
): { x: number; y: number } {
  return {
    x: (dims.W / 2 - transform.x) / transform.scale,
    y: (dims.H / 2 - transform.y) / transform.scale,
  };
}
