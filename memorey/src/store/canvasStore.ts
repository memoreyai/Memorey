import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export interface Canvas {
  id: string;
  userId: string;
  name: string;
  description?: string | null;
  masterNodeBio?: string | null;
  masterNodeColor: string;
  masterLineStyle?: string | null;
  masterLineColor?: string | null;
  /** Null = no emoji in sidebar / labels. */
  emoji: string | null;
  /** Lucide icon name; when set, sidebar shows icon instead of emoji. */
  iconKey: string | null;
  /** Sidebar list accent (hex). */
  color: string;
  isActive: boolean;
  displayOrder: number;
  createdAt: string;
}

interface CanvasStore {
  canvases: Canvas[];
  activeCanvasId: string | null;
  activeCanvas: Canvas | null;
  /** Virtual aggregate graph/kanban — does not change `active_canvas_id` on profile */
  isMasterView: boolean;
  /** Canvases hidden in master view (persisted on `profiles.master_hidden_canvas_ids`) */
  masterHiddenCanvasIds: string[];
  isLoading: boolean;

  fetchCanvases: (userId: string) => Promise<void>;
  setActiveCanvas: (canvasId: string, userId: string) => Promise<void>;
  enterMasterView: () => void;
  exitMasterView: () => void;
  toggleCanvasVisibilityInMaster: (canvasId: string) => Promise<void>;
  isCanvasHiddenInMaster: (canvasId: string) => boolean;
  createCanvas: (
    userId: string,
    options: {
      name: string;
      emoji: string | null;
      description?: string;
    }
  ) => Promise<Canvas | null>;
  updateCanvas: (canvasId: string, updates: Partial<Canvas>) => Promise<void>;
  deleteCanvas: (canvasId: string, userId: string) => Promise<boolean>;
}

function mapRow(row: Record<string, unknown>): Canvas {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    description: row.description as string | null | undefined,
    masterNodeBio: row.master_node_bio as string | null | undefined,
    masterNodeColor: (row.master_node_color as string) ?? "#FF6600",
    masterLineStyle: row.master_line_style as string | null | undefined,
    masterLineColor: row.master_line_color as string | null | undefined,
    emoji: (row.emoji as string | null) ?? null,
    iconKey: (row.icon_key as string | null) ?? null,
    color: (row.color as string) ?? "#5DCAA5",
    isActive: row.is_active !== false,
    displayOrder: (row.display_order as number) ?? 1,
    createdAt: row.created_at as string,
  };
}

