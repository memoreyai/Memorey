"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { AdminFetchError } from "@/components/admin/AdminFetchError";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { labelForEventName } from "@/lib/admin/eventLabels";
import { resolveAvatarUrl } from "@/lib/resolveAvatarUrl";
import type { AdminActivityItem, AdminActivityResponse } from "@/lib/admin/types";

function eventDescription(item: AdminActivityItem): string {
  const base = labelForEventName(item.event_name);
  const path = item.page_path?.trim();
  if (path) return `${base} · ${path}`;
  return base;
}

export default function AdminActivityPage() {
  const [events, setEvents] = useState<AdminActivityItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/activity", {
        credentials: "include",
      });
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (res.status === 403) {
        toast.error("Access denied");
        window.location.href = "/dashboard";
        return;
      }
      if (!res.ok) {
        setError("Failed to load activity.");
        toast.error("Failed to load activity");
        return;
      }
      const data: AdminActivityResponse = await res.json();
      setEvents(data.events);
    } catch {
      setError("Network error.");
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const grouped = useMemo(() => {
    const m = new Map<string, AdminActivityItem[]>();
    for (const e of events) {
      const day = format(parseISO(e.created_at), "yyyy-MM-dd");
      const arr = m.get(day) ?? [];
      arr.push(e);
      m.set(day, arr);
    }
    const keys = [...m.keys()].sort((a, b) => b.localeCompare(a));
    return keys.map((k) => ({
      dayKey: k,
      label: format(parseISO(`${k}T12:00:00`), "EEEE, MMMM d, yyyy"),
      items: m.get(k) ?? [],
    }));
  }, [events]);

  if (error && events.length === 0) {
    return <AdminFetchError message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[13px] text-[var(--text2)]">
          Last 100 events across all users.
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => load()}
          disabled={loading}
          className="gap-1.5"
        >
          <RefreshCw
            className={`size-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Refresh
        </Button>
      </div>

      {loading && events.length === 0 ? (
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} size="sm" className="animate-pulse">
              <CardContent className="h-16" />
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-8">
          {grouped.map((g) => (
            <section key={g.dayKey}>
              <h3 className="mb-3 border-b border-[var(--border)] pb-2 font-display text-sm font-semibold text-[var(--text2)]">
                {g.label}
              </h3>
              <ul className="space-y-3">
                {g.items.map((item) => (
                  <li key={item.id}>
                    <Card size="sm">
                      <CardContent className="flex gap-3 py-3">
                        <Avatar size="sm" className="mt-0.5 size-8">
                          <AvatarImage
                            src={
                              resolveAvatarUrl(item.user.avatar_url) ?? undefined
                            }
                            alt=""
                          />
                          <AvatarFallback className="text-[10px]">
                            {(item.user.display_name ?? "?")
                              .slice(0, 2)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span className="text-[13px] font-medium text-[var(--text)]">
                              {item.user.display_name ?? "User"}
                            </span>
                            <span className="text-[12px] text-[var(--text2)]">
                              {eventDescription(item)}
                            </span>
                          </div>
                          <div className="mt-1 text-[11px] text-[var(--muted)]">
                            {formatDistanceToNow(parseISO(item.created_at), {
                              addSuffix: true,
                            })}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
