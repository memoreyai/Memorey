import React, { useCallback, useEffect, useState } from "react";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { useAuthContext } from "../hooks/useAuth";
import { PLATFORM_ABBREV } from "../utils/colors";
import { formatRelativeTime } from "../utils/time";

declare const __WEB_APP_URL__: string | undefined;
const WEB_APP_URL = typeof __WEB_APP_URL__ !== "undefined" ? __WEB_APP_URL__ : "https://memorey.co";

export function DashboardView() {
  const { stats, recentFacts, vaults, allNodes, pendingProposals, selectedCanvasId } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const { token } = useAuthContext();
  const [conflictCount, setConflictCount] = useState(0);

  const fetchConflictCount = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${WEB_APP_URL}/api/conflicts/detect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) return;
      const data = await res.json();
      setConflictCount(data.conflicts?.length ?? 0);
    } catch {
      /* ignore */
    }
  }, [token]);

  useEffect(() => {
    void fetchConflictCount();
  }, [fetchConflictCount]);

  const filtered = selectedCanvasId === "all"
    ? allNodes
    : allNodes.filter((n) => (n as any).canvasId === selectedCanvasId);

  const totalFacts = filtered.length;
  const activeFacts = filtered.length;
  const pendingCount = pendingProposals.length;

  const vaultBreakdown: Record<string, number> = {};
  filtered.forEach((n) => {
    const vName = vaults.find((v) => v.id === n.vault)?.name ?? "Unknown";
    vaultBreakdown[vName] = (vaultBreakdown[vName] ?? 0) + 1;
  });
  const maxVaultCount = Math.max(1, ...Object.values(vaultBreakdown));

  const recent = selectedCanvasId === "all"
    ? recentFacts
    : recentFacts.filter((n) => (n as any).canvasId === selectedCanvasId);

  function resolveVaultName(vaultId: string): string {
    return vaults.find((v) => v.id === vaultId)?.name ?? vaultId;
  }

  if (totalFacts === 0 && recent.length === 0 && pendingCount === 0) {
    return (
      <div className="memorey-dashboard">
        <div className="memorey-stats">
          <StatCard label="Total Facts" value={0} />
          <StatCard label="Active" value={0} />
          <StatCard label="Pending" value={0} />
          <StatCard
            label="Conflicts"
            value={conflictCount}
            highlight={conflictCount > 0}
            onClick={conflictCount > 0 ? () => dispatch({ type: "SET_VIEW", view: "conflicts" }) : undefined}
          />
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
        <StatCard
          label="Pending"
          value={pendingCount}
          highlight={pendingCount > 0}
          onClick={pendingCount > 0 ? () => dispatch({ type: "SET_VIEW", view: "conflicts" }) : undefined}
        />
        <StatCard
          label="Conflicts"
          value={conflictCount}
          highlight={conflictCount > 0}
          onClick={conflictCount > 0 ? () => dispatch({ type: "SET_VIEW", view: "conflicts" }) : undefined}
        />
      </div>

      {recent.length > 0 && (
        <div className="memorey-section">
          <div className="memorey-section__title">Recent Facts</div>
          <div className="memorey-fact-list">
            {recent.slice(0, 10).map((node) => (
              <div
                key={node.id}
                className="memorey-fact-item"
                onClick={() => dispatch({ type: "NAVIGATE_TO_NODE", nodeId: node.id, from: "dashboard" })}
                role="button"
                tabIndex={0}
              >
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
                    {formatRelativeTime(node.createdAt)}
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
