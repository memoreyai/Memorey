import React, { useState, useCallback } from "react";
import type { MemoryNode } from "../types";
import { VaultBadge } from "./VaultBadge";
import { StatusBadge } from "./StatusBadge";
import { PLATFORM_ABBREV } from "../utils/colors";
import { formatRelativeTime } from "../utils/time";

function confidenceColor(c: number): string {
  if (c > 0.7) return "var(--memorey-success)";
  if (c >= 0.3) return "var(--memorey-warning)";
  return "var(--memorey-error)";
}

interface NodeCardProps {
  node: MemoryNode;
  onClick?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  onConfidenceChange?: (nodeId: string, value: number) => void;
  showActions?: boolean;
  showQuickActions?: boolean;
}

export function NodeCard({
  node,
  onClick,
  onApprove,
  onReject,
  onConfidenceChange,
  showActions,
  showQuickActions,
}: NodeCardProps) {
  const truncatedFact =
    node.fact.length > 120 ? node.fact.slice(0, 117) + "..." : node.fact;
  const pct = Math.round(node.confidence * 100);
  const isPending = node.status === "pending";
  const [editingConfidence, setEditingConfidence] = useState(false);
  const [sliderValue, setSliderValue] = useState(node.confidence);

  const handleConfidenceBarClick = useCallback(
    (e: React.MouseEvent) => {
      if (!onConfidenceChange || !showQuickActions) return;
      e.stopPropagation();
      setSliderValue(node.confidence);
      setEditingConfidence(true);
    },
    [onConfidenceChange, showQuickActions, node.confidence]
  );

  const handleSliderChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      e.stopPropagation();
      setSliderValue(parseFloat(e.target.value));
    },
    []
  );

  const handleSliderCommit = useCallback(
    (e: React.MouseEvent | React.FocusEvent) => {
      e.stopPropagation();
      if (onConfidenceChange && sliderValue !== node.confidence) {
        onConfidenceChange(node.id, sliderValue);
      }
      setEditingConfidence(false);
    },
    [onConfidenceChange, sliderValue, node.confidence, node.id]
  );

  const handleOpenInWebApp = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (typeof chrome !== "undefined" && chrome.tabs?.create) {
        chrome.tabs.create({ url: "https://memorey.co/dashboard" });
      } else {
        window.open("https://memorey.co/dashboard", "_blank");
      }
    },
    []
  );

  return (
    <div className="memorey-node-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="memorey-node-card__fact">{truncatedFact}</div>
      <div className="memorey-node-card__meta">
        <VaultBadge vault={node.vault} />
        <StatusBadge status={node.status} />

        <div
          className="memorey-node-card__confidence"
          onClick={handleConfidenceBarClick}
          title={showQuickActions ? "Click to edit confidence" : `${pct}%`}
          style={showQuickActions ? { cursor: "pointer" } : undefined}
        >
          <div className="memorey-node-card__confidence-bar">
            <div
              className="memorey-node-card__confidence-fill"
              style={{
                width: `${pct}%`,
                background: confidenceColor(node.confidence),
              }}
            />
          </div>
        </div>

        <span className="memorey-platform-icon" title={node.source.platform}>
          {PLATFORM_ABBREV[node.source.platform] ?? node.source.platform.slice(0, 2).toUpperCase()}
        </span>
        <span className="memorey-node-card__time">
          {formatRelativeTime(node.createdAt)}
        </span>
      </div>

      {editingConfidence && (
        <div className="memorey-node-card__confidence-editor" onClick={(e) => e.stopPropagation()}>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={sliderValue}
            onChange={handleSliderChange}
            className="memorey-node-card__confidence-slider"
            autoFocus
            onBlur={handleSliderCommit}
          />
          <span className="memorey-node-card__confidence-value">
            {Math.round(sliderValue * 100)}%
          </span>
          <button
            className="memorey-node-card__confidence-save"
            onClick={handleSliderCommit}
          >
            Save
          </button>
        </div>
      )}

      {showQuickActions && (
        <div className="memorey-node-card__quick-actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="memorey-node-card__web-btn"
            onClick={handleOpenInWebApp}
            title="Open in web app"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
            Web
          </button>
        </div>
      )}

      {(showActions ?? isPending) && isPending && (
        <div className="memorey-node-card__actions" onClick={(e) => e.stopPropagation()}>
          <button
            className="memorey-node-card__btn memorey-node-card__btn--approve"
            onClick={onApprove}
            title="Approve"
          >
            &#10003;
          </button>
          <button
            className="memorey-node-card__btn memorey-node-card__btn--reject"
            onClick={onReject}
            title="Reject"
          >
            &#10005;
          </button>
        </div>
      )}
    </div>
  );
}
