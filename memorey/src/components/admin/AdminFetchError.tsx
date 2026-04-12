"use client";

import { Button } from "@/components/ui/button";

export function AdminFetchError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-[var(--r-card)] border border-[var(--border2)] bg-[var(--bg3)] px-6 py-10 text-center">
      <p className="text-sm text-[var(--text2)]">{message}</p>
      <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
