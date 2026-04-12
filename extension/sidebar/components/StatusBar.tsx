import React from "react";
import { useDataReload } from "../App";
import { useMemoreyState } from "../store/memoreyStore";

export function StatusBar() {
  const reload = useDataReload();
  const { stats, pendingNodes, pendingProposals } = useMemoreyState();

  const totalFacts = stats?.totalFacts ?? 0;
  const pendingCount = pendingNodes.length + pendingProposals.length;

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
          style={{ background: "var(--memorey-success)" }}
        />
        connected
        <button
          type="button"
          onClick={() => void reload()}
          style={{
            marginLeft: 8,
            padding: 0,
            border: "none",
            background: "none",
            font: "inherit",
            fontSize: 11,
            color: "var(--memorey-text-secondary)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
        >
          Refresh
        </button>
      </span>
    </footer>
  );
}
