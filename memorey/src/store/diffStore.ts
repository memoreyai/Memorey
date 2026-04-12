import "@/lib/immer-config";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createClient } from "@/lib/supabase/client";
import {
  mapCategoryVaultRow,
  resolveVaultId,
} from "@/lib/vaults/resolveVaultId";
import type { CategoryVault, DiffProposal, MemoryNode, ProposedNode } from "@/types/memorey";
import { getGraphStore } from "@/store/graphStore";

function rowToMemoryNode(
  row: {
    id: string;
    user_id: string;
    vault_id: string;
    title: string;
    value: string;
    confidence: number;
    source: string;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  },
  vaultName: string
): MemoryNode {
  return {
    id: row.id,
    userId: row.user_id,
    vaultId: row.vault_id,
    vaultName,
    title: row.title,
    value: row.value,
    confidence: row.confidence,
    source: row.source as MemoryNode["source"],
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function requestEmbedForNode(
  nodeId: string,
  title: string,
  value: string,
  accessToken: string | null
): Promise<void> {
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }
    await fetch("/api/embed", {
      method: "POST",
      headers,
      body: JSON.stringify({
        nodeId,
        text: `${title}\n${value}`.slice(0, 2000),
      }),
    });
  } catch {
    // embedding is best-effort
  }
}

export interface DiffStoreState {
  queue: DiffProposal | null;
  isOpen: boolean;
  isConfirming: boolean;

  openDiff: (proposal: DiffProposal) => void;
  closeDiff: () => void;
  rejectAll: () => void;
  confirmNodes: (
    proposedNodes: ProposedNode[],
    userId: string,
    options?: {
      memorySource?: MemoryNode["source"];
      canvasId?: string | null;
    }
  ) => Promise<number>;
}

