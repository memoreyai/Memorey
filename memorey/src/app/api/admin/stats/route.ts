import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminStatsResponse } from "@/lib/admin/types";

function utcStartOfToday(): Date {
  const n = new Date();
  return new Date(
    Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), 0, 0, 0, 0)
  );
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const now = Date.now();
  const startToday = utcStartOfToday();
  const d7 = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const d30 = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [
    totalUsersRes,
    subsRes,
    signupTodayRes,
    signup7Res,
    signup30Res,
    memoryNodesRes,
    edgesRes,
    vaultsRes,
    activeCountsRes,
    onboardedRes,
    nonFreeRes,
  ] = await Promise.all([
    admin.from("profiles").select("*", { count: "exact", head: true }),
    admin.from("subscriptions").select("plan"),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", startToday.toISOString()),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", d7),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .gte("created_at", d30),
    admin
      .from("memory_nodes")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
    admin.from("node_edges").select("*", { count: "exact", head: true }),
    admin.from("category_vaults").select("*", { count: "exact", head: true }),
    admin.rpc("admin_active_user_counts").single(),
    admin
      .from("profiles")
      .select("*", { count: "exact", head: true })
      .eq("onboarding_completed", true),
    admin
      .from("subscriptions")
      .select("*", { count: "exact", head: true })
      .neq("plan", "free"),
  ]);

  const totalUsers = totalUsersRes.error ? null : (totalUsersRes.count ?? 0);
  const subs = subsRes.error ? null : (subsRes.data ?? []);
  const usersByPlan =
    subs === null
      ? null
      : (() => {
          const o = { free: 0, pro: 0, enterprise: 0 };
          for (const row of subs) {
            const p = (row.plan as string) ?? "free";
            if (p === "pro") o.pro++;
            else if (p === "enterprise") o.enterprise++;
            else o.free++;
          }
          return o;
        })();

  const { data: activeCounts } = activeCountsRes;
  const active7 = activeCounts?.active_7d ?? 0;
  const active30 = activeCounts?.active_30d ?? 0;

  const memoryNodes = memoryNodesRes.error ? null : (memoryNodesRes.count ?? 0);
  const total = totalUsers;

  const averageNodesPerUser =
    total === null || memoryNodes === null
      ? null
      : total > 0
        ? memoryNodes / total
        : 0;

  const onboardingCompletionRatePercent =
    total === null || onboardedRes.error
      ? null
      : total > 0
        ? ((onboardedRes.count ?? 0) / total) * 100
        : 0;

  const conversionRatePercent =
    total === null || nonFreeRes.error
      ? null
      : total > 0
        ? ((nonFreeRes.count ?? 0) / total) * 100
        : 0;

  const body: AdminStatsResponse = {
    totalUsers,
    usersByPlan,
    newSignups: {
      today: signupTodayRes.error ? null : (signupTodayRes.count ?? 0),
      last7Days: signup7Res.error ? null : (signup7Res.count ?? 0),
      last30Days: signup30Res.error ? null : (signup30Res.count ?? 0),
    },
    totals: {
      memoryNodes,
      edges: edgesRes.error ? null : (edgesRes.count ?? 0),
      vaults: vaultsRes.error ? null : (vaultsRes.count ?? 0),
    },
    activeUsers: { last7Days: active7, last30Days: active30 },
    averageNodesPerUser,
    onboardingCompletionRatePercent,
    conversionRatePercent,
  };

  return NextResponse.json(body);
}
