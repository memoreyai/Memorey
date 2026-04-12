"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import { X, Palette, Clock, Paperclip, Trash2, Link2 } from "lucide-react";
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

function linkKindIcon(url: string): string {
  const u = url.toLowerCase();
  if (u.includes("youtube.com") || u.includes("youtu.be")) return "▶️";
  if (u.includes("figma.com")) return "🎨";
  if (u.includes("github.com")) return "⚙️";
  if (u.includes("notion.so")) return "📝";
  return "🔗";
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
      ? "📄"
      : att.file_type === "image"
        ? "🖼️"
        : att.file_type === "video"
          ? "▶️"
          : att.file_type === "link"
            ? linkKindIcon(att.file_url)
            : "🔗";

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

interface HistoryEntry {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  created_at: string;
}

interface ConnectedNode {
  edgeId: string;
  id: string;
  title: string;
  vaultName: string;
  direction: "to" | "from";
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
    if (oldTitle !== null && oldTitle !== newTitle) {
      out.push({
        id: `${id}-title`,
        field: "title",
        old_value: oldTitle,
        new_value: newTitle,
        created_at,
      });
    }
    if (oldVal !== null && oldVal !== newVal) {
      out.push({
        id: `${id}-value`,
        field: "value",
        old_value: oldVal,
        new_value: newVal,
        created_at,
      });
    }
  }
  return out.sort(
    (a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
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
        <span style={{ fontSize: 18, flexShrink: 0 }}>
          {node.fileType === "image"
            ? "🖼️"
            : node.fileType === "pdf"
              ? "📄"
              : "🔗"}
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
          <div style={{ fontSize: 40, marginBottom: 8 }}>📎</div>
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
  const incrementAttachmentCount = useGraphStore((s) => s.incrementAttachmentCount);
  const decrementAttachmentCount = useGraphStore((s) => s.decrementAttachmentCount);

  const node = allNodes.find((n) => n.id === selectedNodeId) as
    | MemoryNode
    | undefined;
  const vault = vaults.find((v) => v.id === node?.vaultId);

  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
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
    setTitle(node.title ?? "");
    setValue(node.value ?? "");
    setShowAttInput(false);
    setAttUrl("");
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

  useEffect(() => {
    if (historyOpenForNode !== selectedNodeId || !selectedNodeId) {
      setHistory([]);
      return;
    }
    const supabase = createClient();
    void supabase
      .from("node_history")
      .select("*")
      .eq("node_id", selectedNodeId)
      .order("created_at", { ascending: false })
      .limit(20)
      .then(({ data }) =>
        setHistory(mapHistoryRows((data ?? []) as Record<string, unknown>[]))
      );
  }, [historyOpenForNode, selectedNodeId, historyKey]);

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

        await supabase.from("node_history").insert({
          node_id: selectedNodeId,
          user_id: userId,
          old_title: oldTitle,
          new_title: newTitle,
          old_value: oldValue,
          new_value: newValue,
          change_summary: `${field} edited`,
          triggered_by: "user",
        });

        track("node_edited", { field });
        useGraphStore.getState().updateNode(selectedNodeId, { [field]: val });
        setHistoryKey((k) => k + 1);
      } finally {
        setIsSaving(false);
      }
    },
    [selectedNodeId, userId, node, track]
  );

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

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 80 }}
        onClick={() => {
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
        <div
          style={{
            padding: "14px 20px 10px",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg3)",
            flexShrink: 0,
            position: "sticky",
            top: 0,
            zIndex: 2,
          }}
        >
          {node?.canvasName ? (
            <div
              style={{
                fontSize: 14,
                fontWeight: 600,
                opacity: 0.5,
                color: "var(--text2)",
                marginBottom: 8,
              }}
            >
              {(node.canvasEmoji ?? "🧠")} {node.canvasName}
            </div>
          ) : null}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 8,
            }}
          >
            {vault && (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "2px 8px",
                  background: vault.color + "22",
                  border: `1px solid ${vault.color}44`,
                  borderRadius: 100,
                  fontSize: 10,
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
            )}
            <div style={{ flex: 1 }} />
            {isSaving && (
              <span style={{ fontSize: 9, color: "var(--muted)" }}>
                saving…
              </span>
            )}
            <button
              type="button"
              onClick={() => {
                selectNode(null);
                clearHistoryOpenForNode();
              }}
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
                flexShrink: 0,
              }}
            >
              <X size={13} />
            </button>
          </div>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => void saveField("title", title)}
            onKeyDown={(e) =>
              e.key === "Enter" && e.currentTarget.blur()
            }
            style={{
              width: "100%",
              background: "none",
              border: "none",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text)",
              outline: "none",
              fontFamily: "var(--font-sans)",
              padding: 0,
            }}
          />
        </div>

        <div style={{ flex: 1, overflowY: "auto" }}>
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
                marginBottom: 5,
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
              <span style={{ fontSize: 10, color: "var(--faint)" }}>
                {value.length}/500
              </span>
            </div>
            <textarea
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, 500))}
              maxLength={500}
              rows={3}
              style={{
                width: "100%",
                boxSizing: "border-box",
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-md)",
                padding: "8px 10px",
                color: "var(--text)",
                fontSize: 13,
                lineHeight: 1.6,
                resize: "vertical",
                outline: "none",
                fontFamily: "var(--font-sans)",
              }}
              onFocus={(e) => {
                e.target.style.borderColor = "var(--orange)";
              }}
              onBlur={(e) => {
                e.target.style.borderColor = "var(--border)";
                void saveField("value", value);
              }}
            />
          </div>

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

          <div
            style={{
              padding: "10px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 2,
                  }}
                >
                  Certainty
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  {Math.round((node.confidence ?? 1) * 100)}%
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 2,
                  }}
                >
                  Created
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  {node.createdAt
                    ? new Date(node.createdAt).toLocaleDateString()
                    : "—"}
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: 9,
                    color: "var(--muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    marginBottom: 2,
                  }}
                >
                  Updated
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  {node.updatedAt
                    ? new Date(node.updatedAt).toLocaleDateString()
                    : "—"}
                </div>
              </div>
            </div>
          </div>

          {node.kanbanStatus && (
            <div
              style={{
                padding: "10px 20px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <SectionLabel
                icon={<span style={{ fontSize: 11 }}>📋</span>}
                text="Kanban"
              />
              <div style={{ display: "flex", gap: 5 }}>
                {(["todo", "doing", "done"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={async () => {
                      if (!selectedNodeId || !userId) return;
                      const supabase = createClient();
                      await supabase
                        .from("memory_nodes")
                        .update({ kanban_status: status })
                        .eq("id", selectedNodeId)
                        .eq("user_id", userId);
                      useGraphStore
                        .getState()
                        .updateNode(selectedNodeId, { kanbanStatus: status });
                    }}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 100,
                      fontSize: 11,
                      fontWeight: 500,
                      cursor: "pointer",
                      background:
                        node.kanbanStatus === status
                          ? accentColor + "22"
                          : "var(--bg2)",
                      border: `1px solid ${
                        node.kanbanStatus === status
                          ? accentColor + "66"
                          : "var(--border)"
                      }`,
                      color:
                        node.kanbanStatus === status
                          ? accentColor
                          : "var(--text2)",
                    }}
                  >
                    {status === "todo"
                      ? "📋 To-do"
                      : status === "doing"
                        ? "⚡ Doing"
                        : "✅ Done"}
                  </button>
                ))}
              </div>
            </div>
          )}

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

          <div
            style={{
              padding: "10px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <SectionLabel
              icon={<Clock size={11} />}
              text="History"
              right={
                historyOpenForNode === selectedNodeId ? (
                  <button
                    type="button"
                    onClick={clearHistoryOpenForNode}
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    Close
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      window.dispatchEvent(
                        new CustomEvent("memorey:open-history", {
                          detail: { nodeId: selectedNodeId },
                        })
                      );
                    }}
                    style={{
                      fontSize: 10,
                      color: "var(--orange)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    View
                  </button>
                )
              }
            />

            {historyOpenForNode === selectedNodeId &&
              (history.length === 0 ? (
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--faint)",
                    fontStyle: "italic",
                  }}
                >
                  No history yet
                </div>
              ) : (
                history.map((entry) => (
                  <div
                    key={entry.id}
                    style={{
                      marginBottom: 7,
                      padding: "8px 10px",
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
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
                          fontSize: 9,
                          fontWeight: 700,
                          color: "var(--orange)",
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                        }}
                      >
                        {entry.field}
                      </span>
                      <span style={{ fontSize: 9, color: "var(--muted)" }}>
                        {new Date(entry.created_at).toLocaleString()}
                      </span>
                    </div>
                    {entry.old_value && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#E05C5C",
                          textDecoration: "line-through",
                          opacity: 0.8,
                          marginBottom: 2,
                        }}
                      >
                        {String(entry.old_value).slice(0, 120)}
                      </div>
                    )}
                    {entry.new_value && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "#5DCAA5",
                          marginBottom: 5,
                        }}
                      >
                        {String(entry.new_value).slice(0, 120)}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!selectedNodeId || !userId || !entry.old_value || !node)
                          return;
                        const supabase = createClient();
                        const field = entry.field as "title" | "value";
                        const currentTitle = node.title ?? "";
                        const currentValue = node.value ?? "";
                        const { error } = await supabase
                          .from("memory_nodes")
                          .update({ [field]: entry.old_value })
                          .eq("id", selectedNodeId)
                          .eq("user_id", userId);
                        if (error) {
                          toast.error("Failed to restore");
                          return;
                        }
                        await supabase.from("node_history").insert({
                          node_id: selectedNodeId,
                          user_id: userId,
                          old_title: currentTitle,
                          new_title: field === "title" ? entry.old_value : currentTitle,
                          old_value: currentValue,
                          new_value: field === "value" ? entry.old_value : currentValue,
                          change_summary: `${field} restored to previous version`,
                          triggered_by: "user",
                        });
                        useGraphStore.getState().updateNode(selectedNodeId, {
                          [field]: entry.old_value,
                        });
                        if (field === "title") setTitle(entry.old_value);
                        if (field === "value") setValue(entry.old_value);
                        setHistoryKey((k) => k + 1);
                        toast.success("Version restored");
                      }}
                      style={{
                        fontSize: 10,
                        color: "var(--orange)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      ↩ Restore this version
                    </button>
                  </div>
                ))
              ))}
          </div>

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
