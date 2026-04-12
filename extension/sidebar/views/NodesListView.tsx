import React, { useState, useMemo, useCallback } from "react";
import type { MemoryNode } from "../types";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { useNodeActions } from "../hooks/useNodeActions";
import { FilterBar, DEFAULT_FILTERS, type FilterState } from "../components/FilterBar";
import { SearchBar } from "../components/SearchBar";
import { NodeCard } from "../components/NodeCard";

export function NodesListView() {
  const { allNodes, vaults, selectedCanvasId } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const actions = useNodeActions();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNodes = useMemo(() => {
    let nodes = selectedCanvasId === "all"
      ? [...allNodes]
      : allNodes.filter((n) => (n as any).canvasId === selectedCanvasId);

    if (filters.vault !== "all") {
      nodes = nodes.filter((n) => n.vault === filters.vault);
    }
    if (filters.status !== "all") {
      nodes = nodes.filter((n) => n.status === filters.status);
    }
    nodes = nodes.filter(
      (n) => n.confidence >= filters.confidenceMin && n.confidence <= filters.confidenceMax
    );

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.fact.toLowerCase().includes(q) ||
          n.vault.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    switch (filters.sortBy) {
      case "confidence":
        nodes.sort((a, b) => b.confidence - a.confidence);
        break;
      case "vault":
        nodes.sort((a, b) => a.vault.localeCompare(b.vault));
        break;
      case "date":
      default:
        nodes.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        break;
    }

    return nodes;
  }, [allNodes, filters, searchQuery, selectedCanvasId]);

  const handleApprove = useCallback(
    (node: MemoryNode) => void actions.approveNode(node.id),
    [actions]
  );

  const handleReject = useCallback(
    (node: MemoryNode) => void actions.rejectNode(node.id),
    [actions]
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => dispatch({ type: "NAVIGATE_TO_NODE", nodeId, from: "nodes" }),
    [dispatch]
  );

  const handleConfidenceChange = useCallback(
    (nodeId: string, value: number) => void actions.updateNodeConfidence(nodeId, value),
    [actions]
  );

  return (
    <div className="memorey-nodes-list">
      <FilterBar filters={filters} vaults={vaults} onChange={setFilters} />
      <SearchBar onSearch={setSearchQuery} placeholder="Search memories..." />

      <div className="memorey-nodes-list__count">
        {filteredNodes.length} {filteredNodes.length === 1 ? "node" : "nodes"}
      </div>

      {filteredNodes.length === 0 ? (
        <div className="memorey-empty">
          <div className="memorey-empty__title">No matching nodes</div>
          <div className="memorey-empty__text">Try adjusting your filters or search query.</div>
        </div>
      ) : (
        <div className="memorey-nodes-list__cards">
          {filteredNodes.map((node) => (
            <NodeCard
              key={node.id}
              node={node}
              onClick={() => handleNodeClick(node.id)}
              onApprove={() => handleApprove(node)}
              onReject={() => handleReject(node)}
              onConfidenceChange={handleConfidenceChange}
              showQuickActions
            />
          ))}
        </div>
      )}
    </div>
  );
}
