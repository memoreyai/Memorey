"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  X,
  Copy,
  Download,
  Check,
  FileText,
  Code,
  Brain,
  MessageSquare,
  Clock,
} from "lucide-react";
import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import { createClient } from "@/lib/supabase/client";
import type { CategoryVault, MemoryNode, NodeEdge } from "@/types/memorey";
import { buildTimeline, formatTime } from "../lib/timelineBuilder";
import { toast } from "sonner";
import type { ReactNode } from "react";

type ExportFormat = "ai-brief" | "markdown" | "json" | "plain" | "timeline";

function timelineNodeTitle(n: MemoryNode): string {
  let prefix = "";
  if (n.nodeKindV2 === "file" || n.fileUrl) {
    switch (n.fileType) {
      case "image":
        prefix = "🖼️ ";
        break;
      case "pdf":
        prefix = "📄 ";
        break;
      case "video":
        prefix = "🎬 ";
        break;
      case "doc":
        prefix = "📝 ";
        break;
      case "link":
        prefix = "🔗 ";
        break;
      default:
        prefix = "📁 ";
    }
  }
  return `${prefix}${n.title}`;
}

const FORMATS: {
  id: ExportFormat;
  label: string;
  description: string;
  icon: ReactNode;
  extension: string;
  mimeType: string;
}[] = [
  {
    id: "ai-brief",
    label: "AI Brief",
    description: "Optimised prompt for Claude, ChatGPT, Gemini",
    icon: <Brain size={14} />,
    extension: "txt",
    mimeType: "text/plain",
  },
  {
    id: "markdown",
    label: "Markdown",
    description: "Structured document with headers and sections",
    icon: <FileText size={14} />,
    extension: "md",
    mimeType: "text/markdown",
  },
  {
    id: "json",
    label: "JSON",
    description: "Structured data for developers and integrations",
    icon: <Code size={14} />,
    extension: "json",
    mimeType: "application/json",
  },
  {
    id: "plain",
    label: "Plain text",
    description: "Simple text for any app or context",
    icon: <MessageSquare size={14} />,
    extension: "txt",
    mimeType: "text/plain",
  },
  {
    id: "timeline",
    label: "Timeline",
    description: "Chronological narrative with connected memories grouped",
    icon: <Clock size={14} />,
    extension: "md",
    mimeType: "text/markdown",
  },
];

