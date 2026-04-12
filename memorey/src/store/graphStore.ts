import "@/lib/immer-config";
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { UndirectedGraph } from "graphology";
import { createClient } from "@/lib/supabase/client";
import type {
  CategoryVault,
  GraphData,
  GraphLink,
  GraphNode,
  MemoryNode,
  NodeAttachment,
  NodeEdge,
  VaultCategory,
} from "@/types/memorey";
import { VAULT_COLORS } from "@/types/memorey";

type MemoryNodeRow = {
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
  canvas_id?: string | null;
  kanban_column_id?: string | null;
  kanban_status?: string | null;
  kanban_order?: number | null;
  custom_bg_color?: string | null;
  custom_accent_color?: string | null;
  custom_text_color?: string | null;
  node_type?: string | null;
  node_kind_v2?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  storage_path?: string | null;
  thumbnail_url?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  og_site_name?: string | null;
  pos_x?: number | null;
  pos_y?: number | null;
  category_vaults?: { name: string; color: string | null } | null;
};

export function mapNodeRow(row: MemoryNodeRow): MemoryNode {
  const ks = row.kanban_status;
  const kanbanStatus =
    ks === "todo" || ks === "doing" || ks === "done" ? ks : null;
  const nodeType = row.node_type === "sticky" ? "sticky" : "memory";
  const vaultName = row.category_vaults?.name ?? "Personal";
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
    canvasId: row.canvas_id ?? undefined,
    kanbanColumnId: row.kanban_column_id ?? undefined,
    kanbanStatus,
    kanbanOrder: row.kanban_order ?? 0,
    customBgColor: row.custom_bg_color ?? undefined,
    customAccentColor: row.custom_accent_color ?? undefined,
    customTextColor: row.custom_text_color ?? undefined,
    nodeType,
    nodeKindV2: (() => {
      const nk = row.node_kind_v2;
      if (nk === "file" || nk === "sticky" || nk === "memory") return nk;
      if (row.file_url) return "file";
      return "memory";
    })(),
    fileUrl: row.file_url ?? null,
    fileName: row.file_name ?? null,
    fileType: row.file_type ?? null,
    fileSize: row.file_size ?? null,
    storagePath: row.storage_path ?? null,
    thumbnailUrl: row.thumbnail_url ?? null,
    ogTitle: row.og_title ?? null,
    ogDescription: row.og_description ?? null,
    ogImage: row.og_image ?? null,
    ogSiteName: row.og_site_name ?? null,
    posX: row.pos_x ?? null,
    posY: row.pos_y ?? null,
  };
}

/** Graphology graph instance type */
export type GraphologyGraph = UndirectedGraph;

function vaultColorForNode(
  vaultId: string,
  vaultName: string,
  vaults: CategoryVault[]
): string {
  const v = vaults.find((x) => x.id === vaultId);
  if (v?.color) return v.color;
  const key = vaultName as VaultCategory;
  if (key in VAULT_COLORS) return VAULT_COLORS[key];
  return "#888780";
}

