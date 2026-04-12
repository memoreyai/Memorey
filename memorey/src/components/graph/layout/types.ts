import type { MutableRefObject } from "react";

export type CanvasMeta = { id: string; emoji: string | null; name: string };

export interface MasterCanvasRegion {
  canvasId: string;
  cx: number;
  cy: number;
  halfW: number;
  halfH: number;
  tintColor: string;
  emoji: string | null;
  name: string;
  /** Hub position for layout + virtual master node (world coords). */
  masterHubX: number;
  masterHubY: number;
  masterNodeBio?: string | null;
  masterNodeColor: string;
}

/** Snapshot of layout before canvas-region drag offsets (session-only). */
export type RegionLayoutSnapshot = {
  nodePositions: Map<string, { x: number; y: number }>;
  vaultGroupPositions: Map<string, { x: number; y: number }>;
  nodeRelativePositions: Map<string, { dx: number; dy: number }>;
  regions: Map<string, MasterCanvasRegion>;
};

export interface VaultLayoutRefs {
  vaultGroupPositionsRef: MutableRefObject<
    Map<string, { x: number; y: number }>
  >;
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  nodeRelativePositionsRef: MutableRefObject<
    Map<string, { dx: number; dy: number }>
  >;
  canvasRegionsRef: MutableRefObject<Map<string, MasterCanvasRegion>>;
  /** Per-canvas drag offset for master view (not persisted). */
  canvasRegionOffsetsRef: MutableRefObject<
    Map<string, { dx: number; dy: number }>
  >;
  /** Base layout before offsets; used to reapply after region drag. */
  regionLayoutBaseRef: MutableRefObject<RegionLayoutSnapshot | null>;
}


export interface LayoutAnimFrame {
  from: Map<string, { x: number; y: number }>;
  to: Map<string, { x: number; y: number }>;
  startTime: number;
  duration: number;
}
