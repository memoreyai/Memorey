"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";

const DISMISS_KEY = "memorey_upgrade_banner_dismissed";

type Summary = {
  plan: string;
};

export function UpgradeBanner() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(sessionStorage.getItem(DISMISS_KEY) === "1");
    } catch {
      setDismissed(false);
    }
  }, []);

  const load = useCallback(async () => {
    const res = await fetch("/api/billing/summary", { credentials: "include" });
    if (!res.ok) return;
    setSummary((await res.json()) as Summary);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onDismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (dismissed || !summary || summary.plan === "pro") return null;

  return (
    <div
      className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2.5"
      style={{
        borderColor: "var(--border)",
        background: "var(--bg2)",
        color: "var(--text)",
      }}
    >
      <p className="min-w-0 text-[13px] leading-snug">
        <span className="font-medium">Upgrade to Pro</span>
        <span className="text-[var(--text2)]">
          {" "}
          — unlimited memories, imports, and search.
        </span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/dashboard/settings#plan-billing"
          className="inline-flex h-7 shrink-0 items-center justify-center rounded-[var(--r-button)] bg-[var(--orange)] px-2.5 text-[12px] font-medium text-white hover:bg-[var(--orange)]/90"
        >
          View plans
        </Link>
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-md p-1 text-[var(--text2)] hover:bg-[var(--bg3)] hover:text-[var(--text)]"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
