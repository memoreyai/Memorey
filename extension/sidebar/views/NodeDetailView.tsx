import React, { useMemo, useCallback } from "react";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { usePipeline } from "../hooks/usePipeline";
import { NodeDetail } from "../components/NodeDetail";

export function NodeDetailView() {
  const { selectedNodeId, allNodes, vaults, currentView } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const { pipeline, save } = usePipeline();

  const node = useMemo(
    () => allNodes.find((n) => n.id === selectedNodeId) ?? null,
    [allNodes, selectedNodeId]
  );

  const relatedNodes = useMemo(() => {
    if (!node) return [];
    const graphData = pipeline.exportGraph();
    const edges = graphData.edges.filter(
      (e) => e.fromId === node.id || e.toId === node.id
    );
    return edges
      .map((edge) => {
        const otherId = edge.fromId === node.id ? edge.toId : edge.fromId;
        const relNode = allNodes.find((n) => n.id === otherId);
        return relNode ? { node: relNode, edge } : null;
      })
      .filter(Boolean) as { node: typeof allNodes[number]; edge: typeof graphData.edges[number] }[];
  }, [node, allNodes, pipeline]);

  const handleEditFact = useCallback(
    (nodeId: string, newFact: string) => {
      const updated = pipeline.editNodeFact(nodeId, newFact);
      dispatch({ type: "UPDATE_NODE", node: updated });
      save(pipeline);
    },
    [pipeline, dispatch, save]
  );

  const handleChangeVault = useCallback(
    (nodeId: string, vault: string) => {
      const updated = pipeline.changeNodeVault(nodeId, vault);
      dispatch({ type: "UPDATE_NODE", node: updated });
      save(pipeline);
    },
    [pipeline, dispatch, save]
  );

  const handleChangeConfidence = useCallback(
    (nodeId: string, confidence: number) => {
      const updated = pipeline.updateNodeConfidence(nodeId, confidence);
      dispatch({ type: "UPDATE_NODE", node: updated });
      save(pipeline);
    },
    [pipeline, dispatch, save]
  );

  const handleApprove = useCallback(
    (nodeId: string) => {
      const updated = pipeline.approveNode(nodeId);
      dispatch({ type: "UPDATE_NODE", node: updated });
      save(pipeline);
    },
    [pipeline, dispatch, save]
  );

  const handleReject = useCallback(
    (nodeId: string) => {
      const updated = pipeline.rejectNode(nodeId);
      dispatch({ type: "UPDATE_NODE", node: updated });
      save(pipeline);
    },
    [pipeline, dispatch, save]
  );

  const handleNavigateToNode = useCallback(
    (nodeId: string) => {
      dispatch({ type: "NAVIGATE_TO_NODE", nodeId, from: currentView });
    },
    [dispatch, currentView]
  );

  const handleBack = useCallback(() => {
    dispatch({ type: "NAVIGATE_BACK" });
  }, [dispatch]);

  if (!node) {
    return (
      <div className="memorey-empty">
        <div className="memorey-empty__title">Node not found</div>
        <div className="memorey-empty__text">
          The selected node may have been deleted.
        </div>
        <button className="memorey-node-detail__back" onClick={handleBack}>
          Go back
        </button>
      </div>
    );
  }

  return (
    <NodeDetail
      node={node}
      vaults={vaults}
      relatedNodes={relatedNodes}
      onEditFact={handleEditFact}
      onChangeVault={handleChangeVault}
      onChangeConfidence={handleChangeConfidence}
      onApprove={handleApprove}
      onReject={handleReject}
      onNavigateToNode={handleNavigateToNode}
      onBack={handleBack}
    />
  );
}
