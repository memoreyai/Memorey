import React, { useState } from "react";
import type { MemoryNode, ReconciliationAction, ExtractedFact } from "memorey-core";
import { VaultBadge } from "./VaultBadge";
import { ConfidenceSlider } from "./ConfidenceSlider";
import { formatRelativeTime } from "../utils/time";
import { PLATFORM_ABBREV } from "../utils/colors";

type ConflictAction = ReconciliationAction & { type: "conflict" };

interface ConflictCardProps {
  conflict: ConflictAction;
  existingNode: MemoryNode | null;
  onResolve: (
    conflict: ConflictAction,
    resolution: "keep_existing" | "use_new" | "keep_both",
    confidence?: number
  ) => void;
  isAnimatingOut?: boolean;
}

function FactPanel({
  label,
  fact,
  vault,
  confidence,
  platform,
  date,
}: {
  label: string;
  fact: string;
  vault: string;
  confidence: number;
  platform: string;
  date: string;
}) {
  const pct = Math.round(confidence * 100);
  return (
    <div className="memorey-conflict-card__panel">
      <div className="memorey-conflict-card__panel-label">{label}</div>
      <div className="memorey-conflict-card__panel-fact">{fact}</div>
      <div className="memorey-conflict-card__panel-meta">
        <VaultBadge vault={vault} />
        <span className="memorey-conflict-card__confidence">
          {pct}%
        </span>
        <span className="memorey-platform-icon" title={platform}>
          {PLATFORM_ABBREV[platform] ?? platform.slice(0, 2).toUpperCase()}
        </span>
        <span className="memorey-conflict-card__date">
          {formatRelativeTime(date)}
        </span>
      </div>
    </div>
  );
}

export function ConflictCard({ conflict, existingNode, onResolve, isAnimatingOut }: ConflictCardProps) {
  const [showSlider, setShowSlider] = useState(false);
  const [newConfidence, setNewConfidence] = useState(conflict.fact.confidence);

  const newFact: ExtractedFact = conflict.fact;
  const reason = conflict.reason;

  const handleKeepExisting = () => {
    onResolve(conflict, "keep_existing");
  };

  const handleUseNew = () => {
    if (!showSlider) {
      setShowSlider(true);
      return;
    }
    onResolve(conflict, "use_new", newConfidence);
  };

  const handleKeepBoth = () => {
    onResolve(conflict, "keep_both");
  };

  const containerClass = `memorey-conflict-card${isAnimatingOut ? " memorey-conflict-card--out" : ""}`;

  return (
    <div className={containerClass}>
      <div className="memorey-conflict-card__panels">
        {existingNode && (
          <FactPanel
            label="Existing fact"
            fact={existingNode.fact}
            vault={existingNode.vault}
            confidence={existingNode.confidence}
            platform={existingNode.source.platform}
            date={existingNode.createdAt}
          />
        )}

        <div className="memorey-conflict-card__vs">conflicts with</div>

        <FactPanel
          label="New fact"
          fact={newFact.fact}
          vault={newFact.vault}
          confidence={newFact.confidence}
          platform="extraction"
          date={new Date().toISOString()}
        />
      </div>

      <div className="memorey-conflict-card__reason">
        <span className="memorey-conflict-card__reason-label">Reason:</span>
        {reason}
      </div>

      {showSlider && (
        <div className="memorey-conflict-card__slider">
          <ConfidenceSlider value={newConfidence} onChange={setNewConfidence} />
        </div>
      )}

      <div className="memorey-conflict-card__actions">
        <button
          className="memorey-conflict-card__btn memorey-conflict-card__btn--keep"
          onClick={handleKeepExisting}
        >
          Keep Existing
        </button>
        <button
          className="memorey-conflict-card__btn memorey-conflict-card__btn--new"
          onClick={handleUseNew}
        >
          {showSlider ? "Confirm New" : "Use New"}
        </button>
        <button
          className="memorey-conflict-card__btn memorey-conflict-card__btn--both"
          onClick={handleKeepBoth}
        >
          Keep Both
        </button>
      </div>
    </div>
  );
}
