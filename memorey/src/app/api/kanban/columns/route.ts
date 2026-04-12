import { NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";
import {
  kanbanColumnCreateSchema,
  kanbanColumnPatchSchema,
} from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
import { getBearerUser, createUserSupabase } from "@/lib/api/supabaseUserClient";

export async function GET(request: Request) {
  const { user, token, error } = await getBearerUser(request);
  if (error || !user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(`kanban-columns:${user.id}`, 30, 60)).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(request.url);
  const canvasId = url.searchParams.get("canvasId");

  const supabase = createUserSupabase(token);
  let q = supabase
    .from("kanban_columns")
    .select("*")
    .eq("user_id", user.id)
    .order("display_order", { ascending: true });
  if (canvasId && canvasId !== "null") {
    q = q.eq("canvas_id", canvasId);
  }
  const { data, error: qErr } = await q;
  if (qErr) {
    console.error("[kanban/columns GET]", qErr);
    return NextResponse.json({ error: "Failed to load columns" }, { status: 500 });
  }
  return NextResponse.json({ columns: data ?? [] });
}

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
  const parsed = kanbanColumnCreateSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 }
    );
  }
  const { name, color, canvasId } = parsed.data;

  const supabase = createUserSupabase(token);

  let maxOrder = -1;
  let maxQ = supabase
    .from("kanban_columns")
    .select("display_order")
    .eq("user_id", user.id)
    .order("display_order", { ascending: false })
    .limit(1);
  if (canvasId) {
    maxQ = maxQ.eq("canvas_id", canvasId);
  } else {
    maxQ = maxQ.is("canvas_id", null);
  }
  const { data: maxRows } = await maxQ.maybeSingle();
  if (maxRows && typeof maxRows.display_order === "number") {
    maxOrder = maxRows.display_order;
  }

  const insert = {
    user_id: user.id,
    canvas_id: canvasId ?? null,
    name,
    color: color ?? "#5DCAA5",
    display_order: maxOrder + 1,
    is_default: false,
  };

  const { data: row, error: insErr } = await supabase
    .from("kanban_columns")
    .insert(insert)
    .select("*")
    .single();

  if (insErr || !row) {
    console.error("[kanban/columns POST]", insErr);
    return NextResponse.json({ error: "Could not create column" }, { status: 500 });
  }
  return NextResponse.json({ column: row });
}

export async function PATCH(request: Request) {
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
  const parsed = kanbanColumnPatchSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: formatZodError(parsed.error) },
      { status: 400 }
    );
  }
  const { id, name, color, display_order } = parsed.data;

  const supabase = createUserSupabase(token);
  const { data: existing, error: exErr } = await supabase
    .from("kanban_columns")
    .select("id, user_id, is_default")
    .eq("id", id)
    .single();

  if (exErr || !existing || existing.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updates: Record<string, unknown> = {};
  if (name !== undefined) updates.name = name;
  if (color !== undefined) updates.color = color;
  if (display_order !== undefined) updates.display_order = display_order;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No updates" }, { status: 400 });
  }

  const { data: row, error: upErr } = await supabase
    .from("kanban_columns")
    .update(updates)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .single();

  if (upErr || !row) {
    console.error("[kanban/columns PATCH]", upErr);
    return NextResponse.json({ error: "Could not update column" }, { status: 500 });
  }
  return NextResponse.json({ column: row });
}

export async function DELETE(request: Request) {
  const { user, token, error } = await getBearerUser(request);
  if (error || !user || !token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!(await checkRateLimit(`kanban-columns:${user.id}`, 30, 60)).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: "id query required" }, { status: 400 });
  }

  const supabase = createUserSupabase(token);
  const { data: existing, error: exErr } = await supabase
    .from("kanban_columns")
    .select("id, is_default")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (exErr || !existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (existing.is_default) {
    return NextResponse.json(
      { error: "Cannot delete a default column" },
      { status: 400 }
    );
  }

  const { error: delErr } = await supabase
    .from("kanban_columns")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (delErr) {
    console.error("[kanban/columns DELETE]", delErr);
    return NextResponse.json({ error: "Could not delete column" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
