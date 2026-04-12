import type { HierarchyNode } from "d3-hierarchy";
import type { MemoryNode, NodeEdge, CategoryVault } from "@/types/memorey";
import type { Canvas } from "@/store/canvasStore";

export type TreeNodeKind = "master" | "canvas" | "vault" | "memory";

export interface TreeNodeData {
  id: string;
  kind: TreeNodeKind;
  label: string;
  /** Master / canvas row */
  emoji?: string;
  bio?: string;
  masterColor?: string;
  memoryNode?: MemoryNode;
  vault?: CategoryVault;
  canvas?: Canvas;
  /** Memory nested under another memory (edge-guided placement) */
  edgeLinked?: boolean;
  children?: TreeNodeData[];
  _children?: TreeNodeData[];
}

function memoryTreeNode(m: MemoryNode, edgeLinked: boolean): TreeNodeData {
  return {
    id: m.id,
    kind: "memory",
    label: m.title,
    memoryNode: m,
    edgeLinked,
  };
}

/**
 * Greedy tree: walk memories in stable order; attach to first placed neighbor
 * in the same vault via an edge, else attach at vault top level.
 */
function buildVaultMemoryChildren(
  mems: MemoryNode[],
  edges: NodeEdge[]
): TreeNodeData[] {
  const memIds = new Set(mems.map((m) => m.id));
  const sorted = [...mems].sort((a, b) =>
    a.title.localeCompare(b.title, undefined, { sensitivity: "base" })
  );

  const idToTree = new Map<string, TreeNodeData>();
  const placed = new Set<string>();
  const roots: TreeNodeData[] = [];

  const hasEdge = (a: string, b: string) =>
    edges.some(
      (e) =>
        memIds.has(e.sourceNodeId) &&
        memIds.has(e.targetNodeId) &&
        ((e.sourceNodeId === a && e.targetNodeId === b) ||
          (e.sourceNodeId === b && e.targetNodeId === a))
    );

  for (const m of sorted) {
    const partners = sorted.filter(
      (o) => o.id !== m.id && placed.has(o.id) && hasEdge(m.id, o.id)
    );
    partners.sort((a, b) => a.id.localeCompare(b.id));

    const parentMem = partners[0];
    const treeNode = memoryTreeNode(m, Boolean(parentMem));

    if (parentMem) {
      const parentTree = idToTree.get(parentMem.id);
      if (parentTree) {
        if (!parentTree.children) parentTree.children = [];
        parentTree.children.push(treeNode);
      } else {
        roots.push(treeNode);
      }
    } else {
      roots.push(treeNode);
    }

    idToTree.set(m.id, treeNode);
    placed.add(m.id);
  }

  const accounted = new Set<string>();
  function walk(nodes: TreeNodeData[]) {
    for (const n of nodes) {
      if (n.kind === "memory" && n.id) accounted.add(n.id);
      if (n.children && n.children.length) walk(n.children);
    }
  }
  walk(roots);

  for (const m of sorted) {
    if (!accounted.has(m.id)) {
      roots.push(memoryTreeNode(m, false));
    }
  }

  return roots;
}

export function buildTreeData(
  nodes: MemoryNode[],
  edges: NodeEdge[],
  vaults: CategoryVault[],
  opts: {
    canvasName: string;
    canvasEmoji: string;
    masterNodeBio?: string;
    masterNodeColor?: string;
  }
): TreeNodeData {
  const children: TreeNodeData[] = [];

  for (const v of [...vaults].sort(
    (a, b) => a.displayOrder - b.displayOrder
  )) {
    const mems = nodes.filter((n) => n.vaultId === v.id);
    children.push({
      id: `vault-${v.id}`,
      kind: "vault",
      label: v.name,
      vault: v,
      children:
        mems.length > 0 ? buildVaultMemoryChildren(mems, edges) : undefined,
    });
  }

  return {
    id: "tree-root-master",
    kind: "master",
    label: opts.canvasName,
    emoji: opts.canvasEmoji,
    bio: opts.masterNodeBio,
    masterColor: opts.masterNodeColor ?? "#FF6600",
    children,
  };
}

