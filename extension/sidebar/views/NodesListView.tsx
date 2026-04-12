import React, { useState, useMemo, useCallback } from "react";
import type { MemoryNode } from "memorey-core";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { usePipeline } from "../hooks/usePipeline";
import { FilterBar, DEFAULT_FILTERS, type FilterState } from "../components/FilterBar";
import { SearchBar } from "../components/SearchBar";
import { NodeCard } from "../components/NodeCard";

export function NodesListView() {
  const { allNodes, vaults } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const { pipeline, save } = usePipeline();

  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredNodes = useMemo(() => {
    let nodes = [...allNodes];

    // Vault filter
    if (filters.vault !== "all") {
      nodes = nodes.filter((n) => n.vault === filters.vault);
    }

    // Status filter
    if (filters.status !== "all") {
      nodes = nodes.filter((n) => n.status === filters.status);
    }

    // Confidence range
    nodes = nodes.filter(
      (n) => n.confidence >= filters.confidenceMin && n.confidence <= filters.confidenceMax
    );

    // Text search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      nodes = nodes.filter(
        (n) =>
          n.fact.toLowerCase().includes(q) ||
          n.vault.toLowerCase().includes(q) ||
          n.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Sort
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
  }, [allNodes, filters, searchQuery]);

  const handleApprove = useCallback(
    (node: MemoryNode) => {
      const updated = pipeline.approveNode(node.id);
      dispatch({ type: "UPDATE_NODE", node: updated });
      save(pipeline);
    },
    [pipeline, dispatch, save]
  );

  const handleReject = useCallback(
    (node: MemoryNode) => {
      const updated = pipeline.rejectNode(node.id);
      dispatch({ type: "UPDATE_NODE", node: updated });
      save(pipeline);
    },
    [pipeline, dispatch, save]
  );

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      dispatch({ type: "NAVIGATE_TO_NODE", nodeId, from: "nodes" });
    },
    [dispatch]
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
          <div className="memorey-empty__text">
            Try adjusting your filters or search query.
          </div>
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
            />
          ))}
        </div>
      )}
    </div>
  );
}
