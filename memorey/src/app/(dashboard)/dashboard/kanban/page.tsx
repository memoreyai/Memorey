"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import { useKanbanStore, type KanbanColumnRow } from "@/store/kanbanStore";
import type { KanbanStatus } from "@/types/memorey";
import {
  KanbanCard,
  type KanbanCardNode,
  kanbanCardDragId,
  parseKanbanCardDragId,
} from "@/components/kanban/KanbanCard";
import {
  KanbanAddCardColumnFooter,
  type KanbanNodeRowSnake,
} from "@/components/kanban/KanbanAddCardColumnFooter";
import { KanbanColumnSettingsModal } from "@/components/kanban/KanbanColumnSettingsModal";
import { NodeDetailSheet } from "@/components/graph/ui/NodeDetailSheet";
import { useGraphStore } from "@/store/graphStore";
import { toast } from "sonner";
import {
  Plus,
  GripVertical,
  Settings,
  ChevronDown,
  ChevronRight,
  Search,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { KanbanPageSkeleton } from "@/components/layout/DashboardLayoutSkeleton";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { useTrack } from "@/hooks/useTrack";

function uncatDropId(canvasId: string) {
  return `uncat-${canvasId}`;
}

function nextKanbanOrder(): number {
  return Date.now();
}

type NodeRow = {
  id: string;
  user_id: string;
  vault_id: string;
  canvas_id: string | null;
  title: string;
  value: string;
  kanban_status: KanbanStatus | null;
  kanban_column_id: string | null;
  kanban_order: number | null;
  created_at: string;
};

const migratedCanvasIds = new Set<string>();

async function ensureKanbanMigrated(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  canvasId: string
): Promise<void> {
  if (migratedCanvasIds.has(canvasId)) return;

  const { count, error: cErr } = await supabase
    .from("kanban_columns")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("canvas_id", canvasId);
  if (cErr) return;
  if ((count ?? 0) > 0) {
    migratedCanvasIds.add(canvasId);
    return;
  }

  const { error: rpcErr } = await supabase.rpc("seed_default_kanban_columns", {
    p_user_id: userId,
    p_canvas_id: canvasId,
  });
  if (rpcErr) {
    console.error(rpcErr);
    return;
  }

  const { data: cols } = await supabase
    .from("kanban_columns")
    .select("id, name, display_order")
    .eq("user_id", userId)
    .eq("canvas_id", canvasId)
    .order("display_order", { ascending: true });

  const byName = (n: string) => cols?.find((c) => c.name === n)?.id;
  const cTodo = byName("To Do") ?? cols?.[0]?.id;
  const cDoing = byName("In Progress") ?? cols?.[1]?.id;
  const cDone = byName("Done") ?? cols?.[2]?.id;

  const { data: nodes } = await supabase
    .from("memory_nodes")
    .select("id, kanban_status, kanban_column_id")
    .eq("user_id", userId)
    .eq("canvas_id", canvasId)
    .eq("is_active", true);

  for (const r of nodes ?? []) {
    if (r.kanban_column_id) continue;
    const ks = r.kanban_status;
    let col: string | null = null;
    if (ks === "todo") col = cTodo ?? null;
    else if (ks === "doing") col = cDoing ?? null;
    else if (ks === "done") col = cDone ?? null;
    if (col) {
      await supabase
        .from("memory_nodes")
        .update({ kanban_column_id: col })
        .eq("id", r.id)
        .eq("user_id", userId);
    }
  }
  migratedCanvasIds.add(canvasId);
}

function SortableColHeader({
  column,
  onOpenSettings,
}: {
  column: KanbanColumnRow;
  onOpenSettings: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: column.id, disabled: false });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      className="group flex shrink-0 items-center gap-1 border-b border-[var(--border2)] bg-[var(--bg3)] px-2 py-2"
      style={style}
    >
      <button
        type="button"
        className="touch-none p-0.5"
        style={{ color: "var(--muted)", cursor: "grab" }}
        aria-label="Reorder column"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="size-3.5" />
      </button>
      <span
        className="h-2 w-0.5 shrink-0 rounded-full"
        style={{ backgroundColor: column.color ?? "#5DCAA5" }}
      />
      <span
        className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: "var(--text)" }}
      >
        {column.name}
      </span>
      <button
        type="button"
        className="shrink-0 p-0.5 opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100"
        style={{ color: "var(--muted)" }}
        aria-label="Column settings"
        onClick={(e) => {
          e.stopPropagation();
          onOpenSettings();
        }}
      >
        <Settings className="size-3.5" />
      </button>
    </div>
  );
}

