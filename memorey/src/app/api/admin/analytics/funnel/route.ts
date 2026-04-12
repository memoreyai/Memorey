import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminFunnelResponse } from "@/lib/admin/types";

function parseFunnelDays(searchParams: URLSearchParams): number {
  const raw = searchParams.get("days");
  if (raw === null || raw === "") return 30;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 30;
  return Math.min(n, 3650);
}

export async function GET(request: Request) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const days = parseFunnelDays(searchParams);
  const pSince = new Date(
    Date.now() - days * 24 * 60 * 60 * 1000
  ).toISOString();

  const admin = createAdminClient();
  const { data: rows, error } = await admin.rpc("admin_funnel_metrics", {
    p_since: pSince,
  });

  if (error || !rows?.length) {
    return NextResponse.json(
      { error: error?.message ?? "Funnel metrics unavailable" },
      { status: 500 }
    );
  }

  const row = rows[0];
  const body: AdminFunnelResponse = {
    total_signups: Number(row.total_signups),
    completed_onboarding: Number(row.completed_onboarding),
    created_at_least_one_node: Number(row.created_at_least_one_node),
    created_five_plus_nodes: Number(row.created_five_plus_nodes),
    used_search: Number(row.used_search),
    used_capture: Number(row.used_capture),
    active_last_7_days_rolling: Number(row.active_last_7_days_rolling),
    upgraded_to_pro: Number(row.upgraded_to_pro),
  };

  return NextResponse.json(body);
}
