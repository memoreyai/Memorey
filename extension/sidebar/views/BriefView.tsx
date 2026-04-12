import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMemoreyState } from "../store/memoreyStore";
import { useAuthContext } from "../hooks/useAuth";

declare const __WEB_APP_URL__: string | undefined;
const WEB_APP_URL =
  typeof __WEB_APP_URL__ !== "undefined" ? __WEB_APP_URL__ : "https://memorey.co";

type BriefFormat = "system_prompt" | "markdown" | "json" | "toml";

const FORMAT_OPTIONS: { id: BriefFormat; label: string; short: string }[] = [
  { id: "system_prompt", label: "System Prompt", short: "Best for AI chat" },
  { id: "markdown", label: "Markdown", short: "Tables & sections" },
  { id: "json", label: "JSON", short: "Structured data" },
  { id: "toml", label: "TOML", short: "Config format" },
];

export function BriefView() {
  const { vaults, canvases } = useMemoreyState();
  const { token } = useAuthContext();

  const [format, setFormat] = useState<BriefFormat>("system_prompt");
  const [selectedVaults, setSelectedVaults] = useState<Set<string>>(new Set());
  const [canvasId, setCanvasId] = useState("");
  const [brief, setBrief] = useState("");
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const initialRef = useRef(true);

  useEffect(() => {
    if (vaults.length > 0 && selectedVaults.size === 0) {
      setSelectedVaults(new Set(vaults.map((v) => v.id)));
    }
  }, [vaults, selectedVaults.size]);

  const generateBrief = useCallback(async () => {
    if (!token || selectedVaults.size === 0) return;
    setLoading(true);
    try {
      const res = await fetch(`${WEB_APP_URL}/api/brief`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          format,
          vaultIds: [...selectedVaults],
          canvasId: canvasId || null,
        }),
      });
      if (!res.ok) throw new Error("Brief generation failed");
      const data = await res.json();
      setBrief(data.brief ?? "");
      setNodeCount(data.nodeCount ?? 0);
      setEdgeCount(data.edgeCount ?? 0);
    } catch (err) {
      console.error("Brief generation failed:", err);
    } finally {
      setLoading(false);
      initialRef.current = false;
    }
  }, [token, format, selectedVaults, canvasId]);

  useEffect(() => {
    if (!token || selectedVaults.size === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => void generateBrief(),
      initialRef.current ? 100 : 300
    );
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [token, format, selectedVaults, canvasId, generateBrief]);

  const handleCopy = useCallback(async () => {
    if (!brief) return;
    try {
      await navigator.clipboard.writeText(brief);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = brief;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [brief]);

  const tokenEst = useMemo(() => Math.round(brief.length / 4), [brief.length]);

  return (
    <div className="memorey-brief">
      {/* Controls */}
      <div className="memorey-brief__controls">
        <div className="memorey-brief__section-label">Format</div>
        <div className="memorey-brief__format-grid">
          {FORMAT_OPTIONS.map((f) => (
            <button
              key={f.id}
              type="button"
              className={`memorey-brief__format-btn${format === f.id ? " memorey-brief__format-btn--active" : ""}`}
              onClick={() => setFormat(f.id)}
            >
              <span className="memorey-brief__format-label">{f.label}</span>
              <span className="memorey-brief__format-sub">{f.short}</span>
            </button>
          ))}
        </div>

        {canvases.length > 0 && (
          <>
            <div className="memorey-brief__section-label">Canvas</div>
            <select
              className="memorey-brief__select"
              value={canvasId}
              onChange={(e) => setCanvasId(e.target.value)}
            >
              <option value="">All Canvases</option>
              {canvases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="memorey-brief__section-label">
          Vaults
          <span className="memorey-brief__vault-actions">
            <button
              type="button"
              onClick={() => setSelectedVaults(new Set(vaults.map((v) => v.id)))}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setSelectedVaults(new Set())}
            >
              None
            </button>
          </span>
        </div>
        <div className="memorey-brief__vault-list">
          {vaults.map((v) => {
            const on = selectedVaults.has(v.id);
            return (
              <label key={v.id} className={`memorey-brief__vault-item${on ? " memorey-brief__vault-item--on" : ""}`}>
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => {
                    setSelectedVaults((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(v.id);
                      else next.add(v.id);
                      return next;
                    });
                  }}
                />
                <span
                  className="memorey-brief__vault-dot"
                  style={{ background: v.color || "#5DCAA5" }}
                />
                <span className="memorey-brief__vault-name">{v.name}</span>
              </label>
            );
          })}
        </div>
      </div>

      {/* Copy button */}
      <button
        type="button"
        className={`memorey-brief__copy-btn${copied ? " memorey-brief__copy-btn--copied" : ""}`}
        onClick={() => void handleCopy()}
        disabled={!brief || loading}
      >
        {copied ? "Copied!" : "Copy to Clipboard"}
      </button>

      {/* Stats */}
      {nodeCount > 0 && (
        <div className="memorey-brief__stats">
          {nodeCount} memories{edgeCount > 0 ? `, ${edgeCount} connections` : ""} · ~{tokenEst.toLocaleString()} tokens
        </div>
      )}

      {/* Output */}
      <div className="memorey-brief__output">
        {loading ? (
          <div className="memorey-brief__loading">
            <div className="memorey-spinner" />
            <span>Generating brief...</span>
          </div>
        ) : !brief ? (
          <div className="memorey-brief__empty">
            {selectedVaults.size === 0
              ? "Select at least one vault"
              : "No memories match the selected filters"}
          </div>
        ) : (
          <pre className="memorey-brief__content">{brief}</pre>
        )}
      </div>
    </div>
  );
}
