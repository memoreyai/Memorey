import React from "react";

export function ConflictsView() {
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
          Conflicts are managed in the web app.
        </div>
      </div>
    </div>
  );
}
