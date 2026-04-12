import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminFeatureUsageResponse } from "@/lib/admin/types";

function utcDayStart(offsetDaysAgo: number): Date {
  const n = new Date();
  const d = new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0)
  );
  d.setUTCDate(d.getUTCDate() - offsetDaysAgo);
  return d;
}

export async function GET(request: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const days = Math.min(
    365,
    Math.max(1, parseInt(request.nextUrl.searchParams.get("days") ?? "30", 10) || 30)
  );

  const admin = createAdminClient();
  const rangeStart = utcDayStart(days - 1);
  const rangeEnd = new Date(utcDayStart(0));
  rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 1);

  const { data: rows, error } = await admin
    .from("user_events")
    .select("event_name")
    .gte("created_at", rangeStart.toISOString())
    .lt("created_at", rangeEnd.toISOString());

  if (error) {
    console.error("[admin/analytics/feature-usage]", error);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 }
    );
  }

  const map = new Map<string, number>();
  for (const r of rows ?? []) {
    const n = r.event_name as string;
    map.set(n, (map.get(n) ?? 0) + 1);
  }

  const counts = [...map.entries()]
    .map(([event_name, count]) => ({ event_name, count }))
    .sort((a, b) => b.count - a.count);

  const body: AdminFeatureUsageResponse = { days, counts };

  return NextResponse.json(body);
}
