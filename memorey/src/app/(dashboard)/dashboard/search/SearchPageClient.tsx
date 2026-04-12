"use client";

import { useCallback, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCanvasStore } from "@/store/canvasStore";
import { useVaultStore } from "@/store/vaultStore";
import type { MemoryNode } from "@/types/memorey";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Search, Loader2 } from "lucide-react";

export function SearchPageClient() {
  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const canvases = useCanvasStore((s) => s.canvases);
  const vaults = useVaultStore((s) => s.vaults);

  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MemoryNode[]>([]);
  const [error, setError] = useState<string | null>(null);

  const vaultById = new Map(vaults.map((v) => [v.id, v]));
  const canvasById = new Map(canvases.map((c) => [c.id, c]));

  const runSearch = useCallback(async () => {
    const query = q.trim();
    if (!query) return;
    setLoading(true);
    setError(null);
    setAnswer(null);
    setNodes([]);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const token = session?.access_token;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!token || !user) {
        setError("Sign in to search.");
        return;
      }
      const body: {
        query: string;
        userId: string;
        canvasId?: string;
      } = { query, userId: user.id };
      if (!isMasterView && activeCanvasId) {
        body.canvasId = activeCanvasId;
      }
      const res = await fetch("/api/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as {
        error?: string;
        answer?: string;
        nodes?: MemoryNode[];
      };
      if (!res.ok) {
        setError(json.error ?? "Search failed.");
        return;
      }
      setAnswer(json.answer ?? "");
      setNodes(json.nodes ?? []);
    } catch {
      setError("Something went wrong.");
    } finally {
      setLoading(false);
    }
  }, [q, isMasterView, activeCanvasId]);

  const scopeLabel = isMasterView
    ? "All canvases"
    : activeCanvas
      ? `${activeCanvas.emoji} ${activeCanvas.name}`
      : "Select a canvas";

  return (
    <div
      className="w-full max-w-full p-4 md:p-8"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4 pe-[52px] md:pe-14">
        <div>
          <h1 className="text-sm font-medium">Search</h1>
          <p className="mt-2 max-w-prose text-sm text-[var(--text2)]">
            Ask a question in natural language. Results are scoped to:{" "}
            <span className="font-medium text-[var(--text)]">{scopeLabel}</span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ThemeToggle />
        </div>
      </div>

      <form
        className="mt-6 flex max-w-xl flex-col gap-2 sm:flex-row sm:items-center"
        onSubmit={(e) => {
          e.preventDefault();
          void runSearch();
        }}
      >
        <div className="relative min-w-0 flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2"
            style={{ color: "var(--muted)" }}
            aria-hidden
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="What did I save about…"
            className="h-10 pl-9"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg2)",
              color: "var(--text)",
            }}
          />
        </div>
        <Button
          type="submit"
          disabled={loading || !q.trim()}
          className="h-10 shrink-0"
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" aria-hidden />
          ) : (
            "Search"
          )}
        </Button>
      </form>

      {error ? (
        <p className="mt-4 text-sm text-red-500/90">{error}</p>
      ) : null}

      {answer != null && !error ? (
        <div
          className="mt-8 max-w-prose rounded-[var(--r-card)] border p-4 text-sm leading-relaxed"
          style={{
            borderColor: "var(--border)",
            background: "var(--card-bg)",
            color: "var(--text)",
          }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text2)]">
            Answer
          </p>
          <p className="mt-2 whitespace-pre-wrap">{answer}</p>
        </div>
      ) : null}

      {nodes.length > 0 ? (
        <div className="mt-8">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text2)]">
            Matching memories
          </p>
          <ul className="mt-3 flex flex-col gap-2">
            {nodes.map((n) => {
              const v = vaultById.get(n.vaultId);
              const c = n.canvasId ? canvasById.get(n.canvasId) : null;
              return (
                <li
                  key={n.id}
                  className="relative rounded-lg border p-3 pr-12 text-left"
                  style={{
                    borderColor: "var(--border)",
                    background: "color-mix(in oklab, var(--card-bg) 94%, var(--bg2))",
                    borderLeftWidth: 3,
                    borderLeftStyle: "solid",
                    borderLeftColor: v?.color ?? "#888780",
                  }}
                >
                  {isMasterView && c ? (
                    <span
                      className="absolute right-2 top-2 flex h-6 min-w-[1.5rem] items-center justify-center rounded-md border px-1 text-[13px] leading-none"
                      style={{
                        borderColor: "var(--border)",
                        background: "var(--bg3)",
                        color: "var(--text)",
                      }}
                      title={c.name}
                    >
                      {c.emoji}
                    </span>
                  ) : null}
                  <div className="flex items-center gap-2 pr-8">
                    <span
                      className="inline-block size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: v?.color ?? "#888780" }}
                      aria-hidden
                    />
                    <span
                      className="truncate text-[10px] font-semibold uppercase tracking-wide"
                      style={{ color: v?.color ?? "var(--text2)" }}
                    >
                      {v?.name ?? "Vault"}
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-[var(--text)]">
                    {n.title}
                  </p>
                  {n.value ? (
                    <p className="mt-1 line-clamp-3 text-xs text-[var(--text2)]">
                      {n.value}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
