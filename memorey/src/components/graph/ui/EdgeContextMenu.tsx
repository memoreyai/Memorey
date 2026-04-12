"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useGraphStore } from "@/store/graphStore";
import { Trash2, Palette } from "lucide-react";
import type { NodeEdge } from "@/types/memorey";
import { toast } from "sonner";

const EDGE_COLOR_PRESETS: (string | null)[] = [
  null,
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

interface EdgeContextMenuProps {
  edge: NodeEdge;
  x: number;
  y: number;
  userId: string | null;
  onClose: () => void;
}

export function EdgeContextMenu({
  edge,
  x,
  y,
  userId,
  onClose,
}: EdgeContextMenuProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [saving, setSaving] = useState(false);

  const safeX = Math.min(x, typeof window !== "undefined" ? window.innerWidth - 200 : x);
  const safeY = Math.min(y, typeof window !== "undefined" ? window.innerHeight - 300 : y);

  const changeColor = useCallback(
    async (color: string | null) => {
      if (!userId) return;
      setSaving(true);
      const supabase = createClient();
      await supabase
        .from("node_edges")
        .update({ color })
        .eq("id", edge.id);
      useGraphStore.getState().updateEdge(edge.id, { color: color ?? null });
      setSaving(false);
      toast.success(
        color ? "Edge colour updated" : "Edge colour reset to Auto"
      );
      onClose();
    },
    [edge.id, userId, onClose]
  );

  const deleteEdge = useCallback(async () => {
    if (!userId) return;
    if (!window.confirm("Delete this connection?")) return;
    setSaving(true);
    const supabase = createClient();
    await supabase.from("node_edges").delete().eq("id", edge.id);
    useGraphStore.getState().removeEdge(edge.id);
    setSaving(false);
    toast.success("Connection deleted");
    onClose();
  }, [edge.id, userId, onClose]);

  return (
    <>
      <div
        style={{ position: "fixed", inset: 0, zIndex: 100 }}
        onClick={onClose}
        aria-hidden
      />
      <div
        role="menu"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "fixed",
          left: safeX,
          top: safeY,
          width: 190,
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow-lg)",
          zIndex: 110,
          overflow: "hidden",
          padding: "4px 0",
        }}
      >
        <div
          style={{
            padding: "6px 12px 5px",
            borderBottom: "1px solid var(--border)",
            marginBottom: 3,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            Connection
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowColorPicker((p) => !p)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "7px 12px",
            background: showColorPicker ? "var(--bg4)" : "none",
            border: "none",
            cursor: "pointer",
            color: "var(--text2)",
            fontSize: 12,
            textAlign: "left",
          }}
        >
          <Palette size={12} style={{ opacity: 0.7 }} />
          Change colour
        </button>

        {showColorPicker ? (
          <div style={{ padding: "6px 12px 10px" }}>
            <div
              style={{
                display: "flex",
                gap: 4,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              {EDGE_COLOR_PRESETS.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => void changeColor(c)}
                  title={c === null ? "Auto (vault colour)" : c}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 3,
                    background:
                      c === null
                        ? "linear-gradient(135deg, #378ADD 50%, #F5C542 50%)"
                        : c,
                    border:
                      c === (edge.color ?? null)
                        ? "2px solid var(--text)"
                        : "1px solid var(--border)",
                    cursor: "pointer",
                    padding: 0,
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
            <div
              style={{
                marginTop: 6,
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
            >
              <input
                placeholder="#RRGGBB"
                defaultValue={edge.color ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (/^#[0-9A-Fa-f]{6}$/.test(v)) void changeColor(v);
                }}
                style={{
                  flex: 1,
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: 4,
                  padding: "3px 6px",
                  color: "var(--text)",
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  outline: "none",
                }}
              />
            </div>
          </div>
        ) : null}

        <div
          style={{
            height: 1,
            background: "var(--border)",
            margin: "3px 0",
          }}
        />

        <button
          type="button"
          onClick={() => void deleteEdge()}
          disabled={saving}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            width: "100%",
            padding: "7px 12px",
            background: "none",
            border: "none",
            cursor: saving ? "wait" : "pointer",
            color: "#E05C5C",
            fontSize: 12,
            textAlign: "left",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = "rgba(224,92,92,0.08)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "none";
          }}
        >
          <Trash2 size={12} style={{ opacity: 0.8 }} />
          Delete connection
        </button>
      </div>
    </>
  );
}
