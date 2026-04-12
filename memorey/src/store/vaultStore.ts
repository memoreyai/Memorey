import "@/lib/immer-config";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createClient } from "@/lib/supabase/client";
import { fetchVaultsWithRetry } from "@/lib/vaults/fetchVaultsWithRetry";
import type { CategoryVault } from "@/types/memorey";
import { parseVaultColorOverrides } from "@/lib/vaultThemeResolve";
import { getGraphStore } from "@/store/graphStore";

export function mapVaultRow(r: {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  is_custom: boolean | null;
  is_active: boolean | null;
  display_order: number | null;
  pin_hash?: string | null;
  is_locked?: boolean | null;
  is_exportable?: boolean | null;
  default_card_accent?: string | null;
  default_card_bg?: string | null;
  default_card_text?: string | null;
  pill_fill_bg?: string | null;
  pill_border_color?: string | null;
  pill_text_color?: string | null;
  icon_key?: string | null;
  color_overrides?: unknown;
  show_empty_in_master?: boolean | null;
}): CategoryVault {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    color: r.color ?? "#5DCAA5",
    isCustom: Boolean(r.is_custom),
    isActive: r.is_active !== false,
    displayOrder: r.display_order ?? 0,
    isLocked: r.is_locked === true,
    pinHash: r.pin_hash ?? null,
    isExportable: r.is_exportable !== false,
    defaultCardAccent: r.default_card_accent ?? null,
    defaultCardBg: r.default_card_bg ?? null,
    defaultCardText: r.default_card_text ?? null,
    pillFillBg: r.pill_fill_bg ?? null,
    pillBorderColor: r.pill_border_color ?? null,
    pillTextColor: r.pill_text_color ?? null,
    iconKey: r.icon_key ?? null,
    colorOverrides: parseVaultColorOverrides(r.color_overrides),
    showEmptyInMaster: r.show_empty_in_master === true,
  };
}

function syncGraphVaults(vaults: CategoryVault[]) {
  getGraphStore().setVaults([...vaults]);
}

/** Clearer message when migration 041 columns are missing on the remote DB. */
function rethrowIfMissingVaultEmptyColumns(error: unknown): never {
  const msg = error instanceof Error ? error.message : String(error);
  if (
    msg.includes("show_empty_on_canvas") ||
    msg.includes("show_empty_in_master") ||
    /column.*does not exist/i.test(msg)
  ) {
    throw new Error(
      "Vault display settings need migration 041. In Supabase: SQL → run supabase/migrations/041_vault_show_empty_flags.sql"
    );
  }
  throw error;
}

export interface CanvasVaultLink {
  canvas_id: string;
  vault_id: string;
  showEmptyOnCanvas?: boolean;
}

export interface VaultStoreState {
  vaults: CategoryVault[];
  activeVaultIds: Set<string>;
  isLoading: boolean;
  /** Canvas–vault membership for VaultManager chips */
  canvasVaultLinks: CanvasVaultLink[];

  fetchVaults: (userId: string, canvasId?: string) => Promise<void>;
  fetchCanvasVaultLinks: (canvasIds: string[]) => Promise<void>;
  addVaultToCanvas: (vaultId: string, canvasId: string, order: number) => Promise<void>;
  removeVaultFromCanvas: (vaultId: string, canvasId: string) => Promise<void>;
  setCanvasVaultShowEmpty: (
    canvasId: string,
    vaultId: string,
    show: boolean
  ) => Promise<void>;
  setVaultShowEmptyInMaster: (
    userId: string,
    vaultId: string,
    show: boolean
  ) => Promise<void>;
  toggleVaultActive: (vaultId: string) => void;
  updateVault: (id: string, updates: Partial<CategoryVault>) => void;
  addVault: (vault: CategoryVault) => void;
  removeVault: (id: string) => void;
  reorderVaults: (ordered: CategoryVault[]) => void;
  addCustomVault: (
    userId: string,
    name: string,
    color: string
  ) => Promise<CategoryVault>;
}

