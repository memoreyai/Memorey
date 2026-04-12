import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import { kanbanColumnsReorderSchema } from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
import { getBearerUser, createUserSupabase } from "@/lib/api/supabaseUserClient";

export async function POST(request: Request) {
  const { user, token, error } = await getBearerUser(request);
  if (error || !user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(`kanban-columns:${user.id}`, 30, 60)).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = kanbanColumnsReorderSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 }
    );
  }
  const { columnIds } = parsed.data;

  const supabase = createUserSupabase(token);
  const { data: rows, error: qErr } = await supabase
    .from("kanban_columns")
    .select("id, user_id")
    .in("id", columnIds);

  if (qErr || !rows || rows.length !== columnIds.length) {
    return NextResponse.json(
      { error: "One or more columns not found" },
      { status: 400 }
    );
  }
  for (const r of rows) {
    if (r.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  for (let i = 0; i < columnIds.length; i++) {
    const { error: uErr } = await supabase
      .from("kanban_columns")
      .update({ display_order: i })
      .eq("id", columnIds[i])
      .eq("user_id", user.id);
    if (uErr) {
      console.error("[kanban/columns/reorder]", uErr);
      return NextResponse.json(
        { error: "Could not reorder columns" },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
