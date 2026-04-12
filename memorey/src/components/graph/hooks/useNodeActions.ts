"use client";

import { useCallback, useRef, type MutableRefObject } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TablesInsert } from "@/lib/supabase/types";
import { mapNodeRow, useGraphStore } from "@/store/graphStore";
import { useCanvasStore } from "@/store/canvasStore";
import type { MemoryNode } from "@/types/memorey";
import { toast } from "sonner";
import { setNodeInVaultGroup } from "../layout/positions";
import type { VaultLayoutRefs } from "../layout/types";
import { useTrack } from "@/hooks/useTrack";

export function useNodeActions(opts: {
  userId: string | null;
  canvasId: string | null;
  selectedNodesRef: MutableRefObject<Set<string>>;
  setSelectedNodes: (s: Set<string>) => void;
  setBulkMoveOpen: (v: boolean) => void;
  nodePositionsRef: MutableRefObject<Map<string, { x: number; y: number }>>;
  nodeRelativePositionsRef: MutableRefObject<
    Map<string, { dx: number; dy: number }>
  >;
  vaultLayoutRefs: VaultLayoutRefs;
}): {
  handleDeleteNode: (nodeId: string) => Promise<void>;
  handleBulkDelete: () => Promise<void>;
  handleBulkMove: () => void;
  handleMoveToVault: (nodeId: string, vaultId: string) => Promise<void>;
  handleAddToKanban: (nodeId: string) => Promise<void>;
  handleCreateEdge: (
    sourceId: string,
    targetId: string,
    strength?: number
  ) => Promise<void>;
  copySelectedNodes: () => void;
  pasteNodes: () => Promise<void>;
} {
  const {
    userId,
    canvasId,
    selectedNodesRef,
    setSelectedNodes,
    setBulkMoveOpen,
    nodePositionsRef,
    nodeRelativePositionsRef,
    vaultLayoutRefs,
  } = opts;

  const removeNode = useGraphStore((s) => s.removeNode);
  const addEdge = useGraphStore((s) => s.addEdge);
  const updateNode = useGraphStore((s) => s.updateNode);
  const nodes = useGraphStore((s) => s.nodes);
  const { track } = useTrack();
  const handleDeleteNode = useCallback(
    async (nodeId: string) => {
      if (!userId) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("memory_nodes")
        .update({ is_active: false })
        .eq("id", nodeId)
        .eq("user_id", userId);
      if (error) {
        toast.error("Could not delete memory");
        return;
      }
      removeNode(nodeId);
      toast.success("Memory removed");
    },
    [userId, removeNode]
  );

  const handleBulkDelete = useCallback(async () => {
    if (!userId) return;
    const ids = [...selectedNodesRef.current];
    if (ids.length === 0) return;
    const supabase = createClient();
    const { error } = await supabase
      .from("memory_nodes")
      .update({ is_active: false })
      .in("id", ids)
      .eq("user_id", userId);
    if (error) {
      toast.error("Bulk delete failed");
      return;
    }
    for (const id of ids) removeNode(id);
    selectedNodesRef.current = new Set();
    setSelectedNodes(new Set());
    toast.success(`Removed ${ids.length} memories`);
  }, [userId, removeNode, selectedNodesRef, setSelectedNodes]);

  const handleBulkMove = useCallback(() => {
    if (selectedNodesRef.current.size === 0) return;
    setBulkMoveOpen(true);
  }, [setBulkMoveOpen, selectedNodesRef]);

  const handleMoveToVault = useCallback(
    async (nodeId: string, vaultId: string) => {
      if (!userId) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("memory_nodes")
        .update({ vault_id: vaultId })
        .eq("id", nodeId)
        .eq("user_id", userId);
      if (error) {
        toast.error("Could not move memory");
        return;
      }
      const n = nodes.find((x) => x.id === nodeId);
      updateNode(nodeId, { vaultId });
      if (n) {
        const supabase2 = createClient();
        const { data: v } = await supabase2
          .from("category_vaults")
          .select("name")
          .eq("id", vaultId)
          .single();
        if (v?.name) updateNode(nodeId, { vaultName: v.name as MemoryNode["vaultName"] });
      }
      toast.success("Moved to vault");
    },
    [userId, nodes, updateNode]
  );

  const handleAddToKanban = useCallback(
    async (nodeId: string) => {
      if (!userId) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("memory_nodes")
        .update({ kanban_status: "todo", kanban_order: Date.now() })
        .eq("id", nodeId)
        .eq("user_id", userId);
      if (error) {
        toast.error("Could not add to Kanban");
        return;
      }
      updateNode(nodeId, { kanbanStatus: "todo", kanbanOrder: Date.now() });
      toast.success("Added to Kanban");
    },
    [userId, updateNode]
  );

  const clipboard = useRef<MemoryNode[]>([]);

  const copySelectedNodes = useCallback(() => {
    const liveNodes = useGraphStore.getState().nodes as MemoryNode[];
    const selected = liveNodes.filter((n) =>
      selectedNodesRef.current.has(n.id)
    );
    clipboard.current = selected;
    toast.success(
      `Copied ${selected.length} node${selected.length !== 1 ? "s" : ""}`
    );
  }, [selectedNodesRef]);

  const pasteNodes = useCallback(async () => {
    if (clipboard.current.length === 0) return;
    if (!userId) return;
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const OFFSET = 30;
    const pasted: string[] = [];
    const activeCanvasId = useCanvasStore.getState().activeCanvasId ?? null;

    for (const node of clipboard.current) {
      const title = `${node.title} (copy)`.slice(0, 100);
      const rawValue = node.value.trim();
      const value =
        rawValue.length > 0
          ? rawValue.slice(0, 600)
          : (node.title.trim().slice(0, 600) || ".");

      const res = await fetch("/api/memory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          vaultId: node.vaultId,
          title,
          value,
          confidence: node.confidence,
          source: "manual",
          canvasId: activeCanvasId,
          analyticsSource: "paste",
        }),
      });
      const json = (await res.json()) as {
        node?: Record<string, unknown>;
        error?: string;
      };
      if (!res.ok || !json.node) continue;

      const mapped = mapNodeRow(json.node as never);
      useGraphStore.getState().addNode(mapped);
      const origPos = nodePositionsRef.current.get(node.id);
      if (origPos) {
        nodePositionsRef.current.set(mapped.id, {
          x: origPos.x + OFFSET,
          y: origPos.y + OFFSET,
        });
        nodeRelativePositionsRef.current.set(mapped.id, {
          dx: 0,
          dy: 0,
        });
      } else {
        setNodeInVaultGroup(mapped.id, mapped.vaultId ?? "", vaultLayoutRefs);
      }
      pasted.push(mapped.id);
    }

    const pastedSet = new Set(pasted);
    selectedNodesRef.current = pastedSet;
    setSelectedNodes(new Set(pastedSet));
    toast.success(
      `Pasted ${pasted.length} node${pasted.length !== 1 ? "s" : ""}`
    );
  }, [
    userId,
    selectedNodesRef,
    setSelectedNodes,
    nodePositionsRef,
    nodeRelativePositionsRef,
    vaultLayoutRefs,
  ]);

  const handleCreateEdge = useCallback(
    async (sourceId: string, targetId: string, strength = 0.7) => {
      if (!userId) return;
      const supabase = createClient();
      const row: TablesInsert<"node_edges"> = {
        user_id: userId,
        source_node_id: sourceId,
        target_node_id: targetId,
        strength,
        label: "",
        canvas_id: canvasId ?? null,
      };
      const { data, error } = await supabase
        .from("node_edges")
        .insert(row)
        .select("id, user_id, source_node_id, target_node_id, strength, label")
        .single();
      if (error || !data) {
        toast.error("Could not create link");
        return;
      }
      const r = data as {
        id: string;
        user_id: string;
        source_node_id: string;
        target_node_id: string;
        strength: number;
        label: string | null;
      };
      addEdge({
        id: r.id,
        userId: r.user_id,
        sourceNodeId: r.source_node_id,
        targetNodeId: r.target_node_id,
        strength: r.strength,
        label: r.label ?? undefined,
      });
      track("edge_created", {});
      toast.success("Nodes connected");
    },
    [userId, canvasId, addEdge, track]
  );

  return {
    handleDeleteNode,
    handleBulkDelete,
    handleBulkMove,
    handleMoveToVault,
    handleAddToKanban,
    handleCreateEdge,
    copySelectedNodes,
    pasteNodes,
  };
}
