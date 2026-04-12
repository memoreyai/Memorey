import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminUserDetailResponse } from "@/lib/admin/types";

function planFromRow(row: {
  subscriptions:
    | { plan: string | null }
    | { plan: string | null }[]
    | null;
}): string {
  const s = row.subscriptions;
  if (!s) return "free";
  if (Array.isArray(s)) return s[0]?.plan ?? "free";
  return s.plan ?? "free";
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const { id } = await context.params;
  const admin = createAdminClient();

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select(
      `
      id,
      display_name,
      full_name,
      avatar_url,
      segment,
      created_at,
      onboarding_completed,
      subscriptions ( plan )
    `
    )
    .eq("id", id)
    .maybeSingle();

  if (pErr || !profile) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const [
    { count: nodeCount },
    { count: edgeCount },
    { count: vaultCount },
    { data: canvases },
    { data: vaults },
    { data: usage },
    { count: pendingCount },
    { count: attachmentCount },
    { data: recentEvents },
    { data: eventRows },
    { data: nodeUpdates },
    { data: canvasNodeCountRows },
    { data: vaultNodeCountRows },
  ] = await Promise.all([
    admin
      .from("memory_nodes")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id)
      .eq("is_active", true),
    admin
      .from("node_edges")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id),
    admin
      .from("category_vaults")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id),
    admin
      .from("canvases")
      .select("id, name, emoji")
      .eq("user_id", id)
      .eq("is_active", true),
    admin
      .from("category_vaults")
      .select("id, name, color")
      .eq("user_id", id),
    admin
      .from("user_monthly_usage")
      .select("year_month, share_link_count, chat_query_count, updated_at")
      .eq("user_id", id)
      .order("year_month", { ascending: false })
      .limit(3),
    admin
      .from("pending_proposals")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id)
      .eq("status", "pending"),
    admin
      .from("node_attachments")
      .select("*", { count: "exact", head: true })
      .eq("user_id", id),
    admin
      .from("user_events")
      .select("id, event_name, event_data, page_path, created_at")
      .eq("user_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    admin.from("user_events").select("created_at").eq("user_id", id),
    admin
      .from("memory_nodes")
      .select("updated_at")
      .eq("user_id", id)
      .eq("is_active", true),
    admin.rpc("admin_memory_node_counts_by_canvas", { p_user_id: id }),
    admin.rpc("admin_memory_node_counts_by_vault", { p_user_id: id }),
  ]);

  let lastEv: string | null = null;
  for (const r of eventRows ?? []) {
    const c = r.created_at as string;
    if (!lastEv || c > lastEv) lastEv = c;
  }
  let lastNu: string | null = null;
  for (const r of nodeUpdates ?? []) {
    const u = r.updated_at as string | null;
    if (!u) continue;
    if (!lastNu || u > lastNu) lastNu = u;
  }
  let last_active: string | null = null;
  if (lastEv && lastNu) last_active = lastEv > lastNu ? lastEv : lastNu;
  else last_active = lastEv ?? lastNu;

  const canvasList = canvases ?? [];
  const canvasCountById = new Map(
    (canvasNodeCountRows ?? []).map((r) => [
      r.canvas_id as string,
      Number(r.node_count),
    ])
  );
  const canvasNodeCounts = canvasList.map((c) => ({
    id: c.id as string,
    name: c.name as string,
    emoji: (c.emoji as string | null) ?? null,
    node_count: canvasCountById.get(c.id as string) ?? 0,
  }));

  const vaultList = vaults ?? [];
  const vaultCountById = new Map(
    (vaultNodeCountRows ?? []).map((r) => [
      r.vault_id as string,
      Number(r.node_count),
    ])
  );
  const vaultNodeCounts = vaultList.map((v) => ({
    id: v.id as string,
    name: v.name as string,
    color: (v.color as string | null) ?? null,
    node_count: vaultCountById.get(v.id as string) ?? 0,
  }));

  const body: AdminUserDetailResponse = {
    id: profile.id as string,
    display_name: profile.display_name as string | null,
    full_name: profile.full_name as string | null,
    avatar_url: profile.avatar_url as string | null,
    segment: profile.segment as string | null,
    created_at: profile.created_at as string | null,
    onboarding_completed: profile.onboarding_completed as boolean,
    plan: planFromRow(profile as never),
    node_count: nodeCount ?? 0,
    edge_count: edgeCount ?? 0,
    vault_count: vaultCount ?? 0,
    last_active,
    canvases: canvasNodeCounts,
    vaults: vaultNodeCounts,
    usage_last_3_months: (usage ?? []).map((u) => ({
      year_month: u.year_month as string,
      share_link_count: u.share_link_count as number,
      chat_query_count: u.chat_query_count as number,
      updated_at: u.updated_at as string,
    })),
    pending_proposal_count: pendingCount ?? 0,
    attachment_count: attachmentCount ?? 0,
    recent_events: (recentEvents ?? []).map((e) => ({
      id: e.id as string,
      event_name: e.event_name as string,
      event_data: (e.event_data ?? {}) as Record<string, unknown>,
      page_path: (e.page_path as string | null) ?? null,
      created_at: e.created_at as string,
    })),
  };

  return NextResponse.json(body);
}
