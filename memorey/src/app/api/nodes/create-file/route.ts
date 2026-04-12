import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";
import { fileNodeCreateBodySchema } from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
import { FREE_MEMORY_NODE_MAX, isProPlan } from "@/lib/billing/limits";
import { getEffectivePlan } from "@/lib/billing/usage";

export async function POST(request: NextRequest) {
  try {
    const token = (request.headers.get("Authorization") ?? "")
      .replace("Bearer ", "")
      .trim();
    if (!token)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();
    if (authErr || !user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (!(await checkRateLimit(`create-file:${user.id}`, 30, 60)).allowed) {
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

    const parsed = fileNodeCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }
    const body = parsed.data;

    const titleRaw = body.ogTitle ?? body.fileName ?? "File";
    const title =
      titleRaw.length > 100 ? `${titleRaw.slice(0, 97)}…` : titleRaw;
    /** DB column `value` is NOT NULL; file nodes use empty string when no description. */
    const value =
      (body.ogDescription ?? "").length > 600
        ? `${(body.ogDescription ?? "").slice(0, 597)}…`
        : (body.ogDescription ?? "");

    // Free-tier node limit check
    const admin = createAdminClient();
    const plan = await getEffectivePlan(admin, user.id);
    if (!isProPlan(plan)) {
      const { count } = await admin
        .from("memory_nodes")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .eq("is_active", true);
      if ((count ?? 0) >= FREE_MEMORY_NODE_MAX) {
        return NextResponse.json(
          {
            error: `Free plan is limited to ${FREE_MEMORY_NODE_MAX} memories. Upgrade to Pro for unlimited.`,
            code: "MEMORY_LIMIT",
          },
          { status: 403 }
        );
      }
    }

    /** Omit `node_kind` / `node_kind_v2` when not present in DB; `mapNodeRow` infers file from `file_url`. */
    const baseRow = {
      user_id: user.id,
      vault_id: body.vaultId,
      canvas_id: body.canvasId ?? null,
      title,
      value,
      file_url: body.fileUrl,
      file_name: body.fileName,
      file_type: body.fileType,
      file_size: body.fileSize ?? null,
      storage_path: body.storagePath ?? null,
      thumbnail_url: body.thumbnailUrl ?? null,
      og_title: body.ogTitle ?? null,
      og_description: body.ogDescription ?? null,
      og_image: body.ogImage ?? null,
      og_site_name: body.ogSiteName ?? null,
      confidence: 1.0,
      is_active: true,
    } as const;

    // Verify vault belongs to this user
    const { data: vault, error: vaultErr } = await supabase
      .from("category_vaults")
      .select("id")
      .eq("id", body.vaultId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (vaultErr || !vault) {
      return NextResponse.json(
        { error: "Vault not found or access denied" },
        { status: 403 }
      );
    }

    /** Use `manual` so inserts succeed even when migration 016 (`canvas-drop`) is not applied yet. */
    const { data, error } = await supabase
      .from("memory_nodes")
      .insert({
        ...baseRow,
        source: "manual",
      })
      .select()
      .single();

    if (error) throw error;

    try {
      const admin = createAdminClient();
      await admin.from("user_events").insert({
        user_id: user.id,
        event_name: "node_created",
        event_data: { source: "file" },
        page_path: null,
      });
    } catch {
      /* analytics best-effort */
    }

    const base = process.env.NEXT_PUBLIC_APP_URL ?? "";
    void fetch(`${base}/api/embed`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nodeId: data.id,
        text: `${data.title} ${data.value ?? ""}`.trim(),
      }),
    }).catch(() => {});

    return NextResponse.json({ node: data });
  } catch (err) {
    console.error("[create-file-node]", err);
    return NextResponse.json(
      { error: "Operation failed. Please try again." },
      { status: 500 }
    );
  }
}
