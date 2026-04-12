"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import { useKanbanStore } from "@/store/kanbanStore";
import { useCanvasStore } from "@/store/canvasStore";
import {
  X,
  Palette,
  Clock,
  Paperclip,
  Trash2,
  Link2,
  Pencil,
  Gauge,
  ArrowRightLeft,
  Save,
  MessageSquare,
  Globe,
  Puzzle,
  MonitorSmartphone,
} from "lucide-react";
import { fileTypeColor } from "../canvas/fileNode";
import type { MemoryNode } from "@/types/memorey";
import { toast } from "sonner";
import { useTrack } from "@/hooks/useTrack";

const VAULT_COLORS_MAP: Record<string, string> = {
  Work: "#378ADD",
  Goals: "#F5C542",
  Personal: "#FF6600",
  Health: "#FF5B8A",
  Finance: "#C792EA",
  Study: "#A8E063",
  Relationships: "#4FC1E9",
  Preferences: "#888780",
};

const ACCENT_PRESETS = Object.values(VAULT_COLORS_MAP);

const BG_PRESETS_DARK = [
  "#171410",
  "#1D1A13",
  "#242018",
  "#0F0F0E",
  "#1A1814",
  "#222018",
];
const BG_PRESETS_LIGHT = [
  "#FFFFFF",
  "#F8F6F2",
  "#F0EDE6",
  "#FFF8F0",
  "#F5F4F0",
  "#FFFBF7",
];

const TEXT_PRESETS = ["#F2F0EB", "#0F0F0F", "#FF6600", "#5DCAA5"];

interface NodeDetailSheetProps {
  userId: string | null;
  historyOpenForNode: string | null;
  clearHistoryOpenForNode: () => void;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size?: number | null;
  storage_path?: string | null;
  og_title?: string | null;
  og_description?: string | null;
  og_image?: string | null;
  og_site_name?: string | null;
}

function linkKindIcon(_url: string): string {
  return "";
}

function AttachmentCard({
  att,
  onRemove,
}: {
  att: Attachment;
  onRemove: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const [displayUrl, setDisplayUrl] = useState(att.file_url);
  const [linkHref, setLinkHref] = useState(att.file_url);

  useEffect(() => {
    queueMicrotask(() => {
      setDisplayUrl(att.file_url);
      setLinkHref(att.file_url);
      setImgError(false);
    });
    if (!att.storage_path) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await createClient()
        .storage.from("node-attachments")
        .createSignedUrl(att.storage_path!, 60 * 60);
      if (cancelled || error || !data?.signedUrl) return;
      setDisplayUrl(data.signedUrl);
      setLinkHref(data.signedUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [att.file_url, att.storage_path]);

  const typeIcon =
    att.file_type === "pdf"
      ? "PDF"
      : att.file_type === "image"
        ? "IMG"
        : att.file_type === "video"
          ? "VID"
          : att.file_type === "link"
            ? "URL"
            : "FILE";

  const showImagePreview = att.file_type === "image" && !imgError;

  return (
    <div
      style={{
        marginBottom: 6,
        background: "var(--bg2)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        overflow: "hidden",
      }}
    >
      {showImagePreview && (
        <div style={{ position: "relative" }}>
          <img
            src={displayUrl}
            alt={att.file_name}
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: 120,
              objectFit: "cover",
              display: "block",
            }}
          />
        </div>
      )}

      {!showImagePreview && att.og_image && !imgError && (
        <div style={{ position: "relative" }}>
          <img
            src={att.og_image}
            alt=""
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: 100,
              objectFit: "cover",
              display: "block",
            }}
          />
          {att.og_site_name ? (
            <div
              style={{
                position: "absolute",
                bottom: 6,
                left: 8,
                padding: "2px 6px",
                background: "rgba(0,0,0,0.6)",
                borderRadius: 3,
                fontSize: 9,
                color: "#fff",
              }}
            >
              {att.og_site_name}
            </div>
          ) : null}
        </div>
      )}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "8px 10px",
        }}
      >
        <span style={{ fontSize: 14, flexShrink: 0 }}>{typeIcon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "block",
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--orange)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--text)";
            }}
          >
            {att.og_title ?? att.file_name}
          </a>
          {att.og_description ? (
            <div
              style={{
                fontSize: 10,
                color: "var(--muted)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                marginTop: 1,
              }}
            >
              {att.og_description}
            </div>
          ) : null}
          {att.file_size != null && att.file_size > 0 ? (
            <div
              style={{
                fontSize: 9,
                color: "var(--faint)",
                marginTop: 1,
              }}
            >
              {att.file_size > 1024 * 1024
                ? `${(att.file_size / 1024 / 1024).toFixed(1)} MB`
                : `${(att.file_size / 1024).toFixed(0)} KB`}
            </div>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
          <a
            href={linkHref}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: "var(--bg3)",
              border: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--muted)",
              textDecoration: "none",
              fontSize: 10,
            }}
          >
            ↗
          </a>
          <button
            type="button"
            onClick={onRemove}
            style={{
              width: 22,
              height: 22,
              borderRadius: 4,
              background: "none",
              border: "1px solid var(--border)",
              cursor: "pointer",
              color: "var(--faint)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              transition: "color 0.1s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#E05C5C";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--faint)";
            }}
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

interface HistoryChange {
  field: string;
  before: string;
  after: string;
}

interface HistoryEntry {
  id: string;
  type: "content" | "title" | "confidence" | "vault" | "merged" | "deactivated" | "restored" | "edit";
  label: string;
  changes: HistoryChange[];
  created_at: string;
}

interface ConnectedNode {
  edgeId: string;
  id: string;
  title: string;
  vaultName: string;
  direction: "to" | "from";
}

function formatRelativeTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  const diffMonth = Math.floor(diffDay / 30);
  if (diffMonth < 12) return `${diffMonth}mo ago`;
  return `${Math.floor(diffMonth / 12)}y ago`;
}

function formatHistoryDate(iso: string): string {
  const d = new Date(iso);
  return (
    d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }) +
    " at " +
    d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    })
  );
}

function historyTypeColor(type: string): string {
  switch (type) {
    case "confidence":
      return "#F59E0B";
    case "vault":
      return "#4FC1E9";
    case "merged":
      return "#C792EA";
    case "deactivated":
      return "#E05C5C";
    case "restored":
      return "#5DCAA5";
    default:
      return "var(--orange)";
  }
}

function confidenceColor(c: number): string {
  if (c > 0.7) return "#22C55E";
  if (c >= 0.3) return "#F59E0B";
  return "#EF4444";
}

