"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { TablesInsert } from "@/lib/supabase/types";
import { useGraphStore } from "@/store/graphStore";
import type { GraphNode } from "@/types/memorey";
import { toast } from "sonner";

export function useConnectMode(opts: {
  userId: string | null;
  canvasId: string | null;
}): {
  connectMode: boolean;
  connectSource: GraphNode | null;
  connectModeRef: React.MutableRefObject<boolean>;
  connectSourceRef: React.MutableRefObject<GraphNode | null>;
  handleConnectClick: (node: GraphNode | null) => Promise<void>;
  enterConnectMode: () => void;
  exitConnectMode: () => void;
  setConnectMode: (v: boolean) => void;
  setConnectSource: (n: GraphNode | null) => void;
} {
  const [connectMode, setConnectMode] = useState(false);
  const [connectSource, setConnectSource] = useState<GraphNode | null>(null);
  const connectModeRef = useRef(false);
  const connectSourceRef = useRef<GraphNode | null>(null);
  const addEdge = useGraphStore((s) => s.addEdge);

  useEffect(() => {
    connectModeRef.current = connectMode;
  }, [connectMode]);
  useEffect(() => {
    connectSourceRef.current = connectSource;
  }, [connectSource]);

  const exitConnectMode = useCallback(() => {
    setConnectMode(false);
    connectModeRef.current = false;
    setConnectSource(null);
    connectSourceRef.current = null;
  }, []);

  const enterConnectMode = useCallback(() => {
    setConnectMode(true);
    connectModeRef.current = true;
    setConnectSource(null);
    connectSourceRef.current = null;
  }, []);

  const handleConnectClick = useCallback(
    async (node: GraphNode | null) => {
      if (!connectModeRef.current || !node || !opts.userId) return;
      if (node.nodeKind === "master" || node.id.startsWith("master-")) return;
      const mem =
        node.nodeKind === "memory" ||
        node.nodeKind === "attachment" ||
        (!node.nodeKind && !node.id.startsWith("cat:"));
      if (!mem) return;

      const src = connectSourceRef.current;
      if (!src) {
        setConnectSource(node);
        connectSourceRef.current = node;
        return;
      }
      if (src.id === node.id) return;

      const row: TablesInsert<"node_edges"> = {
        user_id: opts.userId,
        source_node_id: src.id,
        target_node_id: node.id,
        strength: 0.75,
        label: "",
        canvas_id: opts.canvasId ?? null,
      };
      const supabase = createClient();
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
      toast.success("Nodes connected");
      exitConnectMode();
    },
    [opts.userId, opts.canvasId, addEdge, exitConnectMode]
  );

  return {
    connectMode,
    connectSource,
    connectModeRef,
    connectSourceRef,
    handleConnectClick,
    enterConnectMode,
    exitConnectMode,
    setConnectMode,
    setConnectSource,
  };
}
