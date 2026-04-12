import { NextRequest, NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import { escapeIlikePattern } from "@/lib/admin/escapeIlike";
import type { AdminUserListItem, AdminUsersResponse } from "@/lib/admin/types";

const SORT_WHITELIST = new Set([
  "created_at",
  "display_name",
  "full_name",
  "node_count",
  "edge_count",
  "vault_count",
  "last_active",
  "plan",
]);

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

export async function GET(request: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
  const limit = Math.min(
    100,
    Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10) || 25)
  );
  const search = (searchParams.get("search") ?? "").trim();
  const planFilter = (searchParams.get("plan") ?? "").trim().toLowerCase();
  const sort =
    searchParams.get("sort") && SORT_WHITELIST.has(searchParams.get("sort")!)
      ? searchParams.get("sort")!
      : "created_at";
  const order = searchParams.get("order") === "asc" ? "asc" : "desc";

  const admin = createAdminClient();

  // Fetch profiles with subscription join
  let profileQuery = admin.from("profiles").select(`
      id,
      display_name,
      full_name,
      avatar_url,
      segment,
      created_at,
      onboarding_completed,
      subscriptions ( plan )
    `);

  if (search) {
    const e = escapeIlikePattern(search);
    profileQuery = profileQuery.or(
      `display_name.ilike.%${e}%,full_name.ilike.%${e}%`
    );
  }

  // Fetch profiles and aggregated counts in parallel
  const [{ data: profileRows, error: profErr }, { data: countRows, error: countErr }] =
    await Promise.all([
      profileQuery,
      admin.rpc("admin_user_list_counts"),
    ]);

  if (profErr || countErr) {
    console.error("[admin/users]", profErr ?? countErr);
    return NextResponse.json(
      { error: "Failed to load users" },
      { status: 500 }
    );
  }

  // Build a lookup map from the RPC results
  const countsMap = new Map<
    string,
    { node_count: number; edge_count: number; vault_count: number; last_active: string | null }
  >();
  for (const r of countRows ?? []) {
    countsMap.set(r.user_id as string, {
      node_count: Number(r.node_count) || 0,
      edge_count: Number(r.edge_count) || 0,
      vault_count: Number(r.vault_count) || 0,
      last_active: (r.last_active as string) ?? null,
    });
  }

  const profiles = profileRows ?? [];
  const filtered = planFilter
    ? profiles.filter((p) => planFromRow(p as never) === planFilter)
    : profiles;

  const items: AdminUserListItem[] = filtered.map((row) => {
    const id = row.id as string;
    const counts = countsMap.get(id);
    return {
      id,
      display_name: row.display_name as string | null,
      full_name: row.full_name as string | null,
      avatar_url: row.avatar_url as string | null,
      segment: row.segment as string | null,
      created_at: row.created_at as string | null,
      onboarding_completed: row.onboarding_completed as boolean,
      plan: planFromRow(row as never),
      node_count: counts?.node_count ?? 0,
      edge_count: counts?.edge_count ?? 0,
      vault_count: counts?.vault_count ?? 0,
      last_active: counts?.last_active ?? null,
    };
  });

  const dir = order === "asc" ? 1 : -1;
  items.sort((a, b) => {
    let cmp = 0;
    switch (sort) {
      case "display_name":
        cmp = (a.display_name ?? "").localeCompare(b.display_name ?? "");
        break;
      case "full_name":
        cmp = (a.full_name ?? "").localeCompare(b.full_name ?? "");
        break;
      case "node_count":
        cmp = a.node_count - b.node_count;
        break;
      case "edge_count":
        cmp = a.edge_count - b.edge_count;
        break;
      case "vault_count":
        cmp = a.vault_count - b.vault_count;
        break;
      case "plan":
        cmp = (a.plan ?? "").localeCompare(b.plan ?? "");
        break;
      case "last_active": {
        const ta = a.last_active ?? "";
        const tb = b.last_active ?? "";
        if (!ta && !tb) cmp = 0;
        else if (!ta) cmp = 1;
        else if (!tb) cmp = -1;
        else cmp = ta.localeCompare(tb);
        break;
      }
      case "created_at":
      default:
        cmp = (a.created_at ?? "").localeCompare(b.created_at ?? "");
        break;
    }
    return cmp * dir;
  });

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const slice = items.slice((page - 1) * limit, page * limit);

  const body: AdminUsersResponse = {
    users: slice,
    total,
    page,
    limit,
    totalPages,
  };

  return NextResponse.json(body);
}
