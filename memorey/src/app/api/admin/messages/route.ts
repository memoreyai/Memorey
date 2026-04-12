import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> extends infer C ? C & { from: (table: string) => any } : never;

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient() as AnyClient;
  const { data, error } = await admin
    .from("contact_submissions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.error("[admin/messages] fetch error:", error);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }

  return NextResponse.json({ submissions: data ?? [] });
}

export async function PATCH(req: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status, notes } = body as Record<string, string | undefined>;
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const validStatuses = ["new", "read", "replied", "archived"];
  const updates: Record<string, string> = {};
  if (status && validStatuses.includes(status)) updates.status = status;
  if (notes !== undefined) updates.notes = notes;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const admin = createAdminClient() as AnyClient;
  const { error } = await admin
    .from("contact_submissions")
    .update(updates)
    .eq("id", id);

  if (error) {
    console.error("[admin/messages] update error:", error);
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
