import React, { useState, useCallback, useEffect } from "react";
import type { SyncStatus } from "../services/SyncService";

interface SettingsViewProps {
  syncStatus: SyncStatus;
  lastSyncTime: string | null;
  isAutoSync: boolean;
  onConnect: (token: string) => Promise<boolean>;
  onDisconnect: () => void;
  onSyncNow: () => void;
  onToggleAutoSync: (enabled: boolean) => void;
  onExportGraph: () => void;
  onClearLocalData: () => void;
}

export function SettingsView({
  syncStatus,
  lastSyncTime,
  isAutoSync,
  onConnect,
  onDisconnect,
  onSyncNow,
  onToggleAutoSync,
  onExportGraph,
  onClearLocalData,
}: SettingsViewProps) {
  const [token, setToken] = useState("");
  const [isConnected, setIsConnected] = useState(syncStatus !== "not_connected");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // AI Extraction settings
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiProvider, setAiProvider] = useState<"openai" | "anthropic">("openai");
  const [aiKey, setAiKey] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiTestStatus, setAiTestStatus] = useState<"idle" | "testing" | "ok" | "fail">("idle");

  useEffect(() => {
    setIsConnected(syncStatus !== "not_connected");
  }, [syncStatus]);

  // Load saved AI settings from chrome.storage
  useEffect(() => {
    chromeStorageGet("memorey_ai_settings").then((raw) => {
      if (!raw) return;
      try {
        const s = JSON.parse(raw);
        setAiEnabled(s.enabled ?? false);
        setAiProvider(s.provider ?? "openai");
        setAiModel(s.model ?? "");
      } catch { /* ignore */ }
    });
    chromeStorageGet("memorey_ai_key").then((k) => {
      if (k) setAiKey(k);
    });
  }, []);

  const saveAiSettings = useCallback(
    (
      enabled: boolean,
      provider: "openai" | "anthropic",
      model: string,
      key: string
    ) => {
      chromeStorageSet(
        "memorey_ai_settings",
        JSON.stringify({ enabled, provider, model })
      );
      // Key stored separately — never exported
      chromeStorageSet("memorey_ai_key", key);
    },
    []
  );

  const handleConnect = useCallback(async () => {
    if (!token.trim()) return;
    setConnecting(true);
    setConnectError(null);
    const ok = await onConnect(token.trim());
    setConnecting(false);
    if (ok) {
      setIsConnected(true);
      setToken("");
    } else {
      setConnectError("Invalid or expired token. Check your Memorey web app settings.");
    }
  }, [token, onConnect]);

  const handleDisconnect = useCallback(() => {
    onDisconnect();
    setIsConnected(false);
  }, [onDisconnect]);

  const handleClear = useCallback(() => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    onClearLocalData();
    setConfirmClear(false);
  }, [confirmClear, onClearLocalData]);

  const handleTestAi = useCallback(async () => {
    if (!aiKey.trim()) return;
    setAiTestStatus("testing");
    try {
      if (aiProvider === "openai") {
        const resp = await fetch("https://api.openai.com/v1/models", {
          headers: { Authorization: `Bearer ${aiKey}` },
        });
        setAiTestStatus(resp.ok ? "ok" : "fail");
      } else {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": aiKey,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: aiModel || "claude-sonnet-4-20250514",
            max_tokens: 1,
            messages: [{ role: "user", content: "hi" }],
          }),
        });
        setAiTestStatus(resp.ok ? "ok" : "fail");
      }
    } catch {
      setAiTestStatus("fail");
    }
    setTimeout(() => setAiTestStatus("idle"), 3000);
  }, [aiKey, aiProvider, aiModel]);

  function formatSyncTime(iso: string | null): string {
    if (!iso) return "never";
    const d = new Date(iso);
    return d.toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  const statusLabel: Record<SyncStatus, string> = {
    synced: "Synced",
    syncing: "Syncing...",
    offline: "Offline",
    not_connected: "Not connected",
  };

  const statusColor: Record<SyncStatus, string> = {
    synced: "var(--memorey-success)",
    syncing: "var(--memorey-warning)",
    offline: "var(--memorey-text-secondary)",
    not_connected: "var(--memorey-text-secondary)",
  };

  return (
    <div className="memorey-settings">
      {/* ── Account ── */}
      <section className="memorey-settings__section">
        <h3 className="memorey-settings__heading">Account</h3>
        {!isConnected ? (
          <div className="memorey-settings__field-group">
            <label className="memorey-settings__label">
              Memorey Access Token
            </label>
            <p className="memorey-settings__hint">
              Get this from your Memorey web app &rarr; Settings &rarr; Access
              Token
            </p>
            <input
              className="memorey-settings__input"
              type="password"
              placeholder="Paste your access token"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
            {connectError && (
              <p className="memorey-settings__error">{connectError}</p>
            )}
            <button
              className="memorey-settings__btn memorey-settings__btn--primary"
              onClick={handleConnect}
              disabled={connecting || !token.trim()}
            >
              {connecting ? "Connecting..." : "Connect"}
            </button>
          </div>
        ) : (
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
        )}
      </section>

      {/* ── Sync ── */}
      <section className="memorey-settings__section">
        <h3 className="memorey-settings__heading">Sync</h3>
        <div className="memorey-settings__row">
          <span
            className="memorey-settings__status-dot"
            style={{ background: statusColor[syncStatus] }}
          />
          <span>{statusLabel[syncStatus]}</span>
        </div>
        <div className="memorey-settings__row memorey-settings__row--dim">
          Last sync: {formatSyncTime(lastSyncTime)}
        </div>
        <button
          className="memorey-settings__btn memorey-settings__btn--primary"
          onClick={onSyncNow}
          disabled={!isConnected || syncStatus === "syncing"}
        >
          Sync Now
        </button>
        <label className="memorey-settings__toggle-row">
          <input
            type="checkbox"
            checked={isAutoSync}
            onChange={(e) => onToggleAutoSync(e.target.checked)}
            disabled={!isConnected}
          />
          <span>Auto-sync</span>
        </label>
      </section>

      {/* ── AI Extraction ── */}
      <section className="memorey-settings__section">
        <h3 className="memorey-settings__heading">AI Extraction (Optional)</h3>
        <label className="memorey-settings__toggle-row">
          <input
            type="checkbox"
            checked={aiEnabled}
            onChange={(e) => {
              setAiEnabled(e.target.checked);
              saveAiSettings(e.target.checked, aiProvider, aiModel, aiKey);
            }}
          />
          <span>Enable AI-powered extraction</span>
        </label>
        {aiEnabled && (
          <div className="memorey-settings__field-group memorey-settings__field-group--indent">
            <label className="memorey-settings__label">Provider</label>
            <select
              className="memorey-settings__select"
              value={aiProvider}
              onChange={(e) => {
                const v = e.target.value as "openai" | "anthropic";
                setAiProvider(v);
                saveAiSettings(aiEnabled, v, aiModel, aiKey);
              }}
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic</option>
            </select>

            <label className="memorey-settings__label">API Key</label>
            <input
              className="memorey-settings__input"
              type="password"
              placeholder="sk-..."
              value={aiKey}
              onChange={(e) => {
                setAiKey(e.target.value);
                saveAiSettings(aiEnabled, aiProvider, aiModel, e.target.value);
              }}
            />

            <label className="memorey-settings__label">Model (optional)</label>
            <input
              className="memorey-settings__input"
              type="text"
              placeholder={aiProvider === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-20250514"}
              value={aiModel}
              onChange={(e) => {
                setAiModel(e.target.value);
                saveAiSettings(aiEnabled, aiProvider, e.target.value, aiKey);
              }}
            />

            <button
              className="memorey-settings__btn memorey-settings__btn--secondary"
              onClick={handleTestAi}
              disabled={!aiKey.trim() || aiTestStatus === "testing"}
            >
              {aiTestStatus === "testing"
                ? "Testing..."
                : aiTestStatus === "ok"
                  ? "Connected!"
                  : aiTestStatus === "fail"
                    ? "Failed — check key"
                    : "Test Connection"}
            </button>
          </div>
        )}
      </section>

      {/* ── Data ── */}
      <section className="memorey-settings__section">
        <h3 className="memorey-settings__heading">Data</h3>
        <button
          className="memorey-settings__btn memorey-settings__btn--secondary"
          onClick={onExportGraph}
        >
          Export Graph (JSON)
        </button>
        <button
          className="memorey-settings__btn memorey-settings__btn--danger"
          onClick={handleClear}
        >
          {confirmClear ? "Are you sure? Click again to confirm" : "Clear Local Data"}
        </button>
        {confirmClear && (
          <p className="memorey-settings__hint">
            This clears local data only — cloud data is unaffected.
          </p>
        )}
      </section>
    </div>
  );
}

// ── Chrome storage helpers ─────────────────────────────────────────

function chromeStorageGet(key: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get(key, (result) => resolve(result[key] ?? null));
    } else {
      resolve(localStorage.getItem(key));
    }
  });
}

function chromeStorageSet(key: string, value: string): Promise<void> {
  return new Promise((resolve) => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ [key]: value }, () => resolve());
    } else {
      localStorage.setItem(key, value);
      resolve();
    }
  });
}
