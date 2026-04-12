import React, { useCallback, useEffect, useState, useMemo } from "react";
import { useMemoreyState } from "../store/memoreyStore";
import { useAuthContext } from "../hooks/useAuth";
import { useDataReload } from "../App";
import { formatRelativeTime } from "../utils/time";

declare const __WEB_APP_URL__: string | undefined;
const WEB_APP_URL = typeof __WEB_APP_URL__ !== "undefined" ? __WEB_APP_URL__ : "https://memorey.co";

interface ConflictNode {
  id: string;
  title: string;
  value: string;
  vault: string;
  confidence: number;
  created_at: string;
  source: string;
}

interface DetectedConflict {
  id: string;
  nodeA: ConflictNode;
  nodeB: ConflictNode;
  reason: string;
  type: "contradiction" | "evolution" | "duplicate";
  autoResolvable: boolean;
}

type Resolution = "keep_a" | "keep_b" | "keep_both" | "merge";

const TYPE_LABELS: Record<string, string> = {
  contradiction: "Contradiction",
  evolution: "Evolution",
  duplicate: "Duplicate",
};

const TYPE_COLORS: Record<string, string> = {
  contradiction: "#ef4444",
  evolution: "#f59e0b",
  duplicate: "#6366f1",
};

export function ConflictsView() {
  const { pendingProposals } = useMemoreyState();
  const { token } = useAuthContext();
  const reload = useDataReload();
  const [conflicts, setConflicts] = useState<DetectedConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const detectConflicts = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`${WEB_APP_URL}/api/conflicts/detect`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) throw new Error("Failed to detect conflicts");
      const data = await res.json();
      setConflicts(data.conflicts ?? []);
    } catch (err) {
      console.error("Conflict detection failed:", err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void detectConflicts();
  }, [detectConflicts]);

  const handleResolve = useCallback(
    async (conflictId: string, nodeAId: string, nodeBId: string, resolution: Resolution) => {
      if (!token) return;
      setResolving((s) => new Set(s).add(conflictId));
      try {
        const res = await fetch(`${WEB_APP_URL}/api/conflicts/resolve`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ nodeAId, nodeBId, resolution }),
        });
        if (!res.ok) throw new Error("Resolution failed");
        setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
        await reload();
      } catch (err) {
        console.error("Resolution failed:", err);
      } finally {
        setResolving((s) => {
          const next = new Set(s);
          next.delete(conflictId);
          return next;
        });
      }
    },
    [token, reload]
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conflicts;
    const q = searchQuery.toLowerCase();
    return conflicts.filter(
      (c) =>
        c.nodeA.title.toLowerCase().includes(q) ||
        c.nodeA.value.toLowerCase().includes(q) ||
        c.nodeB.title.toLowerCase().includes(q) ||
        c.nodeB.value.toLowerCase().includes(q) ||
        c.reason.toLowerCase().includes(q)
    );
  }, [conflicts, searchQuery]);

  if (loading) {
    return (
      <div className="memorey-conflicts">
        <div className="memorey-conflicts__loading">
          <div className="memorey-spinner" />
          <span>Scanning for conflicts...</span>
        </div>
      </div>
    );
  }

  const totalCount = conflicts.length + pendingProposals.length;

  if (filtered.length === 0 && pendingProposals.length === 0) {
    return (
      <div className="memorey-conflicts">
        <div className="memorey-conflicts__empty">
          <div className="memorey-conflicts__empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--memorey-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="memorey-conflicts__empty-title">
            {searchQuery ? "No matching conflicts" : "No conflicts found!"}
          </div>
          <div className="memorey-conflicts__empty-text">
            {searchQuery
              ? "Try a different search term"
              : "Your memory is consistent. All clear!"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="memorey-conflicts">
      <div className="memorey-conflicts__header">
        <span className="memorey-conflicts__count">
          {totalCount} {totalCount === 1 ? "issue" : "issues"} found
        </span>
        <button
          className="memorey-conflicts__rescan-btn"
          onClick={() => void detectConflicts()}
        >
          Rescan
        </button>
      </div>

      {(conflicts.length > 2 || searchQuery) && (
        <div className="memorey-conflicts__search">
          <input
            type="text"
            className="memorey-conflicts__search-input"
            placeholder="Search conflicts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      )}

      <div className="memorey-conflicts__list">
        {filtered.map((conflict) => {
          const isProcessing = resolving.has(conflict.id);
          const typeColor = TYPE_COLORS[conflict.type] ?? "#888";
          return (
            <div
              key={conflict.id}
              className={`memorey-conflict-card${isProcessing ? " memorey-conflict-card--resolving" : ""}`}
            >
              <div className="memorey-conflict-card__type-bar" style={{ background: typeColor }} />

              <div className="memorey-conflict-card__badge-row">
                <span
                  className="memorey-conflict-card__type-badge"
                  style={{ color: typeColor, borderColor: typeColor }}
                >
                  {TYPE_LABELS[conflict.type] ?? conflict.type}
                </span>
                {conflict.autoResolvable && (
                  <span className="memorey-conflict-card__auto-badge">Auto</span>
                )}
              </div>

              <ConflictNodeSide node={conflict.nodeA} label="A" />

              <div className="memorey-conflict-card__vs">
                <span className="memorey-conflict-card__vs-text">vs</span>
              </div>

              <ConflictNodeSide node={conflict.nodeB} label="B" />

              <div className="memorey-conflict-card__reason">{conflict.reason}</div>

              <div className="memorey-conflict-card__actions">
                <button
                  className="memorey-conflict-card__btn memorey-conflict-card__btn--keep"
                  onClick={() => handleResolve(conflict.id, conflict.nodeA.id, conflict.nodeB.id, "keep_a")}
                  disabled={isProcessing}
                >
                  Keep A
                </button>
                <button
                  className="memorey-conflict-card__btn memorey-conflict-card__btn--keep"
                  onClick={() => handleResolve(conflict.id, conflict.nodeA.id, conflict.nodeB.id, "keep_b")}
                  disabled={isProcessing}
                >
                  Keep B
                </button>
                <button
                  className="memorey-conflict-card__btn memorey-conflict-card__btn--both"
                  onClick={() => handleResolve(conflict.id, conflict.nodeA.id, conflict.nodeB.id, "keep_both")}
                  disabled={isProcessing}
                >
                  Both
                </button>
                <button
                  className="memorey-conflict-card__btn memorey-conflict-card__btn--merge"
                  onClick={() => handleResolve(conflict.id, conflict.nodeA.id, conflict.nodeB.id, "merge")}
                  disabled={isProcessing}
                >
                  Merge
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConflictNodeSide({ node, label }: { node: ConflictNode; label: string }) {
  const confidence = Math.round(node.confidence * 100);
  const barColor =
    node.confidence < 0.3 ? "#ef4444" : node.confidence < 0.7 ? "#f59e0b" : "#22c55e";

  return (
    <div className="memorey-conflict-node">
      <div className="memorey-conflict-node__header">
        <span className="memorey-conflict-node__label">{label}</span>
        <span className="memorey-conflict-node__title">{node.title}</span>
      </div>
      <div className="memorey-conflict-node__value">{node.value}</div>
      <div className="memorey-conflict-node__meta">
        {node.vault && (
          <span className="memorey-badge-pill memorey-badge-pill--vault">{node.vault}</span>
        )}
        <div className="memorey-confidence" style={{ flex: "0 0 auto" }}>
          <div className="memorey-confidence__bar" style={{ width: 40 }}>
            <div
              className="memorey-confidence__fill"
              style={{ width: `${confidence}%`, background: barColor }}
            />
          </div>
          <span className="memorey-confidence__label">{confidence}%</span>
        </div>
        <span className="memorey-conflict-node__time">
          {formatRelativeTime(node.created_at)}
        </span>
      </div>
    </div>
  );
}
