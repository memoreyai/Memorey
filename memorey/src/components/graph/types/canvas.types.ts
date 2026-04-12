export interface Transform {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasDims {
  W: number;
  H: number;
}

export interface WorldPoint {
  x: number;
  y: number;
}

export type DragType = "pan" | "node";

export interface DragState {
  type: DragType;
  nodeId?: string;
  startMx: number;
  startMy: number;
  startOx: number;
  startOy: number;
  startNx?: number;
  startNy?: number;
  moved: boolean;
}

export interface PointerDownRecord {
  nodeId: string | null;
  plus: boolean;
  x: number;
  y: number;
}

export interface SelectionBox {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  active: boolean;
}

export type SearchMode = "idle" | "live" | "locked";
export type EdgeStyle =
  | "orthogonal-dashed"
  | "orthogonal-dotted"
  | "curved-dashed"
  | "curved-dotted";
