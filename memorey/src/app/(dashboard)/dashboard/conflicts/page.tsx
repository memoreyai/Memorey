"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowRightLeft,
  CheckCircle2,
  Copy,
  GitMerge,
  Search,
  Shield,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TrackPageView } from "@/components/analytics/TrackPageView";

interface ConflictNode {
  id: string;
  title: string;
  value: string;
  vault: string;
  confidence: number;
  created_at: string;
  source: string;
}

interface DetectedConflict {
  id: string;
  nodeA: ConflictNode;
  nodeB: ConflictNode;
  reason: string;
  type: "contradiction" | "evolution" | "duplicate";
  autoResolvable: boolean;
}

type Resolution = "keep_a" | "keep_b" | "keep_both" | "merge";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

const TYPE_CONFIG = {
  contradiction: {
    label: "Contradiction",
    color: "#ef4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    icon: AlertTriangle,
  },
  evolution: {
    label: "Evolution",
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    icon: Clock,
  },
  duplicate: {
    label: "Duplicate",
    color: "#6366f1",
    bg: "rgba(99,102,241,0.08)",
    border: "rgba(99,102,241,0.25)",
    icon: Copy,
  },
} as const;

function ConflictCard({
  conflict,
  onResolve,
  resolving,
}: {
  conflict: DetectedConflict;
  onResolve: (conflictId: string, nodeAId: string, nodeBId: string, res: Resolution) => void;
  resolving: boolean;
}) {
  const cfg = TYPE_CONFIG[conflict.type];
  const Icon = cfg.icon;

  return (
    <div
      className="overflow-hidden rounded-xl border transition-all duration-300"
      style={{
        borderColor: cfg.border,
        background: "var(--card-bg)",
        opacity: resolving ? 0.5 : 1,
        transform: resolving ? "scale(0.98)" : "scale(1)",
      }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{
          borderColor: cfg.border,
          background: cfg.bg,
        }}
      >
        <Icon size={14} style={{ color: cfg.color }} />
        <span
          className="text-xs font-semibold uppercase tracking-wider"
          style={{ color: cfg.color }}
        >
          {cfg.label}
        </span>
        {conflict.autoResolvable && (
          <Badge
            variant="outline"
            className="ml-auto text-[10px]"
            style={{ borderColor: cfg.border, color: cfg.color }}
          >
            Auto-resolvable
          </Badge>
        )}
      </div>

      <div className="grid gap-3 p-4 md:grid-cols-[1fr,auto,1fr]">
        <NodeSide node={conflict.nodeA} label="A" />

        <div className="flex items-center justify-center">
          <div
            className="flex size-8 items-center justify-center rounded-full border"
            style={{ borderColor: cfg.border, background: cfg.bg }}
          >
            <ArrowRightLeft size={14} style={{ color: cfg.color }} />
          </div>
        </div>

        <NodeSide node={conflict.nodeB} label="B" />
      </div>

      <div
        className="border-t px-4 py-2 text-xs"
        style={{
          borderColor: "var(--border)",
          color: "var(--text2)",
        }}
      >
        {conflict.reason}
      </div>

      <div
        className="flex flex-wrap items-center gap-2 border-t px-4 py-3"
        style={{ borderColor: "var(--border)" }}
      >
        <Button
          size="sm"
          variant="outline"
          disabled={resolving}
          className="h-8 text-xs"
          onClick={() => onResolve(conflict.id, conflict.nodeA.id, conflict.nodeB.id, "keep_a")}
          style={{ borderColor: "#10b981", color: "#10b981" }}
        >
          <CheckCircle2 size={12} className="mr-1" />
          Keep A
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={resolving}
          className="h-8 text-xs"
          onClick={() => onResolve(conflict.id, conflict.nodeA.id, conflict.nodeB.id, "keep_b")}
          style={{ borderColor: "#10b981", color: "#10b981" }}
        >
          <CheckCircle2 size={12} className="mr-1" />
          Keep B
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={resolving}
          className="h-8 text-xs"
          onClick={() => onResolve(conflict.id, conflict.nodeA.id, conflict.nodeB.id, "keep_both")}
        >
          <Shield size={12} className="mr-1" />
          Keep Both
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={resolving}
          className="h-8 text-xs"
          onClick={() => onResolve(conflict.id, conflict.nodeA.id, conflict.nodeB.id, "merge")}
          style={{ borderColor: "#6366f1", color: "#6366f1" }}
        >
          <GitMerge size={12} className="mr-1" />
          Merge
        </Button>
      </div>
    </div>
  );
}

