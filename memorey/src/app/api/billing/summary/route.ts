import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  FREE_ACTIVE_VAULTS_MAX,
  FREE_CHAT_QUERIES_PER_MONTH,
  FREE_MEMORY_NODE_MAX,
  FREE_SHARE_LINKS_PER_MONTH,
  currentYearMonth,
  isProPlan,
} from "@/lib/billing/limits";
import { getEffectivePlan, getMonthlyUsage } from "@/lib/billing/usage";

export async function GET() {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const plan = await getEffectivePlan(admin, user.id);
  const pro = isProPlan(plan);
  const ym = currentYearMonth();
  const usage = await getMonthlyUsage(admin, user.id, ym);

  const { count: memoryCount } = await admin
    .from("memory_nodes")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  const { count: activeVaults } = await admin
    .from("category_vaults")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("is_active", true);

  const { data: sub } = await admin
    .from("subscriptions")
    .select("dodo_customer_id, dodo_subscription_id, current_period_end")
    .eq("user_id", user.id)
    .maybeSingle();

  return NextResponse.json({
    plan: pro ? "pro" : "free",
    memoryCount: memoryCount ?? 0,
    memoryLimit: pro ? null : FREE_MEMORY_NODE_MAX,
    memoriesRemaining: pro
      ? null
      : Math.max(0, FREE_MEMORY_NODE_MAX - (memoryCount ?? 0)),
    shareLinksThisMonth: usage.shareLinkCount,
    shareLinkLimit: pro ? null : FREE_SHARE_LINKS_PER_MONTH,
    chatQueriesThisMonth: usage.chatQueryCount,
    chatQueryLimit: pro ? null : FREE_CHAT_QUERIES_PER_MONTH,
    activeVaults: activeVaults ?? 0,
    activeVaultLimit: pro ? null : FREE_ACTIVE_VAULTS_MAX,
    hasBillingCustomer: Boolean(sub?.dodo_customer_id),
    currentPeriodEnd: sub?.current_period_end ?? null,
  });
  } catch (err) {
    console.error("[billing/summary]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
