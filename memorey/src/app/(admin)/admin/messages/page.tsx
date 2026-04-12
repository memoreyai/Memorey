"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { AdminFetchError } from "@/components/admin/AdminFetchError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface Submission {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: string;
  created_at: string;
  notes: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  read: "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  replied: "bg-green-500/15 text-green-400 border-green-500/30",
  archived: "bg-[var(--bg4)] text-[var(--muted)] border-[var(--border)]",
};

export default function AdminMessagesPage() {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState<Submission | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await fetch("/api/admin/messages", { credentials: "include" });
      if (!res.ok) throw new Error();
      const json = (await res.json()) as { submissions: Submission[] };
      setSubmissions(json.submissions);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function updateStatus(id: string, status: string) {
    const res = await fetch("/api/admin/messages", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id, status }),
    });
    if (!res.ok) { toast.error("Failed to update"); return; }
    setSubmissions((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status } : s)),
    );
    if (selected?.id === id) setSelected((s) => s ? { ...s, status } : s);
    toast.success(`Marked as ${status}`);
  }

  if (error) return <AdminFetchError message="Could not load messages" onRetry={() => void load()} />;

  const filtered = filter === "all"
    ? submissions
    : submissions.filter((s) => s.status === filter);

  const counts = submissions.reduce<Record<string, number>>((acc, s) => {
    acc[s.status] = (acc[s.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Contact Messages
        </h2>
        <span className="text-xs text-[var(--muted)]">
          {submissions.length} total
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {[
          { key: "all", label: "All" },
          { key: "new", label: `New${counts.new ? ` (${counts.new})` : ""}` },
          { key: "read", label: "Read" },
          { key: "replied", label: "Replied" },
          { key: "archived", label: "Archived" },
        ].map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            className={cn(
              "rounded-[var(--r-md)] border px-3 py-1.5 text-xs font-medium transition-colors",
              filter === f.key
                ? "border-[var(--orange-border)] bg-[var(--orange-dim)] text-[var(--orange)]"
                : "border-[var(--border)] bg-[var(--bg3)] text-[var(--text2)] hover:bg-[var(--bg4)]",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* List */}
        <Card className="border-[var(--border)] bg-[var(--bg3)]">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-[var(--text2)]">
              {filtered.length} message{filtered.length !== 1 ? "s" : ""}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-2">
            {loading ? (
              <div className="space-y-2 p-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 animate-pulse rounded-[var(--r-md)] bg-[var(--bg4)]" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-[var(--muted)]">
                No messages
              </p>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelected(s)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-[var(--r-md)] p-3 text-left transition-colors",
                    selected?.id === s.id
                      ? "bg-[var(--bg4)]"
                      : "hover:bg-[var(--bg4)]",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text)]">
                      {s.name}
                    </span>
                    <span
                      className={cn(
                        "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase",
                        STATUS_COLORS[s.status] ?? STATUS_COLORS.new,
                      )}
                    >
                      {s.status}
                    </span>
                  </div>
                  <span className="truncate text-xs text-[var(--text2)]">
                    {s.subject}
                  </span>
                  <span className="text-[10px] text-[var(--muted)]">
                    {s.email} &middot;{" "}
                    {new Date(s.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </button>
              ))
            )}
          </CardContent>
        </Card>

        {/* Detail */}
        <Card className="border-[var(--border)] bg-[var(--bg3)]">
          <CardContent className="p-4">
            {selected ? (
              <div className="space-y-5">
                <div>
                  <h3 className="font-display text-base font-semibold text-[var(--text)]">
                    {selected.subject}
                  </h3>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    From <span className="font-medium text-[var(--text2)]">{selected.name}</span>{" "}
                    &lt;{selected.email}&gt;
                  </p>
                  <p className="text-[10px] text-[var(--muted)]">
                    {new Date(selected.created_at).toLocaleString()}
                  </p>
                </div>
                <div
                  className="whitespace-pre-wrap rounded-[var(--r-md)] border p-4 text-sm leading-relaxed"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--bg2)",
                    color: "var(--text)",
                  }}
                >
                  {selected.message}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["read", "replied", "archived"] as const).map((st) => (
                    <button
                      key={st}
                      type="button"
                      disabled={selected.status === st}
                      onClick={() => void updateStatus(selected.id, st)}
                      className={cn(
                        "rounded-[var(--r-md)] border px-3 py-1.5 text-xs font-medium transition-colors",
                        selected.status === st
                          ? "cursor-default border-[var(--orange-border)] bg-[var(--orange-dim)] text-[var(--orange)]"
                          : "border-[var(--border)] bg-[var(--bg4)] text-[var(--text2)] hover:bg-[var(--bg5)] hover:text-[var(--text)]",
                      )}
                    >
                      Mark {st}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-[var(--muted)]">
                Select a message to view details
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
