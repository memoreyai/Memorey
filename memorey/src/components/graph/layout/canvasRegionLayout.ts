/**
 * Canvas layout: structured column/grid algorithm lives in {@link structuredAutoLayout}.
 * Names `computeUnifiedCanvasLayout` / `allocateCanvasRegions` are kept for callers.
 */
export {
  computeStructuredCanvasLayout as computeUnifiedCanvasLayout,
  allocateStructuredCanvasRegions as allocateCanvasRegions,
  CANVAS_REGION_GAP,
  statsForCanvas,
  type CanvasLayoutStats,
  type StructuredLayoutResult,
} from "./structuredAutoLayout";
