import React from "react";
import type { ChangelogEntry } from "../types";
import { VaultBadge } from "./VaultBadge";
import { formatRelativeTime } from "../utils/time";

const CHANGE_ICONS: Record<ChangelogEntry["changeType"], string> = {
  created: "+",
  updated: "~",
  superseded: "S",
  confidence_changed: "C",
  vault_changed: "V",
  approved: "\u2713",
  rejected: "\u2717",
  tags_changed: "#",
  fact_edited: "E",
};

const DOT_COLORS: Record<string, string> = {
  created: "var(--memorey-success)",
  approved: "var(--memorey-success)",
  updated: "var(--memorey-warning)",
  fact_edited: "var(--memorey-warning)",
  confidence_changed: "var(--memorey-warning)",
  vault_changed: "var(--memorey-warning)",
  tags_changed: "var(--memorey-warning)",
  superseded: "var(--memorey-text-secondary)",
  rejected: "var(--memorey-error)",
};

function describeChange(entry: ChangelogEntry): React.ReactNode {
  const by = entry.changedBy === "user" ? "by user" : "by system";

  switch (entry.changeType) {
    case "created":
      return <span>Fact created {by}</span>;
    case "approved":
      return <span>Approved {by}</span>;
    case "rejected":
      return <span>Rejected {by}</span>;
    case "superseded":
      return <span>Superseded {by}</span>;
    case "confidence_changed":
      return (
        <span>
          Confidence changed from <strong>{entry.previousValue}</strong> to{" "}
          <strong>{entry.newValue}</strong> {by}
        </span>
      );
    case "vault_changed":
      return (
        <span className="memorey-changelog__vault-change">
          Vault: <VaultBadge vault={entry.previousValue ?? "?"} /> {"→"}{" "}
          <VaultBadge vault={entry.newValue ?? "?"} /> {by}
        </span>
      );
    case "fact_edited":
      return (
        <span className="memorey-changelog__fact-edit">
          Fact edited {by}
          {entry.previousValue && entry.newValue && (
            <div className="memorey-changelog__diff">
              <div className="memorey-changelog__diff-old">{entry.previousValue}</div>
              <div className="memorey-changelog__diff-new">{entry.newValue}</div>
            </div>
          )}
        </span>
      );
    case "tags_changed":
      return <span>Tags changed {by}</span>;
    case "updated":
      return <span>Updated {by}</span>;
    default:
      return <span>{entry.changeType} {by}</span>;
  }
}

interface ChangelogTimelineProps {
  entries: ChangelogEntry[];
}

export function ChangelogTimeline({ entries }: ChangelogTimelineProps) {
  const sorted = [...entries].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (sorted.length === 0) {
    return <div className="memorey-changelog__empty">No history yet</div>;
  }

  return (
    <div className="memorey-changelog">
      {sorted.map((entry, i) => (
        <div key={entry.id} className="memorey-changelog__entry">
          <div className="memorey-changelog__line-col">
            <div
              className="memorey-changelog__dot"
              style={{ background: DOT_COLORS[entry.changeType] ?? "var(--memorey-text-secondary)" }}
            >
              {CHANGE_ICONS[entry.changeType] ?? "?"}
            </div>
            {i < sorted.length - 1 && <div className="memorey-changelog__connector" />}
          </div>
          <div className="memorey-changelog__content">
            <div className="memorey-changelog__time">
              {formatRelativeTime(entry.timestamp)}
            </div>
            <div className="memorey-changelog__desc">{describeChange(entry)}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
