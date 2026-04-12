import { NextResponse } from "next/server";
import { assertAdmin } from "@/lib/admin/assertAdmin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AdminActivityResponse } from "@/lib/admin/types";

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return auth.response;

  const admin = createAdminClient();
  const { data: events, error } = await admin
    .from("user_events")
    .select("id, user_id, event_name, event_data, page_path, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    console.error("[admin/activity]", error);
    return NextResponse.json(
      { error: "Failed to load activity" },
      { status: 500 }
    );
  }

  const userIds = [
    ...new Set(
      (events ?? [])
        .map((e) => e.user_id as string | null)
        .filter(Boolean) as string[]
    ),
  ];

  const profileMap = new Map<
    string,
    { display_name: string | null; avatar_url: string | null }
  >();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, display_name, avatar_url")
      .in("id", userIds);
    for (const p of profiles ?? []) {
      profileMap.set(p.id as string, {
        display_name: p.display_name as string | null,
        avatar_url: p.avatar_url as string | null,
      });
    }
  }

  const body: AdminActivityResponse = {
    events: (events ?? []).map((e) => {
      const uid = e.user_id as string | null;
      const prof = uid ? profileMap.get(uid) : undefined;
      return {
        id: e.id as string,
        user: {
          id: uid ?? "",
          display_name: prof?.display_name ?? null,
          avatar_url: prof?.avatar_url ?? null,
        },
        event_name: e.event_name as string,
        event_data: (e.event_data ?? {}) as Record<string, unknown>,
        page_path: (e.page_path as string | null) ?? null,
        created_at: e.created_at as string,
      };
    }),
  };

  return NextResponse.json(body);
}
