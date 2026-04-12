import React, { useState, useCallback, useMemo } from "react";
import type { MemoryNode, ApprovalStatus } from "../types";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { useNodeActions } from "../hooks/useNodeActions";
import { KanbanBoard } from "../components/KanbanBoard";
import type { KanbanGroupMode } from "../components/KanbanCard";

const GROUP_OPTIONS: { id: KanbanGroupMode; label: string }[] = [
  { id: "vault", label: "By Vault" },
  { id: "status", label: "By Status" },
  { id: "source", label: "By Source" },
];

const STATUS_ORDER: ApprovalStatus[] = ["pending", "approved", "auto_approved", "rejected"];

const STATUS_LABELS: Record<ApprovalStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  auto_approved: "Auto-Approved",
  rejected: "Rejected",
};

const SOURCE_LABELS: Record<string, string> = {
  claude: "Claude",
  chatgpt: "ChatGPT",
  gemini: "Gemini",
};

function normalizeSource(platform: string): string {
  const lower = platform.toLowerCase();
  if (lower === "claude") return "claude";
  if (lower === "chatgpt") return "chatgpt";
  if (lower === "gemini") return "gemini";
  return "other";
}

export function KanbanView() {
  const { allNodes, vaults, currentView, selectedCanvasId } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const actions = useNodeActions();

  const [groupMode, setGroupMode] = useState<KanbanGroupMode>("vault");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const columns = useMemo(() => {
    const canvasFiltered = selectedCanvasId === "all"
      ? allNodes
      : allNodes.filter((n) => (n as any).canvasId === selectedCanvasId);
    const activeNodes = canvasFiltered.filter((n) => n.status !== "rejected" || groupMode === "status");

    if (groupMode === "vault") {
      const groups = new Map<string, MemoryNode[]>();
      vaults.forEach((v) => groups.set(v.id, []));
      activeNodes.forEach((n) => {
        const list = groups.get(n.vault);
        if (list) list.push(n);
        else groups.set(n.vault, [n]);
      });

      let cols = vaults.map((v) => ({
        key: v.id,
        label: v.name,
        nodes: groups.get(v.id) ?? [],
      }));
      if (hideEmpty) cols = cols.filter((c) => c.nodes.length > 0);
      return cols;
    }

    if (groupMode === "status") {
      const groups = new Map<string, MemoryNode[]>();
      STATUS_ORDER.forEach((s) => groups.set(s, []));
      allNodes.forEach((n) => {
        const list = groups.get(n.status);
        if (list) list.push(n);
      });

      let cols = STATUS_ORDER.map((s) => ({
        key: s,
        label: STATUS_LABELS[s],
        nodes: groups.get(s) ?? [],
      }));
      if (hideEmpty) cols = cols.filter((c) => c.nodes.length > 0);
      return cols;
    }

    const keys = ["claude", "chatgpt", "gemini", "other"];
    const groups = new Map<string, MemoryNode[]>();
    keys.forEach((k) => groups.set(k, []));
    activeNodes.forEach((n) => {
      const src = normalizeSource(n.source.platform);
      const list = groups.get(src);
      if (list) list.push(n);
    });

    let cols = keys.map((k) => ({
      key: k,
      label: SOURCE_LABELS[k] ?? "Other",
      nodes: groups.get(k) ?? [],
    }));
    if (hideEmpty) cols = cols.filter((c) => c.nodes.length > 0);
    return cols;
  }, [allNodes, vaults, groupMode, hideEmpty, selectedCanvasId]);

  const handleCardClick = useCallback(
    (nodeId: string) => dispatch({ type: "NAVIGATE_TO_NODE", nodeId, from: currentView }),
    [dispatch, currentView]
  );

  const handleDrop = useCallback(
    (nodeId: string, targetVault: string) => {
      const node = allNodes.find((n) => n.id === nodeId);
      if (!node || node.vault === targetVault) return;

      const vaultDef = vaults.find((v) => v.id === targetVault);
      void actions.changeNodeVault(nodeId, targetVault);
      showToast(`Moved to ${vaultDef?.name ?? targetVault}`);
    },
    [allNodes, vaults, actions, showToast]
  );

  return (
    <div className="memorey-kanban">
      <div className="memorey-kanban__toolbar">
        <div className="memorey-kanban__group-selector">
          {GROUP_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              className={`memorey-kanban__group-btn${groupMode === opt.id ? " memorey-kanban__group-btn--active" : ""}`}
              onClick={() => setGroupMode(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <label className="memorey-kanban__toggle">
          <input type="checkbox" checked={hideEmpty} onChange={(e) => setHideEmpty(e.target.checked)} />
          <span>Hide empty</span>
        </label>
      </div>

      <KanbanBoard
        columns={columns}
        groupMode={groupMode}
        onCardClick={handleCardClick}
        onDrop={groupMode === "vault" ? handleDrop : undefined}
      />

      {toast && <div className="memorey-toast">{toast}</div>}
    </div>
  );
}
