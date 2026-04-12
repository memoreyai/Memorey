import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FREE_ACTIVE_VAULTS_MAX, isProPlan } from "@/lib/billing/limits";
import { getEffectivePlan } from "@/lib/billing/usage";

export async function POST(request: Request) {
  try {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { vaultId?: string; isActive?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const vaultId = typeof body.vaultId === "string" ? body.vaultId : "";
  const isActive = body.isActive === true;
  if (!vaultId) {
    return NextResponse.json({ error: "vaultId required" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: vault } = await admin
    .from("category_vaults")
    .select("id, user_id")
    .eq("id", vaultId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!vault) {
    return NextResponse.json({ error: "Vault not found" }, { status: 404 });
  }

  const plan = await getEffectivePlan(admin, user.id);
  if (!isProPlan(plan) && isActive) {
    const { data: activeRows } = await admin
      .from("category_vaults")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true);
    const activeIds = new Set((activeRows ?? []).map((r) => r.id as string));
    if (!activeIds.has(vaultId) && activeIds.size >= FREE_ACTIVE_VAULTS_MAX) {
      return NextResponse.json(
        {
          error: `Free plan allows ${FREE_ACTIVE_VAULTS_MAX} active vaults. Deactivate one first.`,
          code: "VAULT_LIMIT",
        },
        { status: 403 }
      );
    }
  }

  const { error } = await admin
    .from("category_vaults")
    .update({ is_active: isActive })
    .eq("id", vaultId)
    .eq("user_id", user.id);

  if (error) {
    console.error("vault set-active:", error);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[vaults/set-active]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
