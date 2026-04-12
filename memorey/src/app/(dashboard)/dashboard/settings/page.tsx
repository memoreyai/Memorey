"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Copy, Download, LogOut, ExternalLink } from "lucide-react";
import type { CategoryVault } from "@/types/memorey";
import { useExportPanelStore } from "@/store/exportPanelStore";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useTrack } from "@/hooks/useTrack";

type Summary = {
  plan: string;
  memoryCount: number;
  memoryLimit: number | null;
  shareLinksThisMonth: number;
  shareLinkLimit: number | null;
  chatQueriesThisMonth: number;
  chatQueryLimit: number | null;
  activeVaults: number;
  activeVaultLimit: number | null;
  hasBillingCustomer: boolean;
};

export default function DashboardSettingsPage() {
  const router = useRouter();
  const { track } = useTrack();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [vaults, setVaults] = useState<CategoryVault[]>([]);
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [billingLoading, setBillingLoading] = useState<string | null>(null);
  const [vaultBusy, setVaultBusy] = useState<string | null>(null);
  const [backupLoading, setBackupLoading] = useState(false);
  const openExportPanel = useExportPanelStore((s) => s.openExportPanel);

  const load = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const [sumRes, vaultRes] = await Promise.all([
      fetch("/api/billing/summary", { credentials: "include" }),
      supabase
        .from("category_vaults")
        .select(
          "id, user_id, name, color, is_custom, is_active, display_order"
        )
        .eq("user_id", user.id)
        .order("display_order", { ascending: true }),
    ]);

    if (sumRes.ok) {
      setSummary((await sumRes.json()) as Summary);
    }
    if (!vaultRes.error && vaultRes.data) {
      const uniqueRows = Array.from(
        new Map(vaultRes.data.map((r) => [r.id as string, r])).values()
      );
      setVaults(
        uniqueRows.map((r) => ({
          id: r.id,
          userId: r.user_id,
          name: r.name,
          color: r.color ?? "#5DCAA5",
          isCustom: Boolean(r.is_custom),
          isActive: r.is_active !== false,
          displayOrder: r.display_order ?? 0,
        }))
      );
    }
  }, []);

  useEffect(() => {
    track("page_view", { page_path: "/dashboard/settings" });
  }, [track]);

  useEffect(() => {
    void load();
  }, [load]);

  const onSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    router.push("/login");
    router.refresh();
  };

  const onCheckout = async (interval: "monthly" | "yearly" = "monthly") => {
    setBillingLoading("checkout");
    try {
      const res = await fetch("/api/dodo/checkout", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else toast.error(data.error ?? "Checkout failed");
    } finally {
      setBillingLoading(null);
    }
  };

  const onPortal = async () => {
    setBillingLoading("portal");
    try {
      const res = await fetch("/api/dodo/portal", {
        method: "POST",
        credentials: "include",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
      else toast.error(data.error ?? "Could not open billing portal");
    } finally {
      setBillingLoading(null);
    }
  };

  const toggleVault = async (vaultId: string, next: boolean) => {
    setVaultBusy(vaultId);
    try {
      const res = await fetch("/api/vaults/set-active", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vaultId, isActive: next }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Could not update vault");
        return;
      }
      setVaults((vs) =>
        vs.map((v) => (v.id === vaultId ? { ...v, isActive: next } : v))
      );
      toast.success(next ? "Vault activated" : "Vault deactivated");
      void load();
    } finally {
      setVaultBusy(null);
    }
  };

  const onDeleteAll = async () => {
    if (deleteConfirm !== "DELETE") {
      toast.error("Type DELETE to confirm.");
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/user/delete-all-data", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE" }),
      });
      if (!res.ok) {
        const j = (await res.json()) as { error?: string };
        toast.error(j.error ?? "Delete failed");
        return;
      }
      toast.success("All memory data removed.");
      setDeleteConfirm("");
      window.location.href = "/dashboard";
    } finally {
      setDeleting(false);
    }
  };

  const pro = summary?.plan === "pro";

  const onFullBackup = async () => {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!session?.access_token || !user) {
      toast.error("Sign in again.");
      return;
    }
    const { data: vaultRows, error } = await supabase
      .from("category_vaults")
      .select("id")
      .eq("user_id", user.id);
    if (error || !vaultRows?.length) {
      toast.error("No vaults to export.");
      return;
    }
    setBackupLoading(true);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: user.id,
          vaultIds: vaultRows.map((r) => r.id as string),
          format: "json",
          includeConfidence: true,
          maxNodes: 500,
        }),
      });
      const data = (await res.json()) as {
        content?: string;
        filename?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Backup failed");
        return;
      }
      const blob = new Blob([data.content ?? ""], {
        type: "application/json;charset=utf-8",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = data.filename ?? "memorey-backup.json";
      a.click();
      URL.revokeObjectURL(a.href);
      toast.success("Full backup downloaded");
    } finally {
      setBackupLoading(false);
    }
  };

  const muted = "var(--text2)";
  const micro = "var(--muted)";

  return (
    <div
      className="mx-auto max-w-2xl space-y-6 p-4 pb-16 md:p-5 md:pb-20"
      style={{
        backgroundColor: "var(--bg)",
        color: "var(--text)",
        minHeight: "100%",
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[13px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
            Settings
          </h1>
          <p className="mt-1 text-[13px] leading-[1.4]" style={{ color: muted }}>
            Plan, usage, vaults, and data.
          </p>
        </div>
        <ThemeToggle />
      </div>

      <div className="memorey-data-panel">
        <div className="memorey-data-panel-header">Account</div>
        <div className="memorey-data-row flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-[13px] leading-[1.4]" style={{ color: muted }}>
            End your session on this device.
          </span>
          <Button
            type="button"
            variant="outline"
            className="h-8 w-full shrink-0 border-[var(--border2)] bg-transparent text-[13px] sm:w-auto"
            onClick={() => void onSignOut()}
          >
            <LogOut className="mr-2 size-3.5" />
            Sign out
          </Button>
        </div>
      </div>

      <div className="memorey-data-panel">
        <div className="memorey-data-panel-header">Plan &amp; billing</div>
        <div className="memorey-data-row flex-wrap">
          <span className="text-[11px] uppercase tracking-[0.06em]" style={{ color: micro }}>
            Status
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant="outline"
              className={
                pro
                  ? "rounded-[var(--r-button)] border-[var(--border2)] text-[11px] text-[var(--text)]"
                  : "rounded-[var(--r-button)] border-[var(--border2)] text-[11px]"
              }
              style={pro ? { background: "var(--bg4)" } : { color: muted }}
            >
              {pro ? "Pro" : "Free"}
            </Badge>
          </div>
        </div>
        {summary ? (
          <div
            className="border-b border-[var(--border)] px-[14px] py-2.5 text-[13px] leading-[1.4]"
            style={{ color: muted }}
          >
            {pro
              ? "Unlimited memories, imports, and search."
              : `${summary.memoryCount} / ${summary.memoryLimit ?? "∞"} memories · ${summary.shareLinksThisMonth} / ${summary.shareLinkLimit ?? "∞"} link imports / mo · ${summary.chatQueriesThisMonth} / ${summary.chatQueryLimit ?? "∞"} searches / mo`}
          </div>
        ) : null}
        <div
          style={{
            fontSize: 12,
            color: "var(--text2)",
            lineHeight: 1.7,
            padding: "12px 16px",
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-md)",
            marginTop: 12,
          }}
        >
          <strong style={{ color: "var(--text)" }}>
            If you cancel Pro:
          </strong>{" "}
          your account moves to the free plan immediately. All your memories
          stay — nothing is deleted. You keep access to everything you saved.
          You can re-subscribe at any time and pick up where you left off.
        </div>
        <div className="border-t border-[var(--border)] px-[14px] py-2.5">
          <span className="text-[12px]" style={{ color: muted }}>
            Pro plan upgrade coming soon.
          </span>
        </div>
        {/* TODO: restore once Dodo Payments keys are configured
        <div className="flex flex-wrap gap-2 border-t border-[var(--border)] px-[14px] py-2.5">
          {!pro ? (
            <>
              <Button
                className="h-7 bg-[var(--orange)] text-[13px] text-white hover:bg-[var(--orange)]/90"
                disabled={billingLoading !== null}
                onClick={() => void onCheckout("monthly")}
              >
                {billingLoading === "checkout" ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  "Upgrade — $8/mo"
                )}
              </Button>
              <Button
                variant="outline"
                className="h-7 border-[var(--border2)] bg-transparent text-[13px]"
                disabled={billingLoading !== null}
                onClick={() => void onCheckout("yearly")}
              >
                $79/yr (save 17%)
              </Button>
            </>
          ) : null}
          {pro && summary?.hasBillingCustomer ? (
            <Button
              variant="outline"
              className="h-7 border-[var(--border2)] bg-transparent text-[13px]"
              disabled={billingLoading !== null}
              onClick={() => void onPortal()}
            >
              {billingLoading === "portal" ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                "Manage subscription"
              )}
            </Button>
          ) : null}
        </div>
        */}
      </div>

      <div className="memorey-data-panel">
        <div className="memorey-data-panel-header">Export &amp; backup</div>
        <div
          className="border-b border-[var(--border)] px-[14px] py-2.5 text-[11px] leading-[1.45]"
          style={{ color: muted }}
        >
          Your exported data is yours. Memorey does not track what you share or
          where.
        </div>
        <div className="memorey-data-row">
          <span style={{ color: muted }}>Full backup (JSON)</span>
          <Button
            type="button"
            className="h-7 shrink-0 bg-[var(--orange)] text-[12px] text-white hover:bg-[var(--orange)]/90"
            disabled={backupLoading}
            onClick={() => void onFullBackup()}
          >
            {backupLoading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <>
                <Download className="mr-1.5 size-3.5" />
                Download
              </>
            )}
          </Button>
        </div>
        <div className="memorey-data-row">
          <span style={{ color: muted }}>AI briefing export</span>
          <Button
            type="button"
            variant="outline"
            className="h-7 shrink-0 border-[var(--border2)] bg-transparent text-[12px]"
            onClick={() => openExportPanel()}
          >
            Open panel
          </Button>
        </div>
        <div
          className="px-[14px] py-2 text-[10px] leading-[1.4]"
          style={{ color: micro }}
        >
          Full backup: all vaults (up to 500 nodes). Use briefing export to pick
          vaults and formats.
        </div>
      </div>

      <div className="memorey-data-panel">
        <div className="memorey-data-panel-header">Chrome Extension</div>
        <div
          className="border-b border-[var(--border)] px-[14px] py-2.5 text-[11px] leading-[1.45]"
          style={{ color: muted }}
        >
          Connect the Memorey Chrome extension to sync your imported memories to
          the cloud. Open the extension → Settings → paste your access token.
        </div>
        <div className="border-b border-[var(--border)] px-[14px] py-2.5">
          <div
            className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.06em]"
            style={{ color: micro }}
          >
            Access Token
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-[var(--border2)] bg-transparent text-[12px]"
            onClick={async () => {
              const supabase = createClient();
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session?.access_token) {
                toast.error("Sign in again to copy your access token.");
                return;
              }
              try {
                await navigator.clipboard.writeText(session.access_token);
                toast.success(
                  "Access token copied! Paste it in the extension → Settings → Connect."
                );
              } catch {
                toast.error("Could not copy to clipboard.");
              }
            }}
          >
            <Copy className="mr-1.5 size-3" />
            Copy Access Token
          </Button>
          <p className="mt-2 text-[10px]" style={{ color: micro }}>
            This token is tied to your current session. If the extension
            disconnects, copy a fresh token here and reconnect.
          </p>
        </div>
      </div>

      <div className="memorey-data-panel">
        <div className="memorey-data-panel-header">MCP integration</div>
        <div
          className="border-b border-[var(--border)] px-[14px] py-2.5 text-[11px] leading-[1.45]"
          style={{ color: muted }}
        >
          Connect Claude Desktop / Cursor. Use{" "}
          <code
            className="rounded-[var(--r-sm)] px-1 py-px"
            style={{ background: "var(--bg4)", fontSize: 10 }}
          >
            Authorization: Bearer &lt;token&gt;
          </code>
          . Proposals appear under{" "}
          <strong className="text-[var(--text)]">MCP proposals</strong> until
          confirmed.
        </div>
        {process.env.NEXT_PUBLIC_MCP_SERVER_URL ? (
          <div className="memorey-data-row items-start">
            <span style={{ color: muted }}>Server URL</span>
            <code
              className="max-w-[min(100%,280px)] break-all text-right text-[11px]"
              style={{ color: "var(--text)" }}
            >
              {process.env.NEXT_PUBLIC_MCP_SERVER_URL}
            </code>
          </div>
        ) : (
          <div
            className="px-[14px] py-2.5 text-[11px]"
            style={{ color: muted }}
          >
            Set{" "}
            <code className="text-[10px]">NEXT_PUBLIC_MCP_SERVER_URL</code> to
            show your MCP base URL.
          </div>
        )}
        <div className="border-t border-[var(--border)] px-[14px] py-2.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 border-[var(--border2)] bg-transparent text-[12px]"
            onClick={async () => {
              const supabase = createClient();
              const {
                data: { session },
              } = await supabase.auth.getSession();
              if (!session?.access_token) {
                toast.error("Sign in again to copy a token.");
                return;
              }
              try {
                await navigator.clipboard.writeText(session.access_token);
                toast.success(
                  "Bearer token copied. Paste into your MCP client config."
                );
              } catch {
                toast.error("Could not copy to clipboard.");
              }
            }}
          >
            <Copy className="mr-1.5 size-3" />
            Copy session token
          </Button>
          <p className="mt-2 text-[10px]" style={{ color: micro }}>
            Token matches your session; refresh when it expires.
          </p>
        </div>
      </div>

      <div className="memorey-data-panel">
        <div className="memorey-data-panel-header">Active vaults</div>
        <div
          className="border-b border-[var(--border)] px-[14px] py-2 text-[11px]"
          style={{ color: muted }}
        >
          {pro
            ? "All vaults can be active on Pro."
            : `Free: up to 3 active vaults (${summary?.activeVaults ?? "—"} active).`}
        </div>
        <div className="divide-y divide-[var(--border)]">
          {vaults.map((v) => (
            <div key={v.id} className="memorey-data-row">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ backgroundColor: v.color }}
                />
                <span className="truncate">{v.name}</span>
                {v.isCustom ? (
                  <span className="shrink-0 text-[10px]" style={{ color: micro }}>
                    custom
                  </span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 shrink-0 px-2 text-[12px] hover:bg-[var(--bg4)]"
                style={{ color: muted }}
                disabled={
                  vaultBusy === v.id ||
                  (!v.isActive && !pro && (summary?.activeVaults ?? 0) >= 3)
                }
                onClick={() => void toggleVault(v.id, !v.isActive)}
              >
                {vaultBusy === v.id ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : v.isActive ? (
                  "Deactivate"
                ) : (
                  "Activate"
                )}
              </Button>
            </div>
          ))}
        </div>
      </div>

      <div className="memorey-data-panel">
        <div className="memorey-data-panel-header">Legal</div>
        <div
          className="border-b border-[var(--border)] px-[14px] py-2.5 text-[11px] leading-[1.45]"
          style={{ color: muted }}
        >
          Review our policies that govern your use of Memorey.
        </div>
        <a
          href="/privacy"
          target="_blank"
          rel="noopener noreferrer"
          className="memorey-data-row no-underline transition-colors hover:bg-[var(--bg4)]"
          style={{ color: "var(--text)", cursor: "pointer" }}
        >
          <span className="text-[13px]">Privacy Policy</span>
          <ExternalLink className="size-3.5" style={{ color: muted }} />
        </a>
        <a
          href="/terms"
          target="_blank"
          rel="noopener noreferrer"
          className="memorey-data-row no-underline transition-colors hover:bg-[var(--bg4)]"
          style={{ color: "var(--text)", cursor: "pointer" }}
        >
          <span className="text-[13px]">Terms and Conditions</span>
          <ExternalLink className="size-3.5" style={{ color: muted }} />
        </a>
        <div
          className="px-[14px] py-2 text-[10px] leading-[1.4]"
          style={{ color: micro }}
        >
          By using Memorey you agree to our Privacy Policy and Terms and Conditions.
        </div>
      </div>

      <div
        className="memorey-data-panel border-[var(--border)]"
        style={{ background: "var(--bg2)" }}
      >
        <div
          className="memorey-data-panel-header border-[var(--border)]"
          style={{ color: "var(--destructive)" }}
        >
          Danger zone
        </div>
        <div
          className="px-[14px] py-2.5 text-[13px] leading-[1.4]"
          style={{ color: "var(--text2)" }}
        >
          This will delete all your memories, vaults, canvases, and analytics
          data. Your account and subscription will remain active. This cannot
          be undone.
        </div>
        <div className="flex flex-col gap-2 border-t border-[var(--border)] px-[14px] py-2.5 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 space-y-1">
            <label
              className="text-[10px] font-semibold uppercase tracking-[0.08em]"
              style={{ color: "var(--muted)" }}
            >
              Type DELETE to confirm
            </label>
            <Input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="h-8 rounded-[var(--r-button)] border-[var(--border2)] bg-[var(--bg)] text-[13px]"
              style={{ color: "var(--text)" }}
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            className="h-8 shrink-0"
            disabled={deleting}
            onClick={() => void onDeleteAll()}
          >
            {deleting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              "Delete all data"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
