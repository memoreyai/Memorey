"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

import { AdminFetchError } from "@/components/admin/AdminFetchError";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  formatEventData,
  labelForEventName,
} from "@/lib/admin/eventLabels";
import { resolveAvatarUrl } from "@/lib/resolveAvatarUrl";
import type { AdminUserDetailResponse } from "@/lib/admin/types";
import { cn } from "@/lib/utils";

function planBadgeClass(plan: string | null) {
  const p = (plan ?? "free").toLowerCase();
  if (p === "pro")
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (p === "enterprise")
    return "border-sky-500/40 bg-sky-500/15 text-sky-200";
  return "border-[var(--border2)] bg-[var(--bg4)] text-[var(--text2)]";
}

function displayName(u: AdminUserDetailResponse) {
  return u.display_name?.trim() || u.full_name?.trim() || "User";
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const id = typeof params.id === "string" ? params.id : "";
  const [user, setUser] = useState<AdminUserDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
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
      if (res.status === 404) {
        setError("User not found.");
        toast.error("User not found");
        return;
      }
      if (!res.ok) {
        setError("Failed to load user.");
        toast.error("Failed to load user");
        return;
      }
      setUser(await res.json());
    } catch {
      setError("Network error.");
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !user) {
    return <AdminFetchError message={error} onRetry={load} />;
  }

  if (loading && !user) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-32 animate-pulse rounded bg-[var(--bg4)]" />
        <div className="flex gap-4">
          <div className="size-20 animate-pulse rounded-full bg-[var(--bg4)]" />
          <div className="flex-1 space-y-2">
            <div className="h-6 w-48 animate-pulse rounded bg-[var(--bg4)]" />
            <div className="h-4 w-32 animate-pulse rounded bg-[var(--bg4)]" />
          </div>
        </div>
        <div className="h-40 animate-pulse rounded-[var(--r-card)] bg-[var(--bg3)]" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="space-y-6">
      <Link
        href="/admin/users"
        className={cn(
          buttonVariants({ variant: "ghost", size: "sm" }),
          "-ml-2 inline-flex items-center gap-1"
        )}
      >
        <ArrowLeft className="size-4" />
        Users
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
        <Avatar size="lg" className="size-20 rounded-full">
          <AvatarImage
            src={resolveAvatarUrl(user.avatar_url) ?? undefined}
            alt=""
            className="rounded-full"
          />
          <AvatarFallback className="rounded-full text-lg">
            {displayName(user).slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-semibold tracking-tight md:text-2xl">
              {displayName(user)}
            </h2>
            <Badge
              variant="outline"
              className={cn(
                "capitalize",
                planBadgeClass(user.plan)
              )}
            >
              {user.plan ?? "free"}
            </Badge>
          </div>
          <p className="text-[13px] text-[var(--text2)]">
            {user.segment ? (
              <span>Segment: {user.segment}</span>
            ) : (
              <span>No segment</span>
            )}
            {" · "}
            Signed up{" "}
            {user.created_at
              ? format(new Date(user.created_at), "MMM d, yyyy")
              : "—"}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {[
          { label: "Nodes", value: user.node_count },
          { label: "Edges", value: user.edge_count },
          { label: "Vaults", value: user.vault_count },
          { label: "Canvases", value: user.canvases.length },
          { label: "Attachments", value: user.attachment_count },
        ].map((s) => (
          <Card key={s.label} size="sm">
            <CardContent className="pt-3">
              <div className="font-display text-xl font-bold tabular-nums">
                {s.value.toLocaleString()}
              </div>
              <div className="mt-1 text-[11px] text-[var(--text2)]">
                {s.label}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card size="sm">
              <CardHeader>
                <CardTitle>Vaults</CardTitle>
              </CardHeader>
              <CardContent>
                {user.vaults.length === 0 ? (
                  <p className="text-[13px] text-[var(--text2)]">No vaults.</p>
                ) : (
                  <ul className="space-y-2">
                    {user.vaults.map((v) => (
                      <li
                        key={v.id}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span
                            className="size-2.5 shrink-0 rounded-full border border-[var(--border2)]"
                            style={{
                              background:
                                v.color && v.color.startsWith("#")
                                  ? v.color
                                  : "var(--muted)",
                            }}
                          />
                          <span className="truncate font-medium">{v.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--text2)]">
                          {v.node_count} nodes
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            <Card size="sm">
              <CardHeader>
                <CardTitle>Canvases</CardTitle>
              </CardHeader>
              <CardContent>
                {user.canvases.length === 0 ? (
                  <p className="text-[13px] text-[var(--text2)]">
                    No canvases.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {user.canvases.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center justify-between gap-2 text-[13px]"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="text-base">{c.emoji ?? "◻"}</span>
                          <span className="truncate font-medium">{c.name}</span>
                        </span>
                        <span className="shrink-0 tabular-nums text-[var(--text2)]">
                          {c.node_count} nodes
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="usage" className="mt-4">
          <Card size="sm">
            <CardContent className="px-0 pt-4">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead>Share links</TableHead>
                      <TableHead>Chat queries</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {user.usage_last_3_months.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-[var(--text2)]">
                          No usage rows yet.
                        </TableCell>
                      </TableRow>
                    ) : (
                      user.usage_last_3_months.map((row) => (
                        <TableRow key={row.year_month}>
                          <TableCell className="font-medium">
                            {row.year_month}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {row.share_link_count}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {row.chat_query_count}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <Card size="sm">
            <CardContent className="space-y-4 pt-4">
              {user.recent_events.length === 0 ? (
                <p className="text-[13px] text-[var(--text2)]">No events.</p>
              ) : (
                <ul className="space-y-4">
                  {user.recent_events.map((ev) => (
                    <li
                      key={ev.id}
                      className="border-b border-[var(--border)] pb-4 last:border-0 last:pb-0"
                    >
                      <div className="text-[13px] font-medium text-[var(--text)]">
                        {labelForEventName(ev.event_name)}
                      </div>
                      {Object.keys(ev.event_data ?? {}).length > 0 && (
                        <pre className="mt-1 max-h-24 overflow-auto rounded-md bg-[var(--bg4)] p-2 font-mono text-[10px] text-[var(--text2)]">
                          {formatEventData(ev.event_data)}
                        </pre>
                      )}
                      <div className="mt-1 text-[11px] text-[var(--text2)]">
                        {format(new Date(ev.created_at), "MMM d, yyyy HH:mm")}{" "}
                        ·{" "}
                        {formatDistanceToNow(new Date(ev.created_at), {
                          addSuffix: true,
                        })}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
