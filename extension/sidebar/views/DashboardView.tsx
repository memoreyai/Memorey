import React from "react";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { PLATFORM_ABBREV } from "../utils/colors";

export function DashboardView() {
  const { stats, recentFacts, pendingNodes, pendingConflicts } = useMemoreyState();
  const dispatch = useMemoreyDispatch();

  const totalFacts = stats?.totalFacts ?? 0;
  const activeFacts = stats?.activeFacts ?? 0;
  const pendingCount = pendingNodes.length;
  const conflictCount = pendingConflicts.length;
  const vaultBreakdown = stats?.vaultBreakdown ?? {};
  const maxVaultCount = Math.max(1, ...Object.values(vaultBreakdown));

  function formatTimestamp(iso: string): string {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return "just now";
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  }

  if (totalFacts === 0 && recentFacts.length === 0) {
    return (
      <div className="memorey-dashboard">
        <div className="memorey-stats">
          <StatCard label="Total Facts" value={0} />
          <StatCard label="Active" value={0} />
          <StatCard label="Pending" value={0} />
          <StatCard label="Conflicts" value={0} />
        </div>
        <div className="memorey-empty">
          <div className="memorey-empty__title">No memories yet</div>
          <div className="memorey-empty__text">
            Start chatting with any AI and Memorey will extract and organize your personal facts.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="memorey-dashboard">
      {/* Stats cards */}
      <div className="memorey-stats">
        <StatCard label="Total Facts" value={totalFacts} />
        <StatCard label="Active" value={activeFacts} />
        <StatCard
          label="Pending"
          value={pendingCount}
          highlight={pendingCount > 0}
          onClick={pendingCount > 0 ? () => dispatch({ type: "SET_VIEW", view: "nodes" }) : undefined}
        />
        <StatCard
          label="Conflicts"
          value={conflictCount}
          highlight={conflictCount > 0}
          onClick={conflictCount > 0 ? () => dispatch({ type: "SET_VIEW", view: "conflicts" }) : undefined}
        />
      </div>

      {/* Recent facts */}
      {recentFacts.length > 0 && (
        <div className="memorey-section">
          <div className="memorey-section__title">Recent Facts</div>
          <div className="memorey-fact-list">
            {recentFacts.map((node) => (
              <div key={node.id} className="memorey-fact-item">
                <div className="memorey-fact-item__text">{node.fact}</div>
                <div className="memorey-fact-item__meta">
                  <span className="memorey-badge-pill memorey-badge-pill--vault">
                    {node.vault}
                  </span>
                  <div className="memorey-confidence">
                    <div className="memorey-confidence__bar">
                      <div
                        className="memorey-confidence__fill"
                        style={{ width: `${Math.round(node.confidence * 100)}%` }}
                      />
                    </div>
                    <span className="memorey-confidence__label">
                      {Math.round(node.confidence * 100)}%
                    </span>
                  </div>
                  <span className={`memorey-badge-pill memorey-badge-pill--${node.status}`}>
                    {node.status === "auto_approved" ? "auto" : node.status}
                  </span>
                  <span className="memorey-platform-icon" title={node.source.platform}>
                    {PLATFORM_ABBREV[node.source.platform] ?? node.source.platform.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="memorey-fact-item__timestamp">
                    {formatTimestamp(node.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Vault breakdown */}
      {Object.keys(vaultBreakdown).length > 0 && (
        <div className="memorey-section">
          <div className="memorey-section__title">Vault Breakdown</div>
          <div className="memorey-vault-breakdown">
            {Object.entries(vaultBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([vault, count]) => (
                <div key={vault} className="memorey-vault-row">
                  <span className="memorey-vault-row__name">{vault}</span>
                  <div className="memorey-vault-row__bar">
                    <div
                      className="memorey-vault-row__fill"
                      style={{ width: `${(count / maxVaultCount) * 100}%` }}
                    />
                  </div>
                  <span className="memorey-vault-row__count">{count}</span>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  highlight = false,
  onClick,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  onClick?: () => void;
}) {
  const className = `memorey-stat-card${highlight ? " memorey-stat-card--highlight" : ""}`;
  const Tag = onClick ? "button" : "div";

  return (
    <Tag className={className} onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
      <div className="memorey-stat-card__label">{label}</div>
      <div className="memorey-stat-card__value">{value}</div>
    </Tag>
  );
}
