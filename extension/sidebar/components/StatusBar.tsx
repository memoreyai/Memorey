import React from "react";
import { useMemoreyState } from "../store/memoreyStore";

export function StatusBar() {
  const { stats, pendingNodes, lastSyncTime } = useMemoreyState();

  const totalFacts = stats?.totalFacts ?? 0;
  const pendingCount = pendingNodes.length;

  function formatTime(iso: string | null): string {
    if (!iso) return "never";
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  return (
    <footer className="memorey-status-bar">
      <div className="memorey-status-bar__left">
        <span className="memorey-status-bar__item">
          {totalFacts} facts
        </span>
        {pendingCount > 0 && (
          <span className="memorey-status-bar__item">
            <span className="memorey-status-bar__badge">{pendingCount}</span>
            pending
          </span>
        )}
      </div>
      <span className="memorey-status-bar__item">
        synced {formatTime(lastSyncTime)}
      </span>
    </footer>
  );
}
