"use client";

import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import { TreeView } from "../TreeView";

/** Tree layout for the dashboard graph area — wired to graph/canvas stores. */
export function GraphTreeView() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const vaults = useVaultStore((s) => s.vaults).filter((v) => v.isActive);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const canvases = useCanvasStore((s) => s.canvases);
  const selectNode = useGraphStore((s) => s.selectNode);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        top: 44,
        zIndex: 1,
      }}
    >
      <TreeView
        nodes={nodes}
        edges={edges}
        vaults={vaults}
        canvasName={activeCanvas?.name ?? "Canvas"}
        canvasEmoji={activeCanvas?.emoji ?? ""}
        masterNodeBio={activeCanvas?.masterNodeBio ?? undefined}
        isMasterView={isMasterView}
        canvases={canvases}
        onNodeClick={(n) => selectNode(n.id)}
      />
    </div>
  );
}
