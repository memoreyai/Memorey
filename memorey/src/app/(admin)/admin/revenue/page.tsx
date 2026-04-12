"use client";

import { useCallback, useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { toast } from "sonner";

import { AdminFetchError } from "@/components/admin/AdminFetchError";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AdminRevenueResponse } from "@/lib/admin/types";

const PRO_RATE = 10;
const ENT_RATE = 50;

function formatUsd(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

export default function AdminRevenuePage() {
  const [data, setData] = useState<AdminRevenueResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/revenue", { credentials: "include" });
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
        setError("Failed to load revenue.");
        toast.error("Failed to load revenue");
        return;
      }
      setData(await res.json());
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

  if (error && !data) {
    return <AdminFetchError message={error} onRetry={load} />;
  }

  const pieData = data
    ? [
        {
          name: "Free",
          value: data.users_by_plan.free,
          fill: "var(--muted)",
        },
        {
          name: "Pro",
          value: data.users_by_plan.pro,
          fill: "var(--chart-2)",
        },
        {
          name: "Enterprise",
          value: data.users_by_plan.enterprise,
          fill: "var(--chart-4)",
        },
      ].filter((d) => d.value > 0)
    : [];

  const tiers = data
    ? [
        {
          plan: "Free",
          count: data.users_by_plan.free,
          rate: 0,
          revenue: 0,
        },
        {
          plan: "Pro",
          count: data.users_by_plan.pro,
          rate: PRO_RATE,
          revenue: data.users_by_plan.pro * PRO_RATE,
        },
        {
          plan: "Enterprise",
          count: data.users_by_plan.enterprise,
          rate: ENT_RATE,
          revenue: data.users_by_plan.enterprise * ENT_RATE,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="rounded-[var(--r-card)] border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-[13px] text-amber-100/95">
        Dodo Payments integration pending — figures are estimates based on plan
        counts and assumed pricing ($8/mo Pro, $50/mo Enterprise).
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {loading && !data ? (
          <>
            <Card size="sm" className="animate-pulse">
              <CardContent className="h-28 pt-3" />
            </Card>
            <Card size="sm" className="animate-pulse">
              <CardContent className="h-28 pt-3" />
            </Card>
          </>
        ) : (
          data && (
            <>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>MRR</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold tabular-nums">
                    {formatUsd(data.mrr_estimate_usd)}
                  </p>
                </CardContent>
              </Card>
              <Card size="sm">
                <CardHeader>
                  <CardTitle>ARR</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="font-display text-3xl font-bold tabular-nums">
                    {formatUsd(data.arr_estimate_usd)}
                  </p>
                </CardContent>
              </Card>
            </>
          )
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card size="sm">
          <CardHeader>
            <CardTitle>Users by plan</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {loading && !data ? (
              <div className="h-full animate-pulse rounded-md bg-[var(--bg4)]" />
            ) : pieData.length === 0 ? (
              <p className="flex h-full items-center justify-center text-[13px] text-[var(--text2)]">
                No subscription data.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={56}
                    outerRadius={96}
                    paddingAngle={2}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`${entry.name}-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--bg4)",
                      border: "1px solid var(--border2)",
                      borderRadius: 6,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card size="sm">
          <CardHeader>
            <CardTitle>Revenue by tier</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Plan</TableHead>
                    <TableHead>Users</TableHead>
                    <TableHead>Monthly rate</TableHead>
                    <TableHead>Monthly revenue</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading && !data ? (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <div className="h-20 animate-pulse rounded bg-[var(--bg4)]" />
                      </TableCell>
                    </TableRow>
                  ) : (
                    tiers.map((t) => (
                      <TableRow key={t.plan}>
                        <TableCell className="font-medium">{t.plan}</TableCell>
                        <TableCell className="tabular-nums">
                          {t.count.toLocaleString()}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatUsd(t.rate)}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {formatUsd(t.revenue)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Card
          size="sm"
          className="border-[var(--border)] bg-[var(--bg3)] opacity-60"
        >
          <CardHeader>
            <CardTitle className="text-[var(--text2)]">Churn Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] text-[var(--text2)]">
              Available after billing integration
            </p>
          </CardContent>
        </Card>
        <Card
          size="sm"
          className="border-[var(--border)] bg-[var(--bg3)] opacity-60"
        >
          <CardHeader>
            <CardTitle className="text-[var(--text2)]">Lifetime Value</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[13px] text-[var(--text2)]">
              Available after billing integration
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
