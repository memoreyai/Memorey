"use client";

import type { RefObject } from "react";
import type { DragEvent } from "react";
import type { MemoryNode, CategoryVault, GraphNode } from "@/types/memorey";
import { ExportModal } from "./ExportModal";
import type { CanvasDims, EdgeStyle, SearchMode } from "../types/canvas.types";
import type {
  ContextMenuState,
  EdgeContextMenuState,
  VaultSettingsState,
} from "../types/graph.types";
import { Toolbar } from "./Toolbar";
import { SearchBar } from "./SearchBar";
import { ContextMenu } from "./ContextMenu";
import { BulkActionBar } from "./BulkActionBar";
import { BulkMoveModal } from "./BulkMoveModal";
import { VaultSettingsPopover } from "./VaultSettingsPopover";
import { QuickCreateForm } from "./QuickCreateForm";
import { AddMemoryModal } from "./AddMemoryModal";
import { MasterNodeEditor } from "./MasterNodeEditor";
import { ConnectModeBar } from "./ConnectModeBar";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { ChatGraphBuilder } from "./ChatGraphBuilder";
import { EdgeContextMenu } from "./EdgeContextMenu";
import { NodeDetailSheet } from "./NodeDetailSheet";
import { PlainEnglishView } from "./PlainEnglishView";
import { GraphTreeView } from "./GraphTreeView";
import { MINIMAP_RIGHT } from "../constants/dimensions";
import { LegendPanel } from "./LegendPanel";
import { useGraphStore } from "@/store/graphStore";
import { useCanvasStore } from "@/store/canvasStore";
import { NodePeekAnchored } from "./NodePeekAnchored";
import type { Transform } from "../types/canvas.types";
import type { MutableRefObject } from "react";

export interface MemoryGraphChromeProps {
  containerRef: RefObject<HTMLDivElement | null>;
  canvasRef: RefObject<HTMLCanvasElement | null>;
  dimsRef: RefObject<CanvasDims>;
  /** Canvas pixel size for UI that must not read refs during render. */
  canvasDims: CanvasDims;
  onPointerDown: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerLeave: () => void;
  onContextMenu: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onCanvasDoubleClick: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  connectMode: boolean;
  connectSource: GraphNode | null;
  edgeStyle: EdgeStyle;
  onToggleConnect: () => void;
  onFit: () => void;
  onLayout: () => void;
  onAddMemory: () => void;
  onChatBuilder: () => void;
  onEdgeStyleChange: (s: EdgeStyle) => void;
  edgeColor: string | null;
  onEdgeColorChange: (c: string | null) => void;
  masterLineStyle: string;
  onMasterLineStyleChange: (s: string) => void;
  masterLineColor: string | null;
  onMasterLineColorChange: (c: string | null) => void;
  onShortcuts: () => void;
  onRenameCanvas: (
    canvasId: string,
    updates: { name: string; emoji?: string | null }
  ) => Promise<void>;
  onBriefAnAI: () => void;
  currentView: "graph" | "plain" | "tree";
  onViewChange: (view: "graph" | "plain" | "tree") => void;
  searchExpanded: boolean;
  searchQuery: string;
  searchMode: SearchMode;
  searchResultCount: number;
  semanticLoading: boolean;
  searchInputRef: RefObject<HTMLInputElement | null>;
  onSearchExpand: () => void;
  onSearchChange: (q: string) => void;
  onSearchSubmit: () => void;
  onSearchClear: () => void;
  selectedNodes: Set<string>;
  onBulkSelectAll: () => void;
  onBulkExport: () => void | Promise<void>;
  onBulkMove: () => void;
  onBulkDelete: () => void | Promise<void>;
  onBulkDeselect: () => void;
  contextMenu: ContextMenuState | null;
  onContextMenuClose: () => void;
  edgeContextMenu: EdgeContextMenuState | null;
  onEdgeContextMenuClose: () => void;
  onContextEdit: (id: string) => void;
  onContextViewHistory: (id: string) => void;
  onContextConnect: (id: string) => void;
  onContextCopyTitle: (id: string) => void;
  onContextExportNode: (node: GraphNode) => void;
  onContextAddToKanban: (id: string) => void;
  onContextMoveToVault: (id: string, vid: string) => void;
  onContextDelete: (id: string) => void;
  vaultPopover: VaultSettingsState | null;
  onVaultPopoverClose: () => void;
  bulkMoveOpen: boolean;
  onBulkMoveApply: (vid: string) => void;
  onBulkMoveClose: () => void;
  quickCreate: {
    open: boolean;
    x: number;
    y: number;
    vaultId: string;
    canvasId?: string | null;
  } | null;
  onQuickCreateClose: () => void;
  onQuickCreateSaved: (node: MemoryNode) => void;
  addMemoryModalOpen: boolean;
  addMemoryParentNodeId: string | null;
  /** Resolved target canvas when in master view (fallback to first canvas). */
  canvasIdForMemoryCreate: string | null;
  isMasterView: boolean;
  onAddMemoryClose: () => void;
  onAddMemorySaved: (node: MemoryNode) => void;
  masterEditorOpen: boolean;
  masterEditorBio: string;
  masterEditorColor: string;
  onMasterEditorClose: () => void;
  onMasterEditorSave: (bio: string, color: string) => Promise<void>;
  shortcutsOpen: boolean;
  onShortcutsClose: () => void;
  chatOpen: boolean;
  onChatClose: () => void;
  onChatNodesAdded: (rows: Record<string, unknown>[]) => void;
  selectedNodeId: string | null;
  userId: string | null;
  historyNodeId: string | null;
  onClearHistoryNode: () => void;
  vaults: CategoryVault[];
  activeCanvasId: string | null;
  exportModalOpen: boolean;
  exportModalSelectedIds: Set<string> | null;
  onCloseExportModal: () => void;
  canvasDragOver: boolean;
  onCanvasDragOver: (e: DragEvent<HTMLDivElement>) => void;
  onCanvasDragLeave: (e: DragEvent<HTMLDivElement>) => void;
  onCanvasDrop: (e: DragEvent<HTMLDivElement>) => void;
  fileNodeInputRef: RefObject<HTMLInputElement | null>;
  onAddFileNode: (files: FileList | null) => void;
  peekNodeId: string | null;
  onClosePeek: () => void;
  transformRef: MutableRefObject<Transform>;
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  legendOpen: boolean;
  onLegendToggle: () => void;
  onLegendClose: () => void;
}

