"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import { useCanvasSetup } from "./useCanvasSetup";
import { useDrawLoop } from "./useDrawLoop";
import { useGraphData } from "./useGraphData";
import { useEdgeStyle } from "./useEdgeStyle";
import { useSearch } from "./useSearch";
import { useConnectMode } from "./useConnectMode";
import { useNodeActions } from "./useNodeActions";
import { useVaultLayout } from "./useVaultLayout";
import { useMinimap } from "./useMinimap";
import type { MemoryGraphRefs } from "./useMemoryGraphRefs";
import type { CanvasDims } from "../types/canvas.types";
import { useCanvasStore } from "@/store/canvasStore";

type EngineArgs = {
  r: MemoryGraphRefs;
  canvasReady: boolean;
  activeCanvasId: string | null;
  graphNodeCount: number;
  vaultCount: number;
  setSelectedNodes: Dispatch<SetStateAction<Set<string>>>;
  setBulkMoveOpen: Dispatch<SetStateAction<boolean>>;
};

export function useMemoryGraphEngine({
  r,
  canvasReady,
  activeCanvasId,
  graphNodeCount,
  vaultCount,
  setSelectedNodes,
  setBulkMoveOpen,
}: EngineArgs) {
  const [canvasDims, setCanvasDims] = useState<CanvasDims>({ W: 800, H: 600 });
  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const effectiveCanvasId = isMasterView ? null : activeCanvasId;
  const { userId, profile, setProfile } = useGraphData(
    effectiveCanvasId,
    isMasterView
  );
  const {
    edgeStyle,
    edgeStyleRef,
    handleEdgeStyleChange,
    edgeColor,
    edgeColorRef,
    handleEdgeColorChange,
    masterLineStyle,
    masterLineStyleRef,
    handleMasterLineStyleChange,
    masterLineColor,
    masterLineColorRef,
    handleMasterLineColorChange,
  } = useEdgeStyle(userId, effectiveCanvasId);
  const {
    searchQuery,
    searchMode,
    searchExpanded,
    searchResultCount,
    semanticLoading,
    searchInputRef,
    searchModeRef,
    handleSearchChange,
    handleSearchSubmit,
    clearSearch,
    setSearchExpanded,
    setSearchMode,
  } = useSearch(userId);

  const {
    connectMode,
    connectSource,
    connectModeRef,
    connectSourceRef,
    handleConnectClick,
    enterConnectMode,
    exitConnectMode,
  } = useConnectMode({ userId, canvasId: effectiveCanvasId });

  const {
    handleDeleteNode,
    handleBulkDelete,
    handleBulkMove,
    handleMoveToVault,
    handleAddToKanban,
    copySelectedNodes,
    pasteNodes,
  } = useNodeActions({
    userId,
    canvasId: effectiveCanvasId,
    selectedNodesRef: r.selectedNodesRef,
    setSelectedNodes,
    setBulkMoveOpen,
    nodePositionsRef: r.nodePositionsRef,
    nodeRelativePositionsRef: r.nodeRelativePositionsRef,
    vaultLayoutRefs: r.vaultLayoutRefs,
  });

  const {
    fitCanvasToNodes,
    triggerAutoLayout,
    placeMasterLayout,
    applyLayoutAnimation,
    applyFitAnimation,
  } = useVaultLayout({
    vaultLayoutRefs: r.vaultLayoutRefs,
    graphNodeCount,
    vaultCount,
    canvasReady,
    dimsRef: r.dimsRef,
    transformRef: r.transformRef,
  });

  useCanvasSetup(
    r.canvasRef,
    r.containerRef,
    r.transformRef,
    r.dimsRef,
    r.dprRef,
    setCanvasDims
  );

  const { minimapBoundsRef } = useDrawLoop({
    canvasRef: r.canvasRef,
    transformRef: r.transformRef,
    dimsRef: r.dimsRef,
    frameCountRef: r.frameCountRef,
    vaultLayoutRefs: r.vaultLayoutRefs,
    edgeStyleRef,
    edgeColorRef,
    masterLineStyleRef,
    masterLineColorRef,
    masterHasBioRef: r.masterHasBioRef,
    collapsedVaultsRef: r.collapsedVaultsRef,
    hoveredNodeIdRef: r.hoveredNodeIdRef,
    selectedNodeIdRef: r.selectedNodeIdRef,
    selectedNodesRef: r.selectedNodesRef,
    peekNodeIdRef: r.peekNodeIdRef,
    connectModeRef,
    connectSourceRef,
    cursorWorldRef: r.cursorWorldRef,
    selectionBoxRef: r.selectionBoxRef,
    userIdRef: r.userIdRef,
    profileRef: r.profileRef,
    avatarImageRef: r.avatarImageRef,
    quickCreateOpenRef: r.quickCreateOpenRef,
    emptyVaultHoverIdRef: r.emptyVaultHoverIdRef,
    gearHoverIdRef: r.gearHoverIdRef,
    vaultPlusHoverIdRef: r.vaultPlusHoverIdRef,
    draggingVaultIdRef: r.draggingVaultIdRef,
    applyLayoutAnimation,
    applyFitAnimation,
  });

  const { handleMinimapClick } = useMinimap({
    transformRef: r.transformRef,
    dimsRef: r.dimsRef,
    minimapBoundsRef,
    nodePositionsRef: r.nodePositionsRef,
    vaultGroupPositionsRef: r.vaultGroupPositionsRef,
  });

  return {
    canvasDims,
    userId,
    profile,
    setProfile,
    edgeStyle,
    edgeStyleRef,
    handleEdgeStyleChange,
    edgeColor,
    edgeColorRef,
    handleEdgeColorChange,
    masterLineStyle,
    masterLineStyleRef,
    handleMasterLineStyleChange,
    masterLineColor,
    masterLineColorRef,
    handleMasterLineColorChange,
    searchQuery,
    searchMode,
    searchExpanded,
    searchResultCount,
    semanticLoading,
    searchInputRef,
    searchModeRef,
    handleSearchChange,
    handleSearchSubmit,
    clearSearch,
    setSearchExpanded,
    setSearchMode,
    connectMode,
    connectSource,
    connectModeRef,
    connectSourceRef,
    handleConnectClick,
    enterConnectMode,
    exitConnectMode,
    handleDeleteNode,
    handleBulkDelete,
    handleBulkMove,
    handleMoveToVault,
    handleAddToKanban,
    copySelectedNodes,
    pasteNodes,
    fitCanvasToNodes,
    triggerAutoLayout,
    placeMasterLayout,
    minimapBoundsRef,
    handleMinimapClick,
    isMasterView,
    effectiveCanvasId,
  };
}