export const useVaultStore = create<VaultStoreState>()(
  immer((set, get) => ({
    vaults: [],
    activeVaultIds: new Set<string>(),
    isLoading: false,
    canvasVaultLinks: [],

    fetchVaults: async (userId, canvasId) => {
      set((d) => {
        d.isLoading = true;
        if (canvasId) {
          d.vaults = [];
          d.activeVaultIds = new Set();
        }
      });
      if (canvasId) {
        syncGraphVaults([]);
      }
      try {
        const supabase = createClient();
        if (canvasId) {
          const { data } = await supabase
            .from("canvas_vaults")
            .select("vault_id, display_order, category_vaults(*)")
            .eq("canvas_id", canvasId)
            .order("display_order", { ascending: true });

          const rows = (data ?? []) as unknown as { category_vaults?: Parameters<typeof mapVaultRow>[0] | null }[];
          const vaults = rows
            .map((row) => row.category_vaults)
            .filter((v): v is Parameters<typeof mapVaultRow>[0] => v != null)
            .map((row) => mapVaultRow(row))
            .filter((v) => v.isActive);

          set((draft) => {
            draft.vaults = vaults;
            const active = vaults.filter((v) => v.isActive).map((v) => v.id);
            draft.activeVaultIds = new Set(
              active.length > 0 ? active : vaults.map((v) => v.id)
            );
            draft.isLoading = false;
          });
        } else {
          const data = await fetchVaultsWithRetry(supabase, userId);
          const vaults = data.map((row) =>
            mapVaultRow(row as Parameters<typeof mapVaultRow>[0])
          );
          set((draft) => {
            draft.vaults = vaults;
            const active = vaults.filter((v) => v.isActive).map((v) => v.id);
            draft.activeVaultIds = new Set(
              active.length > 0 ? active : vaults.map((v) => v.id)
            );
            draft.isLoading = false;
          });
        }
        syncGraphVaults(get().vaults);
      } catch (e) {
        set((d) => {
          d.isLoading = false;
        });
        const msg = e instanceof Error ? e.message : "Failed to fetch vaults";
        throw new Error(msg);
      }
    },

    fetchCanvasVaultLinks: async (canvasIds) => {
      if (canvasIds.length === 0) {
        set((d) => {
          d.canvasVaultLinks = [];
        });
        return;
      }
      const supabase = createClient();
      const { data } = await supabase
        .from("canvas_vaults")
        .select("*")
        .in("canvas_id", canvasIds);
      set((draft) => {
        draft.canvasVaultLinks = (data ?? []).map((row) => {
          const r = row as {
            canvas_id: string;
            vault_id: string;
            show_empty_on_canvas?: boolean | null;
          };
          return {
            canvas_id: r.canvas_id,
            vault_id: r.vault_id,
            showEmptyOnCanvas: r.show_empty_on_canvas === true,
          };
        });
      });
    },

    addVaultToCanvas: async (vaultId, canvasId, order) => {
      const supabase = createClient();
      await supabase.from("canvas_vaults").upsert(
        {
          canvas_id: canvasId,
          vault_id: vaultId,
          display_order: order,
        },
        { onConflict: "canvas_id,vault_id" }
      );
      const canvasIds = [canvasId];
      const { data } = await supabase
        .from("canvas_vaults")
        .select("*")
        .in("canvas_id", canvasIds);
      const mapped = (data ?? []).map((row) => {
        const r = row as {
          canvas_id: string;
          vault_id: string;
          show_empty_on_canvas?: boolean | null;
        };
        return {
          canvas_id: r.canvas_id,
          vault_id: r.vault_id,
          showEmptyOnCanvas: r.show_empty_on_canvas === true,
        };
      });
      set((draft) => {
        draft.canvasVaultLinks = [
          ...draft.canvasVaultLinks.filter(
            (l) => !(l.canvas_id === canvasId && l.vault_id === vaultId)
          ),
          ...mapped,
        ];
      });
    },

    setCanvasVaultShowEmpty: async (canvasId, vaultId, show) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("canvas_vaults")
        .update({ show_empty_on_canvas: show })
        .eq("canvas_id", canvasId)
        .eq("vault_id", vaultId);
      if (error) rethrowIfMissingVaultEmptyColumns(error);
      set((draft) => {
        const row = draft.canvasVaultLinks.find(
          (l) => l.canvas_id === canvasId && l.vault_id === vaultId
        );
        if (row) row.showEmptyOnCanvas = show;
      });
    },

    setVaultShowEmptyInMaster: async (userId, vaultId, show) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("category_vaults")
        .update({ show_empty_in_master: show })
        .eq("id", vaultId)
        .eq("user_id", userId);
      if (error) rethrowIfMissingVaultEmptyColumns(error);
      set((draft) => {
        const v = draft.vaults.find((x) => x.id === vaultId);
        if (v) v.showEmptyInMaster = show;
      });
      syncGraphVaults(get().vaults);
    },

    removeVaultFromCanvas: async (vaultId, canvasId) => {
      const supabase = createClient();
      await supabase
        .from("canvas_vaults")
        .delete()
        .eq("canvas_id", canvasId)
        .eq("vault_id", vaultId);
      set((draft) => {
        draft.canvasVaultLinks = draft.canvasVaultLinks.filter(
          (l) => !(l.canvas_id === canvasId && l.vault_id === vaultId)
        );
      });
    },

    toggleVaultActive: (vaultId) =>
      set((draft) => {
        if (draft.activeVaultIds.has(vaultId)) {
          draft.activeVaultIds.delete(vaultId);
        } else {
          draft.activeVaultIds.add(vaultId);
        }
      }),

    updateVault: (id, updates) => {
      set((draft) => {
        const v = draft.vaults.find((x) => x.id === id);
        if (v) Object.assign(v, updates);
      });
      syncGraphVaults(get().vaults);
    },

    addVault: (vault) => {
      set((draft) => {
        if (draft.vaults.some((x) => x.id === vault.id)) return;
        draft.vaults.push(vault);
        if (vault.isActive) draft.activeVaultIds.add(vault.id);
      });
      syncGraphVaults(get().vaults);
    },

    removeVault: (id) => {
      set((draft) => {
        draft.vaults = draft.vaults.filter((x) => x.id !== id);
        draft.activeVaultIds.delete(id);
      });
      syncGraphVaults(get().vaults);
    },

    reorderVaults: (ordered) => {
      set((draft) => {
        draft.vaults = ordered.map((v, i) => ({
          ...v,
          displayOrder: i + 1,
        }));
      });
      syncGraphVaults(get().vaults);
    },

    addCustomVault: async (userId, name, color) => {
      const supabase = createClient();
      const { vaults } = get();
      const nextOrder =
        vaults.reduce((m, v) => Math.max(m, v.displayOrder), 0) + 1;

      const { data: sub } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", userId)
        .maybeSingle();
      const { count: activeVaultCount } = await supabase
        .from("category_vaults")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("is_active", true);
      const isPro =
        sub?.plan === "pro" || sub?.plan === "enterprise";
      const isActive =
        isPro || (activeVaultCount ?? 0) < 3;

      const { data, error } = await supabase
        .from("category_vaults")
        .insert({
          user_id: userId,
          name: name.trim(),
          color,
          is_custom: true,
          is_active: isActive,
          display_order: nextOrder,
        })
        .select("*")
        .single();

      if (error) throw error;

      const vault = mapVaultRow(data as Parameters<typeof mapVaultRow>[0]);

      get().addVault(vault);
      return vault;
    },
  }))
);
