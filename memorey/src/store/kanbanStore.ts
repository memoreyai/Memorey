import { create } from "zustand";
import { createClient } from "@/lib/supabase/client";

export type KanbanColumnRow = {
  id: string;
  user_id: string;
  canvas_id: string | null;
  name: string;
  color: string | null;
  display_order: number;
  is_default: boolean;
  created_at?: string | null;
};

async function authFetch(
  path: string,
  init: RequestInit
): Promise<Response> {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const token = session?.access_token;
  if (!token) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
    });
  }
  return fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
}

interface KanbanStore {
  columns: KanbanColumnRow[];
  loading: boolean;

  loadColumns: (canvasId?: string | null) => Promise<void>;
  /** Clear column state when no canvas is selected (single-canvas nav). */
  clearColumns: () => void;
  addColumn: (
    name: string,
    color?: string,
    canvasId?: string | null
  ) => Promise<KanbanColumnRow | null>;
  updateColumn: (
    id: string,
    updates: Partial<
      Pick<KanbanColumnRow, "name" | "color" | "display_order">
    >
  ) => Promise<KanbanColumnRow | null>;
  deleteColumn: (id: string) => Promise<boolean>;
  reorderColumns: (columnIds: string[]) => Promise<boolean>;
}

export const useKanbanStore = create<KanbanStore>((set, get) => ({
  columns: [],
  loading: false,

  loadColumns: async (canvasId) => {
    set({ loading: true });
    try {
      const q =
        canvasId != null && canvasId !== ""
          ? `?canvasId=${encodeURIComponent(canvasId)}`
          : "";
      const res = await authFetch(`/api/kanban/columns${q}`, { method: "GET" });
      const data = (await res.json()) as { columns?: KanbanColumnRow[]; error?: string };
      if (!res.ok) {
        console.error(data.error ?? res.status);
        set({ columns: [], loading: false });
        return;
      }
      set({ columns: data.columns ?? [], loading: false });
    } catch (e) {
      console.error(e);
      set({ columns: [], loading: false });
    }
  },

  clearColumns: () => set({ columns: [], loading: false }),

  addColumn: async (name, color, canvasId) => {
    const res = await authFetch("/api/kanban/columns", {
      method: "POST",
      body: JSON.stringify({
        name,
        color,
        canvasId: canvasId ?? undefined,
      }),
    });
    const data = (await res.json()) as { column?: KanbanColumnRow; error?: string };
    if (!res.ok || !data.column) {
      console.error(data.error);
      return null;
    }
    set((s) => ({ columns: [...s.columns, data.column!] }));
    return data.column;
  },

  updateColumn: async (id, updates) => {
    const res = await authFetch("/api/kanban/columns", {
      method: "PATCH",
      body: JSON.stringify({ id, ...updates }),
    });
    const data = (await res.json()) as { column?: KanbanColumnRow; error?: string };
    if (!res.ok || !data.column) {
      console.error(data.error);
      return null;
    }
    set((s) => ({
      columns: s.columns.map((c) => (c.id === id ? data.column! : c)),
    }));
    return data.column;
  },

  deleteColumn: async (id) => {
    const res = await authFetch(`/api/kanban/columns?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      console.error(data.error);
      return false;
    }
    set((s) => ({ columns: s.columns.filter((c) => c.id !== id) }));
    return true;
  },

  reorderColumns: async (columnIds) => {
    const res = await authFetch("/api/kanban/columns/reorder", {
      method: "POST",
      body: JSON.stringify({ columnIds }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      console.error(data.error);
      return false;
    }
    const order = new Map(columnIds.map((cid, i) => [cid, i]));
    set((s) => ({
      columns: [...s.columns].sort(
        (a, b) =>
          (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999)
      ),
    }));
    return true;
  },
}));
