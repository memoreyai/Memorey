"use client";

import {
  useState,
  useEffect,
  useRef,
  type RefObject,
} from "react";
import {
  Boxes,
  GitBranch,
  LayoutDashboard,
  Maximize2,
  MessageSquare,
  Paperclip,
  Plus,
  Settings,
  Zap,
} from "lucide-react";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useCanvasStore } from "@/store/canvasStore";
import { useVaultManagerOverlayStore } from "@/store/vaultManagerOverlayStore";
import type { EdgeStyle } from "../types/canvas.types";

const EDGE_COLOR_PRESETS = [
  "#F2F0EB",
  "#888780",
  "#378ADD",
  "#F5C542",
  "#FF6600",
  "#FF5B8A",
  "#C792EA",
  "#A8E063",
  "#4FC1E9",
  "#5DCAA5",
  "#E05C5C",
  "#7C6FF0",
];

const CANVAS_EMOJI_PRESETS = [
  "🧠",
  "📝",
  "💡",
  "🎯",
  "📊",
  "🔬",
  "💼",
  "🎨",
  "📚",
  "🏠",
  "⭐",
  "🔥",
  "🚀",
  "💻",
  "🎮",
];

interface ToolbarProps {
  currentView: "graph" | "plain" | "tree";
  onViewChange: (view: "graph" | "plain" | "tree") => void;
  connectMode: boolean;
  edgeStyle: EdgeStyle;
  onToggleConnect: () => void;
  onFit: () => void;
  onLayout: () => void;
  onAddMemory: () => void;
  fileNodeInputRef: RefObject<HTMLInputElement | null>;
  onAddFileNode: (files: FileList | null) => void;
  onChatBuilder: () => void;
  onEdgeStyleChange: (s: EdgeStyle) => void;
  edgeColor: string | null;
  onEdgeColorChange: (c: string | null) => void;
  masterLineStyle: string;
  onMasterLineStyleChange: (s: string) => void;
  masterLineColor: string | null;
  onMasterLineColorChange: (c: string | null) => void;
  onShortcuts: () => void;
  onRenameCanvas: (
    canvasId: string,
    updates: { name: string; emoji?: string | null }
  ) => Promise<void>;
  onBriefAnAI: () => void;
}

