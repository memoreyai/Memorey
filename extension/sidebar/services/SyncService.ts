import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  MemoreyPipeline,
  MemoryNode,
  MemoryEdge,
  MemoreyEvent,
  VaultDefinition,
} from "memorey-core";
import { createSupabaseClient } from "../utils/supabase";

// ── Supabase row shapes ──────────────────────────────────────────────

interface VaultRow {
  id: string;
  name: string;
  color: string | null;
  is_active: boolean | null;
  is_custom: boolean | null;
  display_order: number | null;
}

interface NodeRow {
  id: string;
  user_id: string;
  vault_id: string;
  title: string;
  value: string;
  confidence: number | null;
  source: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface EdgeRow {
  id: string;
  user_id: string;
  source_node_id: string;
  target_node_id: string;
  strength: number | null;
  label: string | null;
  created_at: string | null;
}

// ── Result types ─────────────────────────────────────────────────────

export interface PullResult {
  added: number;
  updated: number;
  conflicts: number;
}

export interface PushResult {
  pushed: number;
  errors: string[];
}

export interface SyncResult {
  pulled: { added: number; updated: number };
  pushed: number;
  conflicts: number;
  errors: string[];
  timestamp: string;
}

export type SyncStatus = "synced" | "syncing" | "offline" | "not_connected";

// ── Vault slug → Supabase display name mapping ─────────────────────
// memorey-core uses slugs (identity, knowledge, projects, …)
// Supabase seeds display names (Personal, Study, Goals, …)
const VAULT_SLUG_TO_DISPLAY: Record<string, string> = {
  identity: "personal",
  work: "work",
  preferences: "preferences",
  knowledge: "study",
  relationships: "relationships",
  projects: "goals",
  history: "personal",
  context: "personal",
};

function resolveVaultId(
  vaultSlug: string,
  nameToId: Map<string, string>
): string | undefined {
  const lower = vaultSlug.toLowerCase();
  const direct = nameToId.get(lower);
  if (direct) return direct;
  const mapped = VAULT_SLUG_TO_DISPLAY[lower];
  if (mapped) return nameToId.get(mapped);
  return undefined;
}

// ── Helpers ──────────────────────────────────────────────────────────

function nodeToRow(
  node: MemoryNode,
  userId: string,
  vaultNameToId: Map<string, string>
): Omit<NodeRow, "created_at"> & { created_at: string } {
  return {
    id: node.id,
    user_id: userId,
    vault_id: resolveVaultId(node.vault, vaultNameToId) ?? node.vault,
    title: node.fact.slice(0, 100),
    value: node.fact,
    confidence: node.confidence,
    source: node.source.platform === "extension" ? "extension" : "extension",
    is_active: node.supersededBy === null,
    created_at: node.createdAt,
    updated_at: node.updatedAt,
  };
}

function rowToPartialNode(
  row: NodeRow,
  vaultIdToName: Map<string, string>
): {
  id: string;
  fact: string;
  vault: string;
  confidence: number;
  updatedAt: string;
  createdAt: string;
  isActive: boolean;
} {
  return {
    id: row.id,
    fact: row.value,
    vault: vaultIdToName.get(row.vault_id) ?? row.vault_id,
    confidence: row.confidence ?? 1,
    updatedAt: row.updated_at ?? new Date().toISOString(),
    createdAt: row.created_at ?? new Date().toISOString(),
    isActive: row.is_active !== false,
  };
}

// ── SyncService ──────────────────────────────────────────────────────

export class SyncService {
  private supabase: SupabaseClient | null;
  private pipeline: MemoreyPipeline;
  private userId: string | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private pendingChanges: MemoreyEvent[] = [];
  private unsubscribe: (() => void) | null = null;
  private _status: SyncStatus = "not_connected";
  private _lastSyncTime: string | null = null;
  private onStatusChange?: (status: SyncStatus) => void;
  private onSyncComplete?: (result: SyncResult) => void;

  constructor(
    pipeline: MemoreyPipeline,
    accessToken?: string,
    callbacks?: {
      onStatusChange?: (status: SyncStatus) => void;
      onSyncComplete?: (result: SyncResult) => void;
    }
  ) {
    this.pipeline = pipeline;
    this.supabase = accessToken
      ? createSupabaseClient(accessToken)
      : null;
    this.onStatusChange = callbacks?.onStatusChange;
    this.onSyncComplete = callbacks?.onSyncComplete;
  }

