"use client";

import { useMemo, type ReactNode } from "react";
import { useGraphStore } from "@/store/graphStore";
import { BarChart2, ChevronDown, ChevronUp } from "lucide-react";
import type { MemoryNode } from "@/types/memorey";

interface LegendPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

export function LegendPanel({ isOpen, onToggle }: LegendPanelProps) {
  const nodes = useGraphStore((s) => s.nodes) as MemoryNode[];
  const edges = useGraphStore((s) => s.edges);

  const stats = useMemo(() => {
    const active = nodes.filter((n) => n.isActive !== false);
    const memories = active.filter(
      (n) => !n.fileUrl && n.nodeType !== "sticky"
    );
    const documents = active.filter(
      (n) => n.fileType === "pdf" || n.fileType === "doc"
    );
    const images = active.filter((n) => n.fileType === "image");
    const stickies = active.filter((n) => n.nodeType === "sticky");
    const kanban = active.filter((n) => !!n.kanbanStatus);

    const strong = edges.filter((e) => (e.strength ?? 0.5) >= 0.7);
    const weak = edges.filter((e) => (e.strength ?? 0.5) < 0.7);

    const extensions = edges.filter((e) => {
      const s = nodes.find((n) => n.id === e.sourceNodeId);
      const t = nodes.find((n) => n.id === e.targetNodeId);
      return s && t && s.vaultId === t.vaultId;
    });
    const inferences = edges.filter((e) => {
      const s = nodes.find((n) => n.id === e.sourceNodeId);
      const t = nodes.find((n) => n.id === e.targetNodeId);
      return s && t && s.vaultId !== t.vaultId;
    });

    return {
      memories: memories.length,
      connections: edges.length,
      documents: documents.length,
      images: images.length,
      stickies: stickies.length,
      kanban: kanban.length,
      strongEdges: strong.length,
      weakEdges: weak.length,
      sameVaultEdges: extensions.length,
      crossVaultEdges: inferences.length,
    };
  }, [nodes, edges]);

  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme") !== "light";

  return (
    <div
      style={{
        position: "relative",
        zIndex: 21,
        flexShrink: 0,
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 5,
          padding: "5px 10px",
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: isOpen ? "8px 8px 0 0" : 8,
          cursor: "pointer",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--text2)",
          borderBottom: isOpen
            ? `1px solid ${isDark ? "#1A1814" : "#F0EDE6"}`
            : undefined,
        }}
      >
        <BarChart2 size={16} strokeWidth={2} style={{ color: "var(--orange)" }} />
        Legend
        {isOpen ? <ChevronDown size={16} strokeWidth={2} /> : <ChevronUp size={16} strokeWidth={2} />}
      </button>

      {isOpen ? (
        <div
          style={{
            width: 220,
            background: "var(--bg3)",
            border: "1px solid var(--border2)",
            borderTop: "none",
            borderRadius: "0 8px 8px 8px",
            boxShadow: "var(--shadow-lg)",
            overflow: "hidden",
          }}
        >
          <Section label="Statistics">
            <StatRow
              icon="🧠"
              label="Memories"
              value={stats.memories}
              color="#FF6600"
            />
            <StatRow
              icon="⇄"
              label="Connections"
              value={stats.connections}
              color="#4FC1E9"
            />
            <StatRow
              icon="📄"
              label="Documents"
              value={stats.documents}
              color="#E05C5C"
            />
            <StatRow
              icon="🖼️"
              label="Images"
              value={stats.images}
              color="#5DCAA5"
            />
            {stats.stickies > 0 ? (
              <StatRow
                icon="📝"
                label="Sticky notes"
                value={stats.stickies}
                color="#F5C542"
              />
            ) : null}
            {stats.kanban > 0 ? (
              <StatRow
                icon="📋"
                label="Kanban cards"
                value={stats.kanban}
                color="#C792EA"
              />
            ) : null}
          </Section>

          <Divider />

          <Section label="Relations">
            <LegendRow
              visual={<EdgeSample style="same-vault" />}
              label="Same vault"
              sub={`${stats.sameVaultEdges} connection${stats.sameVaultEdges !== 1 ? "s" : ""}`}
            />
            <LegendRow
              visual={<EdgeSample style="cross-vault" />}
              label="Cross-vault"
              sub={`${stats.crossVaultEdges} connection${stats.crossVaultEdges !== 1 ? "s" : ""}`}
            />
          </Section>

          <Divider />

          <Section label="Strength">
            <LegendRow
              visual={<EdgeSample style="strong" />}
              label="Strong (≥70%)"
              sub={`${stats.strongEdges}`}
            />
            <LegendRow
              visual={<EdgeSample style="weak" />}
              label="Weak (<70%)"
              sub={`${stats.weakEdges}`}
            />
          </Section>
        </div>
      ) : null}
    </div>
  );
}

function Section({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ padding: "8px 12px" }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 700,
          color: "var(--muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{ display: "flex", flexDirection: "column", gap: 4 }}
      >
        {children}
      </div>
    </div>
  );
}

function Divider() {
  return (
    <div
      style={{ height: 1, background: "var(--border)", margin: "0" }}
    />
  );
}

function StatRow({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span style={{ fontSize: 12, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 11, color: "var(--text2)" }}>
        {label}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          color,
          minWidth: 24,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}

function LegendRow({
  visual,
  label,
  sub,
}: {
  visual: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flexShrink: 0, width: 40 }}>{visual}</div>
      <div style={{ flex: 1 }}>
        <div
          style={{
            fontSize: 11,
            color: "var(--text2)",
            fontWeight: 500,
          }}
        >
          {label}
        </div>
        <div style={{ fontSize: 9, color: "var(--muted)" }}>{sub}</div>
      </div>
    </div>
  );
}

function EdgeSample({
  style,
}: {
  style: "same-vault" | "cross-vault" | "strong" | "weak";
}) {
  const color =
    style === "same-vault"
      ? "#4FC1E9"
      : style === "cross-vault"
        ? "#C792EA"
        : style === "strong"
          ? "#5DCAA5"
          : "#888780";

  const dashArray = style === "weak" ? "2,3" : "4,2";

  const strokeW = style === "strong" ? 2 : 1;

  return (
    <svg width="40" height="14" viewBox="0 0 40 14">
      <defs>
        <marker
          id={`arrow-${style}`}
          markerWidth="4"
          markerHeight="4"
          refX="3"
          refY="2"
          orient="auto"
        >
          <path d="M0,0 L4,2 L0,4 Z" fill={color} opacity="0.8" />
        </marker>
      </defs>
      <line
        x1="2"
        y1="7"
        x2="34"
        y2="7"
        stroke={color}
        strokeWidth={strokeW}
        strokeDasharray={dashArray}
        markerEnd={`url(#arrow-${style})`}
        opacity={0.85}
      />
    </svg>
  );
}