function CanvasLabel({
  canvas,
  onRename,
}: {
  canvas: { id: string; emoji: string | null; name: string };
  onRename: (
    id: string,
    updates: { name: string; emoji?: string | null }
  ) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(canvas.name);
  const [draftEmoji, setDraftEmoji] = useState(() => canvas.emoji ?? "");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing) {
      queueMicrotask(() => {
        setDraft(canvas.name);
        setDraftEmoji(canvas.emoji ?? "");
        setEmojiOpen(false);
        setTimeout(() => inputRef.current?.select(), 20);
      });
    }
  }, [editing, canvas.name, canvas.emoji]);

  useEffect(() => {
    if (!emojiOpen) return;
    function onDocMouseDown(ev: MouseEvent) {
      if (emojiWrapRef.current?.contains(ev.target as Node)) return;
      setEmojiOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [emojiOpen]);

  async function commit() {
    const trimmed = draft.trim();
    if (!trimmed) {
      setEditing(false);
      return;
    }
    const nextEmoji = draftEmoji.trim() || null;
    const canvasEmoji = canvas.emoji ?? null;
    const nameChanged = trimmed !== canvas.name;
    const emojiChanged = nextEmoji !== canvasEmoji;
    if (!nameChanged && !emojiChanged) {
      setEditing(false);
      return;
    }
    await onRename(canvas.id, {
      name: trimmed,
      ...(emojiChanged ? { emoji: nextEmoji } : {}),
    });
    setEditing(false);
  }

  if (editing) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "1px 6px",
          background: "var(--bg2)",
          border: "1px solid var(--orange)",
          borderRadius: "var(--r-md)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        <div ref={emojiWrapRef} style={{ position: "relative", flexShrink: 0 }}>
          <button
            type="button"
            title="Change emoji"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => setEmojiOpen((o) => !o)}
            style={{
              fontSize: 13,
              lineHeight: 1,
              padding: "1px 2px",
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-sm)",
              cursor: "pointer",
            }}
          >
            {draftEmoji || canvas.emoji || "·"}
          </button>
          {emojiOpen ? (
            <div
              role="listbox"
              onMouseDown={(e) => e.preventDefault()}
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                left: 0,
                zIndex: 200,
                display: "flex",
                flexWrap: "wrap",
                gap: 3,
                padding: 6,
                width: 200,
                background: "var(--bg3)",
                border: "1px solid var(--border2)",
                borderRadius: "var(--r-md)",
                boxShadow: "var(--shadow-lg)",
              }}
            >
              {CANVAS_EMOJI_PRESETS.map((em) => (
                <button
                  key={em}
                  type="button"
                  title={em}
                  onClick={() => {
                    setDraftEmoji(em);
                    setEmojiOpen(false);
                  }}
                  style={{
                    fontSize: 14,
                    padding: "2px 4px",
                    background:
                      (draftEmoji || canvas.emoji || "") === em
                        ? "var(--orange-dim)"
                        : "transparent",
                    border: `1px solid ${
                      (draftEmoji || canvas.emoji || "") === em
                        ? "var(--orange-border)"
                        : "transparent"
                    }`,
                    borderRadius: 4,
                    cursor: "pointer",
                    lineHeight: 1,
                  }}
                >
                  {em}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => void commit()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              void commit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setEmojiOpen(false);
              setEditing(false);
            }
          }}
          style={{
            width: Math.max(60, draft.length * 8),
            maxWidth: 160,
            background: "none",
            border: "none",
            outline: "none",
            color: "var(--text)",
            fontSize: 11,
            fontFamily: "var(--font-sans)",
            padding: 0,
          }}
        />
      </div>
    );
  }

  return (
    <div
      onDoubleClick={() => setEditing(true)}
      title="Double-click to rename canvas"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        fontSize: 11,
        color: "var(--text2)",
        flexShrink: 0,
        maxWidth: 160,
        cursor: "default",
        userSelect: "none",
      }}
    >
      <span style={{ fontSize: 13, flexShrink: 0 }}>
        {canvas.emoji ?? ""}
      </span>
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {canvas.name}
      </span>
      <span
        style={{ fontSize: 9, color: "var(--faint)", flexShrink: 0 }}
        aria-hidden
      >
        ✎
      </span>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{
        width: 1,
        height: 18,
        background: "var(--border)",
        flexShrink: 0,
        margin: "0 2px",
      }}
    />
  );
}

function TBtn({
  icon,
  label,
  shortcut,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={shortcut ? `${label} (${shortcut})` : label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 8px",
        flexShrink: 0,
        background: active ? "var(--bg4)" : "none",
        border: `1px solid ${active ? "var(--border2)" : "transparent"}`,
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        color: active ? "var(--text)" : "var(--text2)",
        transition: "all 0.1s",
        whiteSpace: "nowrap",
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.background = "var(--bg2)";
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.background = "none";
      }}
    >
      <span
        style={{
          color: active ? "var(--orange)" : "var(--muted)",
          display: "flex",
        }}
      >
        {icon}
      </span>
      {label}
      {shortcut ? (
        <kbd
          style={{
            fontSize: 8,
            padding: "0 3px",
            background: "var(--bg3)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            color: "var(--muted)",
            fontFamily: "var(--font-mono)",
            lineHeight: "14px",
          }}
        >
          {shortcut}
        </kbd>
      ) : null}
    </button>
  );
}

function IconBtn({
  icon,
  title,
  active,
  onClick,
  round,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
  round?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 28,
        height: 28,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: active ? "var(--bg4)" : "none",
        border: `1px solid ${active ? "var(--border2)" : "var(--border)"}`,
        borderRadius: round ? "50%" : "var(--r-md)",
        cursor: "pointer",
        color: "var(--text2)",
        transition: "all 0.1s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border2)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = active
          ? "var(--border2)"
          : "var(--border)";
      }}
    >
      {icon}
    </button>
  );
}

