"use client";

import { useState } from "react";

interface PinModalProps {
  mode: "set" | "unlock";
  onSet: (pin: string) => Promise<void>;
  onUnlock: (pin: string) => Promise<void>;
  onClose: () => void;
}

async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder().encode(pin);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return [...new Uint8Array(buf)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function PinModal({ mode, onSet, onUnlock, onClose }: PinModalProps) {
  const [pin, setPin] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-xs rounded-xl border p-4"
        style={{
          backgroundColor: "var(--bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-2 font-semibold">
          {mode === "set" ? "Set vault PIN" : "Unlock vault"}
        </h3>
        <input
          type="password"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          className="mb-2 w-full rounded border px-2 py-1.5 text-sm"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
          }}
          placeholder="PIN"
        />
        {mode === "set" && (
          <input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="mb-2 w-full rounded border px-2 py-1.5 text-sm"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--surface)",
              color: "var(--text)",
            }}
            placeholder="Confirm PIN"
          />
        )}
        {err && (
          <p className="mb-2 text-xs" style={{ color: "var(--destructive, #e11)" }}>
            {err}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="text-sm" style={{ color: "var(--muted)" }}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded px-3 py-1 text-sm font-medium"
            style={{ backgroundColor: "var(--orange)", color: "var(--bg)" }}
            onClick={() => {
              setErr("");
              if (mode === "set") {
                if (pin.length < 4) {
                  setErr("PIN too short");
                  return;
                }
                if (pin !== confirm) {
                  setErr("PINs do not match");
                  return;
                }
                setBusy(true);
                void hashPin(pin).then((h) =>
                  onSet(h).catch(() => setErr("Failed")).finally(() => setBusy(false))
                );
              } else {
                setBusy(true);
                void hashPin(pin).then((h) =>
                  onUnlock(h).catch(() => setErr("Wrong PIN")).finally(() => setBusy(false))
                );
              }
            }}
          >
            {mode === "set" ? "Set" : "Unlock"}
          </button>
        </div>
      </div>
    </div>
  );
}
