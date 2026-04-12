"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import { buildTimeline, formatTime } from "../lib/timelineBuilder";
import type { MemoryNode } from "@/types/memorey";
import { VAULT_COLORS } from "../constants/colors";
import { Download, Copy, Check, Filter, Link2 } from "lucide-react";
import { toast } from "sonner";

function fileNodeTitlePrefix(n: MemoryNode): string {
  if (n.nodeKindV2 !== "file" && !n.fileUrl) return "";
  switch (n.fileType) {
    case "image":
      return "🖼️ ";
    case "pdf":
      return "📄 ";
    case "video":
      return "🎬 ";
    case "doc":
      return "📝 ";
    case "link":
      return "🔗 ";
    default:
      return "📁 ";
  }
}

function VaultPill({
  name,
  color,
  active,
  onClick,
}: {
  name: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        background: active ? color + "22" : "var(--bg2)",
        border: `1px solid ${active ? color + "66" : "var(--border)"}`,
        borderRadius: 100,
        cursor: "pointer",
        fontSize: 11,
        fontWeight: active ? 600 : 400,
        color: active ? color : "var(--text2)",
        transition: "all 0.1s",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: active ? color : "var(--muted)",
          flexShrink: 0,
          transition: "background 0.1s",
        }}
      />
      {name}
    </button>
  );
}

