import React, { useState, useCallback } from "react";
import type { MemoryNode } from "memorey-core";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { usePipeline } from "../hooks/usePipeline";
import { NodeCard } from "../components/NodeCard";
import { VaultBadge } from "../components/VaultBadge";
import { formatRelativeTime } from "../utils/time";

export function PendingView() {
  const { pendingNodes, currentView } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const { pipeline, refreshState, save } = usePipeline();

  const [confirmApproveAll, setConfirmApproveAll] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const animateAndRemove = useCallback(
    (nodeId: string, action: () => void) => {
      setAnimatingOut((prev) => new Set(prev).add(nodeId));
      setTimeout(() => {
        action();
        setAnimatingOut((prev) => {
          const next = new Set(prev);
          next.delete(nodeId);
          return next;
        });
      }, 300);
    },
    []
  );

  const handleApprove = useCallback(
    (node: MemoryNode) => {
      animateAndRemove(node.id, () => {
        const updated = pipeline.approveNode(node.id);
        dispatch({ type: "UPDATE_NODE", node: updated });
        dispatch({ type: "REMOVE_PENDING_NODE", nodeId: node.id });
        save(pipeline);
      });
    },
    [pipeline, dispatch, save, animateAndRemove]
  );

  const handleReject = useCallback(
    (node: MemoryNode) => {
      animateAndRemove(node.id, () => {
        const updated = pipeline.rejectNode(node.id);
        dispatch({ type: "UPDATE_NODE", node: updated });
        dispatch({ type: "REMOVE_PENDING_NODE", nodeId: node.id });
        save(pipeline);
      });
    },
    [pipeline, dispatch, save, animateAndRemove]
  );

  const handleApproveAll = useCallback(() => {
    pipeline.approveAll();
    refreshState(pipeline);
    save(pipeline);
    setConfirmApproveAll(false);
  }, [pipeline, refreshState, save]);

  const handleNodeClick = useCallback(
    (nodeId: string) => {
      dispatch({ type: "NAVIGATE_TO_NODE", nodeId, from: currentView });
    },
    [dispatch, currentView]
  );

  if (pendingNodes.length === 0) {
    return (
      <div className="memorey-pending">
        <div className="memorey-pending__empty">
          <div className="memorey-pending__empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--memorey-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="memorey-pending__empty-title">All caught up!</div>
          <div className="memorey-pending__empty-text">No facts pending approval.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="memorey-pending">
      <div className="memorey-pending__header">
        <span className="memorey-pending__count">
          {pendingNodes.length} {pendingNodes.length === 1 ? "fact" : "facts"} pending approval
        </span>
        {!confirmApproveAll ? (
          <button
            className="memorey-pending__approve-all-btn"
            onClick={() => setConfirmApproveAll(true)}
          >
            Approve All
          </button>
        ) : (
          <div className="memorey-pending__confirm">
            <span>Approve all {pendingNodes.length}?</span>
            <button className="memorey-pending__confirm-yes" onClick={handleApproveAll}>
              Yes
            </button>
            <button className="memorey-pending__confirm-no" onClick={() => setConfirmApproveAll(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>

      <div className="memorey-pending__list">
        {pendingNodes.map((node) => {
          const isExpanded = expandedIds.has(node.id);
          const isAnimating = animatingOut.has(node.id);

          return (
            <div
              key={node.id}
              className={`memorey-pending__item${isAnimating ? " memorey-pending__item--out" : ""}`}
            >
              <NodeCard
                node={node}
                onClick={() => toggleExpand(node.id)}
                onApprove={() => handleApprove(node)}
                onReject={() => handleReject(node)}
                showActions
              />

              {isExpanded && (
                <div className="memorey-pending__expanded">
                  <div className="memorey-pending__detail-row">
                    <span className="memorey-pending__detail-label">Full fact</span>
                    <span className="memorey-pending__detail-value">{node.fact}</span>
                  </div>
                  <div className="memorey-pending__detail-row">
                    <span className="memorey-pending__detail-label">Vault</span>
                    <VaultBadge vault={node.vault} />
                  </div>
                  <div className="memorey-pending__detail-row">
                    <span className="memorey-pending__detail-label">Confidence</span>
                    <span className="memorey-pending__detail-value">
                      {Math.round(node.confidence * 100)}%
                    </span>
                  </div>
                  <div className="memorey-pending__detail-row">
                    <span className="memorey-pending__detail-label">Source</span>
                    <span className="memorey-pending__detail-value">
                      {node.source.platform} · {formatRelativeTime(node.source.timestamp)}
                    </span>
                  </div>
                  {node.source.rawExcerpt && (
                    <blockquote className="memorey-node-detail__excerpt">
                      {node.source.rawExcerpt}
                    </blockquote>
                  )}
                  <button
                    className="memorey-pending__view-detail"
                    onClick={() => handleNodeClick(node.id)}
                  >
                    View full detail →
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