  get status(): SyncStatus {
    return this._status;
  }

  get lastSyncTime(): string | null {
    return this._lastSyncTime;
  }

  isConnected(): boolean {
    return this.supabase !== null && this.userId !== null;
  }

  private setStatus(s: SyncStatus) {
    this._status = s;
    this.onStatusChange?.(s);
  }

  // Resolve the authenticated user ID from the token
  async authenticate(): Promise<boolean> {
    if (!this.supabase) return false;
    try {
      const {
        data: { user },
        error,
      } = await this.supabase.auth.getUser();
      if (error || !user) return false;
      this.userId = user.id;
      this.setStatus("synced");
      return true;
    } catch {
      this.setStatus("offline");
      return false;
    }
  }

  // ── Vault mapping helpers ────────────────────────────────────────

  private async fetchVaultMaps(): Promise<{
    nameToId: Map<string, string>;
    idToName: Map<string, string>;
  }> {
    const nameToId = new Map<string, string>();
    const idToName = new Map<string, string>();
    if (!this.supabase || !this.userId) return { nameToId, idToName };

    const { data } = await this.supabase
      .from("category_vaults")
      .select("id, name, is_active")
      .eq("user_id", this.userId)
      .eq("is_active", true);

    for (const v of (data ?? []) as VaultRow[]) {
      nameToId.set(v.name.toLowerCase(), v.id);
      idToName.set(v.id, v.name);
    }
    return { nameToId, idToName };
  }

  // ── Pull ─────────────────────────────────────────────────────────

  async pull(): Promise<PullResult> {
    if (!this.supabase || !this.userId) {
      return { added: 0, updated: 0, conflicts: 0 };
    }

    this.setStatus("syncing");
    try {
      const { idToName } = await this.fetchVaultMaps();
      const { data, error } = await this.supabase
        .from("memory_nodes")
        .select("id, user_id, vault_id, title, value, confidence, source, is_active, created_at, updated_at")
        .eq("user_id", this.userId)
        .eq("is_active", true)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) {
        console.error("SyncService pull:", error);
        this.setStatus("offline");
        return { added: 0, updated: 0, conflicts: 0 };
      }

      const remoteRows = (data ?? []) as NodeRow[];
      const localGraph = this.pipeline.exportGraph();
      const localById = new Map(localGraph.nodes.map((n) => [n.id, n]));

      let added = 0;
      let updated = 0;
      let conflicts = 0;

      for (const row of remoteRows) {
        const partial = rowToPartialNode(row, idToName);
        const local = localById.get(row.id);

        if (!local) {
          // New node from cloud — add locally
          added++;
        } else {
          const localTime = new Date(local.updatedAt).getTime();
          const remoteTime = new Date(partial.updatedAt).getTime();

          if (remoteTime > localTime) {
            updated++;
          } else if (
            remoteTime < localTime &&
            local.fact !== partial.fact
          ) {
            conflicts++;
          }
        }
      }

      // Re-import the full graph to merge remote data
      if (added > 0 || updated > 0) {
        const mergedNodes: MemoryNode[] = [...localGraph.nodes];
        for (const row of remoteRows) {
          const partial = rowToPartialNode(row, idToName);
          const idx = mergedNodes.findIndex((n) => n.id === row.id);
          if (idx === -1) {
            mergedNodes.push({
              id: partial.id,
              fact: partial.fact,
              vault: partial.vault,
              confidence: partial.confidence,
              status: "approved",
              source: {
                platform: row.source ?? "manual",
                timestamp: partial.createdAt,
              },
              createdAt: partial.createdAt,
              updatedAt: partial.updatedAt,
              supersededBy: null,
              tags: [],
              changelog: [],
            });
          } else {
            const local = mergedNodes[idx];
            const remoteTime = new Date(partial.updatedAt).getTime();
            const localTime = new Date(local.updatedAt).getTime();
            if (remoteTime > localTime) {
              mergedNodes[idx] = {
                ...local,
                fact: partial.fact,
                vault: partial.vault,
                confidence: partial.confidence,
                updatedAt: partial.updatedAt,
              };
            }
          }
        }
        await this.pipeline.importGraph({
          ...localGraph,
          nodes: mergedNodes,
        });
      }

      this.setStatus("synced");
      return { added, updated, conflicts };
    } catch (e) {
      console.error("SyncService pull:", e);
      this.setStatus("offline");
      return { added: 0, updated: 0, conflicts: 0 };
    }
  }

