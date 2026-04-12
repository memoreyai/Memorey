"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

import { AdminFetchError } from "@/components/admin/AdminFetchError";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { resolveAvatarUrl } from "@/lib/resolveAvatarUrl";
import type { AdminUserListItem, AdminUsersResponse } from "@/lib/admin/types";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

type SortKey = "display_name" | "node_count" | "created_at" | "last_active";

function planBadgeClass(plan: string | null) {
  const p = (plan ?? "free").toLowerCase();
  if (p === "pro")
    return "border-emerald-500/40 bg-emerald-500/15 text-emerald-300";
  if (p === "enterprise")
    return "border-sky-500/40 bg-sky-500/15 text-sky-200";
  return "border-[var(--border2)] bg-[var(--bg4)] text-[var(--text2)]";
}

function displayName(u: AdminUserListItem) {
  return u.display_name?.trim() || u.full_name?.trim() || "—";
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [plan, setPlan] = useState<string>("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<SortKey>("created_at");
  const [order, setOrder] = useState<"asc" | "desc">("desc");
  const [data, setData] = useState<AdminUsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "25");
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (plan) params.set("plan", plan);
    params.set("sort", sort);
    params.set("order", order);
    try {
      const res = await fetch(`/api/admin/users?${params}`, {
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
        setError("Failed to load users.");
        toast.error("Failed to load users");
        return;
      }
      setData(await res.json());
    } catch {
      setError("Network error.");
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, plan, sort, order]);

  useEffect(() => {
    load();
  }, [load]);

  function toggleSort(key: SortKey) {
    if (sort === key) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"));
    } else {
      setSort(key);
      setOrder(key === "display_name" ? "asc" : "desc");
    }
  }

  function SortIcon({ active }: { active: boolean }) {
    if (!active) return null;
    return order === "asc" ? (
      <ChevronUp className="inline size-3" />
    ) : (
      <ChevronDown className="inline size-3" />
    );
  }

  if (error && !data) {
    return <AdminFetchError message={error} onRetry={load} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md border-[var(--border2)] bg-[var(--bg3)]"
        />
        <select
          value={plan}
          onChange={(e) => {
            setPlan(e.target.value);
            setPage(1);
          }}
          className="h-8 rounded-[var(--r-button)] border border-[var(--border2)] bg-[var(--bg3)] px-2 text-[13px] text-[var(--text)]"
        >
          <option value="">All plans</option>
          <option value="free">Free</option>
          <option value="pro">Pro</option>
          <option value="enterprise">Enterprise</option>
        </select>
      </div>

      <Card size="sm" className="overflow-hidden">
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10" />
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[var(--text)]"
                      onClick={() => toggleSort("display_name")}
                    >
                      Name{" "}
                      <SortIcon active={sort === "display_name"} />
                    </button>
                  </TableHead>
                  <TableHead>Plan</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[var(--text)]"
                      onClick={() => toggleSort("node_count")}
                    >
                      Nodes{" "}
                      <SortIcon active={sort === "node_count"} />
                    </button>
                  </TableHead>
                  <TableHead>Edges</TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[var(--text)]"
                      onClick={() => toggleSort("created_at")}
                    >
                      Signed Up{" "}
                      <SortIcon active={sort === "created_at"} />
                    </button>
                  </TableHead>
                  <TableHead>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 font-medium hover:text-[var(--text)]"
                      onClick={() => toggleSort("last_active")}
                    >
                      Last Active{" "}
                      <SortIcon active={sort === "last_active"} />
                    </button>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading && !data ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 7 }).map((__, j) => (
                        <TableCell key={j}>
                          <div className="h-4 animate-pulse rounded bg-[var(--bg4)]" />
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : data?.users.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-[var(--text2)]"
                    >
                      No users match your filters.
                    </TableCell>
                  </TableRow>
                ) : (
                  data?.users.map((u) => {
                    const href = `/admin/users/${u.id}`;
                    return (
                      <TableRow
                        key={u.id}
                        className="cursor-pointer"
                        onClick={() => router.push(href)}
                      >
                        <TableCell>
                          <Avatar size="sm" className="size-7">
                            <AvatarImage
                              src={resolveAvatarUrl(u.avatar_url) ?? undefined}
                              alt=""
                            />
                            <AvatarFallback className="text-[10px]">
                              {displayName(u).slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                        </TableCell>
                        <TableCell className="font-medium">
                          <Link
                            href={href}
                            className="text-[var(--text)] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {displayName(u)}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-[10px] font-normal capitalize",
                              planBadgeClass(u.plan)
                            )}
                          >
                            {u.plan ?? "free"}
                          </Badge>
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {u.node_count}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {u.edge_count}
                        </TableCell>
                        <TableCell className="text-[var(--text2)]">
                          {u.created_at
                            ? format(new Date(u.created_at), "MMM d, yyyy")
                            : "—"}
                        </TableCell>
                        <TableCell className="text-[var(--text2)]">
                          {u.last_active
                            ? formatDistanceToNow(new Date(u.last_active), {
                                addSuffix: true,
                              })
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {data && (
        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-[13px] text-[var(--text2)]">
            Page {data.page} of {data.totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={data.page >= data.totalPages || loading}
              onClick={() =>
                setPage((p) => Math.min(data.totalPages, p + 1))
              }
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
