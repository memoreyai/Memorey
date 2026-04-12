import type { Transform } from "../types/canvas.types";
import { MIN_SCALE, MAX_SCALE } from "../constants/layout";

export function handleWheel(
  e: WheelEvent,
  canvasRect: DOMRect,
  transform: Transform
): void {
  e.preventDefault();

  const x = e.clientX - canvasRect.left;
  const y = e.clientY - canvasRect.top;

  const isHorizontal = Math.abs(e.deltaX) > Math.abs(e.deltaY);
  const isShift = e.shiftKey && !isHorizontal;
  const isCtrl = e.ctrlKey && !isHorizontal;

  if (isHorizontal) {
    transform.x -= e.deltaX;
    return;
  }

  if (isShift) {
    transform.x -= e.deltaY * 0.8;
    return;
  }

  if (isCtrl) {
    transform.y -= e.deltaY * 0.8;
    return;
  }

  const factor = e.deltaY > 0 ? 0.92 : 1.08;
  const newScale = Math.min(
    MAX_SCALE,
    Math.max(MIN_SCALE, transform.scale * factor)
  );

  transform.x = x - (x - transform.x) * (newScale / transform.scale);
  transform.y = y - (y - transform.y) * (newScale / transform.scale);
  transform.scale = newScale;
}