function mapHistoryRows(rows: Record<string, unknown>[]): HistoryEntry[] {
  const out: HistoryEntry[] = [];
  for (const r of rows) {
    const id = r.id as string;
    const created_at = r.created_at as string;
    const oldTitle = r.old_title as string | null;
    const newTitle = r.new_title as string;
    const oldVal = r.old_value as string | null;
    const newVal = r.new_value as string;
    const summary = (r.change_summary as string) ?? null;

    if (summary?.includes("Confidence")) {
      const match = summary.match(/([\d.]+)\s*→\s*([\d.]+)/);
      out.push({
        id,
        type: "confidence",
        label: "Confidence changed",
        changes: match ? [{ field: "Confidence", before: match[1], after: match[2] }] : [],
        created_at,
      });
    } else if (summary?.includes("Vault changed")) {
      const match = summary.match(/Vault changed:\s*(.+?)\s*→\s*(.+)/);
      out.push({
        id,
        type: "vault",
        label: "Vault changed",
        changes: match ? [{ field: "Vault", before: match[1].trim(), after: match[2].trim() }] : [],
        created_at,
      });
    } else if (summary?.includes("restored")) {
      out.push({ id, type: "restored", label: "Restored to previous version", changes: [], created_at });
    } else if (summary?.toLowerCase().includes("merge") || summary?.toLowerCase().includes("conflict")) {
      out.push({ id, type: "merged", label: "Merged from conflict resolution", changes: [], created_at });
    } else if (summary?.toLowerCase().includes("deactivat")) {
      out.push({ id, type: "deactivated", label: "Deactivated", changes: [], created_at });
    } else {
      const titleChanged = oldTitle !== null && oldTitle !== newTitle;
      const valueChanged = oldVal !== null && oldVal !== newVal;
      const changes: HistoryChange[] = [];

      if (titleChanged) {
        changes.push({ field: "Title", before: oldTitle!, after: newTitle });
      }
      if (valueChanged) {
        changes.push({ field: "Description", before: oldVal!, after: newVal });
      }

      if (changes.length > 0) {
        const label = titleChanged && valueChanged
          ? "Updated"
          : titleChanged
            ? "Title changed"
            : "Content updated";
        out.push({ id, type: titleChanged ? "title" : "content", label, changes, created_at });
      } else if (summary) {
        out.push({ id, type: "edit", label: summary, changes: [], created_at });
      }
    }
  }
  return out.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

function sourceIcon(source: string) {
  switch (source) {
    case "chat":
      return <MessageSquare size={10} />;
    case "share_link":
      return <Link2 size={10} />;
    case "manual":
      return <Pencil size={10} />;
    case "import":
      return <ArrowRightLeft size={10} />;
    case "extension":
      return <Puzzle size={10} />;
    case "canvas-drop":
      return <MonitorSmartphone size={10} />;
    default:
      return <Globe size={10} />;
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case "chat":
      return "AI Chat";
    case "share_link":
      return "Share Link";
    case "manual":
      return "Manual";
    case "import":
      return "Import";
    case "extension":
      return "Extension";
    case "canvas-drop":
      return "Canvas Drop";
    default:
      return source;
  }
}

function ColorRow({
  label,
  presets,
  currentValue,
  onSelect,
  onReset,
  showBorder,
}: {
  label: string;
  presets: string[];
  currentValue: string | null | undefined;
  onSelect: (color: string) => void;
  onReset: () => void;
  showBorder?: boolean;
}) {
  const [hexInput, setHexInput] = useState(currentValue ?? "");

  useEffect(() => {
    queueMicrotask(() => setHexInput(currentValue ?? ""));
  }, [currentValue]);

  function handleHexChange(raw: string) {
    setHexInput(raw);
    if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
      onSelect(raw);
    }
  }

  function handleHexBlur() {
    const trimmed = hexInput.trim();
    if (!trimmed) {
      onReset();
      return;
    }
    const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;
    if (/^#[0-9A-Fa-f]{6}$/.test(withHash)) {
      onSelect(withHash);
      setHexInput(withHash);
    } else {
      setHexInput(currentValue ?? "");
    }
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 11, color: "var(--text2)", marginBottom: 5 }}>
        {label}
      </div>

      <div
        style={{
          display: "flex",
          gap: 5,
          flexWrap: "wrap",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        {presets.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onSelect(c)}
            style={{
              width: 20,
              height: 20,
              borderRadius: 4,
              flexShrink: 0,
              background: c,
              border: showBorder ? "1px solid var(--border)" : "none",
              cursor: "pointer",
              padding: 0,
              outline: currentValue === c ? "2px solid var(--text)" : "none",
              outlineOffset: 1,
            }}
          />
        ))}
        <button
          type="button"
          onClick={onReset}
          style={{
            fontSize: 9,
            color: "var(--muted)",
            background: "none",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "1px 6px",
            cursor: "pointer",
          }}
        >
          Reset
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <div
          style={{
            width: 20,
            height: 20,
            borderRadius: 4,
            flexShrink: 0,
            background:
              currentValue ?? (showBorder ? "var(--bg)" : "transparent"),
            border: "1px solid var(--border)",
          }}
        />
        <input
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value)}
          onBlur={(e) => {
            handleHexBlur();
            e.target.style.borderColor = "var(--border)";
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="#RRGGBB"
          maxLength={7}
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
            transition: "border-color 0.1s",
          }}
          onFocus={(e) => {
            e.target.style.borderColor = "var(--orange)";
          }}
        />
        <span style={{ fontSize: 9, color: "var(--faint)" }}>hex</span>
      </div>
    </div>
  );
}

function SectionLabel({
  icon,
  text,
  right,
}: {
  icon: React.ReactNode;
  text: string;
  right?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        marginBottom: 8,
      }}
    >
      <span
        style={{
          color: "var(--muted)",
          display: "flex",
          alignItems: "center",
        }}
      >
        {icon}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 600,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          flex: 1,
        }}
      >
        {text}
      </span>
      {right}
    </div>
  );
}

