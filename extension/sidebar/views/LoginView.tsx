import React, { useState, useCallback } from "react";
import { useAuthContext } from "../hooks/useAuth";

export function LoginView() {
  const { connect, error } = useAuthContext();
  const [token, setToken] = useState("");
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(async () => {
    if (!token.trim()) return;
    setConnecting(true);
    await connect(token);
    setConnecting(false);
  }, [token, connect]);

  return (
    <div className="memorey-login">
      <div className="memorey-login__card">
        <div className="memorey-login__logo">M</div>
        <h1 className="memorey-login__title">Memorey</h1>
        <p className="memorey-login__subtitle">
          Your AI memory layer
        </p>

        <div className="memorey-login__form">
          <label className="memorey-login__label">
            Access Token
          </label>
          <p className="memorey-login__hint">
            Get this from your Memorey web app &rarr; Settings &rarr; Chrome Extension
          </p>
          <input
            className="memorey-login__input"
            type="password"
            placeholder="Paste your access token"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            autoFocus
          />
          {error && <p className="memorey-login__error">{error}</p>}
          <button
            className="memorey-login__btn"
            onClick={handleConnect}
            disabled={connecting || !token.trim()}
          >
            {connecting ? "Validating..." : "Connect"}
          </button>
        </div>

        <div className="memorey-login__footer">
          <span className="memorey-login__footer-text">
            Don't have an account?
          </span>
          <a
            className="memorey-login__link"
            href="https://memorey.co"
            target="_blank"
            rel="noopener noreferrer"
          >
            Sign up free at memorey.co
          </a>
        </div>
      </div>
    </div>
  );
}
