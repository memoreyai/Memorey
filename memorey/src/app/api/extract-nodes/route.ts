import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { extractNodesFromText } from "@/lib/ai/extract";
import type { DiffProposal } from "@/types/memorey";
import { extractNodesBodySchema } from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  FREE_AI_CALLS_PER_MONTH,
  currentYearMonth,
  isProPlan,
} from "@/lib/billing/limits";
import {
  getEffectivePlan,
  getMonthlyUsage,
  incrementAiCallUsage,
} from "@/lib/billing/usage";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit(`extract-nodes:${user.id}`, 20, 60)).allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = extractNodesBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const admin = createAdminClient();
    const plan = await getEffectivePlan(admin, user.id);
    if (!isProPlan(plan)) {
      const usage = await getMonthlyUsage(admin, user.id, currentYearMonth());
      if (usage.aiCallCount >= FREE_AI_CALLS_PER_MONTH) {
        return NextResponse.json(
          {
            error: `Free plan allows ${FREE_AI_CALLS_PER_MONTH} AI extraction calls per month. Upgrade to Pro for unlimited.`,
            code: "AI_CALL_LIMIT",
          },
          { status: 403 }
        );
      }
    }

    const proposal: DiffProposal = await extractNodesFromText(parsed.data.text);

    if (!isProPlan(plan)) {
      try { await incrementAiCallUsage(user.id); } catch { /* best-effort */ }
    }

    return NextResponse.json(proposal as DiffProposal);
  } catch (err) {
    console.error("[extract-nodes]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
