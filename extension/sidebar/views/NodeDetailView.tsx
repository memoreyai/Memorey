import React, { useMemo, useCallback } from "react";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { useNodeActions } from "../hooks/useNodeActions";
import { NodeDetail } from "../components/NodeDetail";

export function NodeDetailView() {
  const { selectedNodeId, allNodes, vaults, edges, currentView } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const actions = useNodeActions();

  const node = useMemo(
    () => allNodes.find((n) => n.id === selectedNodeId) ?? null,
    [allNodes, selectedNodeId]
  );

  const relatedNodes = useMemo(() => {
    if (!node) return [];
    const related = edges.filter(
      (e) => e.fromId === node.id || e.toId === node.id
    );
    return related
      .map((edge) => {
        const otherId = edge.fromId === node.id ? edge.toId : edge.fromId;
        const relNode = allNodes.find((n) => n.id === otherId);
        return relNode ? { node: relNode, edge } : null;
      })
      .filter(Boolean) as { node: typeof allNodes[number]; edge: typeof edges[number] }[];
  }, [node, allNodes, edges]);

  const handleEditFact = useCallback(
    (nodeId: string, newFact: string) => void actions.editNodeFact(nodeId, newFact),
    [actions]
  );

  const handleChangeVault = useCallback(
    (nodeId: string, vault: string) => void actions.changeNodeVault(nodeId, vault),
    [actions]
  );

  const handleChangeConfidence = useCallback(
    (nodeId: string, confidence: number) => void actions.updateNodeConfidence(nodeId, confidence),
    [actions]
  );

  const handleApprove = useCallback(
    (nodeId: string) => void actions.approveNode(nodeId),
    [actions]
  );

  const handleReject = useCallback(
    (nodeId: string) => void actions.rejectNode(nodeId),
    [actions]
  );

  const handleNavigateToNode = useCallback(
    (nodeId: string) => dispatch({ type: "NAVIGATE_TO_NODE", nodeId, from: currentView }),
    [dispatch, currentView]
  );

  const handleBack = useCallback(() => dispatch({ type: "NAVIGATE_BACK" }), [dispatch]);

  if (!node) {
    return (
      <div className="memorey-empty">
        <div className="memorey-empty__title">Node not found</div>
        <div className="memorey-empty__text">The selected node may have been deleted.</div>
        <button className="memorey-node-detail__back" onClick={handleBack}>Go back</button>
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