export function Toolbar({
  currentView,
  onViewChange,
  connectMode,
  edgeStyle,
  onToggleConnect,
  onFit,
  onLayout,
  onAddMemory,
  fileNodeInputRef,
  onAddFileNode,
  onChatBuilder,
  onEdgeStyleChange,
  edgeColor,
  onEdgeColorChange,
  masterLineStyle,
  onMasterLineStyleChange,
  masterLineColor,
  onMasterLineColorChange,
  onShortcuts,
  onRenameCanvas,
  onBriefAnAI,
}: ToolbarProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const openVaultManager = useVaultManagerOverlayStore((s) => s.openManager);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "0 12px",
        height: 44,
        borderBottom: "1px solid var(--border)",
        background: "var(--bg)",
        flexShrink: 0,
        overflow: settingsOpen ? "visible" : "hidden",
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        zIndex: 30,
        color: "var(--text)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginRight: 8,
          flexShrink: 0,
        }}
      >
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "#FF6600",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 12,
            fontWeight: 800,
            color: "#fff",
            fontFamily: "var(--font-sans)",
          }}
        >
          M
        </div>
      </div>

      <Divider />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          flexShrink: 1,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <TBtn
          icon={<Plus size={13} />}
          label="Memory"
          shortcut="N"
          onClick={onAddMemory}
        />
        <input
          ref={fileNodeInputRef}
          type="file"
          multiple
          accept="image/*,application/pdf,.md,.txt,.doc,.docx"
          className="hidden"
          aria-hidden
          onChange={(ev) => {
            onAddFileNode(ev.target.files);
            ev.target.value = "";
          }}
        />
        <TBtn
          icon={<Paperclip size={13} />}
          label="File"
          onClick={() => fileNodeInputRef.current?.click()}
        />
        <TBtn
          icon={<MessageSquare size={13} />}
          label="Chat"
          onClick={onChatBuilder}
        />

        <Divider />

        <TBtn
          icon={<GitBranch size={13} />}
          label="Connect"
          shortcut="C"
          active={connectMode}
          onClick={onToggleConnect}
        />
        <TBtn
          icon={<LayoutDashboard size={13} />}
          label="Layout"
          shortcut="A"
          onClick={onLayout}
        />
        <TBtn
          icon={<Maximize2 size={13} />}
          label="Fit"
          shortcut="F"
          onClick={onFit}
        />

        <Divider />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            padding: 2,
            gap: 1,
            flexShrink: 0,
          }}
        >
          {(
            [
              { id: "graph" as const, label: "Graph", icon: "⬡" },
              { id: "plain" as const, label: "Plain", icon: "☰" },
              { id: "tree" as const, label: "Tree", icon: "🌳" },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => onViewChange(opt.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 3,
                padding: "3px 8px",
                background:
                  currentView === opt.id ? "var(--bg4)" : "transparent",
                border: `1px solid ${
                  currentView === opt.id ? "var(--border2)" : "transparent"
                }`,
                borderRadius: "calc(var(--r-md) - 2px)",
                cursor: "pointer",
                fontSize: 11,
                fontWeight: currentView === opt.id ? 600 : 400,
                color:
                  currentView === opt.id ? "var(--text)" : "var(--muted)",
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ fontSize: 9 }}>{opt.icon}</span>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0 }} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          flexShrink: 0,
          minWidth: 0,
        }}
      >
        {isMasterView ? (
          <span
            className="truncate text-[13px] font-semibold"
            style={{ color: "var(--text)", maxWidth: 200 }}
          >
            🌐 Master View
          </span>
        ) : activeCanvas ? (
          <CanvasLabel canvas={activeCanvas} onRename={onRenameCanvas} />
        ) : null}

        <button
          type="button"
          onClick={onBriefAnAI}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: "5px 12px",
            flexShrink: 0,
            background: "#FF6600",
            border: "none",
            borderRadius: "var(--r-md)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            whiteSpace: "nowrap",
          }}
          aria-label="Brief AI"
        >
          <Zap size={12} />
          Brief AI
        </button>

        <IconBtn
          icon={<Boxes size={13} />}
          title="Vaults"
          onClick={() => openVaultManager()}
        />

        <Divider />

        <div style={{ position: "relative", flexShrink: 0, zIndex: 50 }}>
          <IconBtn
            icon={<Settings size={13} />}
            title="Graph settings (edge style & colour)"
            active={settingsOpen}
            onClick={() => setSettingsOpen((o) => !o)}
          />
          {settingsOpen ? (
            <>
              <div
                style={{ position: "fixed", inset: 0, zIndex: 148 }}
                aria-hidden
                onClick={() => setSettingsOpen(false)}
              />
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: 310,
                  maxWidth: "min(310px, calc(100vw - 24px))",
                  maxHeight: "80vh",
                  overflowY: "auto",
                  background: "var(--bg3)",
                  border: "1px solid var(--border2)",
                  borderRadius: "var(--r-lg)",
                  boxShadow:
                    "0 8px 32px rgba(0,0,0,0.35), 0 2px 8px rgba(0,0,0,0.2)",
                  padding: 16,
                  zIndex: 149,
                }}
              >
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.08em",
                  marginBottom: 10,
                }}
              >
                Graph appearance
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--text2)",
                  marginBottom: 8,
                }}
              >
                Connection line style
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 16,
                }}
              >
                {(
                  [
                    "orthogonal-dashed",
                    "orthogonal-dotted",
                    "curved-dashed",
                    "curved-dotted",
                  ] as const
                ).map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => onEdgeStyleChange(style)}
                    style={{
                      padding: "10px 12px",
                      background:
                        edgeStyle === style ? "var(--orange-dim)" : "var(--bg2)",
                      border: `1px solid ${
                        edgeStyle === style
                          ? "var(--orange-border)"
                          : "var(--border)"
                      }`,
                      borderRadius: "var(--r-md)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <svg
                      width={48}
                      height={16}
                      style={{ display: "block", marginBottom: 6 }}
                    >
                      {style.startsWith("orthogonal") ? (
                        <polyline
                          points="4,12 24,12 24,4 44,4"
                          fill="none"
                          stroke={edgeStyle === style ? "#FF6600" : "#555"}
                          strokeWidth="1.5"
                          strokeDasharray={
                            style.endsWith("dashed") ? "4 3" : "1 3"
                          }
                        />
                      ) : (
                        <path
                          d="M4,12 C16,12 32,4 44,4"
                          fill="none"
                          stroke={edgeStyle === style ? "#FF6600" : "#555"}
                          strokeWidth="1.5"
                          strokeDasharray={
                            style.endsWith("dashed") ? "4 3" : "1 3"
                          }
                        />
                      )}
                    </svg>
                    <div
                      style={{
                        fontSize: 11,
                        fontWeight: 500,
                        color:
                          edgeStyle === style ? "var(--orange)" : "var(--text)",
                      }}
                    >
                      {style.startsWith("orthogonal") ? "Angled" : "Curved"}
                    </div>
                    <div style={{ fontSize: 10, color: "var(--muted)" }}>
                      {style.endsWith("dashed") ? "Dashed" : "Dotted"}
                    </div>
                  </button>
                ))}
              </div>

              <div
                style={{
                  height: 1,
                  background: "var(--border)",
                  marginBottom: 16,
                }}
              />

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text2)",
                  marginBottom: 8,
                }}
              >
                Default line colour
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--muted)",
                  marginBottom: 8,
                }}
              >
                Overrides vault colours for all connections. Set to Auto to
                restore vault colours.
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => onEdgeColorChange(null)}
                  style={{
                    padding: "3px 8px",
                    background:
                      edgeColor === null ? "var(--orange-dim)" : "var(--bg2)",
                    border: `1px solid ${
                      edgeColor === null
                        ? "var(--orange-border)"
                        : "var(--border)"
                    }`,
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 600,
                    color:
                      edgeColor === null ? "var(--orange)" : "var(--text2)",
                  }}
                >
                  Auto
                </button>
                {EDGE_COLOR_PRESETS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onEdgeColorChange(c)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: c,
                      border:
                        edgeColor === c
                          ? "2px solid var(--text)"
                          : "1px solid var(--border)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={`Edge colour ${c}`}
                  />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: edgeColor ?? "var(--bg2)",
                    border: "1px solid var(--border)",
                    flexShrink: 0,
                  }}
                />
                <input
                  value={edgeColor ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                      onEdgeColorChange(v === "" ? null : v);
                    }
                  }}
                  placeholder="#RRGGBB or empty for Auto"
                  style={{
                    flex: 1,
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: 5,
                    padding: "4px 8px",
                    color: "var(--text)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                  }}
                />
              </div>

              <div
                style={{
                  height: 1,
                  background: "var(--border)",
                  margin: "14px 0",
                }}
              />

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text2)",
                  marginBottom: 6,
                }}
              >
                Master → vault line style
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 6,
                  marginBottom: 12,
                }}
              >
                {(
                  [
                    {
                      id: "curved-dashed",
                      label: "Curved",
                      sub: "Dashed",
                    },
                    {
                      id: "curved-dotted",
                      label: "Curved",
                      sub: "Dotted",
                    },
                    {
                      id: "orthogonal-dashed",
                      label: "Angled",
                      sub: "Dashed",
                    },
                    {
                      id: "straight-dashed",
                      label: "Straight",
                      sub: "Dashed",
                    },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onMasterLineStyleChange(opt.id)}
                    style={{
                      padding: "8px 10px",
                      background:
                        masterLineStyle === opt.id
                          ? "var(--orange-dim)"
                          : "var(--bg2)",
                      border: `1px solid ${
                        masterLineStyle === opt.id
                          ? "var(--orange-border)"
                          : "var(--border)"
                      }`,
                      borderRadius: "var(--r-md)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <svg
                      width={44}
                      height={14}
                      style={{ display: "block", marginBottom: 5 }}
                    >
                      {opt.id.startsWith("orthogonal") ? (
                        <polyline
                          points="4,10 22,10 22,4 40,4"
                          fill="none"
                          stroke={
                            masterLineStyle === opt.id ? "#FF6600" : "#555"
                          }
                          strokeWidth="1.5"
                          strokeDasharray={
                            opt.id.endsWith("dashed") ? "4 3" : "1 3"
                          }
                        />
                      ) : opt.id.startsWith("straight") ? (
                        <line
                          x1={4}
                          y1={10}
                          x2={40}
                          y2={4}
                          fill="none"
                          stroke={
                            masterLineStyle === opt.id ? "#FF6600" : "#555"
                          }
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                        />
                      ) : (
                        <path
                          d="M4,10 C16,10 28,4 40,4"
                          fill="none"
                          stroke={
                            masterLineStyle === opt.id ? "#FF6600" : "#555"
                          }
                          strokeWidth="1.5"
                          strokeDasharray={
                            opt.id.endsWith("dashed") ? "4 3" : "1 3"
                          }
                        />
                      )}
                    </svg>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        color:
                          masterLineStyle === opt.id
                            ? "var(--orange)"
                            : "var(--text)",
                      }}
                    >
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 9, color: "var(--muted)" }}>
                      {opt.sub}
                    </div>
                  </button>
                ))}
              </div>

              <div
                style={{
                  fontSize: 12,
                  color: "var(--text2)",
                  marginBottom: 6,
                }}
              >
                Master → vault line colour
              </div>
              <div
                style={{
                  display: "flex",
                  gap: 5,
                  flexWrap: "wrap",
                  alignItems: "center",
                  marginBottom: 8,
                }}
              >
                <button
                  type="button"
                  onClick={() => onMasterLineColorChange(null)}
                  style={{
                    padding: "3px 8px",
                    background:
                      masterLineColor === null
                        ? "var(--orange-dim)"
                        : "var(--bg2)",
                    border: `1px solid ${
                      masterLineColor === null
                        ? "var(--orange-border)"
                        : "var(--border)"
                    }`,
                    borderRadius: 5,
                    cursor: "pointer",
                    fontSize: 10,
                    fontWeight: 600,
                    color:
                      masterLineColor === null
                        ? "var(--orange)"
                        : "var(--text2)",
                  }}
                >
                  Vault colour
                </button>
                {[
                  "#FF6600",
                  "#F2F0EB",
                  "#888780",
                  "#378ADD",
                  "#F5C542",
                  "#FF5B8A",
                  "#C792EA",
                  "#A8E063",
                  "#4FC1E9",
                  "#5DCAA5",
                ].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => onMasterLineColorChange(c)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      background: c,
                      border:
                        masterLineColor === c
                          ? "2px solid var(--text)"
                          : "1px solid var(--border)",
                      cursor: "pointer",
                      padding: 0,
                    }}
                    aria-label={`Master line colour ${c}`}
                  />
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    background: masterLineColor ?? "var(--bg2)",
                    border: "1px solid var(--border)",
                    flexShrink: 0,
                  }}
                />
                <input
                  value={masterLineColor ?? ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                      onMasterLineColorChange(v || null);
                    }
                  }}
                  placeholder="#RRGGBB"
                  style={{
                    flex: 1,
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: 5,
                    padding: "4px 8px",
                    color: "var(--text)",
                    fontSize: 11,
                    fontFamily: "var(--font-mono)",
                    outline: "none",
                  }}
                />
              </div>
            </div>
            </>
          ) : null}
        </div>

        <div style={{ flexShrink: 0 }}>
          <ThemeToggle />
        </div>

        <IconBtn
          icon={
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
              }}
            >
              ?
            </span>
          }
          title="Keyboard shortcuts"
          onClick={onShortcuts}
          round
        />
      </div>
    </div>
  );
}
