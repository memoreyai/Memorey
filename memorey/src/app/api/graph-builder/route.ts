import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import { graphBuilderBodySchema } from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
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

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get("Authorization") ?? "")
      .replace("Bearer ", "")
      .trim();
    if (!token) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseAuth = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authErr,
    } = await supabaseAuth.auth.getUser(token);
    if (authErr || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await checkRateLimit(`graph-builder:${user.id}`, 10, 60)).allowed) {
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

    const parsed = graphBuilderBodySchema.safeParse(raw);
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
            error: `Free plan allows ${FREE_AI_CALLS_PER_MONTH} AI calls per month. Upgrade to Pro for unlimited.`,
            code: "AI_CALL_LIMIT",
          },
          { status: 403 }
        );
      }
    }

    const { vaults } = parsed.data;
    const anthropicMessages =
      parsed.data.messages && parsed.data.messages.length > 0
        ? parsed.data.messages
        : [
            {
              role: "user" as const,
              content: parsed.data.message!,
            },
          ];

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("[graph-builder] ANTHROPIC_API_KEY not set");
      return NextResponse.json({ error: "AI not configured" }, { status: 500 });
    }

    const vaultList = vaults.map((v) => `  ${v.name} (id: ${v.id})`).join("\n");

    const system = `You extract structured memories from free-form text for a personal knowledge graph.

For each distinct fact worth remembering:
- Short title (max 60 chars)
- Clear description (max 200 chars)
- Best matching vault from the list

Available vaults:
${vaultList || "  Personal"}

Return ONLY valid JSON — no markdown, no explanation:
{"nodes":[{"title":"...","value":"...","vault_name":"...","vault_id":"...","confidence":0.9}]}`;

    const anthropic = new Anthropic({ apiKey });
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2000,
      system,
      messages: anthropicMessages,
    });

    const modelText =
      response.content.find((c) => c.type === "text")?.text ?? "{}";
    const cleaned = modelText
      .replace(/^```json\s*/im, "")
      .replace(/```\s*$/im, "")
      .trim();
    const jsonStr = cleaned.match(/\{[\s\S]*\}/)?.[0] ?? "{}";

    const modelJson = JSON.parse(jsonStr) as { nodes?: unknown[] };
    const nodes = Array.isArray(modelJson.nodes) ? modelJson.nodes : [];

    const validIds = new Set(vaults.map((v) => v.id));
    const safe = nodes.map((item: unknown) => {
      const n = item as Record<string, unknown>;
      const vaultId = typeof n.vault_id === "string" ? n.vault_id : "";
      if (validIds.has(vaultId)) return n;
      const vaultName =
        typeof n.vault_name === "string" ? n.vault_name : "";
      const byName = vaults.find(
        (v) => v.name.toLowerCase() === vaultName.toLowerCase()
      );
      return {
        ...n,
        vault_id: byName?.id ?? vaults[0]?.id ?? "",
        vault_name: byName?.name ?? vaults[0]?.name ?? "",
      };
    });

    if (!isProPlan(plan)) {
      try { await incrementAiCallUsage(user.id); } catch { /* best-effort */ }
    }

    return NextResponse.json({ nodes: safe });
  } catch (err) {
    console.error("[graph-builder] error:", err);
    return NextResponse.json(
      { error: "Operation failed. Please try again." },
      { status: 500 }
    );
  }
}
