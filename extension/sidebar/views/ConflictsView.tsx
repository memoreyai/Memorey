import React, { useState, useCallback, useMemo } from "react";
import type { ReconciliationAction } from "memorey-core";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { ConflictCard } from "../components/ConflictCard";
import { useConflictResolver } from "../components/ConflictResolver";

type ConflictAction = ReconciliationAction & { type: "conflict" };

export function ConflictsView() {
  const { pendingConflicts, allNodes } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const { resolve, toast } = useConflictResolver();
  const [animatingOut, setAnimatingOut] = useState<Set<string>>(new Set());

  const conflicts = useMemo(
    () => pendingConflicts.filter((a): a is ConflictAction => a.type === "conflict"),
    [pendingConflicts]
  );

  const nodeMap = useMemo(() => {
    const map = new Map<string, typeof allNodes[0]>();
    allNodes.forEach((n) => map.set(n.id, n));
    return map;
  }, [allNodes]);

  const handleResolve = useCallback(
    (
      conflict: ConflictAction,
      resolution: "keep_existing" | "use_new" | "keep_both",
      confidence?: number
    ) => {
      const key = conflict.existingNodeId + conflict.fact.fact;
      setAnimatingOut((prev) => new Set(prev).add(key));

      setTimeout(() => {
        resolve({ conflict, resolution, confidence });
        setAnimatingOut((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }, 300);
    },
    [resolve]
  );

  if (conflicts.length === 0) {
    return (
      <div className="memorey-conflicts">
        <div className="memorey-conflicts__empty">
          <div className="memorey-conflicts__empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--memorey-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="memorey-conflicts__empty-title">No conflicts!</div>
          <div className="memorey-conflicts__empty-text">
            Your memory is consistent.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="memorey-conflicts">
      <div className="memorey-conflicts__header">
        <span className="memorey-conflicts__count">
          {conflicts.length} {conflicts.length === 1 ? "conflict" : "conflicts"} to resolve
        </span>
      </div>

      <div className="memorey-conflicts__list">
        {conflicts.map((conflict) => {
          const key = conflict.existingNodeId + conflict.fact.fact;
          return (
            <ConflictCard
              key={key}
              conflict={conflict}
              existingNode={nodeMap.get(conflict.existingNodeId) ?? null}
              onResolve={handleResolve}
              isAnimatingOut={animatingOut.has(key)}
            />
          );
        })}
      </div>

      {toast && (
        <div className="memorey-toast">{toast}</div>
      )}
    </div>
  );
}
