import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/types";
import { checkRateLimit } from "@/lib/rateLimit";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return new NextResponse(null, { status: 200 });
    }

    if (!(await checkRateLimit(`track:${user.id}`, 60, 60)).allowed) {
      return new NextResponse(null, { status: 200 });
    }

    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return new NextResponse(null, { status: 200 });
    }

    const body = raw as {
      event_name?: string;
      event_data?: unknown;
      page_path?: string;
    };
    const event_name =
      typeof body.event_name === "string" ? body.event_name.trim() : "";
    if (!event_name) {
      return new NextResponse(null, { status: 200 });
    }

    const admin = createAdminClient();
    const twoSecAgo = new Date(Date.now() - 2000).toISOString();
    const { data: dup } = await admin
      .from("user_events")
      .select("id")
      .eq("user_id", user.id)
      .eq("event_name", event_name)
      .gte("created_at", twoSecAgo)
      .limit(1)
      .maybeSingle();

    if (dup) {
      return new NextResponse(null, { status: 200 });
    }

    let event_data: Json = {};
    if (
      body.event_data !== undefined &&
      body.event_data !== null &&
      typeof body.event_data === "object" &&
      !Array.isArray(body.event_data)
    ) {
      event_data = body.event_data as Json;
    }

    const page_path =
      typeof body.page_path === "string" ? body.page_path : null;

    await admin.from("user_events").insert({
      user_id: user.id,
      event_name,
      event_data,
      page_path,
    });
  } catch {
    /* fire-and-forget: never block UI */
  }

  return new NextResponse(null, { status: 200 });
}
