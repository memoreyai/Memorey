import React from "react";
import { useMemoreyState } from "../store/memoreyStore";
import type { SyncStatus } from "../services/SyncService";

const SYNC_DOT_COLOR: Record<SyncStatus, string> = {
  synced: "var(--memorey-success)",
  syncing: "var(--memorey-warning)",
  offline: "var(--memorey-text-secondary)",
  not_connected: "var(--memorey-text-secondary)",
};

export function StatusBar() {
  const { stats, pendingNodes, lastSyncTime, syncStatus } = useMemoreyState();

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
      <span className="memorey-status-bar__item memorey-status-bar__sync">
        <span
          className="memorey-status-bar__sync-dot"
          style={{ background: SYNC_DOT_COLOR[syncStatus] }}
        />
        {syncStatus === "syncing" ? "syncing" : `synced ${formatTime(lastSyncTime)}`}
      </span>
    </footer>
  );
}