function PlainNodeCard({
  node,
  vaultColor,
  vaultName,
  isConnected,
  connectionLabel,
  onClick,
}: {
  node: MemoryNode;
  vaultColor: string;
  vaultName: string;
  isConnected?: boolean;
  connectionLabel?: string;
  onClick: () => void;
}) {
  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  return (
    <div
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      onClick={onClick}
      style={{
        display: "flex",
        gap: 12,
        padding: "12px 16px",
        background: isDark ? "#111110" : "#FFFFFF",
        border: `1px solid ${
          isDark ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.08)"
        }`,
        borderLeft: `3px solid ${vaultColor}`,
        borderRadius: "0 8px 8px 0",
        cursor: "pointer",
        transition: "all 0.1s",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = isDark ? "#1A1914" : "#FAFAF8";
        e.currentTarget.style.borderColor = isDark
          ? "rgba(255,255,255,0.12)"
          : "rgba(0,0,0,0.12)";
        e.currentTarget.style.borderLeftColor = vaultColor;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = isDark ? "#111110" : "#FFFFFF";
        e.currentTarget.style.borderColor = isDark
          ? "rgba(255,255,255,0.07)"
          : "rgba(0,0,0,0.08)";
        e.currentTarget.style.borderLeftColor = vaultColor;
      }}
    >
      {isConnected ? (
        <div
          style={{
            position: "absolute",
            left: -20,
            top: "50%",
            transform: "translateY(-50%)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <div
            style={{
              width: 16,
              height: 1,
              background: vaultColor + "66",
            }}
          />
          <Link2 size={10} style={{ color: vaultColor + "99", flexShrink: 0 }} />
        </div>
      ) : null}

      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            marginBottom: 4,
          }}
        >
          <div style={{ flex: 1 }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "1px 7px",
                marginBottom: 5,
                background: vaultColor + "18",
                border: `1px solid ${vaultColor}33`,
                borderRadius: 100,
                fontSize: 9,
                fontWeight: 600,
                color: vaultColor,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  background: vaultColor,
                }}
              />
              {vaultName}
            </span>
            {isConnected && connectionLabel ? (
              <span
                style={{
                  marginLeft: 6,
                  fontSize: 9,
                  color: "var(--muted)",
                  fontStyle: "italic",
                }}
              >
                ↔ {connectionLabel}
              </span>
            ) : null}
          </div>
          <span
            style={{
              fontSize: 10,
              color: "var(--faint)",
              flexShrink: 0,
              marginTop: 2,
            }}
          >
            {formatTime(new Date(node.createdAt))}
          </span>
        </div>

        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--text)",
            lineHeight: 1.4,
            marginBottom: 4,
          }}
        >
          {fileNodeTitlePrefix(node)}
          {node.title}
        </div>

        {node.value ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--text2)",
              lineHeight: 1.6,
            }}
          >
            {node.value}
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginTop: 8,
          }}
        >
          {node.confidence !== undefined && node.confidence < 1 ? (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <div
                style={{
                  width: 40,
                  height: 2,
                  borderRadius: 1,
                  background: "var(--bg4)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${Math.round(node.confidence * 100)}%`,
                    background: vaultColor,
                    borderRadius: 1,
                  }}
                />
              </div>
              <span style={{ fontSize: 9, color: "var(--muted)" }}>
                {Math.round(node.confidence * 100)}%
              </span>
            </div>
          ) : null}
          {node.kanbanStatus ? (
            <span
              style={{
                fontSize: 9,
                padding: "1px 6px",
                background: "rgba(245,197,66,0.12)",
                border: "1px solid rgba(245,197,66,0.3)",
                borderRadius: 100,
                color: "#F5C542",
              }}
            >
              📋 {node.kanbanStatus}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function vaultColorKey(node: MemoryNode): string {
  return String(node.vaultName ?? "");
}

interface PlainEnglishViewProps {
  style?: CSSProperties;
  onSwitchToGraph: () => void;
}

export function PlainEnglishView({ style, onSwitchToGraph }: PlainEnglishViewProps) {
  const allNodes = useGraphStore((s) => s.nodes) as MemoryNode[];
  const edges = useGraphStore((s) => s.edges);
  const selectNode = useGraphStore((s) => s.selectNode);
  const vaults = useVaultStore((s) => s.vaults).filter((v) => v.isActive);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);

  const [activeVaultIds, setActiveVaultIds] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  function selectAll() {
    setActiveVaultIds(new Set());
  }

  const filterSet = activeVaultIds.size === 0 ? undefined : activeVaultIds;

  const timeline = useMemo(
    () => buildTimeline(allNodes, edges, filterSet),
    [allNodes, edges, filterSet]
  );

  function buildExportText(): string {
    const lines: string[] = [];
    const canvasName = activeCanvas?.name ?? "Memory Graph";

    lines.push(`# ${canvasName} — Timeline`);
    lines.push("");

    if (activeCanvas?.masterNodeBio) {
      lines.push("## About");
      lines.push(activeCanvas.masterNodeBio);
      lines.push("");
    }

    if (timeline.dateRange) {
      lines.push(
        `_${timeline.totalNodes} memories · ${timeline.days.length} days · ` +
          `${timeline.dateRange.from.toLocaleDateString()} to ${timeline.dateRange.to.toLocaleDateString()}_`
      );
      lines.push("");
    }

    for (const day of timeline.days) {
      lines.push(`## ${day.dateLabel}`);
      lines.push("");

      for (const entry of day.entries) {
        const vault = vaults.find((v) => v.id === entry.node.vaultId);
        const time = formatTime(entry.nodeDate);

        lines.push(`### ${time} — ${entry.node.title}`);
        lines.push(`_Vault: ${vault?.name ?? "Unknown"}_`);
        if (entry.node.value) lines.push("");
        if (entry.node.value) lines.push(entry.node.value);

        if (entry.connectedNodes.length > 0) {
          lines.push("");
          lines.push("**Connected:**");
          for (const conn of entry.connectedNodes) {
            const connVault = vaults.find((v) => v.id === conn.vaultId);
            const connTime = formatTime(new Date(conn.createdAt));
            lines.push(
              `- [${connTime}] **${conn.title}** _(${connVault?.name ?? "Unknown"})_`
            );
            if (conn.value) lines.push(`  ${conn.value}`);
          }
        }
        lines.push("");
      }
    }

    lines.push("---");
    lines.push(`_Exported from Memorey · ${new Date().toLocaleString()}_`);
    return lines.join("\n");
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(buildExportText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Timeline copied to clipboard");
  }

  function handleDownload() {
    const text = buildExportText();
    const blob = new Blob([text], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memorey-timeline-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Timeline downloaded");
  }

  const isDark = document.documentElement.getAttribute("data-theme") !== "light";

  return (
    <div
      style={{
        ...style,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: isDark ? "#0C0C0B" : "#F7F6F3",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 20px",
          background: "var(--bg3)",
          borderBottom: "1px solid var(--border)",
          flexShrink: 0,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <Filter size={11} style={{ color: "var(--muted)" }} />
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
            }}
          >
            Vaults
          </span>
        </div>

        <button
          type="button"
          onClick={selectAll}
          style={{
            fontSize: 10,
            color: activeVaultIds.size === 0 ? "var(--orange)" : "var(--muted)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            fontWeight: activeVaultIds.size === 0 ? 600 : 400,
          }}
        >
          All
        </button>

        <div style={{ display: "flex", gap: 5, flexWrap: "wrap", flex: 1 }}>
          {vaults.map((vault) => (
            <VaultPill
              key={vault.id}
              name={vault.name}
              color={vault.color}
              active={
                activeVaultIds.size === 0 || activeVaultIds.has(vault.id)
              }
              onClick={() => {
                if (
                  activeVaultIds.size === 1 &&
                  activeVaultIds.has(vault.id)
                ) {
                  setActiveVaultIds(new Set());
                } else {
                  setActiveVaultIds(new Set([vault.id]));
                }
              }}
            />
          ))}
        </div>

        <div
          style={{
            fontSize: 10,
            color: "var(--muted)",
            flexShrink: 0,
            whiteSpace: "nowrap",
          }}
        >
          {timeline.totalNodes} memories · {timeline.days.length} days
        </div>

        <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
          <button
            type="button"
            onClick={handleDownload}
            title="Download as Markdown"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 9px",
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 11,
              color: "var(--text2)",
            }}
          >
            <Download size={11} />
            .md
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 10px",
              background: copied ? "#5DCAA5" : "var(--orange)",
              border: "none",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 11,
              fontWeight: 600,
              color: "#fff",
              transition: "background 0.2s",
            }}
          >
            {copied ? <Check size={11} /> : <Copy size={11} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "24px 0",
        }}
      >
        {timeline.days.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "60%",
              gap: 12,
            }}
          >
            <div style={{ fontSize: 32, opacity: 0.3 }}>📖</div>
            <div
              style={{
                fontSize: 14,
                color: "var(--muted)",
                fontWeight: 500,
              }}
            >
              No memories to show
            </div>
            <div style={{ fontSize: 12, color: "var(--faint)" }}>
              {activeVaultIds.size > 0
                ? "Try selecting more vaults above"
                : "Add your first memory using the + button or Chat builder"}
            </div>
            <button
              type="button"
              onClick={onSwitchToGraph}
              style={{
                marginTop: 8,
                padding: "7px 14px",
                background: "var(--orange)",
                border: "none",
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              Switch to Graph view
            </button>
          </div>
        ) : null}

        {timeline.days.map((day, di) => (
          <div
            key={`${day.date.toISOString().slice(0, 10)}-${di}`}
            style={{
              maxWidth: 720,
              margin: "0 auto",
              padding: "0 24px",
              marginBottom: 40,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div style={{ flexShrink: 0, textAlign: "center" }}>
                <div
                  style={{
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--text)",
                    lineHeight: 1,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {day.date.getDate()}
                </div>
                <div
                  style={{
                    fontSize: 9,
                    fontWeight: 600,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    marginTop: 1,
                  }}
                >
                  {day.date.toLocaleDateString("en-US", { month: "short" })}
                </div>
                <div style={{ fontSize: 9, color: "var(--faint)" }}>
                  {day.date.getFullYear()}
                </div>
              </div>

              <div style={{ flex: 1 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text)",
                    marginBottom: 4,
                  }}
                >
                  {day.date.toLocaleDateString("en-US", { weekday: "long" })}
                </div>
                <div style={{ height: 1, background: "var(--border)" }} />
              </div>

              <div
                style={{
                  flexShrink: 0,
                  fontSize: 10,
                  color: "var(--faint)",
                }}
              >
                {day.entries.reduce(
                  (acc, e) => acc + 1 + e.connectedNodes.length,
                  0
                )}{" "}
                memories
              </div>
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 0,
                paddingLeft: 16,
                borderLeft: `2px solid ${
                  isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"
                }`,
              }}
            >
              {day.entries.map((entry) => {
                const vault = vaults.find((v) => v.id === entry.node.vaultId);
                const color =
                  vault?.color ??
                  VAULT_COLORS[vaultColorKey(entry.node)] ??
                  "#888780";

                return (
                  <div key={entry.node.id} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 0,
                        position: "relative",
                      }}
                    >
                      <div
                        style={{
                          position: "absolute",
                          left: -22,
                          top: 16,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: color,
                          border: `2px solid ${isDark ? "#0C0C0B" : "#F7F6F3"}`,
                          boxShadow: `0 0 0 2px ${color}44`,
                          zIndex: 1,
                        }}
                      />

                      <div style={{ flex: 1 }}>
                        <PlainNodeCard
                          node={entry.node}
                          vaultColor={color}
                          vaultName={
                            vault?.name ?? String(entry.node.vaultName ?? "Memory")
                          }
                          onClick={() => {
                            selectNode(entry.node.id);
                            onSwitchToGraph();
                          }}
                        />

                        {entry.connectedNodes.length > 0 ? (
                          <div
                            style={{
                              marginTop: 3,
                              paddingLeft: 16,
                              borderLeft: `1.5px dashed ${color}44`,
                              marginLeft: 12,
                            }}
                          >
                            {entry.connectedNodes.map((conn) => {
                              const connVault = vaults.find(
                                (v) => v.id === conn.vaultId
                              );
                              const connColor =
                                connVault?.color ??
                                VAULT_COLORS[vaultColorKey(conn)] ??
                                "#888780";
                              const connectionLabel =
                                vault?.name ?? "this memory";
                              return (
                                <div key={conn.id} style={{ marginTop: 4 }}>
                                  <PlainNodeCard
                                    node={conn}
                                    vaultColor={connColor}
                                    vaultName={
                                      connVault?.name ??
                                      String(conn.vaultName ?? "Memory")
                                    }
                                    isConnected
                                    connectionLabel={connectionLabel}
                                    onClick={() => {
                                      selectNode(conn.id);
                                      onSwitchToGraph();
                                    }}
                                  />
                                </div>
                              );
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        <div style={{ height: 40 }} />
      </div>
    </div>
  );
}
