"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import { toast } from "sonner";
import {
  Copy,
  Download,
  Loader2,
  Check,
  FileText,
  Code2,
  Braces,
  FileCode,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TrackPageView } from "@/components/analytics/TrackPageView";
import { cn } from "@/lib/utils";

type BriefFormat = "system_prompt" | "markdown" | "json" | "toml";

const FORMAT_OPTIONS: {
  id: BriefFormat;
  label: string;
  icon: typeof FileText;
  sub: string;
  ext: string;
}[] = [
  {
    id: "system_prompt",
    label: "System Prompt",
    icon: Sparkles,
    sub: "Paste into any AI chat",
    ext: "txt",
  },
  {
    id: "markdown",
    label: "Markdown",
    icon: FileText,
    sub: "Formatted with tables",
    ext: "md",
  },
  {
    id: "json",
    label: "JSON",
    icon: Braces,
    sub: "Structured data",
    ext: "json",
  },
  {
    id: "toml",
    label: "TOML",
    icon: FileCode,
    sub: "Config format",
    ext: "toml",
  },
];

export default function BriefPage() {
  const vaults = useVaultStore((s) => s.vaults);
  const fetchVaults = useVaultStore((s) => s.fetchVaults);
  const canvases = useCanvasStore((s) => s.canvases);
  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);

  const [userId, setUserId] = useState<string | null>(null);
  const [format, setFormat] = useState<BriefFormat>("system_prompt");
  const [selectedVaults, setSelectedVaults] = useState<Set<string>>(new Set());
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [brief, setBrief] = useState("");
  const [nodeCount, setNodeCount] = useState(0);
  const [edgeCount, setEdgeCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUserId(user.id);
        void fetchVaults(
          user.id,
          isMasterView ? undefined : activeCanvasId ?? undefined
        );
      }
    });
  }, [fetchVaults, isMasterView, activeCanvasId]);

  useEffect(() => {
    if (vaults.length > 0 && selectedVaults.size === 0) {
      setSelectedVaults(new Set(vaults.map((v) => v.id)));
    }
  }, [vaults, selectedVaults.size]);

  const generateBrief = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/brief", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          format,
          vaultIds: [...selectedVaults],
          canvasId: canvasId || null,
          dateFrom: dateFrom || null,
          dateTo: dateTo || null,
        }),
      });

      const data = await res.json();
      setBrief(data.brief ?? "");
      setNodeCount(data.nodeCount ?? 0);
      setEdgeCount(data.edgeCount ?? 0);
    } catch (err) {
      console.error("Brief generation failed:", err);
      toast.error("Failed to generate brief");
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  }, [userId, format, selectedVaults, canvasId, dateFrom, dateTo]);

  useEffect(() => {
    if (!userId || selectedVaults.size === 0) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      void generateBrief();
    }, initialLoad ? 100 : 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [userId, format, selectedVaults, canvasId, dateFrom, dateTo, generateBrief, initialLoad]);

  const handleCopy = useCallback(async () => {
    if (!brief) return;
    await navigator.clipboard.writeText(brief);
    setCopied(true);
    toast.success("Copied to clipboard — paste into any AI chat");
    setTimeout(() => setCopied(false), 2000);
  }, [brief]);

  const handleDownload = useCallback(() => {
    if (!brief) return;
    const opt = FORMAT_OPTIONS.find((f) => f.id === format);
    const ext = opt?.ext ?? "txt";
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
    const filename = `memorey-brief-${stamp}.${ext}`;
    const blob = new Blob([brief], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success("Download started");
  }, [brief, format]);

  const tokenEst = useMemo(
    () => Math.round(brief.length / 4),
    [brief.length]
  );

  const isCode = format === "json" || format === "toml";

  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <TrackPageView pagePath="/dashboard/brief" />

      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[var(--border)] px-4 py-3 md:px-6">
        <Sparkles size={18} style={{ color: "var(--orange)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text)" }}>
          Brief AI
        </span>
        <span className="text-xs" style={{ color: "var(--text2)" }}>
          Generate context for any AI assistant
        </span>
        <div className="ml-auto">
          <ThemeToggle />
        </div>
      </div>

      {/* Main content */}
      <div className="grid min-h-0 flex-1 gap-0 md:grid-cols-[320px,1fr]">
        {/* Left — Controls */}
        <div
          className="flex flex-col gap-5 overflow-y-auto border-r border-[var(--border)] px-4 py-4"
          style={{ background: "var(--bg2)" }}
        >
          {/* Format */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text2)" }}>
              Format
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((f) => {
                const Icon = f.icon;
                const active = format === f.id;
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    className={cn(
                      "flex flex-col items-start gap-0.5 rounded-xl border px-3 py-2.5 text-left transition-colors",
                      active
                        ? "border-[var(--orange)] bg-[var(--orange)]/10"
                        : "border-[var(--border)] hover:border-[var(--border2)]"
                    )}
                    style={{ color: "var(--text)" }}
                  >
                    <div className="flex items-center gap-1.5">
                      <Icon
                        size={13}
                        style={{ color: active ? "var(--orange)" : "var(--muted)" }}
                      />
                      <span className="text-xs font-medium">{f.label}</span>
                    </div>
                    <span className="text-[10px]" style={{ color: "var(--text2)" }}>
                      {f.sub}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Canvas filter */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text2)" }}>
              Canvas
            </h3>
            <select
              className="w-full rounded-lg border px-3 py-2 text-xs"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
              }}
              value={canvasId ?? ""}
              onChange={(e) => setCanvasId(e.target.value || null)}
            >
              <option value="">All Canvases</option>
              {canvases.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </section>

          {/* Vault filter */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text2)" }}>
                Vaults
              </h3>
              <div className="flex gap-2 text-[10px]">
                <button
                  type="button"
                  className="hover:underline"
                  style={{ color: "var(--orange)" }}
                  onClick={() => setSelectedVaults(new Set(vaults.map((v) => v.id)))}
                >
                  All
                </button>
                <button
                  type="button"
                  className="hover:underline"
                  style={{ color: "var(--text2)" }}
                  onClick={() => setSelectedVaults(new Set())}
                >
                  None
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              {vaults.map((v) => {
                const on = selectedVaults.has(v.id);
                return (
                  <label
                    key={v.id}
                    className={cn(
                      "flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors",
                      on
                        ? "border-[var(--border2)] bg-[var(--bg)]"
                        : "border-transparent opacity-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={on}
                      onChange={() => {
                        setSelectedVaults((prev) => {
                          const next = new Set(prev);
                          if (on) next.delete(v.id);
                          else next.add(v.id);
                          return next;
                        });
                      }}
                      className="rounded"
                      style={{ accentColor: v.color }}
                    />
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: v.color }}
                    />
                    <span className="flex-1 truncate font-medium" style={{ color: "var(--text)" }}>
                      {v.name}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {/* Date range */}
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text2)" }}>
              Date Range <span className="font-normal normal-case">(optional)</span>
            </h3>
            <div className="flex items-center gap-2">
              <input
                type="date"
                className="flex-1 rounded-lg border px-2 py-1.5 text-xs"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span className="text-[10px]" style={{ color: "var(--muted)" }}>
                to
              </span>
              <input
                type="date"
                className="flex-1 rounded-lg border px-2 py-1.5 text-xs"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </section>

          {/* Generate button */}
          <Button
            type="button"
            className="h-10 w-full bg-[var(--orange)] font-semibold text-white hover:opacity-90"
            disabled={loading || selectedVaults.size === 0}
            onClick={() => void generateBrief()}
          >
            {loading ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            Generate Brief
          </Button>
        </div>

        {/* Right — Output */}
        <div className="flex min-h-0 flex-col">
          {/* Action bar */}
          <div
            className="flex items-center gap-2 border-b px-4 py-2.5"
            style={{ borderColor: "var(--border)" }}
          >
            <Button
              size="sm"
              className={cn(
                "h-8 gap-1.5 text-xs font-semibold",
                copied
                  ? "bg-emerald-600 text-white hover:bg-emerald-600"
                  : "bg-[var(--orange)] text-white hover:opacity-90"
              )}
              disabled={!brief || loading}
              onClick={() => void handleCopy()}
            >
              {copied ? (
                <>
                  <Check size={13} />
                  Copied!
                </>
              ) : (
                <>
                  <Copy size={13} />
                  Copy to Clipboard
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs"
              style={{ borderColor: "var(--border)", color: "var(--text2)" }}
              disabled={!brief || loading}
              onClick={handleDownload}
            >
              <Download size={13} />
              Download
            </Button>
            <div className="ml-auto flex items-center gap-3 text-[11px]" style={{ color: "var(--text2)" }}>
              {nodeCount > 0 && (
                <>
                  <span>{nodeCount} memories</span>
                  {edgeCount > 0 && <span>{edgeCount} connections</span>}
                  <span>~{tokenEst.toLocaleString()} tokens</span>
                </>
              )}
            </div>
          </div>

          {/* Output preview */}
          <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
            {loading ? (
              <div className="flex flex-col items-center gap-3 py-20">
                <Loader2
                  className="size-6 animate-spin"
                  style={{ color: "var(--orange)" }}
                />
                <span className="text-sm" style={{ color: "var(--text2)" }}>
                  Generating brief...
                </span>
              </div>
            ) : !brief ? (
              <div className="flex flex-col items-center gap-3 py-20">
                <Code2 size={32} style={{ color: "var(--muted)" }} />
                <p className="text-sm" style={{ color: "var(--text2)" }}>
                  {selectedVaults.size === 0
                    ? "Select at least one vault to generate a brief"
                    : "No memories match the selected filters"}
                </p>
              </div>
            ) : isCode ? (
              <pre
                className="whitespace-pre-wrap break-words rounded-lg border p-4 font-mono text-xs leading-relaxed"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                }}
              >
                {brief}
              </pre>
            ) : (
              <div
                className="whitespace-pre-wrap break-words rounded-lg border p-4 text-sm leading-relaxed"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg2)",
                  color: "var(--text)",
                }}
              >
                {brief}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
