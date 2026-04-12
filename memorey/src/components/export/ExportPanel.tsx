"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useExportPanelStore } from "@/store/exportPanelStore";
import type { CategoryVault, ExportFormat } from "@/types/memorey";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  AlertTriangle,
  Copy,
  Download,
  Link2,
  Loader2,
  Share2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTrack } from "@/hooks/useTrack";
import {
  buildExportContent,
  formatTextRoughPreview,
  type ExportNodeInput,
} from "@/lib/export/formatExport";

const PERSONAL_VAULT_WARNING = new Set(
  ["personal", "health"].map((s) => s.toLowerCase())
);

function vaultNeedsWarning(name: string): boolean {
  return PERSONAL_VAULT_WARNING.has(name.trim().toLowerCase());
}

const FORMAT_OPTIONS: {
  id: ExportFormat;
  label: string;
  sub: string;
}[] = [
  { id: "markdown", label: "Markdown", sub: "Best for AI chat" },
  { id: "text", label: "Plain text", sub: "Simplest paste" },
  { id: "json", label: "JSON", sub: "For developers" },
  { id: "toml", label: "TOML", sub: "For config/system prompts" },
];

async function fetchVaultCounts(
  userId: string,
  vaultIds: string[]
): Promise<Record<string, number>> {
  const supabase = createClient();
  const counts: Record<string, number> = {};
  await Promise.all(
    vaultIds.map(async (id) => {
      const { count, error } = await supabase
        .from("memory_nodes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("vault_id", id)
        .eq("is_active", true);
      counts[id] = error ? 0 : count ?? 0;
    })
  );
  return counts;
}

export function ExportPanel() {
  const open = useExportPanelStore((s) => s.open);
  const closeExportPanel = useExportPanelStore((s) => s.closeExportPanel);
  const { track } = useTrack();

  const [userId, setUserId] = useState<string | null>(null);
  const [vaults, setVaults] = useState<CategoryVault[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<ExportFormat>("markdown");
  const [previewNodes, setPreviewNodes] = useState<ExportNodeInput[]>([]);
  const [loadingVaults, setLoadingVaults] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [copying, setCopying] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [includeConfidence, setIncludeConfidence] = useState(false);
  const [piiWarningOpen, setPiiWarningOpen] = useState(false);
  const [piiWarningVaults, setPiiWarningVaults] = useState<CategoryVault[]>([]);
  const [piiStripping, setPiiStripping] = useState(false);
  const [piiDiffOpen, setPiiDiffOpen] = useState(false);
  const [piiDiffResult, setPiiDiffResult] = useState<{
    stripped: string;
    removedItems: Array<{
      type: string;
      original: string;
      replacement: string;
    }>;
  } | null>(null);
  const [originalLockedVaultContent, setOriginalLockedVaultContent] =
    useState("");
  const [piiItemsToRemove, setPiiItemsToRemove] = useState<Set<number>>(
    new Set()
  );

  useEffect(() => {
    if (piiDiffResult) {
      setPiiItemsToRemove(
        new Set(piiDiffResult.removedItems.map((_, i) => i))
      );
    }
  }, [piiDiffResult]);

  function buildFinalExport(
    original: string,
    removedItems: { original: string; replacement: string }[],
    itemsToRemove: Set<number>
  ): string {
    let result = original;
    removedItems.forEach((item, i) => {
      if (!itemsToRemove.has(i)) return;
      result = result.replaceAll(item.original, item.replacement);
    });
    return result;
  }

  const maxPreviewNodes = 100;

  const loadVaultsAndCounts = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    setLoadingVaults(true);
    try {
      const { data: rows, error } = await supabase
        .from("category_vaults")
        .select(
          "id, user_id, name, color, is_custom, is_active, display_order, pin_hash, is_locked, is_exportable"
        )
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (error || !rows) {
        setVaults([]);
        return;
      }
      type Row = (typeof rows)[number];
      const list: CategoryVault[] = rows.map((r: Row) => ({
        id: r.id,
        userId: r.user_id,
        name: r.name,
        color: r.color ?? "#5DCAA5",
        isCustom: Boolean(r.is_custom),
        isActive: r.is_active !== false,
        displayOrder: r.display_order ?? 0,
        isLocked: r.is_locked === true,
        pinHash: r.pin_hash ?? null,
        isExportable: r.is_exportable !== false,
      }));
      setVaults(list);
      const ids = list.map((v) => v.id);
      const c = await fetchVaultCounts(user.id, ids);
      setCounts(c);
      setSelectedIds(new Set(ids));
    } finally {
      setLoadingVaults(false);
    }
  }, []);

  useEffect(() => {
    if (open) void loadVaultsAndCounts();
  }, [open, loadVaultsAndCounts]);

  const vaultOrder = useMemo(
    () => vaults.map((v) => ({ id: v.id, name: v.name })),
    [vaults]
  );

  const selectedVaultOrder = useMemo(
    () => vaultOrder.filter((v) => selectedIds.has(v.id)),
    [vaultOrder, selectedIds]
  );

  const fetchPreviewNodes = useCallback(async () => {
    if (!userId || selectedIds.size === 0) {
      setPreviewNodes([]);
      return;
    }
    setLoadingPreview(true);
    try {
      const supabase = createClient();
      const { data: rows, error } = await supabase
        .from("memory_nodes")
        .select("vault_id, title, value, confidence, updated_at")
        .eq("user_id", userId)
        .in("vault_id", [...selectedIds])
        .eq("is_active", true);

      if (error || !rows) {
        setPreviewNodes([]);
        return;
      }
      type R = {
        vault_id: string;
        title: string;
        value: string;
        confidence: number;
        updated_at: string;
      };
      const nameById = new Map(vaults.map((v) => [v.id, v.name]));
      const sorted = (rows as R[]).sort((a, b) => {
        if (a.vault_id !== b.vault_id)
          return a.vault_id.localeCompare(b.vault_id);
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });
      const limited = sorted.slice(0, maxPreviewNodes);
      setPreviewNodes(
        limited.map((r) => ({
          vaultName: nameById.get(r.vault_id) ?? "Vault",
          title: r.title ?? "",
          value: r.value ?? "",
          confidence: typeof r.confidence === "number" ? r.confidence : 0,
        }))
      );
    } finally {
      setLoadingPreview(false);
    }
  }, [userId, selectedIds, vaults]);

  useEffect(() => {
    if (!open || !userId) return;
    const t = setTimeout(() => void fetchPreviewNodes(), 320);
    return () => clearTimeout(t);
  }, [open, userId, selectedIds, fetchPreviewNodes]);

  const vaultNamesIncluded = useMemo(
    () => selectedVaultOrder.map((v) => v.name),
    [selectedVaultOrder]
  );

  const excludedVaultNames = useMemo(
    () =>
      vaults
        .filter((v) => !selectedIds.has(v.id))
        .map((v) => v.name),
    [vaults, selectedIds]
  );

  const previewContent = useMemo(() => {
    if (previewNodes.length === 0) return "";
    const at = new Date();
    if (format === "text") {
      return formatTextRoughPreview(previewNodes);
    }
    return buildExportContent(
      format,
      previewNodes,
      selectedVaultOrder,
      vaultNamesIncluded,
      at,
      includeConfidence
    );
  }, [
    previewNodes,
    format,
    selectedVaultOrder,
    vaultNamesIncluded,
    includeConfidence,
  ]);

  const previewSnippet =
    previewContent.length > 400
      ? `${previewContent.slice(0, 400)}…`
      : previewContent;

  const charCount = previewContent.length;
  const tokenEst = Math.round(charCount / 4);

  const callExport = useCallback(
    async (vaultIds: string[], fmt: ExportFormat) => {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || !userId) {
        throw new Error("Sign in again.");
      }
      try {
        void fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event_name: "export_triggered",
            event_data: { format: fmt },
            page_path:
              typeof window !== "undefined"
                ? window.location.pathname
                : undefined,
          }),
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
      const res = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          vaultIds,
          format: fmt,
          includeConfidence,
          maxNodes: 500,
        }),
      });
      const data = (await res.json()) as {
        content?: string;
        filename?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Export failed");
      return data as { content: string; filename: string };
    },
    [userId, includeConfidence]
  );

  const doCopy = useCallback(
    async (vaultIds: string[]) => {
      const { content } = await callExport(vaultIds, format);
      await navigator.clipboard.writeText(content);
      toast.success(
        "Context copied — paste it into any AI chat as your first message."
      );
    },
    [callExport, format]
  );

  const onCopy = async () => {
    if (!userId || selectedIds.size === 0) {
      toast.error("Select at least one vault.");
      return;
    }
    const selectedVaultObjects = vaults.filter((v) => selectedIds.has(v.id));
    const lockedVaults = selectedVaultObjects.filter((v) => {
      if (!v.isLocked) return false;
      return typeof sessionStorage === "undefined"
        ? true
        : !sessionStorage.getItem(`vault-unlocked-${v.id}`);
    });
    if (lockedVaults.length > 0) {
      setPiiWarningVaults(lockedVaults);
      setPiiWarningOpen(true);
      return;
    }
    setCopying(true);
    try {
      await doCopy([...selectedIds]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setCopying(false);
    }
  };

  const handleStripAndExport = useCallback(async () => {
    setPiiWarningOpen(false);
    setPiiStripping(true);
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token || !userId) {
      setPiiStripping(false);
      return;
    }
    const lockedIds = piiWarningVaults.map((v) => v.id);
    try {
      const { content } = await callExport(lockedIds, format);
      setOriginalLockedVaultContent(content);
      const res = await fetch("/api/export/strip-pii", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ content }),
      });
      const data = (await res.json()) as {
        stripped?: string;
        removedItems?: Array<{
          type: string;
          original: string;
          replacement: string;
        }>;
      };
      setPiiDiffResult({
        stripped: data.stripped ?? content,
        removedItems: data.removedItems ?? [],
      });
      setPiiDiffOpen(true);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "PII stripping failed");
    } finally {
      setPiiStripping(false);
    }
  }, [piiWarningVaults, callExport, format, userId]);

  const handleExportWithoutLocked = useCallback(async () => {
    setPiiWarningOpen(false);
    const safeVaultIds = new Set(
      [...selectedIds].filter(
        (id) => !piiWarningVaults.some((v) => v.id === id)
      )
    );
    if (safeVaultIds.size === 0) {
      toast.error("No vaults left to export.");
      return;
    }
    setCopying(true);
    try {
      await doCopy([...safeVaultIds]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Copy failed");
    } finally {
      setCopying(false);
    }
  }, [selectedIds, piiWarningVaults, doCopy]);

  const onDownload = async () => {
    if (!userId || selectedIds.size === 0) {
      toast.error("Select at least one vault.");
      return;
    }
    setDownloading(true);
    try {
      const { content, filename } = await callExport(
        [...selectedIds],
        format
      );
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Download started");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const onShare = async () => {
    if (!userId || selectedIds.size === 0) {
      toast.error("Select at least one vault.");
      return;
    }
    setSharing(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token) {
        toast.error("Sign in again.");
        return;
      }
      const res = await fetch("/api/export/share", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId,
          vaultIds: [...selectedIds],
          format,
          includeConfidence,
          maxNodes: 500,
        }),
      });
      const data = (await res.json()) as {
        url?: string;
        expiresInSeconds?: number;
        error?: string;
        code?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Could not create link");
        return;
      }
      if (data.url) {
        track("share_link_created", {
          format,
          vault_count: selectedIds.size,
        });
        await navigator.clipboard.writeText(data.url);
        toast.success(
          `Link copied (expires in ${Math.floor((data.expiresInSeconds ?? 900) / 60)} min)`
        );
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Share failed");
    } finally {
      setSharing(false);
    }
  };

  const selectAll = () => setSelectedIds(new Set(vaults.map((v) => v.id)));
  const deselectAll = () => setSelectedIds(new Set());

  return (
    <Sheet open={open} onOpenChange={(o) => !o && closeExportPanel()}>
      <SheetContent
        side="right"
        className="flex w-full max-w-lg flex-col border-[var(--border2)] bg-[var(--bg3)] p-0 text-[var(--text)] sm:max-w-lg"
      >
        <SheetHeader className="border-b border-[var(--border2)] px-4 pb-3 pt-4">
          <SheetTitle className="flex items-center gap-2 text-[var(--text)]">
            <Share2 className="size-5 text-[var(--orange)]" />
            Brief an AI
          </SheetTitle>
          <p className="text-xs font-normal text-[var(--text2)]">
            Export context for ChatGPT, Claude, or any assistant.
          </p>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 py-4">
          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-[var(--text)]">
                Which context should this AI see?
              </h3>
              <div className="flex gap-2 text-xs">
                <button
                  type="button"
                  className="text-[var(--orange)] hover:underline"
                  onClick={selectAll}
                >
                  Select all
                </button>
                <span className="text-[var(--muted)]">|</span>
                <button
                  type="button"
                  className="text-[var(--text2)] hover:text-[var(--text)] hover:underline"
                  onClick={deselectAll}
                >
                  Deselect all
                </button>
              </div>
            </div>
            {loadingVaults ? (
              <div className="flex justify-center py-8">
                <Loader2 className="size-6 animate-spin text-[var(--muted)]" />
              </div>
            ) : (
              <ul className="space-y-2">
                {vaults.map((v) => {
                  const on = selectedIds.has(v.id);
                  const warn = vaultNeedsWarning(v.name);
                  return (
                    <li
                      key={v.id}
                      className={cn(
                        "flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-[var(--border2)] bg-[var(--bg2)] px-3 py-2.5 pl-2",
                        on && "ring-1 ring-[var(--orange)]/25"
                      )}
                      style={{
                        borderLeftWidth: 4,
                        borderLeftColor: v.color,
                      }}
                      onClick={() => {
                        setSelectedIds((prev) => {
                          const next = new Set(prev);
                          if (on) next.delete(v.id);
                          else next.add(v.id);
                          return next;
                        });
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedIds((prev) => {
                            const next = new Set(prev);
                            if (on) next.delete(v.id);
                            else next.add(v.id);
                            return next;
                          });
                        }
                      }}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        <span
                          className={cn(
                            "relative inline-flex h-6 w-10 shrink-0 rounded-full transition-colors",
                            on ? "bg-[var(--orange)]" : "bg-[var(--bg4)]"
                          )}
                          aria-hidden
                        >
                          <span
                            className={cn(
                              "absolute top-0.5 size-5 rounded-full bg-[var(--text)] shadow transition-transform",
                              on ? "left-4" : "left-0.5"
                            )}
                          />
                        </span>
                        <span className="truncate text-sm font-medium text-[var(--text)]">
                          {v.name}
                        </span>
                        <span className="shrink-0 text-xs text-[var(--text2)]">
                          ({counts[v.id] ?? 0} nodes)
                        </span>
                        {warn ? (
                          <Tooltip>
                            <TooltipTrigger
                              type="button"
                              className="inline-flex shrink-0 border-0 bg-transparent p-0 text-amber-500/90 hover:text-amber-400"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <AlertTriangle className="size-4" />
                            </TooltipTrigger>
                            <TooltipContent
                              side="top"
                              className="max-w-[220px] border-[var(--border2)] bg-[var(--bg3)] text-xs text-[var(--text)]"
                            >
                              Contains personal data
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-[var(--text)]">
              Format
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFormat(f.id)}
                  className={cn(
                    "rounded-xl border px-3 py-3 text-left transition-colors",
                    format === f.id
                      ? "border-[var(--orange)] bg-[var(--orange)]/10 text-[var(--text)]"
                      : "border-[var(--border2)] bg-[var(--bg2)] hover:border-[var(--border3)] text-[var(--text)]"
                  )}
                >
                  <div className="text-sm font-medium">{f.label}</div>
                  <div className="mt-0.5 text-[11px] text-[var(--text2)]">
                    {f.sub}
                  </div>
                </button>
              ))}
            </div>
            <label className="mt-3 flex cursor-pointer items-center gap-2 text-xs text-[var(--text2)]">
              <input
                type="checkbox"
                checked={includeConfidence}
                onChange={(e) => setIncludeConfidence(e.target.checked)}
                className="rounded border-[var(--border)]"
              />
              Include confidence scores (JSON / Markdown / TOML)
            </label>
          </section>

          <section>
            <h3 className="mb-2 text-sm font-medium text-[var(--text)]">
              Preview
            </h3>
            {format === "text" ? (
              <p className="mb-2 text-[11px] italic text-[var(--text2)]">
                Plain text uses AI to rewrite nodes on copy/download. Below is
                a rough preview only.
              </p>
            ) : null}
            <div className="max-h-40 overflow-auto rounded-lg border border-[var(--border2)] bg-[var(--bg2)] p-3 font-mono text-[11px] leading-relaxed text-[var(--text)]">
              {loadingPreview ? (
                <Loader2 className="size-4 animate-spin text-[var(--muted)]" />
              ) : previewSnippet ? (
                <pre className="whitespace-pre-wrap break-words">{previewSnippet}</pre>
              ) : (
                <span className="text-[var(--muted)]">
                  Select vaults with memories to preview.
                </span>
              )}
            </div>
            <p className="mt-2 text-xs text-[var(--text2)]">
              ~
              {charCount.toLocaleString()} characters · ~{tokenEst} tokens
            </p>
          </section>

          <section className="space-y-2">
            <Button
              type="button"
              className="h-12 w-full bg-[var(--orange)] text-base font-medium text-white hover:opacity-90"
              disabled={copying || selectedIds.size === 0}
              onClick={() => void onCopy()}
            >
              {copying ? (
                <Loader2 className="mr-2 size-5 animate-spin" />
              ) : (
                <Copy className="mr-2 size-5" />
              )}
              Copy to clipboard
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-10 w-full border-[var(--border2)] text-[var(--text)]"
              disabled={downloading || selectedIds.size === 0}
              onClick={() => void onDownload()}
            >
              {downloading ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Download className="mr-2 size-4" />
              )}
              Download as file
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="h-9 w-full text-[var(--text2)] hover:text-[var(--text)]"
              disabled={sharing || selectedIds.size === 0}
              onClick={() => void onShare()}
            >
              {sharing ? (
                <Loader2 className="mr-2 size-4 animate-spin" />
              ) : (
                <Link2 className="mr-2 size-4" />
              )}
              Share via link
            </Button>
          </section>
        </div>

        <div className="border-t border-[var(--border2)] px-4 py-3">
          <p className="text-[10px] leading-relaxed text-[var(--text2)]">
            Copy/download includes up to 500 active nodes from{" "}
            {vaultNamesIncluded.length
              ? vaultNamesIncluded.join(", ")
              : "no vaults selected"}
            . Preview shows {previewNodes.length} nodes.
            {excludedVaultNames.length > 0
              ? ` It will not include ${excludedVaultNames.join(", ")}.`
              : ""}
          </p>
          <p className="mt-2 text-[10px] text-[var(--muted)]">
            Your exported data is yours. Memorey does not track what you share
            or where.
          </p>
        </div>
      </SheetContent>

      {piiWarningOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 440,
              background: "var(--bg3)",
              border: "1px solid var(--border2)",
              borderRadius: 14,
              padding: 24,
              boxShadow: "var(--shadow-lg)",
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              Locked vault in export
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--text2)",
                lineHeight: 1.6,
                marginBottom: 16,
              }}
            >
              Your export includes{" "}
              <strong style={{ color: "var(--text)" }}>
                {piiWarningVaults.map((v) => v.name).join(", ")}
              </strong>{" "}
              which {piiWarningVaults.length === 1 ? "is" : "are"} locked. This
              vault may contain private information.
            </div>
            <div
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                padding: "10px 12px",
                marginBottom: 16,
                fontSize: 12,
                color: "var(--text2)",
                lineHeight: 1.6,
              }}
            >
              <strong style={{ color: "var(--orange)" }}>
                Strip PII option:
              </strong>{" "}
              Claude will scan the vault contents, remove personal information
              (names, emails, phone numbers, addresses, financial and medical
              data), and show you exactly what was removed before you confirm
              the export.
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <Button
                type="button"
                disabled={piiStripping}
                onClick={() => void handleStripAndExport()}
                className="h-10 w-full bg-[var(--orange)] font-semibold text-white hover:opacity-90"
              >
                {piiStripping ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : null}
                Strip PII and export
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-9 w-full border-[var(--border)] text-[var(--text2)]"
                onClick={() => void handleExportWithoutLocked()}
              >
                Export without locked vaults
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="h-8 w-full text-[var(--muted)]"
                onClick={() => setPiiWarningOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {piiDiffOpen && piiDiffResult && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: 520,
              maxHeight: "80vh",
              background: "var(--bg3)",
              border: "1px solid var(--border2)",
              borderRadius: 14,
              display: "flex",
              flexDirection: "column",
              boxShadow: "var(--shadow-lg)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "16px 20px",
                borderBottom: "1px solid var(--border)",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
                  marginBottom: 2,
                }}
              >
                PII removed — review before exporting
              </div>
              <div style={{ fontSize: 12, color: "var(--text2)" }}>
                {piiDiffResult.removedItems.length === 0
                  ? "No PII detected in this vault"
                  : `${piiDiffResult.removedItems.length} item${piiDiffResult.removedItems.length === 1 ? "" : "s"} removed`}
              </div>
            </div>
            {piiDiffResult.removedItems.length > 0 && (
              <div
                style={{
                  padding: "12px 20px",
                  borderBottom: "1px solid var(--border)",
                  flexShrink: 0,
                  maxHeight: 200,
                  overflowY: "auto",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: 8,
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
                    PII detected — uncheck to include in export
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() =>
                        setPiiItemsToRemove(
                          new Set(
                            piiDiffResult.removedItems.map((_, i) => i)
                          )
                        )
                      }
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Remove all
                    </button>
                    <span
                      style={{ color: "var(--border)", fontSize: 10 }}
                    >
                      ·
                    </span>
                    <button
                      type="button"
                      onClick={() => setPiiItemsToRemove(new Set())}
                      style={{
                        fontSize: 10,
                        color: "var(--muted)",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    >
                      Keep all
                    </button>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 5,
                  }}
                >
                  {piiDiffResult.removedItems.map((item, i) => {
                    const isRemoving = piiItemsToRemove.has(i);
                    return (
                      <label
                        key={i}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          padding: "6px 8px",
                          background: isRemoving
                            ? "rgba(224,92,92,0.06)"
                            : "var(--bg2)",
                          border: `1px solid ${
                            isRemoving
                              ? "rgba(224,92,92,0.2)"
                              : "var(--border)"
                          }`,
                          borderRadius: 6,
                          cursor: "pointer",
                          transition: "all 0.1s",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isRemoving}
                          onChange={() => {
                            setPiiItemsToRemove((prev) => {
                              const next = new Set(prev);
                              if (next.has(i)) next.delete(i);
                              else next.add(i);
                              return next;
                            });
                          }}
                          style={{
                            flexShrink: 0,
                            accentColor: "#E05C5C",
                          }}
                        />
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            color: isRemoving ? "#E05C5C" : "var(--text2)",
                            background: isRemoving
                              ? "rgba(224,92,92,0.12)"
                              : "var(--bg3)",
                            padding: "1px 6px",
                            borderRadius: 3,
                            textTransform: "uppercase",
                            letterSpacing: "0.05em",
                            flexShrink: 0,
                            border: `1px solid ${
                              isRemoving
                                ? "rgba(224,92,92,0.3)"
                                : "var(--border)"
                            }`,
                          }}
                        >
                          {item.type}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            color: "var(--text2)",
                            textDecoration: isRemoving
                              ? "line-through"
                              : "none",
                            opacity: isRemoving ? 0.6 : 1,
                            flex: 1,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {item.original}
                        </span>
                        {isRemoving && (
                          <>
                            <span
                              style={{
                                color: "var(--muted)",
                                fontSize: 11,
                                flexShrink: 0,
                              }}
                            >
                              →
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: "#5DCAA5",
                                flexShrink: 0,
                                fontFamily: "var(--font-mono)",
                              }}
                            >
                              {item.replacement}
                            </span>
                          </>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                padding: "12px 20px",
              }}
            >
              <div
                style={{
                  fontSize: 11,
                  color: "var(--text2)",
                  marginBottom: 6,
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color:
                      piiItemsToRemove.size > 0 ? "#E05C5C" : "#5DCAA5",
                    background:
                      piiItemsToRemove.size > 0
                        ? "rgba(224,92,92,0.1)"
                        : "rgba(93,202,165,0.1)",
                    padding: "1px 7px",
                    borderRadius: 100,
                    border: `1px solid ${
                      piiItemsToRemove.size > 0
                        ? "rgba(224,92,92,0.25)"
                        : "rgba(93,202,165,0.25)"
                    }`,
                  }}
                >
                  {piiItemsToRemove.size} item
                  {piiItemsToRemove.size === 1 ? "" : "s"} removed
                </span>
                {piiDiffResult.removedItems.length - piiItemsToRemove.size >
                  0 && (
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--muted)",
                    }}
                  >
                    ·{" "}
                    {piiDiffResult.removedItems.length - piiItemsToRemove.size}{" "}
                    kept in export
                  </span>
                )}
              </div>
              <textarea
                readOnly
                value={buildFinalExport(
                  originalLockedVaultContent,
                  piiDiffResult.removedItems,
                  piiItemsToRemove
                )}
                className="h-32 w-full resize-none rounded-md border border-[var(--border)] bg-[var(--bg2)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--text)] outline-none"
                style={{ boxSizing: "border-box" }}
              />
            </div>
            <div
              style={{
                padding: "12px 20px",
                borderTop: "1px solid var(--border)",
                display: "flex",
                gap: 8,
                flexShrink: 0,
              }}
            >
              <Button
                type="button"
                variant="outline"
                className="flex-1 border-[var(--border)] text-[var(--text2)]"
                onClick={() => setPiiDiffOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-[2] bg-[var(--orange)] font-semibold text-white hover:opacity-90"
                onClick={async () => {
                  const finalContent = buildFinalExport(
                    originalLockedVaultContent,
                    piiDiffResult.removedItems,
                    piiItemsToRemove
                  );
                  const removedCount = piiItemsToRemove.size;
                  const keptCount =
                    piiDiffResult.removedItems.length - removedCount;
                  setPiiDiffOpen(false);
                  await navigator.clipboard.writeText(finalContent);
                  toast.success(
                    removedCount > 0
                      ? `Exported with ${removedCount} PII item${removedCount === 1 ? "" : "s"} removed${keptCount > 0 ? `, ${keptCount} kept` : ""}`
                      : "Exported with all original data included"
                  );
                }}
              >
                Confirm and copy to clipboard
              </Button>
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
