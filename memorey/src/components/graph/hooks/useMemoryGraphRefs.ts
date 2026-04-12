"use client";

import { useMemo, useRef, type MutableRefObject, type RefObject } from "react";
import type { Transform } from "../types/canvas.types";
import type { CanvasDims, DragState, PointerDownRecord, SelectionBox } from "../types/canvas.types";
import type { MasterProfile } from "../types/graph.types";
import type {
  VaultLayoutRefs,
  MasterCanvasRegion,
  RegionLayoutSnapshot,
} from "../layout/types";

export type MemoryGraphRefs = {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  transformRef: MutableRefObject<Transform>;
  dimsRef: MutableRefObject<CanvasDims>;
  dprRef: MutableRefObject<number>;
  frameCountRef: MutableRefObject<number>;
  vaultGroupPositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  nodeRelativePositionsRef: MutableRefObject<Map<string, { dx: number; dy: number }>>;
  canvasRegionsRef: MutableRefObject<Map<string, MasterCanvasRegion>>;
  vaultLayoutRefs: VaultLayoutRefs;
  collapsedVaultsRef: MutableRefObject<Set<string>>;
  hoveredNodeIdRef: MutableRefObject<string | null>;
  selectedNodeIdRef: MutableRefObject<string | null>;
  selectedNodesRef: MutableRefObject<Set<string>>;
  peekNodeIdRef: MutableRefObject<string | null>;
  isShiftHeld: MutableRefObject<boolean>;
  cursorWorldRef: MutableRefObject<{ x: number; y: number } | null>;
  selectionBoxRef: MutableRefObject<SelectionBox | null>;
  userIdRef: MutableRefObject<string | null>;
  profileRef: MutableRefObject<MasterProfile | null>;
  /** True when master node bio is non-empty (dynamic hit box height). */
  masterHasBioRef: MutableRefObject<boolean>;
  avatarImageRef: MutableRefObject<CanvasImageSource | null>;
  quickCreateOpenRef: MutableRefObject<boolean>;
  emptyVaultHoverIdRef: MutableRefObject<string | null>;
  gearHoverIdRef: MutableRefObject<string | null>;
  vaultPlusHoverIdRef: MutableRefObject<string | null>;
  draggingVaultIdRef: MutableRefObject<string | null>;
  vaultDragRef: MutableRefObject<{
    vaultKey: string;
    g0: { x: number; y: number };
    p0: { sx: number; sy: number };
  } | null>;
  /** Master graph: last canvas from selected/dragged node (quick-create default). */
  masterLastCanvasIdRef: MutableRefObject<string | null>;
  dragStateRef: MutableRefObject<DragState | null>;
  pointerDownRef: MutableRefObject<PointerDownRecord | null>;
  contextMenuOpenRef: MutableRefObject<boolean>;
  searchExpandedRef: MutableRefObject<boolean>;
  fileNodeInputRef: RefObject<HTMLInputElement | null>;
  pendingNodeDropRef: MutableRefObject<{ x: number; y: number } | null>;
  regionDragRef: MutableRefObject<{
    canvasId: string;
    start: { sx: number; sy: number };
    offset0: { dx: number; dy: number };
  } | null>;
};

export function useMemoryGraphRefs(): MemoryGraphRefs {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transformRef = useRef<Transform>({ x: 0, y: 0, scale: 0.85 });
  const dimsRef = useRef<CanvasDims>({ W: 800, H: 600 });
  const dprRef = useRef(1);
  const frameCountRef = useRef(0);
  const vaultGroupPositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const nodePositionsRef = useRef(new Map<string, { x: number; y: number }>());
  const nodeRelativePositionsRef = useRef(new Map<string, { dx: number; dy: number }>());
  const canvasRegionsRef = useRef(new Map<string, MasterCanvasRegion>());
  const canvasRegionOffsetsRef = useRef(
    new Map<string, { dx: number; dy: number }>()
  );
  const regionLayoutBaseRef = useRef<RegionLayoutSnapshot | null>(null);
  const vaultLayoutRefs: VaultLayoutRefs = useMemo(
    () => ({
      vaultGroupPositionsRef,
      nodePositionsRef,
      nodeRelativePositionsRef,
      canvasRegionsRef,
      canvasRegionOffsetsRef,
      regionLayoutBaseRef,
    }),
    []
  );
  const regionDragRef = useRef<{
    canvasId: string;
    start: { sx: number; sy: number };
    offset0: { dx: number; dy: number };
  } | null>(null);
  const collapsedVaultsRef = useRef(new Set<string>());
  const hoveredNodeIdRef = useRef<string | null>(null);
  const selectedNodeIdRef = useRef<string | null>(null);
  const selectedNodesRef = useRef(new Set<string>());
  const peekNodeIdRef = useRef<string | null>(null);
  const isShiftHeld = useRef(false);
  const cursorWorldRef = useRef<{ x: number; y: number } | null>(null);
  const selectionBoxRef = useRef<SelectionBox | null>(null);
  const userIdRef = useRef<string | null>(null);
  const profileRef = useRef<MasterProfile | null>(null);
  const masterHasBioRef = useRef(false);
  const avatarImageRef = useRef<CanvasImageSource | null>(null);
  const quickCreateOpenRef = useRef(false);
  const emptyVaultHoverIdRef = useRef<string | null>(null);
  const gearHoverIdRef = useRef<string | null>(null);
  const vaultPlusHoverIdRef = useRef<string | null>(null);
  const draggingVaultIdRef = useRef<string | null>(null);
  const vaultDragRef = useRef<{
    vaultKey: string;
    g0: { x: number; y: number };
    p0: { sx: number; sy: number };
  } | null>(null);
  const masterLastCanvasIdRef = useRef<string | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  const pointerDownRef = useRef<PointerDownRecord | null>(null);
  const contextMenuOpenRef = useRef(false);
  const searchExpandedRef = useRef(false);
  const fileNodeInputRef = useRef<HTMLInputElement>(null);
  const pendingNodeDropRef = useRef<{ x: number; y: number } | null>(null);

  return {
    canvasRef,
    containerRef,
    transformRef,
    dimsRef,
    dprRef,
    frameCountRef,
    vaultGroupPositionsRef,
    nodePositionsRef,
    nodeRelativePositionsRef,
    canvasRegionsRef,
    vaultLayoutRefs,
    collapsedVaultsRef,
    hoveredNodeIdRef,
    selectedNodeIdRef,
    selectedNodesRef,
    peekNodeIdRef,
    isShiftHeld,
    cursorWorldRef,
    selectionBoxRef,
    userIdRef,
    profileRef,
    masterHasBioRef,
    avatarImageRef,
    quickCreateOpenRef,
    emptyVaultHoverIdRef,
    gearHoverIdRef,
    vaultPlusHoverIdRef,
    draggingVaultIdRef,
    vaultDragRef,
    masterLastCanvasIdRef,
    dragStateRef,
    pointerDownRef,
    contextMenuOpenRef,
    searchExpandedRef,
    fileNodeInputRef,
    pendingNodeDropRef,
    regionDragRef,
  };
}
