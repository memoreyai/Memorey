import type { DragState } from "../types/canvas.types";

export function createPanDrag(
  mx: number,
  my: number,
  ox: number,
  oy: number
): DragState {
  return {
    type: "pan",
    startMx: mx,
    startMy: my,
    startOx: ox,
    startOy: oy,
    moved: false,
  };
}

export function createNodeDrag(
  mx: number,
  my: number,
  nodeId: string,
  nx: number,
  ny: number
): DragState {
  return {
    type: "node",
    nodeId,
    startMx: mx,
    startMy: my,
    startOx: 0,
    startOy: 0,
    startNx: nx,
    startNy: ny,
    moved: false,
  };
}

export function updateDragMoved(
  drag: DragState,
  mx: number,
  my: number
): void {
  if (Math.hypot(mx - drag.startMx, my - drag.startMy) > 4) {
    drag.moved = true;
  }
}

export function isClickGesture(drag: DragState): boolean {
  return !drag.moved;
}
