"use client";

import { useState, useEffect } from "react";
import { BRAND_ORANGE } from "../constants/colors";
import { X } from "lucide-react";

const MASTER_COLOR_PRESETS = [
  "#FF6600",
  "#378ADD",
  "#F5C542",
  "#FF5B8A",
  "#C792EA",
  "#A8E063",
  "#4FC1E9",
  "#5DCAA5",
  "#E05C5C",
  "#F0A500",
  "#7C6FF0",
  "#888780",
];

interface MasterNodeEditorProps {
  isOpen: boolean;
  initialBio: string;
  initialColor?: string;
  onSave: (bio: string, color: string) => Promise<void>;
  onClose: () => void;
}

export function MasterNodeEditor({
  isOpen,
  initialBio,
  initialColor = BRAND_ORANGE,
  onSave,
  onClose,
}: MasterNodeEditorProps) {
  const [bio, setBio] = useState(initialBio);
  const [color, setColor] = useState(initialColor);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBio(initialBio);
      setColor(initialColor);
    }
  }, [isOpen, initialBio, initialColor]);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave(bio, color);
    } finally {
      setSaving(false);
    }
  }

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 200,
          background: "rgba(0,0,0,0.5)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
        role="presentation"
      />
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 440,
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "var(--r-xl)",
          padding: 28,
          boxShadow: "var(--shadow-lg)",
          zIndex: 210,
        }}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            marginBottom: 20,
          }}
        >
          <div style={{ flex: 1 }}>
            <h3
              style={{
                fontSize: 16,
                fontWeight: 600,
                color: "var(--text)",
                margin: 0,
                marginBottom: 4,
              }}
            >
              Master node
            </h3>
            <p
              style={{
                fontSize: 12,
                color: "var(--muted)",
                margin: 0,
              }}
            >
              The centre of your memory graph. Included in every AI export.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              marginLeft: 12,
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text2)",
              display: "block",
              marginBottom: 8,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Accent colour
          </label>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {MASTER_COLOR_PRESETS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: c,
                  border: "none",
                  cursor: "pointer",
                  outline: color === c ? "3px solid var(--text)" : "none",
                  outlineOffset: 2,
                  flexShrink: 0,
                  transition: "outline 0.1s",
                }}
                aria-label={`Colour ${c}`}
              />
            ))}
            <div
              style={{ display: "flex", alignItems: "center", gap: 5 }}
            >
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 6,
                  background: color,
                  flexShrink: 0,
                  border: "1px solid var(--border)",
                }}
              />
              <input
                value={color}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(v)) setColor(v);
                }}
                placeholder="#FF6600"
                style={{
                  width: 80,
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 5,
                  padding: "3px 6px",
                  color: "var(--text)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
                onFocus={(e) => (e.target.style.borderColor = color)}
                onBlur={(e) =>
                  (e.target.style.borderColor = "var(--border)")
                }
              />
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              padding: "10px 14px",
              background: "var(--bg2)",
              border: `1.5px solid ${color}`,
              borderRadius: 10,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 14,
                fontWeight: 700,
                color: "#fff",
                flexShrink: 0,
              }}
            >
              M
            </div>
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--text)",
                }}
              >
                Master node preview
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                {bio || "No bio set yet"}
              </div>
            </div>
            <div
              style={{
                marginLeft: "auto",
                padding: "2px 6px",
                background: `${color}22`,
                border: `1px solid ${color}44`,
                borderRadius: 3,
                fontSize: 8,
                fontWeight: 700,
                color,
                letterSpacing: "0.08em",
              }}
            >
              YOU
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: "var(--text2)",
              display: "block",
              marginBottom: 6,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Bio / context
          </label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="I'm a founder building Memorey in Bengaluru. I work with Claude, ChatGPT, and Cursor daily..."
            rows={5}
            style={{
              width: "100%",
              boxSizing: "border-box",
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              padding: "10px 12px",
              color: "var(--text)",
              fontSize: 13,
              resize: "vertical",
              outline: "none",
              fontFamily: "var(--font-sans)",
              lineHeight: 1.6,
            }}
            onFocus={(e) => (e.target.style.borderColor = color)}
            onBlur={(e) =>
              (e.target.style.borderColor = "var(--border)")
            }
          />
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            This text is sent to every AI in your exports.
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 14px",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 13,
              color: "var(--text2)",
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            style={{
              padding: "7px 18px",
              background: color,
              border: "none",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
              color: "#fff",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </>
  );
}
