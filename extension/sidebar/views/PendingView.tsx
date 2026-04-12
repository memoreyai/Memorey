import React from "react";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";

export function PendingView() {
  const { pendingProposals } = useMemoreyState();
  const dispatch = useMemoreyDispatch();

  if (pendingProposals.length === 0) {
    return (
      <div className="memorey-pending">
        <div className="memorey-pending__empty">
          <div className="memorey-pending__empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--memorey-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="memorey-pending__empty-title">All caught up!</div>
          <div className="memorey-pending__empty-text">
            No pending items to review.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="memorey-pending">
      <div className="memorey-pending__redirect">
        <div className="memorey-pending__redirect-count">
          {pendingProposals.length} pending {pendingProposals.length === 1 ? "proposal" : "proposals"}
        </div>
        <button
          className="memorey-pending__redirect-btn"
          onClick={() => dispatch({ type: "SET_VIEW", view: "conflicts" })}
        >
          Review in Conflicts View
        </button>
      </div>
    </div>
  );
}