function FileNodeDetailSheet({
  node,
  userId,
  onClose,
}: {
  node: MemoryNode;
  userId: string | null;
  onClose: () => void;
}) {
  const edges = useGraphStore((s) => s.edges);
  const allNodes = useGraphStore((s) => s.nodes) as MemoryNode[];
  const selectNode = useGraphStore((s) => s.selectNode);
  const removeNode = useGraphStore((s) => s.removeNode);
  const vaults = useVaultStore((s) => s.vaults);
  const { track } = useTrack();

  const saveColor = useCallback(
    async (
      field: "custom_accent_color" | "custom_bg_color" | "custom_text_color",
      colorValue: string | null
    ) => {
      if (!userId) return;
      const supabase = createClient();
      await supabase
        .from("memory_nodes")
        .update({ [field]: colorValue })
        .eq("id", node.id)
        .eq("user_id", userId);
      track("node_edited", { field: "color" });
      const storeKey =
        field === "custom_accent_color"
          ? "customAccentColor"
          : field === "custom_bg_color"
            ? "customBgColor"
            : "customTextColor";
      useGraphStore.getState().updateNode(node.id, {
        [storeKey]: colorValue ?? undefined,
      });
    },
    [node.id, userId, track]
  );

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";
  const bgPresets = isDark ? BG_PRESETS_DARK : BG_PRESETS_LIGHT;

  const connectionRows = useMemo(() => {
    return edges
      .filter((e) => e.sourceNodeId === node.id || e.targetNodeId === node.id)
      .map((e) => {
        const otherId =
          e.sourceNodeId === node.id ? e.targetNodeId : e.sourceNodeId;
        const other = allNodes.find((n) => n.id === otherId);
        if (!other) return null;
        return { edgeId: e.id, other };
      })
      .filter(
        (r): r is { edgeId: string; other: MemoryNode } => r !== null
      );
  }, [edges, node.id, allNodes]);

  const deleteFileNodeConnection = useCallback(
    async (edgeId: string) => {
      if (!userId) return;
      if (!window.confirm("Remove this connection?")) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("node_edges")
        .delete()
        .eq("id", edgeId);
      if (error) {
        toast.error("Could not remove connection");
        return;
      }
      useGraphStore.getState().removeEdge(edgeId);
      toast.success("Connection removed");
    },
    [userId]
  );

  const typeColor = fileTypeColor(node.fileType ?? null);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        right: 0,
        bottom: 0,
        width: 360,
        background: "var(--bg3)",
        borderLeft: "1px solid var(--border2)",
        boxShadow: "-8px 0 40px rgba(0,0,0,0.35)",
        zIndex: 90,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "14px 16px 10px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            flexShrink: 0,
            color: "var(--text2)",
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "2px 6px",
            textTransform: "uppercase",
          }}
        >
          {node.fileType === "image"
            ? "IMG"
            : node.fileType === "pdf"
              ? "PDF"
              : "URL"}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {node.ogTitle ?? node.fileName ?? node.title}
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--muted)",
              marginTop: 1,
            }}
          >
            {node.ogSiteName ?? node.fileType?.toUpperCase() ?? "File"}
            {node.fileSize
              ? ` · ${
                  node.fileSize > 1024 * 1024
                    ? `${(node.fileSize / 1024 / 1024).toFixed(1)} MB`
                    : `${(node.fileSize / 1024).toFixed(0)} KB`
                }`
              : ""}
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            width: 24,
            height: 24,
            borderRadius: 6,
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <X size={13} />
        </button>
      </div>

      {node.fileType === "image" && node.fileUrl ? (
        <div style={{ flexShrink: 0, maxHeight: 240, overflow: "hidden" }}>
          <img
            src={node.fileUrl}
            alt={node.fileName ?? ""}
            style={{
              width: "100%",
              objectFit: "contain",
              maxHeight: 240,
              background: isDark ? "#111" : "#f0f0f0",
            }}
          />
        </div>
      ) : null}

      {node.fileType === "pdf" && node.fileUrl ? (
        <div
          style={{
            flexShrink: 0,
            height: 440,
            background: isDark ? "#0d0d0d" : "#e8e8e8",
            borderBottom: "1px solid var(--border)",
          }}
        >
          <iframe
            src={node.fileUrl}
            title={node.fileName ?? "PDF preview"}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              display: "block",
            }}
          />
        </div>
      ) : null}

      {node.fileType &&
      node.fileType !== "image" &&
      node.fileType !== "pdf" &&
      node.fileType !== "link" &&
      node.fileUrl ? (
        <div
          style={{
            flexShrink: 0,
            padding: "20px 16px",
            background: "var(--bg2)",
            borderBottom: "1px solid var(--border)",
            textAlign: "center",
          }}
        >
          <Paperclip size={32} style={{ color: "var(--muted)", marginBottom: 8 }} />
          <div
            style={{
              fontSize: 12,
              color: "var(--text2)",
              lineHeight: 1.5,
              marginBottom: 10,
            }}
          >
            Preview isn’t available in the browser for this file type. Open the
            file to view it.
          </div>
          <a
            href={node.fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "var(--orange)",
            }}
          >
            Open file ↗
          </a>
        </div>
      ) : null}

      {node.ogImage && node.fileType !== "image" && node.fileType !== "pdf" ? (
        <div style={{ flexShrink: 0, maxHeight: 160, overflow: "hidden" }}>
          <img
            src={node.ogImage}
            alt=""
            style={{ width: "100%", objectFit: "cover", height: 160 }}
          />
        </div>
      ) : null}

      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        <a
          href={node.fileUrl ?? "#"}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "10px 12px",
            marginBottom: 14,
            background: typeColor,
            borderRadius: "var(--r-md)",
            fontSize: 12,
            fontWeight: 600,
            color: "#fff",
            textDecoration: "none",
            boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          }}
        >
          Open {node.fileType === "link" ? "link" : "file"} in new tab ↗
        </a>

        <div
          style={{
            padding: "12px 0",
            borderBottom: "1px solid var(--border)",
            marginBottom: 14,
          }}
        >
          <SectionLabel icon={<Palette size={11} />} text="Card on canvas" />
          <ColorRow
            label="Outline (accent)"
            presets={ACCENT_PRESETS}
            currentValue={node.customAccentColor}
            onSelect={(c) => void saveColor("custom_accent_color", c)}
            onReset={() => void saveColor("custom_accent_color", null)}
          />
          <ColorRow
            label="Fill (card background)"
            presets={bgPresets}
            currentValue={node.customBgColor}
            onSelect={(c) => void saveColor("custom_bg_color", c)}
            onReset={() => void saveColor("custom_bg_color", null)}
            showBorder
          />
        </div>

        {node.ogDescription ? (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 5,
              }}
            >
              Description
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--text2)",
                lineHeight: 1.6,
              }}
            >
              {node.ogDescription}
            </div>
          </div>
        ) : null}

        {connectionRows.length > 0 ? (
          <div style={{ marginBottom: 14 }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 600,
                color: "var(--muted)",
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                marginBottom: 8,
              }}
            >
              Connected ({connectionRows.length})
            </div>
            {connectionRows.map(({ edgeId, other: cn }) => {
              const cnVault = vaults.find((v) => v.id === cn.vaultId);
              return (
                <div
                  key={edgeId}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => selectNode(cn.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flex: 1,
                      minWidth: 0,
                      padding: "7px 10px",
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        background: cnVault?.color ?? "#888",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        color: "var(--text)",
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {cn.title}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--muted)" }}>→</span>
                  </button>
                  <button
                    type="button"
                    title="Remove connection"
                    aria-label="Remove connection"
                    onClick={() => void deleteFileNodeConnection(edgeId)}
                    style={{
                      flexShrink: 0,
                      width: 32,
                      height: 32,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      borderRadius: "var(--r-md)",
                      border: "1px solid var(--border)",
                      background: "var(--bg2)",
                      color: "var(--muted)",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : null}

        <button
          type="button"
          onClick={async () => {
            if (!userId) return;
            if (!window.confirm("Delete this file node?")) return;
            const supabase = createClient();
            await supabase
              .from("memory_nodes")
              .update({ is_active: false })
              .eq("id", node.id);
            removeNode(node.id);
            onClose();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            width: "100%",
            padding: "7px 10px",
            background: "none",
            border: "1px solid rgba(224,92,92,0.25)",
            borderRadius: "var(--r-md)",
            cursor: "pointer",
            fontSize: 12,
            fontWeight: 500,
            color: "#E05C5C",
          }}
        >
          <Trash2 size={12} />
          Delete file node
        </button>
      </div>
    </div>
  );
}

function KanbanSection({
  nodeId,
  userId,
  canvasId,
  currentColumnId,
  currentStatus,
  accentColor,
}: {
  nodeId: string;
  userId: string;
  canvasId?: string | null;
  currentColumnId?: string | null;
  currentStatus: string | null;
  accentColor: string;
}) {
  const columns = useKanbanStore((s) => s.columns);
  const loadColumns = useKanbanStore((s) => s.loadColumns);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const effectiveCanvasId = canvasId ?? activeCanvasId;

  useEffect(() => {
    if (effectiveCanvasId) void loadColumns(effectiveCanvasId);
  }, [effectiveCanvasId, loadColumns]);

  const currentCol = columns.find((c) => c.id === currentColumnId);

  const assignColumn = async (columnId: string | null) => {
    const supabase = createClient();
    await supabase
      .from("memory_nodes")
      .update({
        kanban_column_id: columnId,
        kanban_status: columnId ? (currentStatus ?? "todo") : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", nodeId)
      .eq("user_id", userId);

    useGraphStore.getState().updateNode(nodeId, {
      kanbanColumnId: columnId ?? undefined,
      kanbanStatus: columnId ? (currentStatus as "todo" | "doing" | "done" | null) ?? "todo" : null,
    });
  };

  return (
    <div
      style={{
        padding: "10px 20px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <SectionLabel
        icon={<span style={{ fontSize: 10, fontWeight: 700, color: "var(--muted)" }}>K</span>}
        text="Kanban"
      />

      {columns.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select
              value={currentColumnId ?? ""}
              onChange={(e) => {
                const val = e.target.value;
                void assignColumn(val || null);
              }}
              style={{
                flex: 1,
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "5px 8px",
                fontSize: 12,
                color: "var(--text)",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="">Not on board</option>
              {columns.map((col) => (
                <option key={col.id} value={col.id}>
                  {col.name}
                </option>
              ))}
            </select>
            {currentColumnId && (
              <button
                type="button"
                onClick={() => void assignColumn(null)}
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "4px 8px",
                  fontSize: 11,
                  color: "var(--muted)",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                Remove
              </button>
            )}
          </div>

          {currentColumnId && (
            <div style={{ display: "flex", gap: 5 }}>
              {(["todo", "doing", "done"] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={async () => {
                    const supabase = createClient();
                    await supabase
                      .from("memory_nodes")
                      .update({ kanban_status: status })
                      .eq("id", nodeId)
                      .eq("user_id", userId);
                    useGraphStore
                      .getState()
                      .updateNode(nodeId, { kanbanStatus: status });
                  }}
                  style={{
                    padding: "3px 9px",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                    background: currentStatus === status ? accentColor + "22" : "var(--bg2)",
                    border: `1px solid ${currentStatus === status ? accentColor + "66" : "var(--border)"}`,
                    color: currentStatus === status ? accentColor : "var(--text2)",
                  }}
                >
                  {status === "todo" ? "To-do" : status === "doing" ? "Doing" : "Done"}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 11, color: "var(--muted)" }}>
          No kanban columns configured
        </div>
      )}
    </div>
  );
}

function MemoryNodeDetailSheet({
  userId,
  historyOpenForNode,
  clearHistoryOpenForNode,
}: NodeDetailSheetProps) {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const allNodes = useGraphStore((s) => s.nodes) as MemoryNode[];
  const edges = useGraphStore((s) => s.edges);
  const vaults = useVaultStore((s) => s.vaults);
  const activeVaults = vaults.filter((v) => v.isActive);
  const incrementAttachmentCount = useGraphStore((s) => s.incrementAttachmentCount);
  const decrementAttachmentCount = useGraphStore((s) => s.decrementAttachmentCount);

  const node = allNodes.find((n) => n.id === selectedNodeId) as
    | MemoryNode
    | undefined;
  const vault = vaults.find((v) => v.id === node?.vaultId);

  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editValue, setEditValue] = useState("");
  const [editVaultId, setEditVaultId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [attUrl, setAttUrl] = useState("");
  const [attAdding, setAttAdding] = useState(false);
  const [showAttInput, setShowAttInput] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyKey, setHistoryKey] = useState(0);
  const [connNodes, setConnNodes] = useState<ConnectedNode[]>([]);
  const [localConfidence, setLocalConfidence] = useState(1);
  const confidenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { track } = useTrack();

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";
  const bgPresets = isDark ? BG_PRESETS_DARK : BG_PRESETS_LIGHT;
  const accentColor =
    node?.customAccentColor ??
    VAULT_COLORS_MAP[String(node?.vaultName ?? "")] ??
    "#FF6600";

  useEffect(() => {
    if (!node) return;
    setLocalConfidence(node.confidence ?? 1);
    setShowAttInput(false);
    setAttUrl("");
    setIsEditing(false);
  }, [node?.id]);

  useEffect(() => {
    if (!selectedNodeId) {
      setAttachments([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("node_attachments")
      .select("*")
      .eq("node_id", selectedNodeId)
      .eq("is_active", true)
      .then(({ data }) => setAttachments((data ?? []) as Attachment[]));
  }, [selectedNodeId]);

  // Auto-load history when node is selected
  useEffect(() => {
    if (!selectedNodeId) {
      setHistory([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("node_history")
      .select("*")
      .eq("node_id", selectedNodeId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) =>
        setHistory(mapHistoryRows((data ?? []) as Record<string, unknown>[]))
      );
  }, [selectedNodeId, historyKey]);

  useEffect(() => {
    if (!selectedNodeId) {
      setConnNodes([]);
      return;
    }
    const connected = edges
      .filter(
        (e) =>
          e.sourceNodeId === selectedNodeId ||
          e.targetNodeId === selectedNodeId
      )
      .map((e) => {
        const isSource = e.sourceNodeId === selectedNodeId;
        const otherId = isSource ? e.targetNodeId : e.sourceNodeId;
        const other = allNodes.find((n) => n.id === otherId) as
          | MemoryNode
          | undefined;
        if (!other) return null;
        return {
          edgeId: e.id,
          id: other.id,
          title: other.title ?? "Untitled",
          vaultName: String(other.vaultName ?? "Memory"),
          direction: isSource ? ("to" as const) : ("from" as const),
        };
      })
      .filter(Boolean) as ConnectedNode[];
    setConnNodes(connected);
  }, [selectedNodeId, edges, allNodes]);

  const saveField = useCallback(
    async (field: "title" | "value", val: string) => {
      if (!selectedNodeId || !userId || !node) return;
      const oldTitle = node.title ?? "";
      const oldValue = node.value ?? "";
      const newTitle = field === "title" ? val : oldTitle;
      const newValue = field === "value" ? val : oldValue;
      if (field === "title" && val === oldTitle) return;
      if (field === "value" && val === oldValue) return;

      setIsSaving(true);
      try {
        const supabase = createClient();
        const { error } = await supabase
          .from("memory_nodes")
          .update({ [field]: val })
          .eq("id", selectedNodeId)
          .eq("user_id", userId);

        if (error) {
          console.error("saveField update error:", error);
          return;
        }

        useGraphStore.getState().updateNode(selectedNodeId, { [field]: val });
        track("node_edited", { field });

        void Promise.resolve(
          supabase
            .from("node_history")
            .insert({
              node_id: selectedNodeId,
              user_id: userId,
              old_title: oldTitle,
              new_title: newTitle,
              old_value: oldValue,
              new_value: newValue,
              change_summary: `${field} edited`,
              triggered_by: "user",
            })
        )
          .then(() => setHistoryKey((k) => k + 1))
          .catch(console.error);
      } finally {
        setIsSaving(false);
      }
    },
    [selectedNodeId, userId, node, track]
  );

  const saveConfidence = useCallback(
    async (newConfidence: number) => {
      if (!selectedNodeId || !userId || !node) return;
      const old = node.confidence ?? 1;
      if (Math.abs(old - newConfidence) < 0.01) return;
      const supabase = createClient();
      const clamped = Math.max(0, Math.min(1, newConfidence));
      await supabase
        .from("memory_nodes")
        .update({ confidence: clamped, updated_at: new Date().toISOString() })
        .eq("id", selectedNodeId)
        .eq("user_id", userId);

      useGraphStore.getState().updateNode(selectedNodeId, { confidence: clamped });
      track("node_edited", { field: "confidence" });

      void Promise.resolve(
        supabase
          .from("node_history")
          .insert({
            node_id: selectedNodeId,
            user_id: userId,
            old_title: node.title ?? "",
            new_title: node.title ?? "",
            old_value: node.value ?? "",
            new_value: node.value ?? "",
            change_summary: `Confidence: ${old.toFixed(2)} → ${clamped.toFixed(2)}`,
            triggered_by: "user",
          })
      )
        .then(() => setHistoryKey((k) => k + 1))
        .catch(console.error);
    },
    [selectedNodeId, userId, node, track]
  );

  const handleConfidenceChange = useCallback(
    (val: number) => {
      setLocalConfidence(val);
      if (confidenceTimerRef.current) clearTimeout(confidenceTimerRef.current);
      confidenceTimerRef.current = setTimeout(() => {
        void saveConfidence(val);
      }, 500);
    },
    [saveConfidence]
  );

  const saveVaultChange = useCallback(
    async (newVaultId: string) => {
      if (!selectedNodeId || !userId || !node) return;
      if (newVaultId === node.vaultId) return;
      const oldVault = vaults.find((v) => v.id === node.vaultId);
      const newVault = vaults.find((v) => v.id === newVaultId);
      setIsSaving(true);
      try {
        const supabase = createClient();
        await supabase
          .from("memory_nodes")
          .update({ vault_id: newVaultId, updated_at: new Date().toISOString() })
          .eq("id", selectedNodeId)
          .eq("user_id", userId);

        useGraphStore.getState().updateNode(selectedNodeId, {
          vaultId: newVaultId,
          vaultName: newVault?.name ?? "Unknown",
        });
        track("node_edited", { field: "vault" });
        toast.success(`Moved to ${newVault?.name ?? "vault"}`);

        void Promise.resolve(
          supabase
            .from("node_history")
            .insert({
              node_id: selectedNodeId,
              user_id: userId,
              old_title: node.title ?? "",
              new_title: node.title ?? "",
              old_value: node.value ?? "",
              new_value: node.value ?? "",
              change_summary: `Vault changed: ${oldVault?.name ?? "Unknown"} → ${newVault?.name ?? "Unknown"}`,
              triggered_by: "user",
            })
        )
          .then(() => setHistoryKey((k) => k + 1))
          .catch(console.error);
      } finally {
        setIsSaving(false);
      }
    },
    [selectedNodeId, userId, node, vaults, track]
  );

  const startEditing = useCallback(() => {
    if (!node) return;
    setEditTitle(node.title ?? "");
    setEditValue(node.value ?? "");
    setEditVaultId(node.vaultId);
    setIsEditing(true);
  }, [node]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
  }, []);

  const saveEdits = useCallback(async () => {
    if (!node || !selectedNodeId || !userId) return;
    setIsSaving(true);
    try {
      if (editTitle !== (node.title ?? "")) {
        await saveField("title", editTitle);
      }
      if (editValue !== (node.value ?? "")) {
        await saveField("value", editValue);
      }
      if (editVaultId !== node.vaultId) {
        await saveVaultChange(editVaultId);
      }
      setIsEditing(false);
      toast.success("Changes saved");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  }, [node, selectedNodeId, userId, editTitle, editValue, editVaultId, saveField, saveVaultChange]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s" && isEditing) {
        e.preventDefault();
        void saveEdits();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isEditing, saveEdits]);

  const saveColor = useCallback(
    async (
      field: "custom_accent_color" | "custom_bg_color" | "custom_text_color",
      colorValue: string | null
    ) => {
      if (!selectedNodeId || !userId) return;
      const supabase = createClient();
      await supabase
        .from("memory_nodes")
        .update({ [field]: colorValue })
        .eq("id", selectedNodeId)
        .eq("user_id", userId);
      track("node_edited", { field: "color" });
      const storeKey =
        field === "custom_accent_color"
          ? "customAccentColor"
          : field === "custom_bg_color"
            ? "customBgColor"
            : "customTextColor";
      useGraphStore.getState().updateNode(selectedNodeId, {
        [storeKey]: colorValue ?? undefined,
      });
    },
    [selectedNodeId, userId, track]
  );

  const deleteConnection = useCallback(
    async (edgeId: string) => {
      if (!userId) return;
      if (!window.confirm("Remove this connection?")) return;
      const supabase = createClient();
      const { error } = await supabase
        .from("node_edges")
        .delete()
        .eq("id", edgeId);
      if (error) {
        toast.error("Could not remove connection");
        return;
      }
      useGraphStore.getState().removeEdge(edgeId);
      toast.success("Connection removed");
    },
    [userId]
  );

  const addUrlAttachment = useCallback(async () => {
    if (!attUrl.trim() || !selectedNodeId || !userId) return;
    setAttAdding(true);

    const supabase = createClient();
    let ogData = {
      title: attUrl.split("/").pop()?.split("?")[0] ?? "Link",
      description: null as string | null,
      image: null as string | null,
      siteName: null as string | null,
      fileType: "link" as string,
    };

    try {
      const meta = await fetch("/api/attachments/extract-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: attUrl.trim() }),
      }).then((r) => (r.ok ? r.json() : null));
      if (meta) ogData = { ...ogData, ...meta };
    } catch {
      /* use defaults */
    }

    const dbFileType =
      ogData.fileType === "youtube" || ogData.fileType === "video"
        ? "video"
        : ogData.fileType === "image" || ogData.fileType === "pdf"
          ? ogData.fileType
          : "link";

    const { data, error } = await supabase
      .from("node_attachments")
      .insert({
        user_id: userId,
        node_id: selectedNodeId,
        file_url: attUrl.trim(),
        file_name: ogData.title ?? "Link",
        file_type: dbFileType,
        og_title: ogData.title,
        og_description: ogData.description,
        og_image: ogData.image,
        og_site_name: ogData.siteName,
        source: "url",
        is_active: true,
      })
      .select()
      .single();

    if (!error && data) {
      setAttachments((prev) => [data as Attachment, ...prev]);
      setAttUrl("");
      setShowAttInput(false);
      incrementAttachmentCount(selectedNodeId);
      track("attachment_uploaded", { kind: "url" });
      toast.success("Link added");
    } else {
      toast.error("Could not add attachment");
    }
    setAttAdding(false);
  }, [attUrl, selectedNodeId, userId, incrementAttachmentCount, track]);

  const handleFileUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !selectedNodeId || !userId) return;

      for (const file of Array.from(files)) {
        if (file.size > 50 * 1024 * 1024) {
          toast.error(`${file.name} is too large (max 50MB)`);
          continue;
        }

        setUploadProgress(0);
        try {
          const { uploadAttachment } = await import("@/lib/uploadAttachment");
          setUploadProgress(30);
          const result = await uploadAttachment(file, userId);
          setUploadProgress(85);

          const supabase = createClient();
          const { data, error } = await supabase
            .from("node_attachments")
            .insert({
              user_id: userId,
              node_id: selectedNodeId,
              file_url: result.publicUrl,
              file_name: result.fileName,
              file_type: result.fileType,
              file_size: result.fileSize,
              storage_path: result.storagePath,
              source: "url",
              is_active: true,
            })
            .select()
            .single();

          if (!error && data) {
            setAttachments((prev) => [data as Attachment, ...prev]);
            incrementAttachmentCount(selectedNodeId);
            track("attachment_uploaded", { kind: "file" });
            toast.success(`${file.name} uploaded`);
          }
          setUploadProgress(100);
        } catch (err) {
          toast.error(`Failed to upload ${file.name}`);
          console.error(err);
        }
        setUploadProgress(null);
      }
    },
    [selectedNodeId, userId, incrementAttachmentCount, track]
  );

  const handleDelete = useCallback(async () => {
    if (!selectedNodeId || !userId) return;
    if (!window.confirm("Delete this memory? This cannot be undone.")) return;
    const supabase = createClient();
    await supabase
      .from("memory_nodes")
      .update({ is_active: false })
      .eq("id", selectedNodeId)
      .eq("user_id", userId);
    useGraphStore.getState().removeNode(selectedNodeId);
    selectNode(null);
    clearHistoryOpenForNode();
    toast.success("Memory deleted");
  }, [selectedNodeId, userId, selectNode, clearHistoryOpenForNode]);

  if (!selectedNodeId || !node) return null;

  const confPct = Math.round(localConfidence * 100);
  const confColor = confidenceColor(localConfidence);
  const contentValue = isEditing ? editValue : (node.value ?? "");
  const contentRows = Math.max(4, contentValue.split("\n").length + 1);

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 80 }}
        onClick={() => {
          setIsEditing(false);
          selectNode(null);
          clearHistoryOpenForNode();
        }}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 380,
          background: "var(--bg3)",
          borderLeft: "1px solid var(--border2)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.35)",
          zIndex: 90,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* ── Header: Title + Close ── */}
        <div
          style={{
            padding: "16px 20px 12px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg3)",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          {node.canvasName && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 500,
                opacity: 0.5,
                color: "var(--text2)",
                marginBottom: 6,
              }}
            >
              {node.canvasEmoji ? `${node.canvasEmoji} ` : ""}{node.canvasName}
            </div>
          )}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
            {isEditing ? (
              <input
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                autoFocus
                style={{
                  flex: 1,
                  background: "var(--bg2)",
                  border: "1px solid var(--orange)",
                  borderRadius: "var(--r-md)",
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text)",
                  outline: "none",
                  fontFamily: "var(--font-sans)",
                  padding: "6px 10px",
                  boxSizing: "border-box",
                }}
              />
            ) : (
              <div
                style={{
                  flex: 1,
                  fontSize: 16,
                  fontWeight: 600,
                  color: "var(--text)",
                  lineHeight: 1.4,
                  wordBreak: "break-word",
                }}
              >
                {node.title ?? "Untitled"}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                selectNode(null);
                clearHistoryOpenForNode();
              }}
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
                flexShrink: 0,
                marginTop: 2,
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
          {/* ── Meta: Vault + Source + Dates ── */}
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              {isEditing ? (
                <select
                  value={editVaultId}
                  onChange={(e) => setEditVaultId(e.target.value)}
                  style={{
                    padding: "3px 10px",
                    background: "var(--bg2)",
                    border: "1px solid var(--orange)",
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--text)",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {activeVaults.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
              ) : vault ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "3px 10px",
                    background: vault.color + "22",
                    border: `1px solid ${vault.color}44`,
                    borderRadius: 100,
                    fontSize: 11,
                    fontWeight: 600,
                    color: vault.color,
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: vault.color,
                    }}
                  />
                  {vault.name}
                </span>
              ) : null}
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 100,
                  fontSize: 10,
                  color: "var(--text2)",
                }}
              >
                {sourceIcon(node.source)}
                {sourceLabel(node.source)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>
              <span style={{ fontWeight: 500 }}>Created </span>
              {node.createdAt ? formatHistoryDate(node.createdAt) : "—"}
            </div>
            {node.updatedAt && node.updatedAt !== node.createdAt && (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--muted)",
                  marginTop: 2,
                }}
              >
                <span style={{ fontWeight: 500 }}>Updated </span>
                {formatHistoryDate(node.updatedAt)}
              </div>
            )}
          </div>

          {/* ── Content / Description ── */}
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                }}
              >
                Description
              </span>
              {isEditing && (
                <span style={{ fontSize: 10, color: "var(--faint)" }}>
                  {editValue.length}/500
                </span>
              )}
            </div>
            <textarea
              value={contentValue}
              readOnly={!isEditing}
              onClick={() => {
                if (!isEditing) startEditing();
              }}
              onChange={(e) => {
                if (isEditing) setEditValue(e.target.value.slice(0, 500));
              }}
              maxLength={500}
              rows={contentRows}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: isEditing ? "var(--bg2)" : "transparent",
                border: isEditing
                  ? "1px solid var(--orange)"
                  : "1px solid transparent",
                borderRadius: "var(--r-md)",
                padding: isEditing ? "8px 10px" : "4px 0",
                color: "var(--text)",
                fontSize: 13,
                lineHeight: 1.6,
                resize: isEditing ? "vertical" : "none",
                outline: "none",
                fontFamily: "var(--font-sans)",
                cursor: isEditing ? "text" : "pointer",
                transition:
                  "border-color 0.15s, background 0.15s, padding 0.15s",
              }}
            />
          </div>

          {/* ── Confidence Meter ── */}
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <SectionLabel icon={<Gauge size={11} />} text="Confidence" />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 6,
              }}
            >
              <input
                type="range"
                min="0"
                max="1"
                step="0.01"
                value={localConfidence}
                onChange={(e) =>
                  handleConfidenceChange(parseFloat(e.target.value))
                }
                style={{
                  flex: 1,
                  height: 6,
                  accentColor: confColor,
                  cursor: "pointer",
                }}
              />
              <span
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: confColor,
                  minWidth: 38,
                  textAlign: "right",
                }}
              >
                {confPct}%
              </span>
            </div>
            <div
              style={{
                height: 4,
                borderRadius: 2,
                overflow: "hidden",
                background: "var(--bg2)",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${confPct}%`,
                  borderRadius: 2,
                  background: `linear-gradient(90deg, #EF4444 0%, #F59E0B 40%, #22C55E 80%)`,
                  backgroundSize: `${100 / (confPct / 100 || 1)}% 100%`,
                  transition: "width 0.15s",
                }}
              />
            </div>
          </div>

          {/* ── Edit / Save section ── */}
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            {!isEditing ? (
              <button
                type="button"
                onClick={startEditing}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  width: "100%",
                  padding: "9px 12px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text2)",
                  transition: "all 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = "var(--orange)";
                  e.currentTarget.style.color = "var(--orange)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = "var(--border)";
                  e.currentTarget.style.color = "var(--text2)";
                }}
              >
                <Pencil size={12} />
                Edit Node
              </button>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={() => void saveEdits()}
                  disabled={isSaving}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    padding: "9px 12px",
                    background: "#FF6600",
                    border: "none",
                    borderRadius: "var(--r-md)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 600,
                    color: "#fff",
                    opacity: isSaving ? 0.6 : 1,
                    transition: "opacity 0.15s",
                  }}
                >
                  <Save size={12} />
                  {isSaving ? "Saving..." : "Save Changes"}
                </button>
                <button
                  type="button"
                  onClick={cancelEditing}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    padding: "9px 16px",
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    cursor: "pointer",
                    fontSize: 12,
                    fontWeight: 500,
                    color: "var(--text2)",
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* ── Connections ── */}
          {connNodes.length > 0 && (
            <div
              style={{
                padding: "10px 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <SectionLabel
                icon={<Link2 size={11} />}
                text={`Connections (${connNodes.length})`}
              />
              {connNodes.map((cn) => {
                const cnVault = vaults.find((v) => v.name === cn.vaultName);
                return (
                  <div
                    key={cn.edgeId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 3,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => selectNode(cn.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flex: 1,
                        minWidth: 0,
                        padding: "6px 8px",
                        background: "var(--bg2)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--r-md)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "border-color 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "var(--border2)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: "50%",
                          background: cnVault?.color ?? "#888780",
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          flex: 1,
                          fontSize: 12,
                          color: "var(--text)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cn.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          color: "var(--muted)",
                          flexShrink: 0,
                        }}
                      >
                        {cn.direction === "to" ? "→" : "←"}
                      </span>
                    </button>
                    <button
                      type="button"
                      title="Remove connection"
                      aria-label="Remove connection"
                      onClick={() => void deleteConnection(cn.edgeId)}
                      style={{
                        flexShrink: 0,
                        width: 32,
                        height: 32,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "var(--r-md)",
                        border: "1px solid var(--border)",
                        background: "var(--bg2)",
                        color: "var(--muted)",
                        cursor: "pointer",
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Kanban ── */}
          <KanbanSection
            nodeId={selectedNodeId!}
            userId={userId!}
            canvasId={node.canvasId}
            currentColumnId={node.kanbanColumnId}
            currentStatus={node.kanbanStatus ?? null}
            accentColor={accentColor}
          />

          {/* ── Attachments ── */}
          <div
            style={{
              padding: "10px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                marginBottom: 8,
              }}
            >
              <Paperclip size={11} style={{ color: "var(--muted)" }} />
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: "var(--muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.07em",
                  flex: 1,
                }}
              >
                Attachments{" "}
                {attachments.length > 0 ? `(${attachments.length})` : ""}
              </span>
              <div style={{ display: "flex", gap: 5 }}>
                <button
                  type="button"
                  onClick={() => setShowAttInput((p) => !p)}
                  style={{
                    fontSize: 10,
                    color: "var(--orange)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  + Link
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    fontSize: 10,
                    color: "var(--orange)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                  }}
                >
                  + File
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf,.md,.txt,.doc,.docx"
                  style={{ display: "none" }}
                  onChange={(e) => void handleFileUpload(e.target.files)}
                />
              </div>
            </div>

            {uploadProgress !== null ? (
              <div style={{ marginBottom: 8 }}>
                <div
                  style={{
                    height: 3,
                    background: "var(--bg2)",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width: `${uploadProgress}%`,
                      background: "var(--orange)",
                      borderRadius: 2,
                      transition: "width 0.3s",
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--muted)",
                    marginTop: 3,
                  }}
                >
                  Uploading…
                </div>
              </div>
            ) : null}

            {showAttInput ? (
              <div style={{ display: "flex", gap: 5, marginBottom: 8 }}>
                <input
                  autoFocus
                  value={attUrl}
                  onChange={(e) => setAttUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void addUrlAttachment();
                    if (e.key === "Escape") {
                      setShowAttInput(false);
                      setAttUrl("");
                    }
                  }}
                  placeholder="https://..."
                  style={{
                    flex: 1,
                    background: "var(--bg2)",
                    border: "1px solid var(--orange)",
                    borderRadius: 6,
                    padding: "5px 8px",
                    color: "var(--text)",
                    fontSize: 12,
                    outline: "none",
                  }}
                />
                <button
                  type="button"
                  onClick={() => void addUrlAttachment()}
                  disabled={!attUrl.trim() || attAdding}
                  style={{
                    padding: "5px 10px",
                    background: "var(--orange)",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "#fff",
                    opacity: !attUrl.trim() || attAdding ? 0.5 : 1,
                  }}
                >
                  {attAdding ? "…" : "Add"}
                </button>
              </div>
            ) : null}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--orange)";
              }}
              onDragLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.currentTarget.style.borderColor = "var(--border)";
                void handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--orange)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border)";
              }}
              style={{
                padding: "10px",
                border: "1px dashed var(--border)",
                borderRadius: 8,
                marginBottom: 8,
                textAlign: "center",
                cursor: "pointer",
                transition: "border-color 0.1s",
              }}
            >
              <div style={{ fontSize: 10, color: "var(--muted)" }}>
                Drop files here or{" "}
                <span style={{ color: "var(--orange)" }}>browse</span>
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: "var(--faint)",
                  marginTop: 2,
                }}
              >
                Images, PDFs, docs up to 50MB
              </div>
            </div>

            {attachments.length === 0 &&
            !showAttInput &&
            uploadProgress === null ? (
              <div
                style={{
                  fontSize: 11,
                  color: "var(--faint)",
                  fontStyle: "italic",
                }}
              >
                No attachments yet
              </div>
            ) : (
              attachments.map((att) => (
                <AttachmentCard
                  key={att.id}
                  att={att}
                  onRemove={() => {
                    void createClient()
                      .from("node_attachments")
                      .update({ is_active: false })
                      .eq("id", att.id)
                      .then(() => {
                        setAttachments((prev) =>
                          prev.filter((a) => a.id !== att.id)
                        );
                        if (selectedNodeId) {
                          decrementAttachmentCount(selectedNodeId);
                        }
                      });
                  }}
                />
              ))
            )}
          </div>

          {/* ── Card appearance ── */}
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <SectionLabel icon={<Palette size={11} />} text="Card appearance" />

            <ColorRow
              label="Accent colour"
              presets={ACCENT_PRESETS}
              currentValue={node.customAccentColor}
              onSelect={(c) => void saveColor("custom_accent_color", c)}
              onReset={() => void saveColor("custom_accent_color", null)}
            />

            <ColorRow
              label="Background colour"
              presets={bgPresets}
              currentValue={node.customBgColor}
              onSelect={(c) => void saveColor("custom_bg_color", c)}
              onReset={() => void saveColor("custom_bg_color", null)}
              showBorder
            />

            <ColorRow
              label="Text colour"
              presets={TEXT_PRESETS}
              currentValue={node.customTextColor}
              onSelect={(c) => void saveColor("custom_text_color", c)}
              onReset={() => void saveColor("custom_text_color", null)}
            />
          </div>

          {/* ── History ── */}
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <SectionLabel icon={<Clock size={11} />} text="History" />

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              {history.map((entry) => (
                <div
                  key={entry.id}
                  style={{
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-md)",
                    padding: "10px 12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginBottom: 4,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        background: historyTypeColor(entry.type),
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--text)",
                      }}
                    >
                      {entry.label}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: "var(--muted)",
                      marginBottom: entry.changes.length > 0 ? 8 : 0,
                    }}
                  >
                    {formatHistoryDate(entry.created_at)}
                  </div>
                  {entry.changes.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {entry.changes.map((ch, ci) => (
                        <div key={ci}>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 600,
                              color: "var(--text2)",
                              marginBottom: 2,
                            }}
                          >
                            {ch.field}
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                            <span>Before: </span>
                            <span style={{ color: "var(--text2)" }}>
                              {ch.before.length > 120 ? ch.before.slice(0, 120) + "..." : ch.before}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--muted)", lineHeight: 1.5 }}>
                            <span>After: </span>
                            <span style={{ color: "var(--text2)" }}>
                              {ch.after.length > 120 ? ch.after.slice(0, 120) + "..." : ch.after}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              {/* Creation event — always at bottom */}
              <div
                style={{
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 4,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#5DCAA5",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    Created
                  </span>
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--muted)",
                    marginBottom: 6,
                  }}
                >
                  {node.createdAt
                    ? formatHistoryDate(node.createdAt)
                    : "Unknown"}
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.6 }}>
                  Source: {sourceLabel(node.source)}
                  {node.title && (
                    <>
                      <br />
                      Initial title: {node.title}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ── Delete ── */}
          <div style={{ padding: "12px 20px" }}>
            <button
              type="button"
              onClick={() => void handleDelete()}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                width: "100%",
                padding: "7px 10px",
                background: "none",
                border: "1px solid rgba(224,92,92,0.3)",
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                color: "#E05C5C",
                fontSize: 12,
                fontWeight: 500,
                transition: "background 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(224,92,92,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "none";
              }}
            >
              <Trash2 size={12} />
              Delete this memory
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

export function NodeDetailSheet(props: NodeDetailSheetProps) {
  const selectedNodeId = useGraphStore((s) => s.selectedNodeId);
  const allNodes = useGraphStore((s) => s.nodes) as MemoryNode[];
  const selectNode = useGraphStore((s) => s.selectNode);
  const node = allNodes.find((n) => n.id === selectedNodeId);

  if (!selectedNodeId) return null;
  if (node && (node.nodeKindV2 === "file" || node.fileUrl)) {
    return (
      <FileNodeDetailSheet
        node={node}
        userId={props.userId}
        onClose={() => selectNode(null)}
      />
    );
  }

  return <MemoryNodeDetailSheet {...props} />;
}