function buildExport(
  format: ExportFormat,
  nodes: MemoryNode[],
  masterBio: string,
  masterName: string,
  vaultMap: Record<string, { name: string; color: string }>,
  edges: NodeEdge[],
  vaults: CategoryVault[]
): string {
  const byVault = new Map<string, MemoryNode[]>();
  for (const node of nodes) {
    const vaultId = node.vaultId ?? "unknown";
    if (!byVault.has(vaultId)) byVault.set(vaultId, []);
    byVault.get(vaultId)!.push(node);
  }

  const vaultSections = [...byVault.entries()]
    .map(([vaultId, vaultNodes]) => {
      const vault = vaultMap[vaultId];
      return { vaultName: vault?.name ?? "Other", nodes: vaultNodes };
    })
    .sort((a, b) => a.vaultName.localeCompare(b.vaultName));

  switch (format) {
    case "ai-brief": {
      const lines: string[] = [];
      lines.push("# Memory Context for AI Assistant");
      lines.push("");
      lines.push("## About Me");
      lines.push(masterBio || `Name: ${masterName}`);
      lines.push("");
      lines.push("## My Memories");
      lines.push(
        `The following is a structured export of ${nodes.length} memories from my personal knowledge graph.`
      );
      lines.push(
        "Use this context to give me more personalised and relevant responses."
      );
      lines.push("");
      for (const { vaultName, nodes: vNodes } of vaultSections) {
        lines.push(`### ${vaultName}`);
        for (const node of vNodes) {
          lines.push(`**${node.title}**`);
          if (node.value) lines.push(node.value);
          if (node.confidence && node.confidence < 0.8) {
            lines.push(
              `_(confidence: ${Math.round(node.confidence * 100)}%)_`
            );
          }
          lines.push("");
        }
      }
      lines.push("---");
      lines.push(
        `_Exported from Memorey — ${nodes.length} memories — ${new Date().toLocaleDateString()}_`
      );
      return lines.join("\n");
    }

    case "markdown": {
      const lines: string[] = [];
      lines.push(`# ${masterName}'s Memory Graph`);
      lines.push("");
      if (masterBio) {
        lines.push("## Profile");
        lines.push(masterBio);
        lines.push("");
      }
      lines.push(`## Memories (${nodes.length} total)`);
      lines.push("");
      for (const { vaultName, nodes: vNodes } of vaultSections) {
        lines.push(`### ${vaultName}`);
        lines.push("");
        for (const node of vNodes) {
          lines.push(`#### ${node.title}`);
          if (node.value) lines.push(node.value);
          lines.push("");
          const meta: string[] = [];
          if (node.confidence)
            meta.push(`Certainty: ${Math.round(node.confidence * 100)}%`);
          if (node.createdAt)
            meta.push(`Created: ${new Date(node.createdAt).toLocaleDateString()}`);
          if (meta.length > 0) lines.push(`_${meta.join(" · ")}_`);
          lines.push("");
        }
      }
      lines.push(`---`);
      lines.push(`_Exported ${new Date().toISOString()}_`);
      return lines.join("\n");
    }

    case "json": {
      const payload = {
        exportedAt: new Date().toISOString(),
        exportedBy: masterName,
        profile: {
          name: masterName,
          bio: masterBio,
        },
        totalMemories: nodes.length,
        vaults: vaultSections.map(({ vaultName, nodes: vNodes }) => ({
          name: vaultName,
          memoryCount: vNodes.length,
          memories: vNodes.map((n) => ({
            id: n.id,
            title: n.title,
            value: n.value,
            confidence: n.confidence,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
          })),
        })),
      };
      return JSON.stringify(payload, null, 2);
    }

    case "plain": {
      const lines: string[] = [];
      lines.push(`${masterName}'s Memories`);
      if (masterBio) {
        lines.push("");
        lines.push(masterBio);
      }
      lines.push("");
      lines.push("=".repeat(40));
      for (const { vaultName, nodes: vNodes } of vaultSections) {
        lines.push("");
        lines.push(vaultName.toUpperCase());
        lines.push("-".repeat(vaultName.length));
        for (const node of vNodes) {
          lines.push("");
          lines.push(`• ${node.title}`);
          if (node.value) lines.push(`  ${node.value}`);
        }
      }
      lines.push("");
      lines.push("=".repeat(40));
      lines.push(
        `${nodes.length} memories exported ${new Date().toLocaleDateString()}`
      );
      return lines.join("\n");
    }

    case "timeline": {
      const timeline = buildTimeline(nodes, edges);
      const lines: string[] = [];

      lines.push(`# ${masterName}'s Memory Timeline`);
      lines.push("");

      if (masterBio) {
        lines.push("## About");
        lines.push(masterBio);
        lines.push("");
      }

      if (timeline.dateRange) {
        lines.push(
          `_${timeline.totalNodes} memories across ${timeline.days.length} days · ` +
            `${timeline.dateRange.from.toLocaleDateString()} – ${timeline.dateRange.to.toLocaleDateString()}_`
        );
        lines.push("");
      }

      for (const day of timeline.days) {
        lines.push(`## ${day.dateLabel}`);
        lines.push("");

        for (const entry of day.entries) {
          const vault = vaults.find((v) => v.id === entry.node.vaultId);
          const time = formatTime(entry.nodeDate);

          lines.push(`### ${time} · ${timelineNodeTitle(entry.node)}`);
          lines.push(`> **${vault?.name ?? "Memory"}**`);
          if (entry.node.value) {
            lines.push("");
            lines.push(entry.node.value);
          }

          if (entry.connectedNodes.length > 0) {
            lines.push("");
            lines.push("**Connected memories:**");
            for (const conn of entry.connectedNodes) {
              const connVault = vaults.find((v) => v.id === conn.vaultId);
              const connTime = formatTime(new Date(conn.createdAt));
              lines.push(
                `- [${connTime}] **${conn.title}** — ${connVault?.name ?? ""}`
              );
              if (conn.value) lines.push(`  > ${conn.value}`);
            }
          }
          lines.push("");
        }
      }

      lines.push("---");
      lines.push(`_Exported ${new Date().toISOString()}_`);
      return lines.join("\n");
    }
  }
}