export const useCanvasStore = create<CanvasStore>((set, get) => ({
  canvases: [],
  activeCanvasId: null,
  activeCanvas: null,
  isMasterView: false,
  masterHiddenCanvasIds: [],
  isLoading: false,

  enterMasterView: () => {
    if (typeof window !== "undefined") {
      sessionStorage.setItem("memorey_master_view", "1");
    }
    set({ isMasterView: true });
  },

  exitMasterView: () => {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("memorey_master_view");
    }
    set({ isMasterView: false });
  },

  isCanvasHiddenInMaster: (canvasId: string) =>
    get().masterHiddenCanvasIds.includes(canvasId),

  toggleCanvasVisibilityInMaster: async (canvasId: string) => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const prev = get().masterHiddenCanvasIds;
    const nextSet = new Set(prev);
    if (nextSet.has(canvasId)) nextSet.delete(canvasId);
    else nextSet.add(canvasId);
    const next = [...nextSet];

    set({ masterHiddenCanvasIds: next });

    const { error } = await supabase
      .from("profiles")
      .update({ master_hidden_canvas_ids: next })
      .eq("id", user.id);

    if (error) {
      set({ masterHiddenCanvasIds: prev });
      console.error("toggleCanvasVisibilityInMaster:", error);
    }
  },

  fetchCanvases: async (userId) => {
    set({ isLoading: true });
    const supabase = createClient();
    const sessionMaster =
      typeof window !== "undefined" &&
      sessionStorage.getItem("memorey_master_view") === "1";
    const keepMaster = get().isMasterView || sessionMaster;

    const [
      { data: canvasRows },
      { data: profile },
    ] = await Promise.all([
      supabase
        .from("canvases")
        .select("*")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("display_order", { ascending: true }),
      supabase
        .from("profiles")
        .select("active_canvas_id, master_hidden_canvas_ids")
        .eq("id", userId)
        .single(),
    ]);

    const canvases = (canvasRows ?? []).map((row) =>
      mapRow(row as Record<string, unknown>)
    );
    const activeId = profile?.active_canvas_id as string | null;
    const activeCanvas =
      canvases.find((c) => c.id === activeId) ?? canvases[0] ?? null;
    const hiddenRaw = profile?.master_hidden_canvas_ids as string[] | null;
    const masterHiddenCanvasIds = Array.isArray(hiddenRaw) ? hiddenRaw : [];

    if (keepMaster) {
      set({
        canvases,
        activeCanvasId: activeCanvas?.id ?? null,
        activeCanvas,
        masterHiddenCanvasIds,
        isMasterView: true,
        isLoading: false,
      });
      return;
    }

    set({
      canvases,
      activeCanvasId: activeCanvas?.id ?? null,
      activeCanvas,
      masterHiddenCanvasIds,
      isMasterView: false,
      isLoading: false,
    });
  },

  setActiveCanvas: async (canvasId, userId) => {
    const canvas = get().canvases.find((c) => c.id === canvasId);
    if (!canvas) return;

    if (typeof window !== "undefined") {
      sessionStorage.removeItem("memorey_master_view");
    }
    set({ activeCanvasId: canvasId, activeCanvas: canvas, isMasterView: false });

    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({ active_canvas_id: canvasId })
      .eq("id", userId);
  },

  createCanvas: async (userId, options) => {
    const supabase = createClient();
    const { canvases } = get();

    const emojiTrimmed =
      typeof options.emoji === "string" ? options.emoji.trim() : "";
    const { data: newCanvas, error } = await supabase
      .from("canvases")
      .insert({
        user_id: userId,
        name: options.name.trim(),
        emoji: emojiTrimmed.length > 0 ? emojiTrimmed : null,
        description: options.description ?? null,
        display_order: canvases.length + 1,
        color: "#5DCAA5",
        icon_key: null,
      })
      .select()
      .single();

    if (error || !newCanvas) return null;
    const mapped = mapRow(newCanvas as Record<string, unknown>);

    // Optimistic: add to store immediately so the sidebar updates instantly
    set((s) => ({ canvases: [...s.canvases, mapped] }));

    try {
      const path =
        typeof window !== "undefined" ? window.location.pathname : "";
      void fetch("/api/track", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: "canvas_created",
          event_data: {},
          page_path: path || undefined,
        }),
        keepalive: true,
      });
    } catch {
      /* ignore */
    }

    const { error: seedError } = await supabase.rpc("seed_canvas_vaults", {
      p_user_id: userId,
      p_canvas_id: mapped.id,
    });
    if (seedError) {
      console.error("seed_canvas_vaults", seedError);
    }

    return mapped;
  },

  updateCanvas: async (canvasId, updates) => {
    const supabase = createClient();
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.emoji !== undefined) dbUpdates.emoji = updates.emoji;
    if (updates.description !== undefined)
      dbUpdates.description = updates.description;
    if (updates.masterNodeBio !== undefined)
      dbUpdates.master_node_bio = updates.masterNodeBio;
    if (updates.masterNodeColor !== undefined)
      dbUpdates.master_node_color = updates.masterNodeColor;
    if (updates.masterLineStyle !== undefined)
      dbUpdates.master_line_style = updates.masterLineStyle;
    if (updates.masterLineColor !== undefined)
      dbUpdates.master_line_color = updates.masterLineColor;
    if (updates.color !== undefined) dbUpdates.color = updates.color;
    if (updates.iconKey !== undefined) dbUpdates.icon_key = updates.iconKey;

    if (Object.keys(dbUpdates).length > 0) {
      await supabase.from("canvases").update(dbUpdates).eq("id", canvasId);
    }

    set((s) => ({
      canvases: s.canvases.map((c) =>
        c.id === canvasId ? { ...c, ...updates } : c
      ),
      activeCanvas:
        s.activeCanvas?.id === canvasId
          ? { ...s.activeCanvas, ...updates }
          : s.activeCanvas,
    }));
  },

  deleteCanvas: async (canvasId, userId) => {
    const { canvases, activeCanvasId, setActiveCanvas } = get();
    if (canvases.length <= 1) return false;

    const remainingSorted = canvases
      .filter((c) => c.id !== canvasId)
      .sort((a, b) => a.displayOrder - b.displayOrder);
    const targetCanvasId = remainingSorted[0]?.id;
    if (!targetCanvasId) return false;

    const supabase = createClient();

    await supabase
      .from("memory_nodes")
      .update({
        canvas_id: targetCanvasId,
        kanban_column_id: null,
        kanban_status: null,
        kanban_order: null,
      })
      .eq("canvas_id", canvasId)
      .eq("user_id", userId);

    await supabase.from("kanban_columns").delete().eq("canvas_id", canvasId);
    await supabase.from("canvas_vaults").delete().eq("canvas_id", canvasId);

    await supabase
      .from("canvases")
      .update({ is_active: false })
      .eq("id", canvasId)
      .eq("user_id", userId);

    const remaining = canvases.filter((c) => c.id !== canvasId);
    const newActive =
      activeCanvasId === canvasId
        ? remainingSorted[0]
        : canvases.find((c) => c.id === activeCanvasId) ?? remainingSorted[0];

    set({ canvases: remaining });

    if (newActive) {
      await setActiveCanvas(newActive.id, userId);
    }
    return true;
  },
}));
