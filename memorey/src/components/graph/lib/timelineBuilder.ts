import type { MemoryNode, NodeEdge } from "@/types/memorey";

export interface TimelineNodeEntry {
  node: MemoryNode;
  connectedNodes: MemoryNode[];
  anchorDate: Date;
  nodeDate: Date;
}

export interface TimelineDayGroup {
  date: Date;
  dateLabel: string;
  entries: TimelineNodeEntry[];
}

export interface Timeline {
  days: TimelineDayGroup[];
  totalNodes: number;
  dateRange: { from: Date; to: Date } | null;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatDateLabel(d: Date): string {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function nodeKind(n: MemoryNode): string | undefined {
  return (n as MemoryNode & { nodeKind?: string }).nodeKind;
}

export function buildTimeline(
  nodes: MemoryNode[],
  edges: NodeEdge[],
  filterVaultIds?: Set<string>
): Timeline {
  let filtered = nodes.filter((n) => {
    if (nodeKind(n) === "master") return false;
    return n.isActive !== false;
  });

  if (filterVaultIds && filterVaultIds.size > 0) {
    filtered = filtered.filter((n) => filterVaultIds.has(n.vaultId ?? ""));
  }

  if (filtered.length === 0) {
    return { days: [], totalNodes: 0, dateRange: null };
  }

  const adjacency = new Map<string, Set<string>>();
  for (const edge of edges) {
    if (!adjacency.has(edge.sourceNodeId))
      adjacency.set(edge.sourceNodeId, new Set());
    if (!adjacency.has(edge.targetNodeId))
      adjacency.set(edge.targetNodeId, new Set());
    adjacency.get(edge.sourceNodeId)!.add(edge.targetNodeId);
    adjacency.get(edge.targetNodeId)!.add(edge.sourceNodeId);
  }

  const nodeMap = new Map(filtered.map((n) => [n.id, n]));
  const placed = new Set<string>();

  const sorted = [...filtered].sort(
    (a, b) =>
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const entries: TimelineNodeEntry[] = [];

  for (const node of sorted) {
    if (placed.has(node.id)) continue;
    placed.add(node.id);

    const nodeDate = new Date(node.createdAt);
    const anchorDate = nodeDate;

    const connectedIds = adjacency.get(node.id) ?? new Set();
    const connectedNodes: MemoryNode[] = [];

    for (const connId of connectedIds) {
      if (placed.has(connId)) continue;
      const conn = nodeMap.get(connId);
      if (!conn) continue;
      connectedNodes.push(conn);
      placed.add(connId);
    }

    connectedNodes.sort(
      (a, b) =>
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );

    entries.push({
      node,
      connectedNodes,
      anchorDate,
      nodeDate,
    });
  }

  const dayMap = new Map<string, TimelineDayGroup>();

  for (const entry of entries) {
    const key = toDateKey(entry.anchorDate);
    const label = formatDateLabel(entry.anchorDate);

    if (!dayMap.has(key)) {
      dayMap.set(key, { date: entry.anchorDate, dateLabel: label, entries: [] });
    }
    dayMap.get(key)!.entries.push(entry);
  }

  const days = [...dayMap.values()].sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  for (const day of days) {
    day.entries.sort(
      (a, b) => a.anchorDate.getTime() - b.anchorDate.getTime()
    );
  }

  const allDates = filtered.map((n) => new Date(n.createdAt));
  const dateRange =
    allDates.length > 0
      ? {
          from: new Date(Math.min(...allDates.map((d) => d.getTime()))),
          to: new Date(Math.max(...allDates.map((d) => d.getTime()))),
        }
      : null;

  return {
    days,
    totalNodes: filtered.length,
    dateRange,
  };
}
