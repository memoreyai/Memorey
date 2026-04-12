import { useCallback } from "react";
import { createSupabaseClient } from "../utils/supabase";
import { useAuthContext } from "./useAuth";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";

export function useNodeActions() {
  const { token } = useAuthContext();
  const { allNodes } = useMemoreyState();
  const dispatch = useMemoreyDispatch();

  const getClient = useCallback(() => {
    if (!token) return null;
    return createSupabaseClient(token);
  }, [token]);

  const approveNode = useCallback(
    async (id: string) => {
      const client = getClient();
      if (!client) return;

      await client
        .from("memory_nodes")
        .update({ is_active: true, updated_at: new Date().toISOString() })
        .eq("id", id);

      const node = allNodes.find((n) => n.id === id);
      if (node) {
        dispatch({ type: "UPDATE_NODE", node: { ...node, status: "approved" } });
      }
    },
    [getClient, allNodes, dispatch]
  );

  const rejectNode = useCallback(
    async (id: string) => {
      const client = getClient();
      if (!client) return;

      await client
        .from("memory_nodes")
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq("id", id);

      const node = allNodes.find((n) => n.id === id);
      if (node) {
        dispatch({ type: "UPDATE_NODE", node: { ...node, status: "rejected" } });
      }
    },
    [getClient, allNodes, dispatch]
  );

  const editNodeFact = useCallback(
    async (id: string, newFact: string) => {
      const client = getClient();
      if (!client) return;

      await client
        .from("memory_nodes")
        .update({
          value: newFact,
          title: newFact.slice(0, 100),
          updated_at: new Date().toISOString(),
        })
        .eq("id", id);

      const node = allNodes.find((n) => n.id === id);
      if (node) {
        dispatch({ type: "UPDATE_NODE", node: { ...node, fact: newFact } });
      }
    },
    [getClient, allNodes, dispatch]
  );

  const changeNodeVault = useCallback(
    async (id: string, vaultId: string) => {
      const client = getClient();
      if (!client) return;

      await client
        .from("memory_nodes")
        .update({ vault_id: vaultId, updated_at: new Date().toISOString() })
        .eq("id", id);

      const node = allNodes.find((n) => n.id === id);
      if (node) {
        dispatch({ type: "UPDATE_NODE", node: { ...node, vault: vaultId } });
      }
    },
    [getClient, allNodes, dispatch]
  );

  const updateNodeConfidence = useCallback(
    async (id: string, confidence: number) => {
      const client = getClient();
      if (!client) return;

      await client
        .from("memory_nodes")
        .update({ confidence, updated_at: new Date().toISOString() })
        .eq("id", id);

      const node = allNodes.find((n) => n.id === id);
      if (node) {
        dispatch({ type: "UPDATE_NODE", node: { ...node, confidence } });
      }
    },
    [getClient, allNodes, dispatch]
  );

  return {
    approveNode,
    rejectNode,
    editNodeFact,
    changeNodeVault,
    updateNodeConfidence,
  };
}
