import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_MEMORY_NODE_MAX, isProPlan } from "@/lib/billing/limits";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  memoryNodeCreateBodySchema,
} from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";

/**
 * Supabase PostgREST runs as the user when Authorization: Bearer <access_token> is set.
 * Vault verify + insert use this client so RLS matches the browser (no service role needed).
 */
function createUserSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json(
        { error: "Missing auth token" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseAuth = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (!(await checkRateLimit(`memory-create:${user.id}`, 60, 60)).allowed) {
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

    const parsed = memoryNodeCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const body = parsed.data;
    if (body.userId !== user.id) {
      return NextResponse.json(
        { error: "User ID mismatch" },
        { status: 403 }
      );
    }

    const vaultId = body.vaultId;
    const title = body.title.trim();
    const value = (body.value ?? "").trim();
    const confidence = body.confidence;
    const source = body.source;
    const canvasId = body.canvasId ?? null;
    const analyticsSource = body.analyticsSource;
    const kanbanColumnId = body.kanbanColumnId ?? null;
    const kanbanOrder = body.kanbanOrder ?? null;
    const kanbanStatus = body.kanbanStatus ?? null;

    const supabase = createUserSupabase(token);

    const { data: vault, error: vaultError } = await supabase
      .from("category_vaults")
      .select("id")
      .eq("id", vaultId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (vaultError || !vault) {
      return NextResponse.json({ error: "Invalid vault" }, { status: 400 });
    }

    if (canvasId) {
      const { data: can, error: canErr } = await supabase
        .from("canvases")
        .select("id")
        .eq("id", canvasId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (canErr || !can) {
        return NextResponse.json({ error: "Invalid canvas" }, { status: 400 });
      }
    }

    if (kanbanColumnId) {
      if (!canvasId) {
        return NextResponse.json(
          { error: "canvasId is required when kanbanColumnId is set" },
          { status: 400 }
        );
      }
      const { data: kcol, error: kErr } = await supabase
        .from("kanban_columns")
        .select("id, canvas_id")
        .eq("id", kanbanColumnId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (kErr || !kcol || kcol.canvas_id !== canvasId) {
        return NextResponse.json(
          { error: "Invalid Kanban column for this canvas" },
          { status: 400 }
        );
      }
    }

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("plan")
      .eq("user_id", user.id)
      .maybeSingle();
    const plan =
      sub?.plan && isProPlan(sub.plan as string)
        ? (sub.plan as string)
        : "free";

    if (!isProPlan(plan)) {
      const { count } = await supabase
        .from("memory_nodes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);
      if ((count ?? 0) >= FREE_MEMORY_NODE_MAX) {
        return NextResponse.json(
          {
            error: `Free plan allows up to ${FREE_MEMORY_NODE_MAX} memories. Upgrade to Pro for unlimited.`,
            code: "MEMORY_LIMIT",
          },
          { status: 403 }
        );
      }
    }

    const { data: row, error: insertError } = await supabase
      .from("memory_nodes")
      .insert({
        user_id: user.id,
        vault_id: vaultId,
        canvas_id: canvasId,
        title,
        value,
        confidence,
        source,
        is_active: true,
        kanban_column_id: kanbanColumnId,
        kanban_order: kanbanOrder,
        kanban_status: kanbanStatus,
      })
      .select(
        "id, user_id, vault_id, title, value, confidence, source, is_active, created_at, updated_at, canvas_id, kanban_status, kanban_column_id, kanban_order"
      )
      .single();

    if (insertError) {
      console.error("memory/create insert:", insertError);
      return NextResponse.json(
        { error: "Operation failed. Please try again." },
        { status: 500 }
      );
    }

    try {
      const admin = createAdminClient();
      await admin.from("user_events").insert({
        user_id: user.id,
        event_name: "node_created",
        event_data: { source: analyticsSource ?? source },
        page_path: null,
      });
    } catch {
      /* analytics best-effort */
    }

    return NextResponse.json({ node: row }, { status: 201 });
  } catch (err) {
    console.error("Unexpected error in /api/memory/create:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
