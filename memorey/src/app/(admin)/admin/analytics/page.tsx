"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Bar,
  BarChart,
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
import { Button } from "@/components/ui/button";
import { labelForFeatureEvent } from "@/lib/admin/eventLabels";
import type {
  AdminAnalyticsOverviewResponse,
  AdminFeatureUsageResponse,
  AdminFunnelResponse,
} from "@/lib/admin/types";
import { cn } from "@/lib/utils";

type Range = 7 | 30 | 90;

const FUNNEL_STAGES: {
  key: keyof AdminFunnelResponse;
  label: string;
  subtitle?: string;
}[] = [
  { key: "total_signups", label: "Total Users (All Time)" },
  { key: "completed_onboarding", label: "Onboarding" },
  { key: "created_at_least_one_node", label: "First node" },
  { key: "created_five_plus_nodes", label: "5+ nodes" },
  {
    key: "active_last_7_days_rolling",
    label: "Active (Last 7 Days)",
    subtitle:
      "Rolling 7-day window, independent of time range selector",
  },
  { key: "upgraded_to_pro", label: "Pro" },
];

export default function AdminAnalyticsPage() {
  const [range, setRange] = useState<Range>(30);
  const [overview, setOverview] = useState<AdminAnalyticsOverviewResponse | null>(
    null
  );
  const [features, setFeatures] = useState<AdminFeatureUsageResponse | null>(
    null
  );
  const [funnel, setFunnel] = useState<AdminFunnelResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [r1, r2, r3] = await Promise.all([
        fetch(`/api/admin/analytics/overview?days=${range}`, {
          credentials: "include",
        }),
        fetch(`/api/admin/analytics/feature-usage?days=${range}`, {
          credentials: "include",
        }),
        fetch("/api/admin/analytics/funnel", { credentials: "include" }),
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
        setError("Failed to load analytics.");
        toast.error("Failed to load analytics");
        return;
      }
      const [j1, j2, j3] = await Promise.all([
        r1.json(),
        r2.json(),
        r3.json(),
      ]);
      setOverview(j1);
      setFeatures(j2);
      setFunnel(j3);
    } catch {
      setError("Network error.");
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !overview) {
    return <AdminFetchError message={error} onRetry={load} />;
  }

  const dauData =
    overview?.dailyActiveUsers.map((d) => ({ ...d, label: d.date.slice(5) })) ??
    [];
  const signupData =
    overview?.newSignupsPerDay.map((d) => ({ ...d, label: d.date.slice(5) })) ??
    [];

  const featureBarData = (features?.counts ?? []).map((c) => ({
    name: labelForFeatureEvent(c.event_name),
    count: c.count,
    raw: c.event_name,
  }));

  const base = funnel?.total_signups || 1;

  const avgDau =
    overview && overview.dailyActiveUsers.length > 0
      ? overview.dailyActiveUsers.reduce((a, d) => a + d.count, 0) /
        overview.dailyActiveUsers.length
      : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {([7, 30, 90] as const).map((d) => (
          <Button
            key={d}
            type="button"
            size="sm"
            variant={range === d ? "default" : "outline"}
            onClick={() => setRange(d)}
          >
            {d}d
          </Button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {loading && !overview ? (
          [1, 2, 3].map((i) => (
            <Card key={i} size="sm" className="animate-pulse">
              <CardContent className="h-24 pt-3" />
            </Card>
          ))
        ) : (
          <>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums">
                  {avgDau.toFixed(avgDau >= 10 ? 0 : 1)}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">
                  Avg. DAU (range)
                </div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums">
                  {(overview?.weeklyActiveUsers ?? 0).toLocaleString()}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">WAU</div>
              </CardContent>
            </Card>
            <Card size="sm">
              <CardContent className="pt-3">
                <div className="font-display text-2xl font-bold tabular-nums">
                  {(overview?.monthlyActiveUsers ?? 0).toLocaleString()}
                </div>
                <div className="mt-1 text-[11px] text-[var(--text2)]">MAU</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Daily active users</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading && !overview ? (
              <div className="h-full animate-pulse rounded-md bg-[var(--bg4)]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dauData}>
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

        <Card size="sm">
          <CardHeader>
            <CardTitle>New signups</CardTitle>
          </CardHeader>
          <CardContent className="h-[260px]">
            {loading && !overview ? (
              <div className="h-full animate-pulse rounded-md bg-[var(--bg4)]" />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={signupData}>
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
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Feature usage</CardTitle>
        </CardHeader>
        <CardContent className="h-[320px]">
          {loading && !features ? (
            <div className="h-full animate-pulse rounded-md bg-[var(--bg4)]" />
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                layout="vertical"
                data={featureBarData}
                margin={{ left: 8, right: 16, top: 8, bottom: 8 }}
              >
                <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
                <XAxis type="number" tick={{ fill: "var(--muted)", fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={140}
                  tick={{ fill: "var(--muted)", fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--bg4)",
                    border: "1px solid var(--border2)",
                    borderRadius: 6,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card size="sm">
        <CardHeader>
          <CardTitle>Engagement funnel</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading && !funnel ? (
            <div className="h-56 animate-pulse rounded-md bg-[var(--bg4)]" />
          ) : (
            FUNNEL_STAGES.map(({ key, label, subtitle }) => {
              const count = funnel ? (funnel[key] as number) : 0;
              const pct = base > 0 ? (count / base) * 100 : 0;
              const w = base > 0 ? (count / base) * 100 : 0;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex justify-between gap-3 text-[12px]">
                    <div className="min-w-0">
                      <div className="font-medium text-[var(--text)]">{label}</div>
                      {subtitle ? (
                        <p className="mt-0.5 max-w-md text-[10px] font-normal leading-snug text-[var(--text2)]">
                          {subtitle}
                        </p>
                      ) : null}
                    </div>
                    <span className="shrink-0 tabular-nums text-[var(--text2)]">
                      {count.toLocaleString()}{" "}
                      <span className="text-[var(--muted)]">
                        ({pct.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-8 overflow-hidden rounded-[var(--r-sm)] bg-[var(--bg4)]">
                    <div
                      className={cn(
                        "flex h-full items-center justify-end rounded-[var(--r-sm)] bg-gradient-to-r from-[var(--chart-4)]/90 to-[var(--primary)]/80 pr-2 text-[11px] font-medium text-[var(--text)] transition-all"
                      )}
                      style={{ width: `${Math.max(w, count > 0 ? 4 : 0)}%` }}
                    >
                      {count > 0 && w > 18 ? count : ""}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