export interface ExportModalProps {
  isOpen: boolean;
  selectedNodeIds?: Set<string> | null;
  onClose: () => void;
}

export function ExportModal({
  isOpen,
  selectedNodeIds,
  onClose,
}: ExportModalProps) {
  const allNodes = useGraphStore((s) => s.nodes) as MemoryNode[];
  const edges = useGraphStore((s) => s.edges);
  const vaults = useVaultStore((s) => s.vaults);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);

  const [profile, setProfile] = useState<{
    name: string;
    bio: string;
  } | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      void supabase
        .from("profiles")
        .select("full_name, display_name, master_node_bio")
        .eq("id", user.id)
        .single()
        .then(({ data }) => {
          const canvasBio = activeCanvas?.masterNodeBio ?? "";
          const dbBio = data?.master_node_bio ?? "";
          setProfile({
            name:
              data?.display_name ??
              data?.full_name ??
              user.email?.split("@")[0] ??
              "Me",
            bio: canvasBio || dbBio,
          });
        });
    });
  }, [isOpen, activeCanvas?.masterNodeBio]);

  const [format, setFormat] = useState<ExportFormat>("ai-brief");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      queueMicrotask(() => {
        setCopied(false);
        setFormat("ai-brief");
        setProfile(null);
      });
    }
  }, [isOpen]);

  const exportNodes = useMemo(() => {
    const active = allNodes.filter((n) => n.isActive !== false) as MemoryNode[];

    if (selectedNodeIds && selectedNodeIds.size > 0) {
      return active.filter((n) => selectedNodeIds.has(n.id));
    }
    return active;
  }, [allNodes, selectedNodeIds]);

  const vaultMap = useMemo(() => {
    const map: Record<string, { name: string; color: string }> = {};
    for (const v of vaults) {
      map[v.id] = { name: v.name, color: v.color };
    }
    return map;
  }, [vaults]);

  const masterName = profile?.name ?? "Me";
  const masterBio =
    activeCanvas?.masterNodeBio ?? profile?.bio ?? "";

  const exportContent = useMemo(
    () =>
      buildExport(
        format,
        exportNodes,
        masterBio,
        masterName,
        vaultMap,
        edges,
        vaults
      ),
    [format, exportNodes, masterBio, masterName, vaultMap, edges, vaults]
  );

  const vaultCount = new Set(exportNodes.map((n) => n.vaultId).filter(Boolean))
    .size;
  const isSubset = !!(selectedNodeIds && selectedNodeIds.size > 0);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(exportContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success(
      `Copied ${exportNodes.length} memories as ${FORMATS.find((f) => f.id === format)?.label}`
    );
  }, [exportContent, exportNodes.length, format]);

  const handleDownload = useCallback(() => {
    const fmt = FORMATS.find((f) => f.id === format)!;
    const blob = new Blob([exportContent], { type: fmt.mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `memorey-export-${new Date().toISOString().slice(0, 10)}.${fmt.extension}`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Downloaded as .${fmt.extension}`);
  }, [exportContent, format]);

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 300,
          background: "rgba(0,0,0,0.55)",
          backdropFilter: "blur(4px)",
        }}
        onClick={onClose}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="export-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: 560,
          maxHeight: "88vh",
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 310,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              id="export-modal-title"
              style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}
            >
              Export memories
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--muted)",
                marginTop: 2,
              }}
            >
              {isSubset
                ? `${exportNodes.length} selected memor${exportNodes.length === 1 ? "y" : "ies"} across ${vaultCount} vault${vaultCount !== 1 ? "s" : ""}`
                : `All ${exportNodes.length} memories across ${vaultCount} vaults`}
              {" · "}
              <span style={{ color: "var(--orange)" }}>
                Master context always included
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
          <div
            style={{
              padding: "10px 14px",
              marginBottom: 16,
              background: "rgba(255,102,0,0.06)",
              border: "1px solid rgba(255,102,0,0.2)",
              borderRadius: "var(--r-md)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                marginBottom: 5,
              }}
            >
              <div
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#FF6600",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 9,
                  fontWeight: 700,
                  color: "#fff",
                  flexShrink: 0,
                }}
              >
                {(masterName || "M")[0].toUpperCase()}
              </div>
              <span
                style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}
              >
                {profile ? masterName : "Loading…"}
              </span>
              <span
                style={{
                  fontSize: 9,
                  padding: "1px 5px",
                  background: "rgba(255,102,0,0.15)",
                  border: "1px solid rgba(255,102,0,0.3)",
                  borderRadius: 3,
                  color: "#FF6600",
                  fontWeight: 700,
                  letterSpacing: "0.06em",
                }}
              >
                MASTER · ALWAYS INCLUDED
              </span>
            </div>
            <div
              style={{
                fontSize: 11,
                color: "var(--text2)",
                lineHeight: 1.5,
              }}
            >
              {masterBio ? (
                masterBio
              ) : (
                <span style={{ color: "var(--faint)", fontStyle: "italic" }}>
                  No bio set — click the master node to add context about
                  yourself
                </span>
              )}
            </div>
          </div>

          <div style={{ marginBottom: 16 }}>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 8,
              }}
            >
              Export format
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
              }}
            >
              {FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setFormat(fmt.id)}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: 10,
                    padding: "10px 12px",
                    background:
                      format === fmt.id ? "var(--orange-dim)" : "var(--bg2)",
                    border: `1px solid ${format === fmt.id ? "var(--orange-border)" : "var(--border)"}`,
                    borderRadius: "var(--r-md)",
                    cursor: "pointer",
                    textAlign: "left",
                    transition: "all 0.1s",
                  }}
                >
                  <span
                    style={{
                      color:
                        format === fmt.id ? "var(--orange)" : "var(--text2)",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  >
                    {fmt.icon}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color:
                          format === fmt.id ? "var(--orange)" : "var(--text)",
                        marginBottom: 2,
                      }}
                    >
                      {fmt.label}
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        lineHeight: 1.4,
                      }}
                    >
                      {fmt.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                Preview
              </div>
              <div style={{ fontSize: 10, color: "var(--faint)" }}>
                {exportContent.length.toLocaleString()} chars
              </div>
            </div>
            <textarea
              readOnly
              value={exportContent}
              style={{
                width: "100%",
                boxSizing: "border-box",
                height: 180,
                background: "var(--bg)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "10px 12px",
                color: "var(--text)",
                fontSize: 11,
                fontFamily:
                  format === "json" ? "var(--font-mono)" : "var(--font-sans)",
                lineHeight: 1.6,
                resize: "vertical",
                outline: "none",
              }}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            padding: "12px 20px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
            background: "var(--bg3)",
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "7px 14px",
              background: "none",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text2)",
            }}
          >
            Cancel
          </button>
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={handleDownload}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 14px",
              background: "var(--bg2)",
              border: "1px solid var(--border)",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 12,
              color: "var(--text2)",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--border2)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--border)";
            }}
          >
            <Download size={13} />
            Download .{FORMATS.find((f) => f.id === format)?.extension}
          </button>
          <button
            type="button"
            onClick={() => void handleCopy()}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "7px 18px",
              background: copied ? "#5DCAA5" : "var(--orange)",
              border: "none",
              borderRadius: "var(--r-md)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              transition: "background 0.2s",
            }}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied!" : "Copy to clipboard"}
          </button>
        </div>
      </div>
    </>
  );
}
