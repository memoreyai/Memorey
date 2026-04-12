import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MemoryNode,
  VaultDefinition,
  MemoryEdge,
  Canvas,
  PendingProposal,
  Stats,
} from "../types";

export interface SupabaseData {
  nodes: MemoryNode[];
  vaults: VaultDefinition[];
  edges: MemoryEdge[];
  canvases: Canvas[];
  pendingProposals: PendingProposal[];
  stats: Stats;
  recentFacts: MemoryNode[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useSupabaseData(
  supabase: SupabaseClient | null,
  userId: string | null
): SupabaseData {
  const [nodes, setNodes] = useState<MemoryNode[]>([]);
  const [vaults, setVaults] = useState<VaultDefinition[]>([]);
  const [edges, setEdges] = useState<MemoryEdge[]>([]);
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [pendingProposals, setPendingProposals] = useState<PendingProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const supabaseRef = useRef(supabase);
  supabaseRef.current = supabase;

  const fetchedRef = useRef(false);

  const refresh = useCallback(async () => {
    const client = supabaseRef.current;
    if (!client || !userId) return;
    setLoading(true);
    setError(null);

    try {
      const [nodesRes, vaultsRes, edgesRes, canvasesRes, proposalsRes] =
        await Promise.all([
          client
            .from("memory_nodes")
            .select("*, category_vaults(id, name, color, icon)")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("created_at", { ascending: false }),
          client
            .from("category_vaults")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("display_order", { ascending: true }),
          client.from("node_edges").select("*").eq("user_id", userId),
          client
            .from("canvases")
            .select("*")
            .eq("user_id", userId)
            .eq("is_active", true)
            .order("display_order", { ascending: true }),
          client
            .from("pending_proposals")
            .select("*")
            .eq("user_id", userId)
            .eq("status", "pending"),
        ]);

      if (nodesRes.error) throw nodesRes.error;
      if (vaultsRes.error) throw vaultsRes.error;
      if (edgesRes.error) throw edgesRes.error;

      const rawVaults = vaultsRes.data ?? [];
      const parsedVaults: VaultDefinition[] = rawVaults.map(
        (v: Record<string, unknown>) => ({
          id: v.id as string,
          name: v.name as string,
          description: (v.slug as string) ?? "",
          color: (v.color as string) ?? undefined,
        })
      );

      const rawNodes = nodesRes.data ?? [];
      const parsedNodes: MemoryNode[] = rawNodes.map(
        (r: Record<string, unknown>) => {
          const embedded = r.category_vaults as Record<string, unknown> | null;
          return {
            id: r.id as string,
            fact: (r.value as string) || (r.title as string) || "",
            vault: r.vault_id as string,
            vaultName: embedded?.name as string | undefined,
            vaultColor: embedded?.color as string | undefined,
            canvasId: (r.canvas_id as string) ?? null,
            confidence: (r.confidence as number) ?? 1,
            status:
              (r.is_active as boolean) !== false ? "approved" : "rejected",
            tags: [],
            source: {
              platform: (r.source as string) ?? "web",
              timestamp: r.created_at as string,
            },
            createdAt: r.created_at as string,
            updatedAt:
              (r.updated_at as string) ?? (r.created_at as string),
            changelog: [],
            supersededBy: null,
          } as MemoryNode;
        }
      );

      const parsedEdges: MemoryEdge[] = (edgesRes.data ?? []).map(
        (e: Record<string, unknown>) => ({
          id: e.id as string,
          fromId: e.source_node_id as string,
          toId: e.target_node_id as string,
          relation: (e.label as string) ?? "related",
          strength: (e.strength as number) ?? 1,
          createdAt: (e.created_at as string) ?? undefined,
        })
      );

      const parsedCanvases: Canvas[] = (canvasesRes.data ?? []).map(
        (c: Record<string, unknown>) => ({
          id: c.id as string,
          name: c.name as string,
          emoji: (c.emoji as string) ?? null,
          is_active: true,
          display_order: (c.display_order as number) ?? 0,
          user_id: userId,
          created_at: c.created_at as string,
        })
      );

      const parsedProposals: PendingProposal[] = (
        proposalsRes.data ?? []
      ).map((p: Record<string, unknown>) => ({
        id: p.id as string,
        user_id: userId,
        proposed_value: (p.proposed_value as string) ?? (p.value as string) ?? "",
        proposed_title: (p.proposed_title as string) ?? (p.title as string) ?? null,
        proposed_vault_id: (p.proposed_vault_id as string) ?? (p.vault_id as string) ?? null,
        proposed_vault_name: (p.proposed_vault_name as string) ?? null,
        source: (p.source as string) ?? null,
        status: "pending" as const,
        created_at: p.created_at as string,
      }));

      setNodes(parsedNodes);
      setVaults(parsedVaults);
      setEdges(parsedEdges);
      setCanvases(parsedCanvases);
      setPendingProposals(parsedProposals);
      setError(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "object" && err !== null && "message" in err
            ? String((err as { message: unknown }).message)
            : "Failed to load data";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId || !supabaseRef.current) return;
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void refresh();
  }, [userId, refresh]);

  const stats: Stats = useMemo(() => {
    const vaultBreakdown: Record<string, number> = {};
    nodes.forEach((n) => {
      const vName = vaults.find((v) => v.id === n.vault)?.name ?? "Unknown";
      vaultBreakdown[vName] = (vaultBreakdown[vName] ?? 0) + 1;
    });
    return {
      totalFacts: nodes.length,
      activeFacts: nodes.length,
      pendingCount: pendingProposals.length,
      vaultBreakdown,
    };
  }, [nodes, vaults, pendingProposals.length]);

  const recentFacts = useMemo(() => nodes.slice(0, 10), [nodes]);

  return {
    nodes,
    vaults,
    edges,
    canvases,
    pendingProposals,
    stats,
    recentFacts,
    loading,
    error,
    refresh,
  };
}
