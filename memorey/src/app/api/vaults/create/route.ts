import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { vaultCreateBodySchema } from "@/lib/validation/schemas";
import { checkRateLimit } from "@/lib/rateLimit";
import { formatZodError } from "@/lib/validation/formatZodError";

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
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
      error: authError,
    } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (!(await checkRateLimit(`vaults-create:${user.id}`, 20, 60)).allowed) {
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

    const parsed = vaultCreateBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const { name, color, icon_key: iconKeyRaw } = parsed.data;
    const iconKey =
      iconKeyRaw && String(iconKeyRaw).trim()
        ? String(iconKeyRaw).trim()
        : null;

    const supabase = createClient(url, anon, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: maxRow } = await supabase
      .from("category_vaults")
      .select("display_order")
      .eq("user_id", user.id)
      .order("display_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const displayOrder =
      ((maxRow as { display_order?: number } | null)?.display_order ?? 0) + 1;

    const { data: vault, error: insertError } = await supabase
      .from("category_vaults")
      .insert({
        user_id: user.id,
        name,
        color: color || "#5DCAA5",
        icon_key: iconKey,
        is_custom: true,
        is_active: true,
        is_visible: true,
        is_exportable: true,
        display_order: displayOrder,
      })
      .select(
        "id, user_id, name, color, icon_key, is_custom, is_active, display_order, pin_hash, is_locked, is_exportable"
      )
      .single();

    if (insertError) {
      console.error("vaults/create insert:", insertError);
      return NextResponse.json(
        { error: "Operation failed. Please try again." },
        { status: 500 }
      );
    }

    try {
      const admin = createAdminClient();
      await admin.from("user_events").insert({
        user_id: user.id,
        event_name: "vault_created",
        event_data: {},
        page_path: null,
      });
    } catch {
      /* analytics best-effort */
    }

    return NextResponse.json({ vault }, { status: 201 });
  } catch (err) {
    console.error("vaults/create unexpected:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
