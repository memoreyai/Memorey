import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminAnalyticsOverviewResponse } from "@/lib/admin/types";

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

  const w7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const w30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { data: eventsInRange },
    { data: profilesInRange },
    { data: ev7 },
    { data: ev30 },
  ] = await Promise.all([
    admin
      .from("user_events")
      .select("user_id, event_name, created_at")
      .gte("created_at", rangeStart.toISOString())
      .lt("created_at", rangeEnd.toISOString()),
    admin
      .from("profiles")
      .select("created_at")
      .gte("created_at", rangeStart.toISOString())
      .lt("created_at", rangeEnd.toISOString()),
    admin.from("user_events").select("user_id").gte("created_at", w7),
    admin.from("user_events").select("user_id").gte("created_at", w30),
  ]);

  const dailyActiveUsers: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = utcDayStart(i);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const isoS = dayStart.toISOString();
    const isoE = dayEnd.toISOString();
    const set = new Set<string>();
    for (const e of eventsInRange ?? []) {
      const c = e.created_at as string;
      if (c >= isoS && c < isoE && e.user_id) set.add(e.user_id as string);
    }
    dailyActiveUsers.push({
      date: isoS.slice(0, 10),
      count: set.size,
    });
  }

  const weeklyActiveUsers = new Set(
    (ev7 ?? []).map((r) => r.user_id).filter(Boolean) as string[]
  ).size;
  const monthlyActiveUsers = new Set(
    (ev30 ?? []).map((r) => r.user_id).filter(Boolean) as string[]
  ).size;

  const newSignupsPerDay: { date: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dayStart = utcDayStart(i);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const isoS = dayStart.toISOString();
    const isoE = dayEnd.toISOString();
    let c = 0;
    for (const p of profilesInRange ?? []) {
      const created = p.created_at as string | null;
      if (created && created >= isoS && created < isoE) c++;
    }
    newSignupsPerDay.push({ date: isoS.slice(0, 10), count: c });
  }

  const totalEventsByName: Record<string, number> = {};
  for (const e of eventsInRange ?? []) {
    const n = e.event_name as string;
    totalEventsByName[n] = (totalEventsByName[n] ?? 0) + 1;
  }

  const body: AdminAnalyticsOverviewResponse = {
    days,
    dailyActiveUsers,
    weeklyActiveUsers,
    monthlyActiveUsers,
    newSignupsPerDay,
    totalEventsByName,
  };

  return NextResponse.json(body);
}
