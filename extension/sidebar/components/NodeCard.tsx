import React from "react";
import type { MemoryNode } from "../types";
import { VaultBadge } from "./VaultBadge";
import { StatusBadge } from "./StatusBadge";
import { PLATFORM_ABBREV } from "../utils/colors";
import { formatRelativeTime } from "../utils/time";

function confidenceColor(c: number): string {
  if (c >= 0.8) return "var(--memorey-success)";
  if (c >= 0.5) return "var(--memorey-warning)";
  return "var(--memorey-error)";
}

interface NodeCardProps {
  node: MemoryNode;
  onClick?: () => void;
  onApprove?: () => void;
  onReject?: () => void;
  showActions?: boolean;
}

export function NodeCard({ node, onClick, onApprove, onReject, showActions }: NodeCardProps) {
  const truncatedFact =
    node.fact.length > 120 ? node.fact.slice(0, 117) + "..." : node.fact;
  const pct = Math.round(node.confidence * 100);
  const isPending = node.status === "pending";

  return (
    <div className="memorey-node-card" onClick={onClick} role="button" tabIndex={0}>
      <div className="memorey-node-card__fact">{truncatedFact}</div>
      <div className="memorey-node-card__meta">
        <VaultBadge vault={node.vault} />
        <StatusBadge status={node.status} />

        <div className="memorey-node-card__confidence">
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