export default function KanbanPage() {
  const vaults = useVaultStore((s) => s.vaults);
  const fetchVaults = useVaultStore((s) => s.fetchVaults);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const canvases = useCanvasStore((s) => s.canvases);
  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const masterHiddenCanvasIds = useCanvasStore((s) => s.masterHiddenCanvasIds);
  const toggleCanvasVisibilityInMaster = useCanvasStore(
    (s) => s.toggleCanvasVisibilityInMaster
  );
  const isCanvasHiddenInMaster = useCanvasStore((s) => s.isCanvasHiddenInMaster);
  const loadColumns = useKanbanStore((s) => s.loadColumns);
  const clearColumns = useKanbanStore((s) => s.clearColumns);
  const fetchCanvasVaultLinks = useVaultStore((s) => s.fetchCanvasVaultLinks);
  const canvasVaultLinks = useVaultStore((s) => s.canvasVaultLinks);
  const columns = useKanbanStore((s) => s.columns);
  const loadingCols = useKanbanStore((s) => s.loading);
  const addColumn = useKanbanStore((s) => s.addColumn);
  const updateColumn = useKanbanStore((s) => s.updateColumn);
  const deleteColumn = useKanbanStore((s) => s.deleteColumn);
  const reorderColumns = useKanbanStore((s) => s.reorderColumns);

  const [userId, setUserId] = useState<string | null>(null);
  const [rows, setRows] = useState<NodeRow[]>([]);
  const [edges, setEdges] = useState<
    { source_node_id: string; target_node_id: string; canvas_id?: string | null }[]
  >([]);
  const [activeVaultIds, setActiveVaultIds] = useState<Set<string>>(new Set());
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [listReady, setListReady] = useState(false);
  const [filterVaultIds, setFilterVaultIds] = useState<Set<string>>(new Set());
  const [collapsedCanvas, setCollapsedCanvas] = useState<Set<string>>(new Set());
  const [collapsedHydrated, setCollapsedHydrated] = useState(false);
  const [draggingNodeCanvasId, setDraggingNodeCanvasId] = useState<
    string | null
  >(null);
  const [uiCanvasFilter, setUiCanvasFilter] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [newColOpen, setNewColOpen] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newColColor, setNewColColor] = useState("#5DCAA5");
  const [newColCanvas, setNewColCanvas] = useState<string | null>(null);
  const [columnSettingsId, setColumnSettingsId] = useState<string | null>(null);

  const { track } = useTrack();
  const nodesRef = useRef<KanbanCardNode[]>([]);

  const PRESETS = ["#6B7280", "#F59E0B", "#10B981", "#5DCAA5", "#378ADD", "#D4537E"];

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        void fetchVaults(user.id, isMasterView ? undefined : activeCanvasId ?? undefined);
      }
    });
  }, [fetchVaults, activeCanvasId, isMasterView]);

  useEffect(() => {
    if (vaults.length && filterVaultIds.size === 0) {
      setFilterVaultIds(new Set(vaults.map((v) => v.id)));
    }
  }, [vaults, filterVaultIds.size]);

  useEffect(() => {
    if (!userId || !isMasterView) return;
    if (canvases.length === 0) return;
    void fetchCanvasVaultLinks(canvases.map((c) => c.id));
  }, [userId, isMasterView, canvases, fetchCanvasVaultLinks]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("memorey-master-kanban-collapsed");
      if (raw) setCollapsedCanvas(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* ignore */
    }
    setCollapsedHydrated(true);
  }, []);

  useEffect(() => {
    if (!collapsedHydrated) return;
    try {
      localStorage.setItem(
        "memorey-master-kanban-collapsed",
        JSON.stringify([...collapsedCanvas])
      );
    } catch {
      /* ignore */
    }
  }, [collapsedCanvas, collapsedHydrated]);

  useEffect(() => {
    if (!isMasterView) return;
    const eligible = new Set(
      canvases
        .filter((c) => !masterHiddenCanvasIds.includes(c.id))
        .map((c) => c.id)
    );
    setUiCanvasFilter((prev) => {
      const next = new Set<string>();
      for (const id of eligible) {
        if (prev.size === 0 || prev.has(id)) next.add(id);
      }
      if (next.size === 0) eligible.forEach((id) => next.add(id));
      return next;
    });
  }, [isMasterView, canvases, masterHiddenCanvasIds]);

  useEffect(() => {
    if (vaults.length && activeVaultIds.size === 0) {
      queueMicrotask(() => setActiveVaultIds(new Set(vaults.map((v) => v.id))));
    }
  }, [vaults, activeVaultIds.size]);

  const runMigrationAndLoadCols = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    if (!isMasterView && !activeCanvasId) {
      clearColumns();
      return;
    }
    if (!isMasterView && activeCanvasId) {
      await ensureKanbanMigrated(supabase, userId, activeCanvasId);
      await loadColumns(activeCanvasId);
    } else if (isMasterView) {
      for (const c of canvases) {
        await ensureKanbanMigrated(supabase, userId, c.id);
      }
      await loadColumns(null);
    }
  }, [
    userId,
    activeCanvasId,
    isMasterView,
    canvases,
    loadColumns,
    clearColumns,
  ]);

  useEffect(() => {
    void runMigrationAndLoadCols();
  }, [runMigrationAndLoadCols]);

  const loadKanbanNodes = useCallback(async () => {
    if (!userId) {
      setListReady(false);
      return;
    }
    setListReady(false);
    const supabase = createClient();
    let q = supabase
      .from("memory_nodes")
      .select(
        "id, user_id, vault_id, canvas_id, title, value, kanban_status, kanban_column_id, kanban_order, created_at"
      )
      .eq("user_id", userId)
      .eq("is_active", true)
      .or("kanban_column_id.not.is.null,kanban_status.in.(todo,doing,done)");
    if (!isMasterView && activeCanvasId) {
      q = q.eq("canvas_id", activeCanvasId);
    }
    const { data: mem, error: e1 } = await q;
    if (e1) {
      console.error(e1);
      setListReady(true);
      return;
    }
    let edgesQuery = supabase
      .from("node_edges")
      .select("source_node_id, target_node_id, canvas_id")
      .eq("user_id", userId);
    if (!isMasterView && activeCanvasId) {
      edgesQuery = edgesQuery.eq("canvas_id", activeCanvasId);
    }
    const { data: ed } = await edgesQuery;
    let rowData = (mem ?? []) as NodeRow[];
    let edgeData = ed ?? [];
    if (isMasterView && masterHiddenCanvasIds.length > 0) {
      const hide = new Set(masterHiddenCanvasIds);
      rowData = rowData.filter(
        (r) => !r.canvas_id || !hide.has(r.canvas_id)
      );
      edgeData = edgeData.filter(
        (e) => !e.canvas_id || !hide.has(e.canvas_id)
      );
    }
    setEdges(edgeData);
    setRows(rowData);
    setListReady(true);
  }, [userId, activeCanvasId, isMasterView, masterHiddenCanvasIds]);

  useEffect(() => {
    void loadKanbanNodes();
  }, [loadKanbanNodes]);

  const vaultById = useMemo(() => {
    const m = new Map(vaults.map((v) => [v.id, v]));
    return m;
  }, [vaults]);

  const canvasById = useMemo(() => {
    const m = new Map(canvases.map((c) => [c.id, c]));
    return m;
  }, [canvases]);

  const columnById = useMemo(() => {
    const m = new Map(columns.map((c) => [c.id, c]));
    return m;
  }, [columns]);

  const cards: KanbanCardNode[] = useMemo(() => {
    const q = isMasterView ? searchQuery.trim().toLowerCase() : "";
    return rows
      .filter((r) => activeVaultIds.has(r.vault_id))
      .filter((r) => filterVaultIds.has(r.vault_id))
      .filter((r) => {
        if (isMasterView && !r.kanban_column_id) return false;
        return true;
      })
      .filter((r) => {
        if (!isMasterView) return true;
        if (!r.canvas_id) return true;
        if (masterHiddenCanvasIds.includes(r.canvas_id)) return false;
        return uiCanvasFilter.has(r.canvas_id);
      })
      .map((r) => {
        const v = vaultById.get(r.vault_id);
        const cv = r.canvas_id ? canvasById.get(r.canvas_id) : null;
        const searchMatch =
          !q ||
          r.title.toLowerCase().includes(q) ||
          (r.value || "").toLowerCase().includes(q);
        return {
          id: r.id,
          title: r.title,
          value: r.value,
          kanban_status: r.kanban_status,
          vaultName: v?.name ?? "Vault",
          vaultColor: v?.color ?? "#888780",
          createdAt: r.created_at,
          masterView: isMasterView,
          canvasEmoji: cv?.emoji ?? null,
          searchDimmed: q ? !searchMatch : false,
          searchHighlight: !!q && searchMatch,
        };
      })
      .sort((a, b) => {
        const ra = rows.find((x) => x.id === a.id);
        const rb = rows.find((x) => x.id === b.id);
        return (ra?.kanban_order ?? 0) - (rb?.kanban_order ?? 0);
      });
  }, [
    rows,
    activeVaultIds,
    vaultById,
    canvasById,
    masterHiddenCanvasIds,
    filterVaultIds,
    isMasterView,
    uiCanvasFilter,
    searchQuery,
  ]);

  const masterSummary = useMemo(() => {
    if (!isMasterView) return null;
    const eligible = (r: NodeRow) => {
      if (!activeVaultIds.has(r.vault_id)) return false;
      if (!filterVaultIds.has(r.vault_id)) return false;
      if (!r.kanban_column_id) return false;
      if (!r.canvas_id) return true;
      if (masterHiddenCanvasIds.includes(r.canvas_id)) return false;
      return uiCanvasFilter.has(r.canvas_id);
    };
    const filtered = rows.filter(eligible);
    let todo = 0;
    let doing = 0;
    let done = 0;
    for (const r of filtered) {
      if (r.kanban_status === "todo") todo++;
      else if (r.kanban_status === "doing") doing++;
      else if (r.kanban_status === "done") done++;
    }
    return { total: filtered.length, todo, doing, done };
  }, [
    isMasterView,
    rows,
    activeVaultIds,
    filterVaultIds,
    masterHiddenCanvasIds,
    uiCanvasFilter,
  ]);

  useEffect(() => {
    nodesRef.current = cards;
  }, [cards]);

  const linkedCount = useCallback(
    (nodeId: string) => {
      const node = rows.find((r) => r.id === nodeId);
      return edges.filter((e) => {
        const hit =
          e.source_node_id === nodeId || e.target_node_id === nodeId;
        if (!hit) return false;
        if (!isMasterView || !node?.canvas_id) return true;
        const otherId =
          e.source_node_id === nodeId ? e.target_node_id : e.source_node_id;
        const other = rows.find((r) => r.id === otherId);
        return other?.canvas_id === node.canvas_id;
      }).length;
    },
    [edges, rows, isMasterView]
  );

  const vaultsForCanvas = useCallback(
    (canvasId: string) => {
      if (!isMasterView) {
        return vaults.filter((v) => v.isActive);
      }
      const allowed = new Set(
        canvasVaultLinks
          .filter((l) => l.canvas_id === canvasId)
          .map((l) => l.vault_id)
      );
      if (allowed.size === 0) return [];
      return vaults
        .filter((v) => allowed.has(v.id) && v.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder);
    },
    [isMasterView, vaults, canvasVaultLinks]
  );

  const handleKanbanCardCreated = useCallback(
    (node: KanbanNodeRowSnake) => {
      const row: NodeRow = {
        id: node.id,
        user_id: node.user_id,
        vault_id: node.vault_id,
        canvas_id: node.canvas_id,
        title: node.title,
        value: node.value ?? "",
        kanban_status: node.kanban_status,
        kanban_column_id: node.kanban_column_id,
        kanban_order: node.kanban_order,
        created_at: node.created_at,
      };
      setRows((prev) => [...prev, row]);
      setActiveVaultIds((prev) => new Set([...prev, row.vault_id]));
      setFilterVaultIds((prev) => new Set([...prev, row.vault_id]));
      const cv = row.canvas_id ? canvasById.get(row.canvas_id) : null;
      const vaultName = vaultById.get(row.vault_id)?.name ?? "Personal";
      useGraphStore.getState().addNode({
        id: row.id,
        userId: userId!,
        vaultId: row.vault_id,
        vaultName,
        title: row.title,
        value: row.value,
        confidence: 1,
        source: "manual",
        isActive: true,
        createdAt: row.created_at,
        updatedAt: row.created_at,
        canvasId: row.canvas_id,
        canvasEmoji: cv?.emoji ?? null,
        canvasName: cv?.name ?? null,
        kanbanColumnId: row.kanban_column_id,
        kanbanStatus: row.kanban_status,
        kanbanOrder: row.kanban_order ?? 0,
        nodeKindV2: "memory",
        nodeType: "memory",
      });
    },
    [userId, canvasById, vaultById]
  );

  const columnForSettings = useMemo(
    () =>
      columnSettingsId
        ? columns.find((c) => c.id === columnSettingsId) ?? null
        : null,
    [columns, columnSettingsId]
  );

  const refreshKanbanColumns = useCallback(() => {
    void loadColumns(
      !isMasterView && activeCanvasId ? activeCanvasId : null
    );
  }, [isMasterView, activeCanvasId, loadColumns]);

  useEffect(() => {
    if (
      columnSettingsId &&
      !columns.some((c) => c.id === columnSettingsId)
    ) {
      setColumnSettingsId(null);
    }
  }, [columnSettingsId, columns]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const persistNodeColumn = useCallback(
    async (
      nodeId: string,
      columnId: string | null,
      oldSnapshot: NodeRow
    ) => {
      const supabase = createClient();
      const order = nextKanbanOrder();
      const updates: Record<string, unknown> = {
        kanban_column_id: columnId,
        kanban_order: order,
      };
      if (columnId) {
        const col = columnById.get(columnId);
        if (col?.name === "Done") updates.kanban_status = "done";
        else if (col?.name === "In Progress") updates.kanban_status = "doing";
        else if (col?.name === "To Do") updates.kanban_status = "todo";
      } else {
        updates.kanban_status = null;
        updates.kanban_order = 0;
      }
      const { error } = await supabase
        .from("memory_nodes")
        .update(updates)
        .eq("id", nodeId)
        .eq("user_id", userId ?? "");
      if (error) {
        setRows((p) =>
          p.some((r) => r.id === nodeId) ? p : [...p, oldSnapshot]
        );
        toast.error("Could not move card");
        return;
      }
      if (columnId) {
        const col = columnById.get(columnId);
        if (col?.name === "Done") {
          const {
            data: { session },
          } = await createClient().auth.getSession();
          if (session?.access_token) {
            void fetch("/api/kanban/complete", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ nodeId }),
            }).then(async (res) => {
              const data = (await res.json()) as {
                suggestions?: { id: string; suggestedUpdate: string }[];
              };
              const suggestions = data.suggestions ?? [];
              if (suggestions.length > 0) {
                toast.success("Task completed!", {
                  description: "Review linked memory updates.",
                });
              }
            });
          }
        }
      }
      void loadKanbanNodes();
    },
    [userId, columnById, loadKanbanNodes]
  );

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveDragId(null);
      setDraggingNodeCanvasId(null);
      const { active, over } = event;
      if (!over) return;
      const aid = String(active.id);
      const nodeId = parseKanbanCardDragId(aid);
      if (nodeId) {
        const node = rows.find((r) => r.id === nodeId);
        if (!node) return;
        const overId = String(over.id);
        let targetCol: string | null = null;
        if (overId.startsWith("drop-uncat-")) targetCol = null;
        else if (overId.startsWith("drop-")) {
          targetCol = overId.replace("drop-", "");
        } else {
          const overNode = rows.find((r) => r.id === overId);
          targetCol = overNode?.kanban_column_id ?? null;
          if (
            isMasterView &&
            node.canvas_id &&
            overNode?.canvas_id &&
            overNode.canvas_id !== node.canvas_id
          ) {
            toast.error(
              "Cards can only move between columns within the same canvas. To move a memory to a different canvas, use the graph view."
            );
            return;
          }
        }
        if (isMasterView && node.canvas_id && targetCol) {
          const tc = columnById.get(targetCol);
          if (tc && tc.canvas_id && tc.canvas_id !== node.canvas_id) {
            toast.error(
              "Cards can only move between columns within the same canvas. To move a memory to a different canvas, use the graph view."
            );
            return;
          }
        }
        if (isMasterView && node.canvas_id && overId.startsWith("drop-uncat-")) {
          const zoneCanvas = overId.slice("drop-uncat-".length);
          if (zoneCanvas && zoneCanvas !== node.canvas_id) {
            toast.error(
              "Cards can only move between columns within the same canvas. To move a memory to a different canvas, use the graph view."
            );
            return;
          }
        }
        if (
          (targetCol === null && !node.kanban_column_id) ||
          targetCol === node.kanban_column_id
        )
          return;
        if (isMasterView && node.canvas_id) {
          const fromName = node.kanban_column_id
            ? columnById.get(node.kanban_column_id)?.name ?? "Column"
            : "Unassigned";
          const toName = targetCol
            ? columnById.get(targetCol)?.name ?? "Column"
            : "Unassigned";
          track("master_kanban_card_moved", {
            fromColumn: fromName,
            toColumn: toName,
            canvasId: node.canvas_id,
          });
        }
        const snap = { ...node };
        setRows((prev) =>
          prev.map((r) =>
            r.id === nodeId
              ? {
                  ...r,
                  kanban_column_id: targetCol,
                  kanban_order: nextKanbanOrder(),
                  kanban_status:
                    targetCol === null
                      ? null
                      : columnById.get(targetCol)?.name === "Done"
                        ? "done"
                        : columnById.get(targetCol)?.name === "In Progress"
                          ? "doing"
                          : columnById.get(targetCol)?.name === "To Do"
                            ? "todo"
                            : r.kanban_status,
                }
              : r
          )
        );
        await persistNodeColumn(nodeId, targetCol, snap);
        return;
      }

      if (!nodeId && over?.id) {
        const activeCol = columns.find((c) => c.id === String(active.id));
        if (!activeCol?.canvas_id) return;
        const sameCanvas = columns
          .filter((c) => c.canvas_id === activeCol.canvas_id)
          .sort((a, b) => a.display_order - b.display_order);
        const ids = sameCanvas.map((c) => c.id);
        if (!ids.includes(String(over.id))) return;
        const oldIndex = ids.indexOf(String(active.id));
        const newIndex = ids.indexOf(String(over.id));
        if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return;
        const next = arrayMove(ids, oldIndex, newIndex);
        const ok = await reorderColumns(next);
        if (ok) {
          track("kanban_column_reordered", {});
          void loadColumns(
            !isMasterView && activeCanvasId ? activeCanvasId : null
          );
        }
      }
    },
    [
      rows,
      columnById,
      persistNodeColumn,
      isMasterView,
      columns,
      reorderColumns,
      track,
      loadColumns,
      activeCanvasId,
    ]
  );

  const removeFromBoard = async (nodeId: string) => {
    const row = rows.find((r) => r.id === nodeId);
    if (!row || !userId) return;
    const snap = { ...row };
    setRows((p) => p.filter((r) => r.id !== nodeId));
    const supabase = createClient();
    const { error } = await supabase
      .from("memory_nodes")
      .update({ kanban_status: null, kanban_column_id: null, kanban_order: 0 })
      .eq("id", nodeId)
      .eq("user_id", userId);
    if (error) {
      setRows((p) => (p.some((r) => r.id === nodeId) ? p : [...p, snap]));
      toast.error("Could not remove");
    }
    track("kanban_status_changed", { to_status: "none" });
  };

  const dragNode = activeDragId
    ? cards.find((c) => kanbanCardDragId(c.id) === activeDragId)
    : null;

  if (!userId || !listReady || loadingCols) {
    return <KanbanPageSkeleton />;
  }

  const headerTitle = isMasterView
    ? "Master View"
    : `${activeCanvas?.emoji ?? ""} ${activeCanvas?.name ?? "Canvas"}`.trim();

  const renderColumnBody = (
    columnId: string | null,
    list: KanbanCardNode[]
  ) => (
    <div className="min-h-[120px] flex-1 overflow-y-auto px-2 py-1.5">
      {list.map((c) => (
        <KanbanCard
          key={c.id}
          node={c}
          linkedCount={linkedCount(c.id)}
          onRemoveFromBoard={removeFromBoard}
          onOpenDetail={(id) => useGraphStore.getState().selectNode(id)}
        />
      ))}
    </div>
  );

  function DroppableCol({
    id,
    children,
    color,
    zoneCanvasId,
    variant = "default",
  }: {
    id: string;
    children: React.ReactNode;
    color: string;
    zoneCanvasId: string;
    variant?: "default" | "unassigned";
  }) {
    const { setNodeRef, isOver } = useDroppable({ id: `drop-${id}` });
    const isCardDrag = draggingNodeCanvasId != null;
    const invalidCross =
      isCardDrag && draggingNodeCanvasId !== zoneCanvasId;
    const showInvalid = isOver && invalidCross;
    const isUnassigned = variant === "unassigned";
    return (
      <div
        ref={setNodeRef}
        className={`relative flex min-h-0 min-w-[240px] max-w-[320px] flex-1 flex-col rounded-[var(--r-card)] border ${
          isUnassigned ? "border-dashed" : ""
        }`}
        style={{
          background: isUnassigned
            ? "color-mix(in oklab, var(--bg2) 78%, var(--bg))"
            : "var(--card-bg)",
          borderColor: showInvalid
            ? "#ef4444"
            : isOver
              ? color
              : "var(--border)",
          boxShadow:
            showInvalid && isOver
              ? "0 0 0 2px rgba(239,68,68,0.35)"
              : isOver && !showInvalid
                ? `0 0 0 2px ${color}44`
                : undefined,
          transition: "box-shadow 0.15s, border-color 0.15s",
        }}
      >
        {showInvalid ? (
          <div
            className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-[inherit] border-2 border-red-500 bg-red-500/10"
            aria-hidden
          >
            <span className="text-xl font-bold text-red-500">&times;</span>
          </div>
        ) : null}
        {children}
      </div>
    );
  }

  const renderBoardForCanvas = (canvasId: string) => {
    const cols = columns
      .filter((c) => c.canvas_id === canvasId)
      .sort((a, b) => a.display_order - b.display_order);
    const colIds = cols.map((c) => c.id);

    const uncategorized = cards.filter((c) => {
      const r = rows.find((x) => x.id === c.id);
      return r?.canvas_id === canvasId && !r.kanban_column_id;
    });

    const byCol = (colId: string) =>
      cards.filter((c) => {
        const r = rows.find((x) => x.id === c.id);
        return r?.canvas_id === canvasId && r.kanban_column_id === colId;
      });

    return (
      <div className="flex min-h-0 gap-3 overflow-x-auto pb-2">
        {!isMasterView ? (
          <DroppableCol
            id={uncatDropId(canvasId)}
            color="#94a3b8"
            zoneCanvasId={canvasId}
            variant="unassigned"
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col">
              <div
                className="flex shrink-0 items-center gap-2 border-b border-dashed px-3 py-2"
                style={{
                  borderColor: "var(--border)",
                  background:
                    "color-mix(in oklab, var(--bg3) 65%, transparent)",
                }}
              >
                <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--text)]">
                  Unassigned
                </span>
              </div>
              <p
                className="px-2 py-1 text-[10px] text-[var(--text2)]"
                style={{ fontStyle: "italic" }}
              >
                Needs a column — triage here
              </p>
              {renderColumnBody(null, uncategorized)}
              <KanbanAddCardColumnFooter
                userId={userId}
                canvasId={canvasId}
                column={null}
                vaults={vaultsForCanvas(canvasId)}
                getKanbanOrder={nextKanbanOrder}
                onCreated={handleKanbanCardCreated}
              />
            </div>
          </DroppableCol>
        ) : null}

        <SortableContext items={colIds} strategy={horizontalListSortingStrategy}>
          {cols.map((col) => (
            <DroppableCol
              key={col.id}
              id={col.id}
              color={col.color ?? "#5DCAA5"}
              zoneCanvasId={canvasId}
            >
              <SortableColHeader
                column={col}
                onOpenSettings={() => setColumnSettingsId(col.id)}
              />
              <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                {renderColumnBody(col.id, byCol(col.id))}
                <KanbanAddCardColumnFooter
                  userId={userId}
                  canvasId={canvasId}
                  column={col}
                  vaults={vaultsForCanvas(canvasId)}
                  getKanbanOrder={nextKanbanOrder}
                  onCreated={handleKanbanCardCreated}
                />
              </div>
            </DroppableCol>
          ))}
        </SortableContext>

        <button
          type="button"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-dashed"
          style={{ borderColor: "var(--border2)", color: "var(--text)" }}
          onClick={() => {
            setNewColOpen(true);
            setNewColCanvas(canvasId);
          }}
          title="Add column"
        >
          <Plus className="size-4" />
        </button>
      </div>
    );
  };

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <TrackPageView pagePath="/dashboard/kanban" />
      <div
        className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 md:px-6"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            {headerTitle}
          </span>
          {isMasterView && masterSummary ? (
            <span
              className="text-xs"
              style={{ color: "var(--text2)" }}
            >
              {masterSummary.total} total cards: {masterSummary.todo} to do,{" "}
              {masterSummary.doing} in progress, {masterSummary.done} done
            </span>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
          </div>
        </div>
        {!isMasterView ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] text-[var(--text2)]">Vaults:</span>
            {vaults.map((vault) => (
              <button
                key={vault.id}
                type="button"
                className="rounded-full border px-2 py-0.5 text-[11px]"
                style={{
                  borderColor: activeVaultIds.has(vault.id)
                    ? vault.color
                    : "var(--border)",
                  color: "var(--text)",
                }}
                onClick={() =>
                  setActiveVaultIds((prev) => {
                    const n = new Set(prev);
                    if (n.has(vault.id)) n.delete(vault.id);
                    else n.add(vault.id);
                    return n;
                  })
                }
              >
                {vault.name}
              </button>
            ))}
          </div>
        ) : null}
        {isMasterView ? (
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-[var(--text2)]">
                Canvas filter:
              </span>
              {canvases
                .filter((c) => !isCanvasHiddenInMaster(c.id))
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className="rounded-full border px-2 py-0.5 text-[11px]"
                    style={{
                      borderColor: uiCanvasFilter.has(c.id)
                        ? "var(--orange)"
                        : "var(--border)",
                      background: uiCanvasFilter.has(c.id)
                        ? "var(--bg4)"
                        : "transparent",
                      color: "var(--text)",
                      opacity: uiCanvasFilter.has(c.id) ? 1 : 0.55,
                    }}
                    title="Temporarily show or hide this canvas on the board"
                    onClick={() =>
                      setUiCanvasFilter((prev) => {
                        const n = new Set(prev);
                        if (n.has(c.id)) n.delete(c.id);
                        else n.add(c.id);
                        return n;
                      })
                    }
                  >
                    {c.emoji} {c.name}
                  </button>
                ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-[var(--text2)]">Vaults:</span>
              {vaults.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  className="rounded-full border px-2 py-0.5 text-[11px]"
                  style={{
                    borderColor: filterVaultIds.has(v.id)
                      ? v.color
                      : "var(--border)",
                    color: "var(--text)",
                  }}
                  onClick={() =>
                    setFilterVaultIds((prev) => {
                      const n = new Set(prev);
                      if (n.has(v.id)) n.delete(v.id);
                      else n.add(v.id);
                      return n;
                    })
                  }
                >
                  {v.name}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Search
                className="size-3.5 shrink-0"
                style={{ color: "var(--muted)" }}
                aria-hidden
              />
              <Input
                placeholder="Search cards by title or value…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-8 max-w-md flex-1 text-sm"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] text-[var(--text2)]">
                Sidebar — hide from master (persisted):
              </span>
              {canvases.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="rounded-full border px-2 py-0.5 text-[11px]"
                  style={{
                    borderColor: isCanvasHiddenInMaster(c.id)
                      ? "var(--border)"
                      : "var(--orange)",
                    background: isCanvasHiddenInMaster(c.id)
                      ? "transparent"
                      : "var(--bg4)",
                    color: "var(--text)",
                    opacity: isCanvasHiddenInMaster(c.id) ? 0.45 : 1,
                  }}
                  title={
                    isCanvasHiddenInMaster(c.id)
                      ? "Hidden in master — click to show"
                      : "Visible — click to hide from master"
                  }
                  onClick={() => void toggleCanvasVisibilityInMaster(c.id)}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 py-4 md:px-6"
      >
        {!isMasterView && activeCanvasId ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => {
              setActiveDragId(String(active.id));
              const nid = parseKanbanCardDragId(active.id);
              if (nid) {
                const r = rows.find((x) => x.id === nid);
                setDraggingNodeCanvasId(r?.canvas_id ?? null);
              } else {
                setDraggingNodeCanvasId(null);
              }
            }}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveDragId(null);
              setDraggingNodeCanvasId(null);
            }}
          >
            {renderBoardForCanvas(activeCanvasId)}
            <DragOverlay dropAnimation={null}>
              {dragNode ? (
                <div className="w-[280px] opacity-95 shadow-xl">
                  <KanbanCard
                    node={dragNode}
                    linkedCount={linkedCount(dragNode.id)}
                    onRemoveFromBoard={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : isMasterView ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={({ active }) => {
              setActiveDragId(String(active.id));
              const nid = parseKanbanCardDragId(active.id);
              if (nid) {
                const r = rows.find((x) => x.id === nid);
                setDraggingNodeCanvasId(r?.canvas_id ?? null);
              } else {
                setDraggingNodeCanvasId(null);
              }
            }}
            onDragEnd={handleDragEnd}
            onDragCancel={() => {
              setActiveDragId(null);
              setDraggingNodeCanvasId(null);
            }}
          >
            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pb-2">
              {canvases
                .filter((c) => !isCanvasHiddenInMaster(c.id))
                .filter((c) => uiCanvasFilter.has(c.id))
                .map((c) => {
                  const collapsed = collapsedCanvas.has(c.id);
                  const cardCount = cards.filter((card) => {
                    const rr = rows.find((x) => x.id === card.id);
                    return rr?.canvas_id === c.id;
                  }).length;
                  return (
                    <div
                      key={c.id}
                      className="overflow-hidden rounded-[var(--r-card)] border"
                      style={{
                        borderColor: "var(--border)",
                        background:
                          "color-mix(in oklab, var(--bg2) 88%, var(--bg))",
                        boxShadow:
                          "0 1px 2px color-mix(in oklab, var(--text) 5%, transparent), 0 6px 20px color-mix(in oklab, var(--text) 6%, transparent)",
                      }}
                    >
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 border-b px-3 py-2.5 text-left"
                        style={{
                          borderColor: "var(--border)",
                          background:
                            "color-mix(in oklab, var(--bg3) 55%, transparent)",
                          color: "var(--text)",
                        }}
                        aria-expanded={!collapsed}
                        onClick={() =>
                          setCollapsedCanvas((prev) => {
                            const n = new Set(prev);
                            if (n.has(c.id)) n.delete(c.id);
                            else n.add(c.id);
                            return n;
                          })
                        }
                      >
                        <span className="text-lg leading-none" aria-hidden>
                          {c.emoji}
                        </span>
                        {collapsed ? (
                          <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                            {c.name} — {cardCount}{" "}
                            {cardCount === 1 ? "card" : "cards"}
                          </span>
                        ) : (
                          <>
                            <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                              {c.name}
                            </span>
                            <span
                              className="shrink-0 rounded-md border px-2 py-0.5 text-[11px] font-medium tabular-nums"
                              style={{
                                borderColor: "var(--border)",
                                background: "var(--bg)",
                                color: "var(--text2)",
                              }}
                            >
                              {cardCount}{" "}
                              {cardCount === 1 ? "card" : "cards"}
                            </span>
                          </>
                        )}
                        <span
                          className="shrink-0"
                          style={{ color: "var(--muted)" }}
                          aria-hidden
                        >
                          {collapsed ? (
                            <ChevronRight className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                        </span>
                      </button>
                      {!collapsed ? (
                        <div
                          className="border-t px-3 py-3"
                          style={{
                            borderColor: "var(--border)",
                            background: "var(--bg)",
                          }}
                        >
                          {renderBoardForCanvas(c.id)}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
            </div>
            <DragOverlay dropAnimation={null}>
              {dragNode ? (
                <div className="w-[280px] opacity-95 shadow-xl">
                  <KanbanCard
                    node={dragNode}
                    linkedCount={linkedCount(dragNode.id)}
                    onRemoveFromBoard={() => {}}
                  />
                </div>
              ) : null}
            </DragOverlay>
          </DndContext>
        ) : (
          <p className="text-sm text-[var(--text2)]">Select a canvas</p>
        )}
      </div>

      <KanbanColumnSettingsModal
        open={columnSettingsId != null && columnForSettings != null}
        onOpenChange={(next) => {
          if (!next) setColumnSettingsId(null);
        }}
        column={columnForSettings}
        onUpdateName={async (name) => {
          if (!columnForSettings) return;
          await updateColumn(columnForSettings.id, { name });
          refreshKanbanColumns();
        }}
        onUpdateColor={async (color) => {
          if (!columnForSettings) return;
          await updateColumn(columnForSettings.id, { color });
          refreshKanbanColumns();
        }}
        onDelete={async () => {
          if (!columnForSettings || columnForSettings.is_default) return false;
          const ok = await deleteColumn(columnForSettings.id);
          if (ok) {
            track("kanban_column_deleted", {
              column_id: columnForSettings.id,
            });
            refreshKanbanColumns();
          }
          return ok;
        }}
      />

      {newColOpen ? (
        <div
          className="fixed bottom-6 right-6 z-50 flex w-72 flex-col gap-2 rounded-lg border p-3 shadow-xl"
          style={{
            borderColor: "var(--border)",
            background: "var(--card-bg)",
            color: "var(--text)",
          }}
        >
          <span className="text-xs font-medium">New column</span>
          <Input
            placeholder="Name"
            value={newColName}
            onChange={(e) => setNewColName(e.target.value)}
            className="h-8 text-sm"
          />
          <div className="flex flex-wrap gap-1">
            {PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                className="size-6 rounded border"
                style={{
                  background: p,
                  borderColor: newColColor === p ? "var(--text)" : "transparent",
                }}
                onClick={() => setNewColColor(p)}
              />
            ))}
          </div>
          {isMasterView ? (
            <select
              className="h-8 rounded border text-xs"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
              }}
              value={newColCanvas ?? ""}
              onChange={(e) => setNewColCanvas(e.target.value || null)}
            >
              {canvases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          ) : null}
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-7"
              onClick={async () => {
                const name = newColName.trim();
                if (!name) return;
                const cid = isMasterView ? newColCanvas : activeCanvasId;
                if (!cid) {
                  toast.error("Pick a canvas");
                  return;
                }
                const col = await addColumn(name, newColColor, cid);
                if (col) {
                  track("kanban_column_created", {});
                  setNewColOpen(false);
                  setNewColName("");
                  void loadColumns(
                    !isMasterView && activeCanvasId ? activeCanvasId : null
                  );
                }
              }}
            >
              Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setNewColOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {userId && (
        <NodeDetailSheet
          userId={userId}
          historyOpenForNode={null}
          clearHistoryOpenForNode={() => {}}
        />
      )}
    </div>
  );
}
