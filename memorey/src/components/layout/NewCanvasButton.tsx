"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { useCanvasStore } from "@/store/canvasStore";
import { cn } from "@/lib/utils";

const EMOJIS = [
  "🧠",
  "🚀",
  "💼",
  "🎯",
  "🌱",
  "⚡",
  "🔬",
  "🎨",
  "📚",
  "💡",
  "🏗️",
  "🌍",
  "💰",
  "🏋️",
  "❤️",
  "🎵",
];

export function NewCanvasButton({
  userId,
  plan,
  isCollapsed,
}: {
  userId: string;
  plan: string;
  isCollapsed: boolean;
}) {
  const canvases = useCanvasStore((s) => s.canvases);
  const createCanvas = useCanvasStore((s) => s.createCanvas);
  const setActiveCanvas = useCanvasStore((s) => s.setActiveCanvas);

  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  /** Empty string = no emoji (stored as null). */
  const [newEmoji, setNewEmoji] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const FREE_LIMIT = 2;
  const atLimit = plan === "free" && canvases.length >= FREE_LIMIT;

  async function handleCreate() {
    if (!newName.trim() || isSaving) return;
    setIsSaving(true);
    const canvas = await createCanvas(userId, {
      name: newName.trim(),
      emoji: newEmoji.trim() || null,
    });
    setIsSaving(false);
    if (canvas) {
      await setActiveCanvas(canvas.id, userId);
      toast.success(`"${canvas.name}" created`);
      setOpen(false);
      setNewName("");
      setNewEmoji("");
    }
  }

  const emojiPicker = (
    <>
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wide" style={{ color: "var(--muted)" }}>
        Emoji (optional)
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => setNewEmoji("")}
          className="rounded border px-1.5 py-0.5 text-[10px] font-medium"
          style={{
            background: newEmoji === "" ? "var(--orange-dim)" : "none",
            borderColor:
              newEmoji === "" ? "var(--orange-border)" : "var(--border)",
            color: "var(--text2)",
            cursor: "pointer",
          }}
          title="No emoji"
        >
          None
        </button>
        {(isCollapsed ? EMOJIS.slice(0, 12) : EMOJIS).map((em) => (
          <button
            key={em}
            type="button"
            onClick={() => setNewEmoji(em)}
            className="rounded border p-0.5 text-[13px]"
            style={{
              background: newEmoji === em ? "var(--orange-dim)" : "none",
              borderColor:
                newEmoji === em ? "var(--orange-border)" : "transparent",
              cursor: "pointer",
            }}
          >
            {em}
          </button>
        ))}
      </div>
    </>
  );

  if (isCollapsed) {
    return (
      <>
        <button
          type="button"
          disabled={atLimit}
          onClick={() => {
            if (atLimit) {
              toast.error("Free plan: 2 canvases max. Upgrade to Pro.");
              return;
            }
            setOpen(true);
          }}
          className="memorey-nav-tooltip-wrap relative flex w-full items-center justify-center rounded-[var(--r-button)] border-none py-2"
          style={{
            color: atLimit ? "var(--muted)" : "var(--text2)",
            cursor: atLimit ? "not-allowed" : "pointer",
            background: "transparent",
          }}
          title={atLimit ? "Canvas limit reached" : "New canvas"}
          aria-label="New canvas"
        >
          <Plus size={18} strokeWidth={1.75} />
          <span className="sidebar-tooltip">New canvas</span>
        </button>
        {open ? (
          <div
            className="fixed inset-0 z-[200] flex items-center justify-center p-4"
            style={{ background: "rgba(0,0,0,0.45)" }}
            role="dialog"
            aria-modal
          >
            <div
              className="w-full max-w-sm rounded-[var(--r-lg)] border p-4 shadow-xl"
              style={{
                borderColor: "var(--border)",
                background: "var(--card-bg)",
                color: "var(--text)",
              }}
            >
              <p className="mb-3 text-sm font-semibold">New canvas</p>
              {emojiPicker}
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleCreate();
                  if (e.key === "Escape") setOpen(false);
                }}
                placeholder="Canvas name…"
                className="mb-2 w-full rounded-md border px-2 py-1.5 text-[12px] outline-none"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
              />
              <p className="mb-3 text-[11px] leading-snug" style={{ color: "var(--muted)" }}>
                All active vaults are added to this canvas by default. You can hide
                vaults per canvas in Manage vaults.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="flex-1 rounded border py-1.5 text-[12px]"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg2)",
                    color: "var(--text2)",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newName.trim() || isSaving}
                  onClick={() => void handleCreate()}
                  className="flex-[2] rounded py-1.5 text-[12px] font-semibold"
                  style={{
                    background: newName.trim() ? "var(--orange)" : "var(--bg4)",
                    color: newName.trim() ? "#fff" : "var(--muted)",
                    cursor: newName.trim() ? "pointer" : "not-allowed",
                    border: "none",
                  }}
                >
                  {isSaving ? "Creating…" : "Create"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="w-full">
      {!open ? (
        <button
          type="button"
          disabled={atLimit}
          onClick={() => {
            if (atLimit) {
              toast.error("Free plan: 2 canvases max. Upgrade to Pro.");
              return;
            }
            setOpen(true);
          }}
          className={cn(
            "flex w-full items-center gap-2 rounded-[var(--r-button)] border border-dashed px-3 py-2 text-left text-[12px] font-medium transition-colors"
          )}
          style={{
            borderColor: "var(--border)",
            color: atLimit ? "var(--muted)" : "var(--text2)",
            cursor: atLimit ? "not-allowed" : "pointer",
            background: "transparent",
          }}
        >
          <Plus size={14} strokeWidth={2} />
          New Canvas
          {atLimit ? (
            <span
              className="ml-auto text-[9px]"
              style={{
                color: "var(--orange)",
                background: "var(--orange-dim)",
                border: "1px solid var(--orange-border)",
                padding: "1px 5px",
                borderRadius: 100,
              }}
            >
              Pro
            </span>
          ) : null}
        </button>
      ) : (
        <div
          className="rounded-[var(--r-md)] border p-2"
          style={{
            borderColor: "var(--border)",
            background: "var(--bg3)",
          }}
        >
          {emojiPicker}
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleCreate();
              if (e.key === "Escape") {
                setOpen(false);
                setNewName("");
              }
            }}
            placeholder="Canvas name…"
            className="mb-2 w-full rounded-md border px-2 py-1.5 text-[12px] outline-none"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
          <p className="mb-2 text-[10px] leading-snug" style={{ color: "var(--muted)" }}>
            All active vaults are included by default; remove any from this canvas in
            Manage vaults.
          </p>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setNewName("");
              }}
              className="flex-1 rounded border py-1 text-[11px]"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg2)",
                color: "var(--text2)",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!newName.trim() || isSaving}
              onClick={() => void handleCreate()}
              className="flex-[2] rounded py-1 text-[11px] font-semibold"
              style={{
                background: newName.trim() ? "var(--orange)" : "var(--bg4)",
                color: newName.trim() ? "#fff" : "var(--muted)",
                cursor: newName.trim() ? "pointer" : "not-allowed",
                border: "none",
              }}
            >
              {isSaving ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