export const useDiffStore = create<DiffStoreState>()(
  immer((set, get) => ({
    queue: null,
    isOpen: false,
    isConfirming: false,

    openDiff: (proposal) =>
      set((draft) => {
        draft.queue = proposal;
        draft.isOpen = true;
      }),

    closeDiff: () =>
      set((draft) => {
        draft.isOpen = false;
        draft.queue = null;
      }),

    rejectAll: () =>
      set((draft) => {
        draft.queue = null;
        draft.isOpen = false;
      }),

    confirmNodes: async (proposedNodes, _userId, options) => {
      const insertSource = options?.memorySource ?? "chat";
      const canvasIdForInsert =
        options?.canvasId ?? get().queue?.canvasId ?? undefined;

      set((d) => {
        d.isConfirming = true;
      });

      const supabase = createClient();
      const graph = getGraphStore();
      let saved = 0;
      let clearedPendingProposal = false;

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();

        if (authError || !user) {
          throw new Error("Authentication error. Please sign in again.");
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          throw new Error("No active session. Please sign in again.");
        }

        const userId = user.id;
        const accessToken = session.access_token;

        const VAULT_SELECT =
          "id, user_id, name, color, is_custom, is_active, display_order" as const;

        async function fetchVaultsForUser(): Promise<CategoryVault[]> {
          const { data, error } = await supabase
            .from("category_vaults")
            .select(VAULT_SELECT)
            .eq("user_id", userId)
            .order("display_order", { ascending: true });

          if (error) {
            console.error("fetchVaultsForUser:", error);
            return [];
          }
          if (data?.length) return data.map(mapCategoryVaultRow);
          return [];
        }

        async function seedDefaultVaults(): Promise<void> {
          const { error } = await supabase.rpc("seed_default_vaults", {
            p_user_id: userId,
          });
          if (error) console.error("seed_default_vaults:", error);
        }

        let vaults = await fetchVaultsForUser();
        if (vaults.length === 0) {
          await seedDefaultVaults();
          await new Promise((r) => setTimeout(r, 500));
          vaults = await fetchVaultsForUser();
        }

        async function resolveVaultIdWithRetry(
          node: ProposedNode
        ): Promise<{ id: string; name: string } | null> {
          let vaultId = resolveVaultId(vaults, node);

          if (!vaultId) {
            await seedDefaultVaults();
            await new Promise((r) => setTimeout(r, 500));
            const { data: fresh } = await supabase
              .from("category_vaults")
              .select("*")
              .eq("user_id", userId)
              .eq("is_active", true)
              .order("display_order", { ascending: true });

            const mapped = (fresh ?? []).map((row) =>
              mapCategoryVaultRow(
                row as Parameters<typeof mapCategoryVaultRow>[0]
              )
            );
            if (mapped.length) {
              vaults = mapped;
            }
            vaultId = resolveVaultId(vaults, node);
          }

          if (!vaultId) {
            console.error("Cannot resolve vault even after seeding. Skipping node.");
            return null;
          }

          const v = vaults.find((x) => x.id === vaultId);
          if (!v) {
            console.error("Resolved vault id not in vault list. Skipping node.");
            return null;
          }
          return { id: v.id, name: v.name };
        }

        for (const p of proposedNodes) {
          const vault = await resolveVaultIdWithRetry(p);
          if (!vault) continue;

          if (p.isNew) {
            const effectiveVaultId = vault.id;
            const res = await fetch("/api/memory/create", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${accessToken}`,
              },
              body: JSON.stringify({
                vaultId: effectiveVaultId,
                title: p.title,
                value: p.newValue,
                confidence: p.confidence,
                source: insertSource,
                userId,
                canvasId: canvasIdForInsert ?? null,
              }),
            });
            const payload = (await res.json()) as {
              error?: string;
              node?: Parameters<typeof rowToMemoryNode>[0];
            };
            if (!res.ok) {
              console.error(
                "memory/create failed (skipping node):",
                payload.error ?? res.status,
                p.title
              );
              continue;
            }
            const data = payload.node;
            if (!data) {
              console.error("memory/create: no node in response", p.title);
              continue;
            }

            graph.addNode(rowToMemoryNode(data as never, vault.name));
            void requestEmbedForNode(
              data.id,
              p.title,
              p.newValue,
              accessToken
            );
            if (p.pendingProposalId) {
              const { error: delErr } = await supabase
                .from("pending_proposals")
                .delete()
                .eq("id", p.pendingProposalId)
                .eq("user_id", userId);
              if (delErr) console.error("pending_proposals delete:", delErr);
              else clearedPendingProposal = true;
            }
            saved += 1;
          } else if (p.nodeId) {
            const existingNode = graph.nodes.find((n) => n.id === p.nodeId);
            const { data, error } = await supabase
              .from("memory_nodes")
              .update({
                title: p.title.slice(0, 100),
                value: p.newValue.slice(0, 600),
                confidence: Math.min(1, Math.max(0, p.confidence)),
              })
              .eq("id", p.nodeId)
              .eq("user_id", userId)
              .select(
                "id, user_id, vault_id, title, value, confidence, source, is_active, created_at, updated_at"
              )
              .single();

            if (error) {
              console.error("memory_nodes update:", error);
              continue;
            }
            if (data) {
              await supabase.from("node_history").insert({
                node_id: p.nodeId,
                user_id: userId,
                old_title: existingNode?.title ?? "",
                new_title: p.title.slice(0, 100),
                old_value: existingNode?.value ?? "",
                new_value: p.newValue.slice(0, 600),
                change_summary: "Updated via AI proposal",
                triggered_by: "ai_extract",
              });
              const v =
                vaults.find((x) => x.id === data.vault_id) ?? vault;
              graph.updateNode(
                data.id,
                rowToMemoryNode(data as never, v.name)
              );
              void requestEmbedForNode(
                data.id,
                p.title,
                p.newValue,
                accessToken
              );
              saved += 1;
            }
          }
        }

        set((draft) => {
          draft.queue = null;
          draft.isOpen = false;
          draft.isConfirming = false;
        });
        if (
          clearedPendingProposal &&
          typeof globalThis !== "undefined" &&
          "dispatchEvent" in globalThis
        ) {
          globalThis.dispatchEvent(
            new CustomEvent("memorey-pending-refresh")
          );
        }
        return saved;
      } catch (e) {
        set((draft) => {
          draft.isConfirming = false;
        });
        throw e;
      }
    },
  }))
);
