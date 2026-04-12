import React, { useCallback } from "react";
import { useAuthContext } from "../hooks/useAuth";
import { useMemoreyDispatch } from "../store/memoreyStore";

export function SettingsView() {
  const { disconnect } = useAuthContext();
  const dispatch = useMemoreyDispatch();

  const handleBack = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "dashboard" });
  }, [dispatch]);

  const handleDisconnect = useCallback(async () => {
    await disconnect();
  }, [disconnect]);

  return (
    <div className="memorey-settings">
      <div className="memorey-settings__back-row">
        <button className="memorey-node-detail__back" onClick={handleBack} title="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back
        </button>
      </div>

      <section className="memorey-settings__section">
        <h3 className="memorey-settings__heading">Account</h3>
        <div className="memorey-settings__field-group">
          <div className="memorey-settings__row">
            <span className="memorey-settings__status-dot" style={{ background: "var(--memorey-success)" }} />
            <span>Connected</span>
          </div>
          <button
            className="memorey-settings__btn memorey-settings__btn--secondary"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </div>
      </section>

      <section className="memorey-settings__section">
        <h3 className="memorey-settings__heading">About</h3>
        <div className="memorey-settings__field-group">
          <div className="memorey-settings__row memorey-settings__row--dim">
            Memorey Extension v0.1.0
          </div>
          <a
            className="memorey-settings__link"
            href="https://memorey.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open Memorey Web App &rarr;
          </a>
        </div>
      </section>
    </div>
  );
}
