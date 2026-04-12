"use client";

import { useState, type Dispatch, type SetStateAction } from "react";
import type {
  ContextMenuState,
  EdgeContextMenuState,
  VaultSettingsState,
} from "../types/graph.types";

export type MemoryGraphUiState = {
  collapsedVaults: Set<string>;
  setCollapsedVaults: Dispatch<SetStateAction<Set<string>>>;
  selectedNodes: Set<string>;
  setSelectedNodes: Dispatch<SetStateAction<Set<string>>>;
  peekNodeId: string | null;
  setPeekNodeId: Dispatch<SetStateAction<string | null>>;
  contextMenu: ContextMenuState | null;
  setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
  edgeContextMenu: EdgeContextMenuState | null;
  setEdgeContextMenu: Dispatch<SetStateAction<EdgeContextMenuState | null>>;
  vaultPopover: VaultSettingsState | null;
  setVaultPopover: Dispatch<SetStateAction<VaultSettingsState | null>>;
  quickCreate: {
    open: boolean;
    x: number;
    y: number;
    vaultId: string;
    canvasId?: string | null;
  } | null;
  setQuickCreate: Dispatch<
    SetStateAction<{
      open: boolean;
      x: number;
      y: number;
      vaultId: string;
      canvasId?: string | null;
    } | null>
  >;
  masterEditorOpen: boolean;
  setMasterEditorOpen: Dispatch<SetStateAction<boolean>>;
  /** When set, master editor saves to this canvas (master graph virtual hub). */
  masterEditorCanvasId: string | null;
  setMasterEditorCanvasId: Dispatch<SetStateAction<string | null>>;
  shortcutsOpen: boolean;
  setShortcutsOpen: Dispatch<SetStateAction<boolean>>;
  chatOpen: boolean;
  setChatOpen: Dispatch<SetStateAction<boolean>>;
  bulkMoveOpen: boolean;
  setBulkMoveOpen: Dispatch<SetStateAction<boolean>>;
  historyNodeId: string | null;
  setHistoryNodeId: Dispatch<SetStateAction<string | null>>;
  canvasReady: boolean;
  setCanvasReady: Dispatch<SetStateAction<boolean>>;
  exportModalOpen: boolean;
  setExportModalOpen: Dispatch<SetStateAction<boolean>>;
  exportModalSelectedIds: Set<string> | null;
  setExportModalSelectedIds: Dispatch<SetStateAction<Set<string> | null>>;
  canvasDragOver: boolean;
  setCanvasDragOver: Dispatch<SetStateAction<boolean>>;
};

export function useMemoryGraphUiState(): MemoryGraphUiState {
  const [collapsedVaults, setCollapsedVaults] = useState<Set<string>>(new Set());
  const [selectedNodes, setSelectedNodes] = useState<Set<string>>(new Set());
  const [peekNodeId, setPeekNodeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [edgeContextMenu, setEdgeContextMenu] =
    useState<EdgeContextMenuState | null>(null);
  const [vaultPopover, setVaultPopover] = useState<VaultSettingsState | null>(null);
  const [quickCreate, setQuickCreate] = useState<{
    open: boolean;
    x: number;
    y: number;
    vaultId: string;
    canvasId?: string | null;
  } | null>(null);
  const [masterEditorOpen, setMasterEditorOpen] = useState(false);
  const [masterEditorCanvasId, setMasterEditorCanvasId] = useState<
    string | null
  >(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  const [historyNodeId, setHistoryNodeId] = useState<string | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportModalSelectedIds, setExportModalSelectedIds] = useState<
    Set<string> | null
  >(null);
  const [canvasDragOver, setCanvasDragOver] = useState(false);

  return {
    collapsedVaults,
    setCollapsedVaults,
    selectedNodes,
    setSelectedNodes,
    peekNodeId,
    setPeekNodeId,
    contextMenu,
    setContextMenu,
    edgeContextMenu,
    setEdgeContextMenu,
    vaultPopover,
    setVaultPopover,
    quickCreate,
    setQuickCreate,
    masterEditorOpen,
    setMasterEditorOpen,
    masterEditorCanvasId,
    setMasterEditorCanvasId,
    shortcutsOpen,
    setShortcutsOpen,
    chatOpen,
    setChatOpen,
    bulkMoveOpen,
    setBulkMoveOpen,
    historyNodeId,
    setHistoryNodeId,
    canvasReady,
    setCanvasReady,
    exportModalOpen,
    setExportModalOpen,
    exportModalSelectedIds,
    setExportModalSelectedIds,
    canvasDragOver,
    setCanvasDragOver,
  };
}
