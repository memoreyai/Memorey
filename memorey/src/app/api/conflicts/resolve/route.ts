import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

function createUserSupabase(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    }
  );
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("Authorization");
  const bearerToken = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  let userId: string;
  let supabase: ReturnType<typeof createUserSupabase>;

  if (bearerToken) {
    supabase = createUserSupabase(bearerToken);
    const { data, error } = await supabase.auth.getUser(bearerToken);
    if (error || !data.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = data.user.id;
  } else {
    const serverClient = await createServerClient();
    const { data } = await serverClient.auth.getUser();
    if (!data.user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    userId = data.user.id;
    supabase = serverClient as unknown as ReturnType<typeof createUserSupabase>;
  }

  const body = await req.json();
  const { nodeAId, nodeBId, resolution } = body as {
    nodeAId: string;
    nodeBId: string;
    resolution: "keep_a" | "keep_b" | "keep_both" | "merge";
  };

  if (!nodeAId || !nodeBId || !resolution) {
    return NextResponse.json(
      { error: "nodeAId, nodeBId, and resolution are required" },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();

  switch (resolution) {
    case "keep_a":
      await supabase
        .from("memory_nodes")
        .update({ is_active: false, updated_at: now })
        .eq("id", nodeBId)
        .eq("user_id", userId);
      break;

    case "keep_b":
      await supabase
        .from("memory_nodes")
        .update({ is_active: false, updated_at: now })
        .eq("id", nodeAId)
        .eq("user_id", userId);
      break;

    case "keep_both":
      break;

    case "merge": {
      const { data: nodeA } = await supabase
        .from("memory_nodes")
        .select("title, value")
        .eq("id", nodeAId)
        .eq("user_id", userId)
        .single();
      const { data: nodeB } = await supabase
        .from("memory_nodes")
        .select("title, value")
        .eq("id", nodeBId)
        .eq("user_id", userId)
        .single();
      if (nodeA && nodeB) {
        const merged = `${nodeA.value}\n\n${nodeB.value}`;
        await supabase
          .from("memory_nodes")
          .update({ value: merged, updated_at: now })
          .eq("id", nodeAId)
          .eq("user_id", userId);
        await supabase
          .from("memory_nodes")
          .update({ is_active: false, updated_at: now })
          .eq("id", nodeBId)
          .eq("user_id", userId);
      }
      break;
    }
  }

  const { data: nodeAData } = await supabase
    .from("memory_nodes")
    .select("title, value")
    .eq("id", nodeAId)
    .single();
  const { data: nodeBData } = await supabase
    .from("memory_nodes")
    .select("title, value")
    .eq("id", nodeBId)
    .single();

  const historyRows = [
    {
      node_id: nodeAId,
      user_id: userId,
      new_title: nodeAData?.title ?? "",
      new_value: nodeAData?.value ?? "",
      change_summary: `Conflict resolved: ${resolution}`,
      triggered_by: "user" as const,
    },
    {
      node_id: nodeBId,
      user_id: userId,
      new_title: nodeBData?.title ?? "",
      new_value: nodeBData?.value ?? "",
      change_summary: `Conflict resolved: ${resolution}`,
      triggered_by: "user" as const,
    },
  ];

  await supabase
    .from("node_history")
    .insert(historyRows)
    .then(({ error }) => {
      if (error) console.error("History insert failed:", error);
    });

  return NextResponse.json({ success: true });
}
