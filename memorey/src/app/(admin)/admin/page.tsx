"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { AdminFetchError } from "@/components/admin/AdminFetchError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  AdminAnalyticsOverviewResponse,
  AdminRevenueResponse,
  AdminStatsResponse,
} from "@/lib/admin/types";

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtCount(n: number | null | undefined) {
  return n != null ? n.toLocaleString() : "—";
}

function fmtPct(n: number | null | undefined) {
  return n != null ? `${n.toFixed(1)}%` : "—";
}

function StatSkeleton() {
  return (
    <Card size="sm" className="animate-pulse">
      <CardContent className="pt-3">
        <div className="h-8 w-16 rounded bg-[var(--bg4)]" />
        <div className="mt-2 h-3 w-24 rounded bg-[var(--bg4)]" />
      </CardContent>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [overview, setOverview] = useState<AdminAnalyticsOverviewResponse | null>(
    null
  );
  const [revenue, setRevenue] = useState<AdminRevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch("/api/admin/stats", { credentials: "include" }),
        fetch("/api/admin/analytics/overview?days=30", {
          credentials: "include",
        }),
        fetch("/api/admin/revenue", { credentials: "include" }),
      ]);
      if (r1.status === 401 || r2.status === 401 || r3.status === 401) {
        window.location.href = "/login";
        return;
      }
      if (r1.status === 403 || r2.status === 403 || r3.status === 403) {
        toast.error("Access denied");
        window.location.href = "/dashboard";
        return;
      }
      if (!r1.ok || !r2.ok || !r3.ok) {
        setError("Failed to load dashboard data.");
        toast.error("Failed to load dashboard data");
        return;
      }
      const [j1, j2, j3] = await Promise.all([
        r1.json(),
        r2.json(),
        r3.json(),
      ]);
      setStats(j1 as AdminStatsResponse);
      setOverview(j2 as AdminAnalyticsOverviewResponse);
      setRevenue(j3 as AdminRevenueResponse);
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

  if (error && !stats) {
    return <AdminFetchError message={error} onRetry={load} />;
  }

  const signupChartData =
    overview?.newSignupsPerDay.map((d) => ({
      ...d,
      label: d.date.slice(5),
    })) ?? [];
  const dauChartData =
    overview?.dailyActiveUsers.map((d) => ({
      ...d,
      label: d.date.slice(5),
    })) ?? [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {loading || !stats ? (
          <>
            {Array.from({ length: 6 }).map((_, i) => (
              <StatSkeleton key={i} />
            ))}
          </>
        ) : (
          <>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums text-[var(--text)]">
                  {fmtCount(stats.totalUsers)}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">
                  Total Users
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums text-[var(--text)]">
                  {fmtCount(stats.usersByPlan?.pro)}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">
                  Pro Users
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums text-[var(--text)]">
                  {fmtCount(stats.newSignups.last7Days)}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">
                  New This Week
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums text-[var(--text)]">
                  {(overview?.weeklyActiveUsers ?? 0).toLocaleString()}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">
                  Active This Week
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums text-[var(--text)]">
                  {fmtCount(stats.totals.memoryNodes)}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">
                  Total Nodes
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums text-[var(--text)]">
                  {fmtCount(stats.totals.edges)}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">
                  Total Edges
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {loading || !stats ? (
          <>
            <Card size="sm" className="animate-pulse">
              <CardContent className="h-24 pt-3" />
            </Card>
            <Card size="sm" className="animate-pulse">
              <CardContent className="h-24 pt-3" />
            </Card>
          </>
        ) : (
          <>
            <Card size="sm">
              <CardHeader className="pb-1">
                <CardTitle>Onboarding Completion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold tabular-nums">
                    {fmtPct(stats.onboardingCompletionRatePercent)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg4)]">
                  <div
                    className="h-full rounded-full bg-[var(--primary)]/80 transition-all"
                    style={{
                      width: `${Math.min(100, stats.onboardingCompletionRatePercent ?? 0)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader className="pb-1">
                <CardTitle>Conversion Rate</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="font-display text-2xl font-bold tabular-nums">
                    {fmtPct(stats.conversionRatePercent)}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg4)]">
                  <div
                    className="h-full rounded-full bg-[var(--chart-2)]/90 transition-all"
                    style={{
                      width: `${Math.min(100, stats.conversionRatePercent ?? 0)}%`,
                    }}
                  />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>New signups (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading || !overview ? (
              <div className="h-full animate-pulse rounded-md bg-[var(--bg4)]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={signupChartData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg4)",
                      border: "1px solid var(--border2)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                    labelStyle={{ color: "var(--text)" }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Daily active users (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading || !overview ? (
              <div className="h-full animate-pulse rounded-md bg-[var(--bg4)]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dauChartData}>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                  <YAxis tick={{ fill: "var(--muted)", fontSize: 10 }} width={32} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg4)",
                      border: "1px solid var(--border2)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="var(--chart-3)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {loading || !revenue ? (
          <>
            <Card size="sm" className="animate-pulse">
              <CardContent className="h-28 pt-3" />
            </Card>
            <Card size="sm" className="animate-pulse">
              <CardContent className="h-28 pt-3" />
            </Card>
          </>
        ) : (
          <>
            <Card size="sm">
              <CardHeader>
                <CardTitle>MRR</CardTitle>
                <p className="text-[11px] text-[var(--text2)]">
                  Estimates — billing pending
                </p>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold tabular-nums">
                  {formatUsd(revenue.mrr_estimate_usd)}
                </p>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardHeader>
                <CardTitle>ARR</CardTitle>
                <p className="text-[11px] text-[var(--text2)]">
                  Estimates — billing pending
                </p>
              </CardHeader>
              <CardContent>
                <p className="font-display text-3xl font-bold tabular-nums">
                  {formatUsd(revenue.arr_estimate_usd)}
                </p>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