function NodeSide({ node, label }: { node: ConflictNode; label: string }) {
  const confidence = Math.round(node.confidence * 100);
  const barColor =
    node.confidence < 0.3
      ? "#ef4444"
      : node.confidence < 0.7
        ? "#f59e0b"
        : "#22c55e";

  return (
    <div
      className="flex flex-col gap-2 rounded-lg border p-3"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg2)",
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="flex size-5 items-center justify-center rounded text-[10px] font-bold"
          style={{
            background: "var(--bg4)",
            color: "var(--text2)",
          }}
        >
          {label}
        </span>
        <span
          className="min-w-0 flex-1 truncate text-sm font-semibold"
          style={{ color: "var(--text)" }}
        >
          {node.title}
        </span>
      </div>
      <p
        className="line-clamp-3 text-xs leading-relaxed"
        style={{ color: "var(--text2)" }}
      >
        {node.value}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {node.vault && (
          <Badge variant="outline" className="text-[10px]">
            {node.vault}
          </Badge>
        )}
        <div className="flex items-center gap-1">
          <div
            className="h-1.5 w-12 overflow-hidden rounded-full"
            style={{ background: "var(--bg4)" }}
          >
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${confidence}%`, background: barColor }}
            />
          </div>
          <span className="text-[10px] tabular-nums" style={{ color: "var(--text2)" }}>
            {confidence}%
          </span>
        </div>
        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
          {formatRelativeTime(node.created_at)}
        </span>
      </div>
    </div>
  );
}

export default function ConflictsPage() {
  const [conflicts, setConflicts] = useState<DetectedConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const detectConflicts = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/conflicts/detect", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      const data = await res.json();
      setConflicts(data.conflicts ?? []);
    } catch (err) {
      console.error("Failed to detect conflicts:", err);
      toast.error("Failed to detect conflicts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void detectConflicts();
  }, [detectConflicts]);

  const handleResolve = useCallback(
    async (conflictId: string, nodeAId: string, nodeBId: string, resolution: Resolution) => {
      setResolving((s) => new Set(s).add(conflictId));
      try {
        const supabase = createClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (!session?.access_token) return;

        const res = await fetch("/api/conflicts/resolve", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ nodeAId, nodeBId, resolution }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Resolution failed");
        }

        toast.success(
          resolution === "merge"
            ? "Nodes merged successfully"
            : resolution === "keep_both"
              ? "Both nodes kept — conflict dismissed"
              : "Conflict resolved"
        );

        setConflicts((prev) => prev.filter((c) => c.id !== conflictId));
      } catch (err) {
        console.error("Resolution failed:", err);
        toast.error("Failed to resolve conflict");
      } finally {
        setResolving((s) => {
          const next = new Set(s);
          next.delete(conflictId);
          return next;
        });
      }
    },
    []
  );

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return conflicts;
    const q = searchQuery.toLowerCase();
    return conflicts.filter(
      (c) =>
        c.nodeA.title.toLowerCase().includes(q) ||
        c.nodeA.value.toLowerCase().includes(q) ||
        c.nodeB.title.toLowerCase().includes(q) ||
        c.nodeB.value.toLowerCase().includes(q) ||
        c.reason.toLowerCase().includes(q)
    );
  }, [conflicts, searchQuery]);

  if (loading) {
    return (
      <div
        className="flex min-h-0 flex-1 flex-col"
        style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
      >
        <TrackPageView pagePath="/dashboard/conflicts" />
        <div className="flex flex-1 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <div
              className="size-8 animate-spin rounded-full border-2 border-t-transparent"
              style={{ borderColor: "var(--border)", borderTopColor: "transparent" }}
            />
            <span className="text-sm" style={{ color: "var(--text2)" }}>
              Scanning for conflicts...
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <TrackPageView pagePath="/dashboard/conflicts" />

      <div className="flex flex-col gap-3 border-b border-[var(--border)] px-4 py-3 md:px-6">
        <div className="flex items-center gap-3">
          <AlertTriangle size={18} style={{ color: conflicts.length > 0 ? "#ef4444" : "var(--muted)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
            Conflicts
          </span>
          {conflicts.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums"
              style={{
                background: "rgba(239,68,68,0.12)",
                color: "#ef4444",
              }}
            >
              {conflicts.length}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs"
              onClick={() => void detectConflicts()}
            >
              Rescan
            </Button>
            <ThemeToggle />
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="flex items-center gap-2">
            <Search
              className="size-3.5 shrink-0"
              style={{ color: "var(--muted)" }}
              aria-hidden
            />
            <Input
              placeholder="Search conflicts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 max-w-md flex-1 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
              }}
            />
          </div>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">
        {filtered.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 py-20">
            <div
              className="flex size-16 items-center justify-center rounded-full"
              style={{ background: "rgba(34,197,94,0.1)" }}
            >
              <CheckCircle2 size={32} style={{ color: "#22c55e" }} />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold" style={{ color: "var(--text)" }}>
                {searchQuery ? "No matching conflicts" : "No conflicts found!"}
              </p>
              <p className="mt-1 text-xs" style={{ color: "var(--text2)" }}>
                {searchQuery
                  ? "Try a different search term"
                  : "Your memory graph is consistent. All clear!"}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtered.map((conflict) => (
              <ConflictCard
                key={conflict.id}
                conflict={conflict}
                onResolve={handleResolve}
                resolving={resolving.has(conflict.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
