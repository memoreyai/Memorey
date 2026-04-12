"use client";

import { useCallback, useEffect, useRef, type MutableRefObject } from "react";
import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import type { Transform } from "../types/canvas.types";
import type { CanvasDims } from "../types/canvas.types";
import type { VaultLayoutRefs } from "../layout/types";
import type { LayoutAnimFrame } from "../layout/types";
import {
  buildUserOrderHintFromPositionMap,
  placeAllNodes,
  syncNodeRelativePositionsFromAbsolute,
} from "../layout/positions";
import { triggerAutoLayout as startLayoutAnim } from "../layout/auto";
import {
  fitCanvasToNodes as computeFit,
  startFitAnimation,
  type FitAnimState,
} from "../layout/fit";
import { LAYOUT_ANIM_DURATION_MS } from "../constants/layout";
import {
  runPlaceAllNodesMaster,
} from "../layout/masterLayout";
import { computeDynamicMasterCanvasRegions } from "../canvas/canvasGroups";
import { persistAllGraphNodePositionsFromRefs } from "@/lib/graph/persistNodePositions";

export function useVaultLayout(opts: {
  vaultLayoutRefs: VaultLayoutRefs;
  graphNodeCount: number;
  vaultCount: number;
  canvasReady: boolean;
  dimsRef: MutableRefObject<CanvasDims>;
  transformRef: MutableRefObject<Transform>;
}): {
  fitCanvasToNodes: () => void;
  triggerAutoLayout: () => void;
  placeMasterLayout: () => void;
  applyLayoutAnimation: () => void;
  applyFitAnimation: () => void;
  layoutAnimRef: MutableRefObject<LayoutAnimFrame | null>;
  fitAnimRef: MutableRefObject<FitAnimState | null>;
} {
  const layoutAnimRef = useRef<LayoutAnimFrame | null>(null);
  const fitAnimRef = useRef<FitAnimState | null>(null);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const masterHiddenSig = useCanvasStore((s) =>
    s.masterHiddenCanvasIds.join(",")
  );
  const canvasIdsSig = useCanvasStore((s) =>
    [...s.canvases]
      .sort((a, b) => a.displayOrder - b.displayOrder)
      .map((c) => c.id)
      .join(",")
  );
  /** Re-run layout when “show empty vault” flags change (node count alone may not). */
  const emptyVaultLayoutSig = useVaultStore((s) => {
    const links = s.canvasVaultLinks
      .map(
        (l) =>
          `${l.canvas_id}:${l.vault_id}:${l.showEmptyOnCanvas ? "1" : "0"}`
      )
      .sort()
      .join("|");
    const masters = s.vaults
      .map((v) => `${v.id}:${v.showEmptyInMaster ? "1" : "0"}`)
      .sort()
      .join("|");
    return `${links}#${masters}`;
  });

  const prevCanvasIdRef = useRef<string | null>(null);
  const prevGraphCountRef = useRef<number | undefined>(undefined);
  const prevVaultCountRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!optsRef.current.canvasReady) return;
    const isMaster = useCanvasStore.getState().isMasterView;
    const v = optsRef.current.vaultLayoutRefs;
    const canvasId = useCanvasStore.getState().activeCanvasId;
    const prevCanvas = prevCanvasIdRef.current;
    const prevCount = prevGraphCountRef.current;
    const prevVaultCount = prevVaultCountRef.current;
    const count = opts.graphNodeCount;
    const vaultCount = opts.vaultCount;

    const skipIncremental =
      !isMaster &&
      canvasId != null &&
      prevCanvas === canvasId &&
      prevCount !== undefined &&
      count === prevCount + 1 &&
      prevVaultCount === vaultCount;

    prevCanvasIdRef.current = canvasId;
    prevGraphCountRef.current = count;
    prevVaultCountRef.current = vaultCount;

    if (skipIncremental) {
      return;
    }

    if (isMaster) {
      runPlaceAllNodesMaster(v);
    } else {
      const nodes = useGraphStore.getState().graphData.nodes;
      placeAllNodes(nodes, v);
    }
  }, [
    opts.canvasReady,
    opts.graphNodeCount,
    opts.vaultCount,
    isMasterView,
    masterHiddenSig,
    canvasIdsSig,
    emptyVaultLayoutSig,
  ]);

  const fitCanvasToNodes = useCallback(() => {
    const o = optsRef.current;
    const master = useCanvasStore.getState().isMasterView;
    const staticRegs = o.vaultLayoutRefs.canvasRegionsRef.current;
    const np = o.vaultLayoutRefs.nodePositionsRef.current;
    const graphNodes = useGraphStore.getState().graphData.nodes;
    const regionArg =
      master && staticRegs.size > 0
        ? computeDynamicMasterCanvasRegions(staticRegs, graphNodes, np)
        : master
          ? staticRegs
          : undefined;
    const to = computeFit(
      o.vaultLayoutRefs.nodePositionsRef.current,
      o.vaultLayoutRefs.vaultGroupPositionsRef.current,
      o.dimsRef.current,
      120,
      regionArg
    );
    startFitAnimation(fitAnimRef, { ...o.transformRef.current }, to);
  }, []);

  const placeMasterLayout = useCallback(() => {
    runPlaceAllNodesMaster(optsRef.current.vaultLayoutRefs);
  }, []);

  const triggerAutoLayout = useCallback(() => {
    const v = optsRef.current.vaultLayoutRefs;
    if (useCanvasStore.getState().isMasterView) {
      runPlaceAllNodesMaster(v, { skipSavedMerge: true });
      void persistAllGraphNodePositionsFromRefs(v);
      return;
    }
    const nodes = useGraphStore.getState().graphData.nodes;
    const from = new Map(v.nodePositionsRef.current);
    const userOrderHint = buildUserOrderHintFromPositionMap(
      from,
      nodes
    );
    placeAllNodes(nodes, v, undefined, {
      skipSavedMerge: true,
      userOrderHint,
    });
    const to = new Map(v.nodePositionsRef.current);
    for (const [id, p] of from) {
      v.nodePositionsRef.current.set(id, p);
    }
    startLayoutAnim(
      layoutAnimRef,
      v.nodePositionsRef,
      to,
      LAYOUT_ANIM_DURATION_MS
    );
  }, []);

  const applyLayoutAnimation = useCallback(() => {
    const v = optsRef.current.vaultLayoutRefs;
    const anim = layoutAnimRef.current;
    if (!anim) return;
    const t = Math.min(1, (performance.now() - anim.startTime) / anim.duration);
    const ease = t * t * (3 - 2 * t);
    for (const [id, to] of anim.to) {
      const from = anim.from.get(id) ?? to;
      v.nodePositionsRef.current.set(id, {
        x: from.x + (to.x - from.x) * ease,
        y: from.y + (to.y - from.y) * ease,
      });
    }
    if (t >= 1) {
      syncNodeRelativePositionsFromAbsolute(
        anim.to.keys(),
        useGraphStore.getState().graphData.nodes,
        v
      );
      layoutAnimRef.current = null;
      void persistAllGraphNodePositionsFromRefs(v);
    }
  }, []);

  const applyFitAnimation = useCallback(() => {
    const fa = fitAnimRef.current;
    if (!fa) return;
    const t = Math.min(1, (performance.now() - fa.startTime) / fa.duration);
    const ease = t * t * (3 - 2 * t);
    const transformRef = optsRef.current.transformRef;
    const tr = transformRef.current;
    transformRef.current = {
      ...tr,
      x: fa.from.x + (fa.to.x - fa.from.x) * ease,
      y: fa.from.y + (fa.to.y - fa.from.y) * ease,
      scale: fa.from.scale + (fa.to.scale - fa.from.scale) * ease,
    };
    if (t >= 1) fitAnimRef.current = null;
  }, []);

  return {
    fitCanvasToNodes,
    triggerAutoLayout,
    placeMasterLayout,
    applyLayoutAnimation,
    applyFitAnimation,
    layoutAnimRef,
    fitAnimRef,
  };
}
