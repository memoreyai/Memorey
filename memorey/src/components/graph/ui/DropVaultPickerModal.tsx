"use client";

import { useState } from "react";
import type { CategoryVault } from "@/types/memorey";

export function DropVaultPickerModal({
  vaults,
  fileCount,
  urlCount,
  onCancel,
  onConfirm,
}: {
  vaults: CategoryVault[];
  fileCount: number;
  urlCount: number;
  onCancel: () => void;
  onConfirm: (vaultId: string) => void;
}) {
  const [vaultId, setVaultId] = useState(vaults[0]?.id ?? "");

  const summary =
    fileCount > 0 && urlCount > 0
      ? `${fileCount} file(s) and ${urlCount} link(s)`
      : fileCount > 0
        ? `${fileCount} file${fileCount === 1 ? "" : "s"}`
        : `${urlCount} link${urlCount === 1 ? "" : "s"}`;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "rgba(0,0,0,0.45)",
        backdropFilter: "blur(4px)",
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="drop-vault-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
      }}
    >
      <div
        style={{
          width: "min(400px, 100%)",
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-lg)",
          padding: "20px 20px 16px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="drop-vault-title"
          style={{
            fontSize: 16,
            fontWeight: 700,
            color: "var(--text)",
            marginBottom: 6,
          }}
        >
          Choose a vault
        </h2>
        <p
          style={{
            fontSize: 13,
            color: "var(--text2)",
            lineHeight: 1.45,
            marginBottom: 16,
          }}
        >
          Add {summary} to your canvas. Which vault should store{" "}
          {fileCount + urlCount === 1 ? "it" : "them"}?
        </p>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 6,
            maxHeight: 220,
            overflowY: "auto",
            marginBottom: 18,
          }}
        >
          {vaults.map((v) => (
            <label
              key={v.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                border:
                  vaultId === v.id
                    ? "2px solid var(--orange)"
                    : "1px solid var(--border)",
                background:
                  vaultId === v.id ? "rgba(255,102,0,0.08)" : "var(--bg2)",
              }}
            >
              <input
                type="radio"
                name="drop-vault"
                checked={vaultId === v.id}
                onChange={() => setVaultId(v.id)}
                style={{ accentColor: "var(--orange)" }}
              />
              <span
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  background: v.color ?? "#888",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--text)",
                  flex: 1,
                }}
              >
                {v.name}
              </span>
            </label>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "8px 14px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--r-md)",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--text2)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => vaultId && onConfirm(vaultId)}
            disabled={!vaultId}
            style={{
              padding: "8px 16px",
              fontSize: 13,
              fontWeight: 600,
              borderRadius: "var(--r-md)",
              border: "none",
              background: "var(--orange)",
              color: "#fff",
              cursor: vaultId ? "pointer" : "not-allowed",
              opacity: vaultId ? 1 : 0.5,
            }}
          >
            Upload & add
          </button>
        </div>
      </div>
    </div>
  );
}