export function MemoryGraphChrome(props: MemoryGraphChromeProps) {
  const {
    containerRef,
    canvasRef,
    dimsRef: _dimsRef,
    canvasDims,
    currentView,
    onCanvasDragOver,
    onCanvasDragLeave,
    onCanvasDrop,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerLeave,
    onContextMenu,
    onCanvasDoubleClick,
    canvasDragOver,
    legendOpen,
    onLegendToggle,
    onLegendClose,
    onViewChange,
    connectMode,
    connectSource,
    edgeStyle,
    onToggleConnect,
    onFit,
    onLayout,
    onAddMemory,
    fileNodeInputRef,
    onAddFileNode,
    onChatBuilder,
    onEdgeStyleChange,
    edgeColor,
    onEdgeColorChange,
    masterLineStyle,
    onMasterLineStyleChange,
    masterLineColor,
    onMasterLineColorChange,
    onShortcuts,
    onRenameCanvas,
    onBriefAnAI,
    searchExpanded,
    searchQuery,
    searchMode,
    searchResultCount,
    semanticLoading,
    onSearchExpand,
    onSearchChange,
    onSearchSubmit,
    onSearchClear,
    searchInputRef,
    peekNodeId,
    transformRef,
    nodePositionsRef,
    onClosePeek,
    selectedNodes,
    onBulkSelectAll,
    onBulkExport,
    onBulkMove,
    onBulkDelete,
    onBulkDeselect,
    edgeContextMenu,
    onEdgeContextMenuClose,
    userId,
    contextMenu,
    onContextMenuClose,
    onContextEdit,
    onContextViewHistory,
    onContextConnect,
    onContextCopyTitle,
    onContextExportNode,
    onContextAddToKanban,
    onContextMoveToVault,
    onContextDelete,
    vaultPopover,
    onVaultPopoverClose,
    bulkMoveOpen,
    onBulkMoveApply,
    onBulkMoveClose,
    quickCreate,
    onQuickCreateClose,
    onQuickCreateSaved,
    addMemoryModalOpen,
    addMemoryParentNodeId,
    vaults,
    onAddMemoryClose,
    onAddMemorySaved,
    canvasIdForMemoryCreate,
    isMasterView,
    masterEditorOpen,
    masterEditorBio,
    masterEditorColor,
    onMasterEditorClose,
    onMasterEditorSave,
    shortcutsOpen,
    onShortcutsClose,
    exportModalOpen,
    exportModalSelectedIds,
    onCloseExportModal,
    chatOpen,
    onChatClose,
    onChatNodesAdded,
    selectedNodeId,
    historyNodeId,
    onClearHistoryNode,
    activeCanvasId,
  } = props;
  void _dimsRef;
  const peekId = peekNodeId;
  const canvases = useCanvasStore((s) => s.canvases);
  return (
    <div className="relative flex h-full min-h-0 flex-1">
      <div ref={containerRef} className="relative min-h-0 flex-1">
        <div
          style={{
            display: currentView === "graph" ? "block" : "none",
            position: "absolute",
            inset: 0,
            top: 44,
          }}
          onDragOver={onCanvasDragOver}
          onDragLeave={onCanvasDragLeave}
          onDrop={onCanvasDrop}
        >
          <canvas
            ref={canvasRef}
            className="block h-full w-full touch-none"
            style={{ cursor: "default" }}
            onPointerDown={(e) => {
              if (legendOpen) onLegendClose();
              onPointerDown(e);
            }}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerLeave}
            onContextMenu={onContextMenu}
            onDoubleClick={onCanvasDoubleClick}
          />
          {canvasDragOver ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                background: "rgba(255,102,0,0.06)",
                border: "3px dashed rgba(255,102,0,0.4)",
                borderRadius: 8,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              <div style={{ fontSize: 40 }}>📁</div>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--orange)",
                }}
              >
                Drop to add to canvas
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>
                Images, PDFs, documents, or links
              </div>
            </div>
          ) : null}
        </div>
        <Toolbar
          currentView={currentView}
          onViewChange={onViewChange}
          connectMode={connectMode}
          edgeStyle={edgeStyle}
          onToggleConnect={onToggleConnect}
          onFit={onFit}
          onLayout={onLayout}
          onAddMemory={onAddMemory}
          fileNodeInputRef={fileNodeInputRef}
          onAddFileNode={onAddFileNode}
          onChatBuilder={onChatBuilder}
          onEdgeStyleChange={onEdgeStyleChange}
          edgeColor={edgeColor}
          onEdgeColorChange={onEdgeColorChange}
          masterLineStyle={masterLineStyle}
          onMasterLineStyleChange={onMasterLineStyleChange}
          masterLineColor={masterLineColor}
          onMasterLineColorChange={onMasterLineColorChange}
          onShortcuts={onShortcuts}
          onRenameCanvas={onRenameCanvas}
          onBriefAnAI={onBriefAnAI}
        />
        {currentView === "graph" ? (
          <>
            <div
              style={{
                position: "absolute",
                left: 16,
                bottom: 16,
                zIndex: 21,
                pointerEvents: "auto",
              }}
            >
              <LegendPanel
                isOpen={legendOpen}
                onToggle={onLegendToggle}
              />
            </div>
            <div
              style={{
                position: "absolute",
                right: MINIMAP_RIGHT,
                bottom: 16,
                zIndex: 21,
                pointerEvents: "auto",
                display: "flex",
                justifyContent: "flex-end",
                alignItems: "flex-end",
                maxWidth: "min(420px, calc(100% - 32px))",
                ...(searchExpanded ? { maxHeight: 150 } : {}),
              }}
            >
              <SearchBar
                searchExpanded={searchExpanded}
                searchQuery={searchQuery}
                searchMode={searchMode}
                searchResultCount={searchResultCount}
                semanticLoading={semanticLoading}
                onExpand={onSearchExpand}
                onChange={onSearchChange}
                onSubmit={() => void onSearchSubmit()}
                onClear={onSearchClear}
                inputRef={searchInputRef}
              />
            </div>
            {peekId ? (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  top: 44,
                  zIndex: 50,
                  pointerEvents: "none",
                }}
              >
                <NodePeekAnchored
                  key={peekId}
                  nodeId={peekId}
                  transformRef={transformRef}
                  nodePositionsRef={nodePositionsRef}
                  canvasW={canvasDims.W}
                  canvasH={canvasDims.H}
                  onClose={onClosePeek}
                  onOpenFull={() => {
                    onClosePeek();
                    useGraphStore.getState().selectNode(peekId!);
                  }}
                />
              </div>
            ) : null}
          </>
        ) : null}
        {currentView === "plain" ? (
          <PlainEnglishView
            style={{ position: "absolute", inset: 0, top: 44 }}
            onSwitchToGraph={() => onViewChange("graph")}
          />
        ) : null}
        {currentView === "tree" ? <GraphTreeView /> : null}
        <BulkActionBar
          selectedCount={selectedNodes.size}
          onSelectAll={onBulkSelectAll}
          onExport={onBulkExport}
          onMove={onBulkMove}
          onDelete={() => void onBulkDelete()}
          onDeselect={onBulkDeselect}
        />
        {connectMode && <ConnectModeBar connectSource={connectSource} />}
        {edgeContextMenu ? (
          <EdgeContextMenu
            edge={edgeContextMenu.edge}
            x={edgeContextMenu.x}
            y={edgeContextMenu.y}
            userId={userId}
            onClose={onEdgeContextMenuClose}
          />
        ) : null}
        <ContextMenu
          menu={contextMenu}
          onClose={onContextMenuClose}
          onEdit={onContextEdit}
          onViewHistory={onContextViewHistory}
          onConnect={onContextConnect}
          onCopyTitle={onContextCopyTitle}
          onExportNode={onContextExportNode}
          onAddToKanban={onContextAddToKanban}
          onMoveToVault={onContextMoveToVault}
          onDelete={onContextDelete}
          vaults={vaults}
        />
        <VaultSettingsPopover
          popover={vaultPopover}
          canvasW={canvasDims.W}
          onClose={onVaultPopoverClose}
        />
        <BulkMoveModal
          isOpen={bulkMoveOpen}
          selectedCount={selectedNodes.size}
          vaults={vaults}
          onMove={onBulkMoveApply}
          onClose={onBulkMoveClose}
        />
        {quickCreate?.open && (
          <QuickCreateForm
            isOpen
            pos={{ x: quickCreate.x, y: quickCreate.y }}
            defaultVaultId={quickCreate.vaultId}
            vaults={vaults}
            canvasW={canvasDims.W}
            canvasH={canvasDims.H}
            userId={userId ?? ""}
            canvasId={
              quickCreate.canvasId ?? canvasIdForMemoryCreate ?? activeCanvasId
            }
            masterCanvasOptions={
              isMasterView
                ? canvases.map((c) => ({
                    id: c.id,
                    emoji: c.emoji ?? "",
                    name: c.name,
                  }))
                : undefined
            }
            onClose={onQuickCreateClose}
            onSaved={onQuickCreateSaved}
          />
        )}
        <AddMemoryModal
          isOpen={addMemoryModalOpen}
          parentNodeId={addMemoryParentNodeId}
          vaults={vaults}
          userId={userId ?? ""}
          canvasId={canvasIdForMemoryCreate ?? activeCanvasId}
          onClose={onAddMemoryClose}
          onSaved={onAddMemorySaved}
        />
        <MasterNodeEditor
          isOpen={masterEditorOpen}
          initialBio={masterEditorBio}
          initialColor={masterEditorColor}
          onClose={onMasterEditorClose}
          onSave={onMasterEditorSave}
        />
        <KeyboardShortcutsModal isOpen={shortcutsOpen} onClose={onShortcutsClose} />
        <ExportModal
          isOpen={exportModalOpen}
          selectedNodeIds={exportModalSelectedIds}
          onClose={onCloseExportModal}
        />
        <ChatGraphBuilder
          isOpen={chatOpen}
          onClose={onChatClose}
          onNodesAdded={onChatNodesAdded}
        />
      </div>
      {selectedNodeId && (
        <NodeDetailSheet
          userId={userId}
          historyOpenForNode={historyNodeId}
          clearHistoryOpenForNode={onClearHistoryNode}
        />
      )}
    </div>
  );
}