  // ── Push ─────────────────────────────────────────────────────────

  async push(): Promise<PushResult> {
    if (!this.supabase || !this.userId) {
      return { pushed: 0, errors: [] };
    }

    this.setStatus("syncing");
    try {
      const { nameToId } = await this.fetchVaultMaps();
      const graph = this.pipeline.exportGraph();

      // Only sync approved / auto_approved nodes
      const pushable = graph.nodes.filter(
        (n) =>
          (n.status === "approved" || n.status === "auto_approved") &&
          n.supersededBy === null
      );

      const errors: string[] = [];
      let pushed = 0;

      // Batch upsert in chunks of 50
      const BATCH_SIZE = 50;
      for (let i = 0; i < pushable.length; i += BATCH_SIZE) {
        const batch = pushable.slice(i, i + BATCH_SIZE);
        const rows = batch
          .map((node) => {
            const vaultId = resolveVaultId(node.vault, nameToId);
            if (!vaultId) return null;
            return nodeToRow(node, this.userId!, nameToId);
          })
          .filter((r): r is NonNullable<typeof r> => r !== null);

        if (rows.length === 0) continue;

        const { error } = await this.supabase
          .from("memory_nodes")
          .upsert(rows, { onConflict: "id" });

        if (error) {
          errors.push(error.message);
          console.error("SyncService push batch:", error);
        } else {
          pushed += rows.length;
        }
      }

      // Push edges
      const edgeRows = graph.edges
        .map((e) => ({
          id: e.id,
          user_id: this.userId!,
          source_node_id: e.fromId,
          target_node_id: e.toId,
          strength: e.weight,
          label: e.relation,
          created_at: e.createdAt,
        }))
        .filter((e) => {
          const srcExists = pushable.some((n) => n.id === e.source_node_id);
          const tgtExists = pushable.some((n) => n.id === e.target_node_id);
          return srcExists && tgtExists;
        });

      if (edgeRows.length > 0) {
        const { error } = await this.supabase
          .from("node_edges")
          .upsert(edgeRows, { onConflict: "id" });
        if (error) {
          errors.push(`edges: ${error.message}`);
        }
      }

      this.setStatus(errors.length === 0 ? "synced" : "offline");
      return { pushed, errors };
    } catch (e) {
      console.error("SyncService push:", e);
      this.setStatus("offline");
      return { pushed: 0, errors: [String(e)] };
    }
  }

  // ── Full bidirectional sync ──────────────────────────────────────

  async sync(): Promise<SyncResult> {
    const pulled = await this.pull();
    const pushResult = await this.push();

    const result: SyncResult = {
      pulled: { added: pulled.added, updated: pulled.updated },
      pushed: pushResult.pushed,
      conflicts: pulled.conflicts,
      errors: pushResult.errors,
      timestamp: new Date().toISOString(),
    };

    this._lastSyncTime = result.timestamp;
    this.onSyncComplete?.(result);
    return result;
  }

  // ── Auto-sync ────────────────────────────────────────────────────

  startAutoSync(): void {
    if (this.syncTimer) return;

    // Subscribe to pipeline events and queue changes
    this.unsubscribe = this.pipeline.onAny((event: MemoreyEvent) => {
      this.pendingChanges.push(event);
    });

    // Flush queued changes every 5 seconds
    this.syncTimer = setInterval(async () => {
      if (this.pendingChanges.length === 0) return;
      this.pendingChanges = [];
      try {
        await this.push();
      } catch (e) {
        console.error("SyncService auto-push:", e);
      }
    }, 5_000);
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
  }

  disconnect(): void {
    this.stopAutoSync();
    this.supabase = null;
    this.userId = null;
    this.pendingChanges = [];
    this.setStatus("not_connected");
  }
}
