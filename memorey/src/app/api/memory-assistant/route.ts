import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

const SYSTEM = `You are Memorey's AI memory assistant. Extract memory nodes from what the user shares about themselves.

Vault categories (plain language only — never use brain region names):
- personal: biographical facts, identity, where they live, relationships, past experiences
- work: job, career, projects, tech stack, goals, planning, tasks
- health: fitness, diet, wellness, medical, emotions, feelings
- lifestyle: hobbies, habits, routines, preferences, sports, music
- study: books, courses, knowledge, learning, facts, education
- finance: money, savings, investments, budget, income

Your response MUST be valid JSON only, no preamble, no markdown fences:
{
  "reply": "A warm 1-2 sentence response acknowledging what was shared",
  "nodes": [
    {
      "label": "Short label max 4 words",
      "vault": "one of: personal, work, health, lifestyle, study, finance",
      "detail": "Full description of the memory"
    }
  ]
}

Extract 2-6 meaningful nodes. Be specific. Never use medical/brain terminology in responses.`;

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "ANTHROPIC_API_KEY is not configured" },
        { status: 503 },
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit(`memory-assistant:${user.id}`, 20, 60)).allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    let body: { messages?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const rawMessages = body.messages;
    if (!Array.isArray(rawMessages) || rawMessages.length === 0) {
      return NextResponse.json(
        { error: "Expected non-empty messages array" },
        { status: 400 },
      );
    }

    const admin = createAdminClient();
    const plan = await getEffectivePlan(admin, user.id);
    if (!isProPlan(plan)) {
      const usage = await getMonthlyUsage(admin, user.id, currentYearMonth());
      if (usage.aiCallCount >= FREE_AI_CALLS_PER_MONTH) {
        return NextResponse.json(
          {
            error: `Free plan allows ${FREE_AI_CALLS_PER_MONTH} AI assistant calls per month. Upgrade to Pro for unlimited.`,
            code: "AI_CALL_LIMIT",
          },
          { status: 403 }
        );
      }
    }

    // Cap at 30 messages, 4000 chars each to prevent excessive token usage
    const messages = rawMessages.slice(0, 30).map((m: Record<string, unknown>) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: typeof m.content === "string" ? m.content.slice(0, 4000) : "",
    }));

    const model =
      process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        system: SYSTEM,
        messages,
      }),
    });

    if (!response.ok) {
      console.error("[memory-assistant] Anthropic error:", response.status);
      return NextResponse.json(
        { error: "AI service unavailable" },
        { status: 502 }
      );
    }

    const data: unknown = await response.json().catch(() => ({
      error: "Invalid response from Anthropic",
    }));

    if (!isProPlan(plan)) {
      try { await incrementAiCallUsage(user.id); } catch { /* best-effort */ }
    }

    return NextResponse.json(data);
  } catch (err) {
    console.error("[memory-assistant]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
