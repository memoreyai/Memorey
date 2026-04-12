"use client";

import { useState } from "react";
import {
  Copy,
  ExternalLink,
  GitBranch,
  Trash2,
} from "lucide-react";
import type { CategoryVault, GraphNode, MemoryNode } from "@/types/memorey";
import type { ContextMenuState } from "../types/graph.types";
import { toast } from "sonner";

interface ContextMenuProps {
  menu: ContextMenuState | null;
  onClose: () => void;
  onEdit: (nodeId: string) => void;
  onViewHistory: (nodeId: string) => void;
  onConnect: (nodeId: string) => void;
  onCopyTitle: (nodeId: string) => void;
  onExportNode: (node: GraphNode) => void;
  onAddToKanban: (nodeId: string) => void;
  onMoveToVault: (nodeId: string, vaultId: string) => void;
  onDelete: (nodeId: string) => void;
  vaults: CategoryVault[];
}

function isFileNode(n: GraphNode): boolean {
  const m = n as unknown as MemoryNode;
  return m.nodeKindV2 === "file" || Boolean(m.fileUrl);
}

export function ContextMenu({
  menu,
  onClose,
  onEdit,
  onViewHistory,
  onConnect,
  onCopyTitle,
  onExportNode,
  onAddToKanban,
  onMoveToVault,
  onDelete,
  vaults,
}: ContextMenuProps) {
  const [sub, setSub] = useState(false);
  if (!menu) return null;

  const item = (label: string, fn: () => void) => (
    <button
      type="button"
      className="block w-full px-3 py-2 text-left text-sm"
      style={{ color: "var(--text)" }}
      onClick={() => {
        fn();
        onClose();
      }}
    >
      {label}
    </button>
  );

  const file = isFileNode(menu.node);
  const fileNode = menu.node as unknown as MemoryNode;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden />
      <div
        className="fixed z-50 min-w-[200px] overflow-hidden rounded-lg border py-1 shadow-xl"
        style={{
          left: menu.x,
          top: menu.y,
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
        }}
      >
        {file ? (
          <>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              style={{ color: "var(--text)" }}
              onClick={() => {
                if (fileNode.fileUrl)
                  window.open(fileNode.fileUrl, "_blank", "noopener,noreferrer");
                onClose();
              }}
            >
              <ExternalLink size={12} aria-hidden />
              Open file
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              style={{ color: "var(--text)" }}
              onClick={() => {
                onConnect(menu.nodeId);
                onClose();
              }}
            >
              <GitBranch size={12} aria-hidden />
              Connect to node
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              style={{ color: "var(--text)" }}
              onClick={() => {
                void navigator.clipboard.writeText(fileNode.fileUrl ?? "");
                toast.success("URL copied");
                onClose();
              }}
            >
              <Copy size={12} aria-hidden />
              Copy URL
            </button>
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm"
              style={{ color: "#E05C5C" }}
              onClick={() => {
                onDelete(menu.nodeId);
                onClose();
              }}
            >
              <Trash2 size={12} aria-hidden />
              Delete
            </button>
          </>
        ) : (
          <>
            {item("Edit", () => onEdit(menu.nodeId))}
            {item("View history", () => onViewHistory(menu.nodeId))}
            {item("Connect", () => onConnect(menu.nodeId))}
            {item("Copy title", () => onCopyTitle(menu.nodeId))}
            {item("Export node", () => onExportNode(menu.node))}
            {item("Add to Kanban", () => onAddToKanban(menu.nodeId))}
            <div className="relative">
              <button
                type="button"
                className="block w-full px-3 py-2 text-left text-sm"
                style={{ color: "var(--text)" }}
                onClick={() => setSub((s) => !s)}
              >
                Move to vault ▸
              </button>
              {sub && (
                <div
                  className="absolute left-full top-0 ml-1 min-w-[160px] rounded-lg border py-1 shadow-lg"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                  }}
                >
                  {vaults.map((v) => (
                    <button
                      key={v.id}
                      type="button"
                      className="block w-full px-3 py-1.5 text-left text-sm"
                      style={{ color: "var(--text)" }}
                      onClick={() => {
                        onMoveToVault(menu.nodeId, v.id);
                        onClose();
                      }}
                    >
                      {v.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {item("Delete", () => onDelete(menu.nodeId))}
          </>
        )}
      </div>
    </>
  );
}