export function buildMasterTreeData(
  nodes: MemoryNode[],
  edges: NodeEdge[],
  vaults: CategoryVault[],
  canvases: Canvas[]
): TreeNodeData {
  const sortedCanvases = [...canvases].sort(
    (a, b) => a.displayOrder - b.displayOrder
  );

  const canvasChildren: TreeNodeData[] = [];

  for (const canvas of sortedCanvases) {
    const canvasNodes = nodes.filter((n) => n.canvasId === canvas.id);
    const vaultIds = new Set(canvasNodes.map((n) => n.vaultId));
    const canvasVaults = vaults.filter((v) => vaultIds.has(v.id));

    const vaultNodes: TreeNodeData[] = [];

    for (const v of canvasVaults.sort(
      (a, b) => a.displayOrder - b.displayOrder
    )) {
      const mems = canvasNodes.filter((n) => n.vaultId === v.id);
      vaultNodes.push({
        id: `vault-${canvas.id}-${v.id}`,
        kind: "vault",
        label: v.name,
        vault: v,
        canvas,
        children:
          mems.length > 0 ? buildVaultMemoryChildren(mems, edges) : undefined,
      });
    }

    canvasChildren.push({
      id: `canvas-${canvas.id}`,
      kind: "canvas",
      label: canvas.name,
      emoji: canvas.emoji ?? undefined,
      masterColor: canvas.masterNodeColor,
      bio: canvas.masterNodeBio ?? undefined,
      canvas,
      children: vaultNodes.length ? vaultNodes : undefined,
    });
  }

  return {
    id: "tree-root-master-workspace",
    kind: "master",
    label: "All canvases",
    emoji: "",
    children: canvasChildren,
  };
}

export function isTreeParentChild(
  nodeIdA: string,
  nodeIdB: string,
  root: HierarchyNode<TreeNodeData>
): boolean {
  let found = false;
  root.eachBefore((d) => {
    const ch = d.children ?? [];
    for (const c of ch) {
      if (
        (d.data.id === nodeIdA && c.data.id === nodeIdB) ||
        (d.data.id === nodeIdB && c.data.id === nodeIdA)
      ) {
        found = true;
      }
    }
  });
  return found;
}

export function isCrossVault(
  edge: NodeEdge,
  nodes: MemoryNode[]
): boolean {
  const s = nodes.find((n) => n.id === edge.sourceNodeId);
  const t = nodes.find((n) => n.id === edge.targetNodeId);
  if (!s || !t) return true;
  return s.vaultId !== t.vaultId;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const m = /^#?([0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function getCrossLinkColor(
  edge: NodeEdge,
  vaults: CategoryVault[],
  nodes: MemoryNode[]
): string {
  if (isCrossVault(edge, nodes)) {
    return "rgba(128, 128, 128, 0.4)";
  }
  const s = nodes.find((n) => n.id === edge.sourceNodeId);
  const t = nodes.find((n) => n.id === edge.targetNodeId);
  const vid = s?.vaultId ?? t?.vaultId;
  if (!vid) return "rgba(128, 128, 128, 0.4)";
  const v = vaults.find((x) => x.id === vid);
  const hex = v?.color ?? "#888780";
  const rgb = hexToRgb(hex);
  if (!rgb) return "rgba(136, 135, 128, 0.5)";
  return `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
}

/** Collapse nodes deeper than depth 2 (0=root, 1=vault/canvas, 2=first memories). */
export function applyInitialCollapse(rootData: TreeNodeData): void {
  function go(node: TreeNodeData, depth: number) {
    if (node.children) {
      for (const c of node.children) {
        go(c, depth + 1);
      }
    }
    if (depth >= 2 && node.children?.length) {
      node._children = node.children;
      node.children = undefined;
    }
  }
  if (rootData.children) {
    for (const c of rootData.children) {
      go(c, 1);
    }
  }
}

export function expandAllTree(node: TreeNodeData): void {
  if (node._children) {
    node.children = node._children;
    node._children = undefined;
  }
  if (node.children) {
    for (const c of node.children) {
      expandAllTree(c);
    }
  }
}

/** Collapse to root + vault rows only (memories hidden). */
export function collapseToVaultsOnly(node: TreeNodeData): void {
  if (node.kind === "vault") {
    if (node.children) {
      node._children = node.children;
      node.children = undefined;
    }
    return;
  }
  if (node.kind === "canvas" && node.children) {
    for (const c of node.children) {
      collapseToVaultsOnly(c);
    }
    return;
  }
  if (node.children) {
    for (const c of node.children) {
      collapseToVaultsOnly(c);
    }
  }
}
