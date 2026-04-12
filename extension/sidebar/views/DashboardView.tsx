import React from "react";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { PLATFORM_ABBREV } from "../utils/colors";

export function DashboardView() {
  const { stats, recentFacts, vaults } = useMemoreyState();
  const dispatch = useMemoreyDispatch();

  const totalFacts = stats?.totalFacts ?? 0;
  const activeFacts = stats?.activeFacts ?? 0;
  const vaultBreakdown = stats?.vaultBreakdown ?? {};
  const maxVaultCount = Math.max(1, ...Object.values(vaultBreakdown));

  function resolveVaultName(vaultId: string): string {
    return vaults.find((v) => v.id === vaultId)?.name ?? vaultId;
  }

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
        </div>
        <div className="memorey-empty">
          <div className="memorey-empty__title">No memories yet</div>
          <div className="memorey-empty__text">
            Import a conversation or create memories in the web app to see them here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="memorey-dashboard">
      <div className="memorey-stats">
        <StatCard label="Total Facts" value={totalFacts} />
        <StatCard label="Active" value={activeFacts} />
      </div>

      {recentFacts.length > 0 && (
        <div className="memorey-section">
          <div className="memorey-section__title">Recent Facts</div>
          <div className="memorey-fact-list">
            {recentFacts.map((node) => (
              <div key={node.id} className="memorey-fact-item">
                <div className="memorey-fact-item__text">{node.fact}</div>
                <div className="memorey-fact-item__meta">
                  <span className="memorey-badge-pill memorey-badge-pill--vault">
                    {resolveVaultName(node.vault)}
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
