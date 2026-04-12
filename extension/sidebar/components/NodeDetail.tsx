import React, { useState, useCallback } from "react";
import type { MemoryNode, MemoryEdge, VaultDefinition } from "memorey-core";
import { VaultBadge } from "./VaultBadge";
import { StatusBadge } from "./StatusBadge";
import { ConfidenceSlider } from "./ConfidenceSlider";
import { ChangelogTimeline } from "./ChangelogTimeline";
import { PLATFORM_ABBREV } from "../utils/colors";
import { formatRelativeTime } from "../utils/time";

interface RelatedNode {
  node: MemoryNode;
  edge: MemoryEdge;
}

interface NodeDetailProps {
  node: MemoryNode;
  vaults: VaultDefinition[];
  relatedNodes: RelatedNode[];
  onEditFact: (nodeId: string, newFact: string) => void;
  onChangeVault: (nodeId: string, vault: string) => void;
  onChangeConfidence: (nodeId: string, confidence: number) => void;
  onApprove: (nodeId: string) => void;
  onReject: (nodeId: string) => void;
  onNavigateToNode: (nodeId: string) => void;
  onBack: () => void;
}

export function NodeDetail({
  node,
  vaults,
  relatedNodes,
  onEditFact,
  onChangeVault,
  onChangeConfidence,
  onApprove,
  onReject,
  onNavigateToNode,
  onBack,
}: NodeDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(node.fact);
  const [showVaultPicker, setShowVaultPicker] = useState(false);

  const handleSaveFact = useCallback(() => {
    if (editText.trim() && editText !== node.fact) {
      onEditFact(node.id, editText.trim());
    }
    setIsEditing(false);
  }, [editText, node.fact, node.id, onEditFact]);

  const handleCancelEdit = useCallback(() => {
    setEditText(node.fact);
    setIsEditing(false);
  }, [node.fact]);

  const handleVaultChange = useCallback(
    (vault: string) => {
      onChangeVault(node.id, vault);
      setShowVaultPicker(false);
    },
    [node.id, onChangeVault]
  );

  return (
    <div className="memorey-node-detail">
      {/* Header with back button */}
      <div className="memorey-node-detail__header">
        <button className="memorey-node-detail__back" onClick={onBack} title="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
      </div>

      {/* Fact */}
      <div className="memorey-node-detail__section">
        <div className="memorey-node-detail__section-header">
          <span className="memorey-node-detail__section-title">Fact</span>
          {!isEditing && (
            <button
              className="memorey-node-detail__icon-btn"
              onClick={() => { setEditText(node.fact); setIsEditing(true); }}
              title="Edit fact"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
              </svg>
            </button>
          )}
        </div>
        {isEditing ? (
          <div className="memorey-node-detail__edit-area">
            <textarea
              className="memorey-node-detail__textarea"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              autoFocus
            />
            <div className="memorey-node-detail__edit-actions">
              <button className="memorey-node-detail__save-btn" onClick={handleSaveFact}>Save</button>
              <button className="memorey-node-detail__cancel-btn" onClick={handleCancelEdit}>Cancel</button>
            </div>
          </div>
        ) : (
          <div className="memorey-node-detail__fact-text">{node.fact}</div>
        )}
      </div>

      {/* Vault */}
      <div className="memorey-node-detail__section">
        <div className="memorey-node-detail__section-header">
          <span className="memorey-node-detail__section-title">Vault</span>
          <button
            className="memorey-node-detail__icon-btn"
            onClick={() => setShowVaultPicker(!showVaultPicker)}
            title="Change vault"
          >
            Change
          </button>
        </div>
        <VaultBadge vault={node.vault} />
        {showVaultPicker && (
          <div className="memorey-node-detail__vault-picker">
            {vaults.map((v) => (
              <button
                key={v.id}
                className={`memorey-node-detail__vault-option${v.id === node.vault ? " memorey-node-detail__vault-option--active" : ""}`}
                onClick={() => handleVaultChange(v.id)}
              >
                <VaultBadge vault={v.id} />
                <span className="memorey-node-detail__vault-desc">{v.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Confidence */}
      <div className="memorey-node-detail__section">
        <div className="memorey-node-detail__section-title">Confidence</div>
        <ConfidenceSlider
          value={node.confidence}
          onChange={(val) => onChangeConfidence(node.id, val)}
        />
      </div>

      {/* Status */}
      <div className="memorey-node-detail__section">
        <div className="memorey-node-detail__section-header">
          <span className="memorey-node-detail__section-title">Status</span>
        </div>
        <div className="memorey-node-detail__status-row">
          <StatusBadge status={node.status} />
          {node.status === "pending" && (
            <div className="memorey-node-detail__status-actions">
              <button className="memorey-node-card__btn memorey-node-card__btn--approve" onClick={() => onApprove(node.id)} title="Approve">&#10003; Approve</button>
              <button className="memorey-node-card__btn memorey-node-card__btn--reject" onClick={() => onReject(node.id)} title="Reject">&#10005; Reject</button>
            </div>
          )}
        </div>
      </div>

      {/* Source info */}
      <div className="memorey-node-detail__section">
        <div className="memorey-node-detail__section-title">Source</div>
        <div className="memorey-node-detail__source-grid">
          <span className="memorey-node-detail__source-label">Platform</span>
          <span className="memorey-node-detail__source-value">
            <span className="memorey-platform-icon" title={node.source.platform}>
              {PLATFORM_ABBREV[node.source.platform] ?? node.source.platform.slice(0, 2).toUpperCase()}
            </span>
            {" "}{node.source.platform}
          </span>

          {node.source.conversationId && (
            <>
              <span className="memorey-node-detail__source-label">Conversation</span>
              <span className="memorey-node-detail__source-value memorey-node-detail__source-value--mono">
                {node.source.conversationId}
              </span>
            </>
          )}

          <span className="memorey-node-detail__source-label">Extracted</span>
          <span className="memorey-node-detail__source-value">
            {formatRelativeTime(node.source.timestamp)}
          </span>
        </div>

        {node.source.rawExcerpt && (
          <blockquote className="memorey-node-detail__excerpt">
            {node.source.rawExcerpt}
          </blockquote>
        )}
      </div>

      {/* Relationships */}
      {relatedNodes.length > 0 && (
        <div className="memorey-node-detail__section">
          <div className="memorey-node-detail__section-title">
            Relationships ({relatedNodes.length})
          </div>
          <div className="memorey-node-detail__related-list">
            {relatedNodes.map(({ node: rel, edge }) => (
              <button
                key={rel.id}
                className="memorey-node-detail__related-item"
                onClick={() => onNavigateToNode(rel.id)}
              >
                <span className="memorey-node-detail__related-fact">{rel.fact}</span>
                <span className="memorey-node-detail__related-meta">
                  <span className="memorey-node-detail__related-relation">{edge.relation}</span>
                  <VaultBadge vault={rel.vault} />
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Changelog */}
      <div className="memorey-node-detail__section">
        <div className="memorey-node-detail__section-title">History</div>
        <ChangelogTimeline entries={node.changelog} />
      </div>

      {/* Bottom actions */}
      <div className="memorey-node-detail__bottom-actions">
        <button
          className="memorey-node-detail__danger-btn"
          onClick={() => onReject(node.id)}
          title="Mark as rejected"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