function buildGraphology(
  memoryNodes: MemoryNode[],
  filteredEdges: NodeEdge[]
): UndirectedGraph {
  const g = new UndirectedGraph();
  for (const n of memoryNodes) {
    if (n.isActive && !g.hasNode(n.id)) {
      g.addNode(n.id, { label: n.title });
    }
  }
  for (const e of filteredEdges) {
    if (!g.hasNode(e.sourceNodeId) || !g.hasNode(e.targetNodeId)) continue;
    if (g.hasEdge(e.sourceNodeId, e.targetNodeId)) continue;
    try {
      g.addEdge(e.sourceNodeId, e.targetNodeId, {
        strength: e.strength,
        label: e.label,
      });
    } catch {
      // skip invalid edges
    }
  }
  return g;
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace("#", "");
  const n =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const num = parseInt(n, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export interface GraphStore {
  nodes: MemoryNode[];
  edges: NodeEdge[];
  vaults: CategoryVault[];
  graph: GraphologyGraph | null;
  graphData: GraphData;
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  /** Vaults toggled off in the filter bar — nodes/edges render at ~10% opacity */
  mutedVaultIds: Set<string>;
  personInitials: string;
  searchHighlightIds: Set<string>;
  /** True while semantic graph search request is in flight (graph may show pulse). */
  semanticSearchActive: boolean;
  isLoading: boolean;
  /** Active attachment counts per memory node id */
  attachmentCounts: Record<string, number>;
  /** Standalone attachments (node_id null) rendered as graph nodes */
  standaloneAttachments: NodeAttachment[];

  /** Modal: add memory from toolbar (null) or linked to parent node */
  addMemoryModalOpen: boolean;
  addMemoryParentNodeId: string | null;
  openAddMemoryModal: (parentNodeId?: string | null) => void;
  closeAddMemoryModal: () => void;

  setNodes: (nodes: MemoryNode[]) => void;
  setEdges: (edges: NodeEdge[]) => void;
  setVaults: (vaults: CategoryVault[]) => void;
  setIsLoading: (loading: boolean) => void;
  fetchNodes: (
    userId: string,
    canvasId?: string | null,
    opts?: { excludeCanvasIds?: string[] }
  ) => Promise<void>;
  fetchEdges: (
    userId: string,
    canvasId?: string | null,
    opts?: { excludeCanvasIds?: string[] }
  ) => Promise<void>;
  setPersonInitials: (initials: string) => void;
  addNode: (node: MemoryNode) => void;
  updateNode: (id: string, updates: Partial<MemoryNode>) => void;
  removeNode: (id: string) => void;
  selectNode: (id: string | null) => void;
  setHoveredNode: (id: string | null) => void;
  toggleVaultMuted: (vaultId: string) => void;
  setMutedVaultIds: (ids: Set<string>) => void;
  setSearchHighlights: (ids: string[]) => void;
  setSemanticSearchActive: (active: boolean) => void;
  rebuildGraphData: () => void;
  setAttachmentData: (
    counts: Record<string, number>,
    standalone: NodeAttachment[]
  ) => void;
  incrementAttachmentCount: (memoryNodeId: string) => void;
  decrementAttachmentCount: (memoryNodeId: string) => void;
  addEdge: (edge: NodeEdge) => void;
  removeEdgeBetween: (nodeIdA: string, nodeIdB: string) => void;
  removeEdgeById: (edgeId: string) => void;
  updateEdge: (edgeId: string, updates: Partial<NodeEdge>) => void;
  removeEdge: (edgeId: string) => void;
}

function applyRebuild(draft: GraphStore): void {
  const {
    nodes,
    edges,
    vaults,
    mutedVaultIds,
    personInitials,
    attachmentCounts,
  } = draft;

  const memories = nodes.filter((n) => n.isActive);
  const memoryIds = new Set(memories.map((n) => n.id));

  const graphNodes: GraphNode[] = [];
  const graphLinks: GraphLink[] = [];

  graphNodes.push({
    id: "person",
    nodeKind: "person",
    category: "",
    title: "",
    value: "",
    color: "#FFFFFF",
    val: 20,
    fx: 0,
    fy: 0,
    initials: personInitials || "ME",
  });

  const sortedVaults = [...vaults].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  for (const v of sortedVaults) {
    const muted = mutedVaultIds.has(v.id);
    graphNodes.push({
      id: `cat:${v.id}`,
      nodeKind: "category",
      vaultId: v.id,
      category: v.name,
      title: v.name,
      value: "",
      color: v.color,
      val: 12,
      muted,
    });
    graphLinks.push({
      source: "person",
      target: `cat:${v.id}`,
      strength: 0.85,
      edgeColor: hexToRgba(v.color, 0.25),
    });
  }

  for (const n of memories) {
    const color = vaultColorForNode(n.vaultId, String(n.vaultName), vaults);
    const muted = mutedVaultIds.has(n.vaultId);
    const r = 4 + n.confidence * 4;
    const displayVaultName =
      vaults.find((v) => v.id === n.vaultId)?.name ?? String(n.vaultName);
    graphNodes.push({
      id: n.id,
      nodeKind: "memory",
      vaultId: n.vaultId,
      category: displayVaultName,
      title: n.title,
      value: n.value,
      color,
      val: r,
      muted,
      attachmentCount: attachmentCounts[n.id] ?? 0,
      customBgColor: n.customBgColor ?? undefined,
      customAccentColor: n.customAccentColor ?? undefined,
      customTextColor: n.customTextColor ?? undefined,
      nodeType: n.nodeType ?? "memory",
      nodeKindV2: n.nodeKindV2,
      fileUrl: n.fileUrl ?? null,
      fileName: n.fileName ?? null,
      fileType: n.fileType ?? null,
      fileSize: n.fileSize ?? null,
      storagePath: n.storagePath ?? null,
      thumbnailUrl: n.thumbnailUrl ?? null,
      ogTitle: n.ogTitle ?? null,
      ogDescription: n.ogDescription ?? null,
      ogImage: n.ogImage ?? null,
      ogSiteName: n.ogSiteName ?? null,
      canvasId: n.canvasId ?? undefined,
      canvasEmoji: n.canvasEmoji ?? undefined,
      canvasName: n.canvasName ?? undefined,
    });
    graphLinks.push({
      source: `cat:${n.vaultId}`,
      target: n.id,
      strength: 0.3,
      edgeColor: hexToRgba(color, 0.25),
    });
  }

  for (const e of edges) {
    if (!memoryIds.has(e.sourceNodeId) || !memoryIds.has(e.targetNodeId))
      continue;
    const src = memories.find((m) => m.id === e.sourceNodeId);
    const c = src
      ? vaultColorForNode(src.vaultId, String(src.vaultName), vaults)
      : "#888780";
    graphLinks.push({
      source: e.sourceNodeId,
      target: e.targetNodeId,
      strength: e.strength,
      label: e.label,
      edgeColor: hexToRgba(c, 0.25),
    });
  }

  // Plain serializable snapshot — Immer still freezes state in dev, but this
  // avoids any draft/proxy leakage into graphData; UI clones again for ForceGraph.
  draft.graphData = JSON.parse(
    JSON.stringify({ nodes: graphNodes, links: graphLinks })
  ) as GraphData;
  draft.graph = buildGraphology(memories, edges);
}

const emptyGraphData: GraphData = { nodes: [], links: [] };

export const useGraphStore = create<GraphStore>()(
  immer((set, get) => ({
    nodes: [],
    edges: [],
    vaults: [],
    graph: null,
    graphData: emptyGraphData,
    selectedNodeId: null,
    hoveredNodeId: null,
    mutedVaultIds: new Set<string>(),
    personInitials: "ME",
    searchHighlightIds: new Set<string>(),
    semanticSearchActive: false,
    isLoading: false,
    attachmentCounts: {},
    standaloneAttachments: [],
    addMemoryModalOpen: false,
    addMemoryParentNodeId: null,

    fetchNodes: async (userId, canvasId, opts) => {
      const supabase = createClient();
      const exclude = opts?.excludeCanvasIds ?? [];
      const hide = new Set(exclude);
      let query = supabase
        .from("memory_nodes")
        .select("*, category_vaults(name, color)")
        .eq("user_id", userId)
        .eq("is_active", true);
      if (canvasId) {
        query = query.eq("canvas_id", canvasId);
      }
      const { data } = await query;
      const canvasMeta: Record<string, { emoji: string; name: string }> = {};
      if (!canvasId) {
        const { data: cans } = await supabase
          .from("canvases")
          .select("id, emoji, name")
          .eq("user_id", userId)
          .eq("is_active", true);
        for (const c of cans ?? []) {
          canvasMeta[c.id as string] = {
            emoji: (c.emoji as string | null) ?? "",
            name: (c.name as string) ?? "Canvas",
          };
        }
      }
      let nodes = (data ?? []).map((row) => {
        const m = mapNodeRow(row as MemoryNodeRow);
        const cid = m.canvasId;
        if (cid && canvasMeta[cid]) {
          return {
            ...m,
            canvasEmoji: canvasMeta[cid].emoji,
            canvasName: canvasMeta[cid].name,
          };
        }
        return m;
      });
      if (hide.size > 0) {
        nodes = nodes.filter((m) => {
          const cid = m.canvasId;
          if (!cid) return true;
          return !hide.has(cid);
        });
      }
      get().setNodes(nodes);
    },

    fetchEdges: async (userId, canvasId, opts) => {
      const supabase = createClient();
      const exclude = opts?.excludeCanvasIds ?? [];
      const hide = new Set(exclude);
      let query = supabase
        .from("node_edges")
        .select(
          "id, user_id, source_node_id, target_node_id, strength, label, color, canvas_id"
        )
        .eq("user_id", userId);
      if (canvasId) {
        query = query.eq("canvas_id", canvasId);
      }
      const { data } = await query;
      let edges: NodeEdge[] = (data ?? []).map((r) => ({
        id: r.id,
        userId: r.user_id,
        sourceNodeId: r.source_node_id,
        targetNodeId: r.target_node_id,
        strength: r.strength ?? 0.75,
        label: r.label ?? undefined,
        color: r.color ?? undefined,
        canvasId: r.canvas_id ?? undefined,
      }));
      if (hide.size > 0) {
        edges = edges.filter((e) => {
          const cid = e.canvasId ?? null;
          if (!cid) return true;
          return !hide.has(cid);
        });
      }
      get().setEdges(edges);
    },

    openAddMemoryModal: (parentNodeId = null) =>
      set((draft) => {
        draft.addMemoryModalOpen = true;
        draft.addMemoryParentNodeId = parentNodeId ?? null;
      }),

    closeAddMemoryModal: () =>
      set((draft) => {
        draft.addMemoryModalOpen = false;
        draft.addMemoryParentNodeId = null;
      }),

    setNodes: (nodes) =>
      set((draft) => {
        draft.nodes = nodes;
        applyRebuild(draft);
      }),

    setEdges: (edges) =>
      set((draft) => {
        draft.edges = edges;
        applyRebuild(draft);
      }),

    setVaults: (vaults) =>
      set((draft) => {
        draft.vaults = vaults;
        applyRebuild(draft);
      }),

    setIsLoading: (loading) =>
      set((draft) => {
        draft.isLoading = loading;
      }),

    setPersonInitials: (initials) =>
      set((draft) => {
        draft.personInitials = initials.slice(0, 3).toUpperCase();
        applyRebuild(draft);
      }),

    addNode: (node) =>
      set((draft) => {
        if (draft.nodes.some((n) => n.id === node.id)) return;
        draft.nodes.push(node);
        applyRebuild(draft);
      }),

    updateNode: (id, updates) =>
      set((draft) => {
        const i = draft.nodes.findIndex((n) => n.id === id);
        if (i >= 0) {
          Object.assign(draft.nodes[i], updates);
          applyRebuild(draft);
        }
      }),

    removeNode: (id) =>
      set((draft) => {
        draft.nodes = draft.nodes.filter((n) => n.id !== id);
        draft.edges = draft.edges.filter(
          (e) => e.sourceNodeId !== id && e.targetNodeId !== id
        );
        if (draft.selectedNodeId === id) draft.selectedNodeId = null;
        if (draft.hoveredNodeId === id) draft.hoveredNodeId = null;
        applyRebuild(draft);
      }),

    selectNode: (id) =>
      set((draft) => {
        draft.selectedNodeId = id;
      }),

    setHoveredNode: (id) =>
      set((draft) => {
        draft.hoveredNodeId = id;
      }),

    toggleVaultMuted: (vaultId) =>
      set((draft) => {
        if (draft.mutedVaultIds.has(vaultId)) {
          draft.mutedVaultIds.delete(vaultId);
        } else {
          draft.mutedVaultIds.add(vaultId);
        }
        applyRebuild(draft);
      }),

    setMutedVaultIds: (ids) =>
      set((draft) => {
        draft.mutedVaultIds = new Set(ids);
        applyRebuild(draft);
      }),

    setSearchHighlights: (ids) =>
      set((draft) => {
        draft.searchHighlightIds = new Set(ids);
      }),

    setSemanticSearchActive: (active) =>
      set((draft) => {
        draft.semanticSearchActive = active;
      }),

    rebuildGraphData: () =>
      set((draft) => {
        applyRebuild(draft);
      }),

    setAttachmentData: (counts, standalone) =>
      set((draft) => {
        draft.attachmentCounts = { ...counts };
        draft.standaloneAttachments = standalone;
        applyRebuild(draft);
      }),

    incrementAttachmentCount: (memoryNodeId) =>
      set((draft) => {
        draft.attachmentCounts[memoryNodeId] =
          (draft.attachmentCounts[memoryNodeId] ?? 0) + 1;
        applyRebuild(draft);
      }),

    decrementAttachmentCount: (memoryNodeId) =>
      set((draft) => {
        const n = (draft.attachmentCounts[memoryNodeId] ?? 0) - 1;
        if (n <= 0) delete draft.attachmentCounts[memoryNodeId];
        else draft.attachmentCounts[memoryNodeId] = n;
        applyRebuild(draft);
      }),

    addEdge: (edge) =>
      set((draft) => {
        const dup = draft.edges.some(
          (e) =>
            (e.sourceNodeId === edge.sourceNodeId &&
              e.targetNodeId === edge.targetNodeId) ||
            (e.sourceNodeId === edge.targetNodeId &&
              e.targetNodeId === edge.sourceNodeId)
        );
        if (dup) return;
        draft.edges.push(edge);
        applyRebuild(draft);
      }),

    removeEdgeBetween: (nodeIdA, nodeIdB) =>
      set((draft) => {
        draft.edges = draft.edges.filter(
          (e) =>
            !(
              (e.sourceNodeId === nodeIdA && e.targetNodeId === nodeIdB) ||
              (e.sourceNodeId === nodeIdB && e.targetNodeId === nodeIdA)
            )
        );
        applyRebuild(draft);
      }),

    removeEdgeById: (edgeId) =>
      set((draft) => {
        draft.edges = draft.edges.filter((e) => e.id !== edgeId);
        applyRebuild(draft);
      }),

    updateEdge: (edgeId, updates) =>
      set((draft) => {
        const i = draft.edges.findIndex((e) => e.id === edgeId);
        if (i < 0) return;
        const edge = draft.edges[i];
        const { color: colorUpd, ...rest } = updates;
        Object.assign(edge, rest);
        if ("color" in updates) {
          if (colorUpd == null) delete edge.color;
          else edge.color = colorUpd;
        }
        applyRebuild(draft);
      }),

    removeEdge: (edgeId) =>
      set((draft) => {
        draft.edges = draft.edges.filter((e) => e.id !== edgeId);
        applyRebuild(draft);
      }),
  }))
);

/** Non-hook access for other stores */
export function getGraphStore() {
  return useGraphStore.getState();
}
