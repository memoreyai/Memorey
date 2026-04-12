import React, { useState, useMemo, useCallback } from "react";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { FilterBar, DEFAULT_FILTERS, type FilterState } from "../components/FilterBar";
import { GraphCanvas } from "../components/GraphCanvas";

export function CanvasView() {
  const { allNodes, vaults, edges } = useMemoreyState();
  const dispatch = useMemoreyDispatch();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);

  const filteredNodes = useMemo(() => {
    let nodes = [...allNodes];

    if (filters.vault !== "all") {
      nodes = nodes.filter((n) => n.vault === filters.vault);
    }
    if (filters.status !== "all") {
      nodes = nodes.filter((n) => n.status === filters.status);
    }
    nodes = nodes.filter(
      (n) => n.confidence >= filters.confidenceMin && n.confidence <= filters.confidenceMax
    );

    return nodes;
  }, [allNodes, filters]);

  const filteredEdges = useMemo(() => {
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    return edges.filter((e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId));
  }, [filteredNodes, edges]);

  const handleNodeDoubleClick = useCallback(
    (nodeId: string) => dispatch({ type: "NAVIGATE_TO_NODE", nodeId, from: "canvas" }),
    [dispatch]
  );

  return (
    <div className="memorey-canvas-view">
      <FilterBar filters={filters} vaults={vaults} onChange={setFilters} />
      <div className="memorey-canvas-view__info">
        {filteredNodes.length} nodes · {filteredEdges.length} edges
      </div>
      <GraphCanvas
        nodes={filteredNodes}
        edges={filteredEdges}
        onNodeDoubleClick={handleNodeDoubleClick}
      />
    </div>
  );
}
