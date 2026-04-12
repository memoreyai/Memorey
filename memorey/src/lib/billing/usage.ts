import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { currentYearMonth, isProPlan } from "./limits";

export async function getEffectivePlan(
  admin: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  if (sub?.plan && isProPlan(sub.plan as string)) return sub.plan as string;
  return "free";
}

export async function ensureSubscriptionRow(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    await admin.from("subscriptions").insert({ user_id: userId, plan: "free" });
  }
}

export async function getMonthlyUsage(
  admin: SupabaseClient,
  userId: string,
  ym: string
) {
  const { data } = await admin
    .from("user_monthly_usage")
    .select("share_link_count, chat_query_count, ai_call_count")
    .eq("user_id", userId)
    .eq("year_month", ym)
    .maybeSingle();
  return {
    shareLinkCount: data?.share_link_count ?? 0,
    chatQueryCount: data?.chat_query_count ?? 0,
    aiCallCount: data?.ai_call_count ?? 0,
  };
}

export async function incrementShareLinkUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const yearMonth = currentYearMonth();
  const { error } = await admin.rpc("increment_usage", {
    p_user_id: userId,
    p_year_month: yearMonth,
    p_field: "share_link_count",
  });
  if (error) console.error("Failed to increment share_link_count:", error.message);
}

export async function incrementChatQueryUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const yearMonth = currentYearMonth();
  const { error } = await admin.rpc("increment_usage", {
    p_user_id: userId,
    p_year_month: yearMonth,
    p_field: "chat_query_count",
  });
  if (error) console.error("Failed to increment chat_query_count:", error.message);
}

export async function incrementAiCallUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const yearMonth = currentYearMonth();
  const { error } = await admin.rpc("increment_usage", {
    p_user_id: userId,
    p_year_month: yearMonth,
    p_field: "ai_call_count",
  });
  if (error) console.error("Failed to increment ai_call_count:", error.message);
}
