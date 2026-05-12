import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminRevenueResponse } from "@/lib/admin/types";

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: subs, error } = await admin.from("subscriptions").select("plan");

  if (error) {
    console.error("[admin/revenue]", error);
    return NextResponse.json(
      { error: "Failed to load subscriptions" },
      { status: 500 }
    );
  }

  const users_by_plan = { free: 0, pro: 0, enterprise: 0 };
  for (const row of subs ?? []) {
    const p = (row.plan as string) ?? "free";
    if (p === "pro") users_by_plan.pro++;
    else if (p === "enterprise") users_by_plan.enterprise++;
    else users_by_plan.free++;
  }

  const mrr_estimate_usd = users_by_plan.pro * 8 + users_by_plan.enterprise * 50;
  const arr_estimate_usd = mrr_estimate_usd * 12;

  const body: AdminRevenueResponse = {
    users_by_plan,
    mrr_estimate_usd,
    arr_estimate_usd,
    billing_connected: true,
    churn_rate: null,
    ltv: null,
    notes:
      "MRR/ARR are estimates from plan counts × assumed ARPU ($8/mo Pro, $50/mo Enterprise). Subscription state is updated from Dodo webhooks; churn and LTV are not computed in-app yet.",
  };

  return NextResponse.json(body);
}
