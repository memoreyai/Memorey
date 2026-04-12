import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rateLimit";

function extractMessageText(response: Anthropic.Message): string {
  return response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

export async function POST(request: Request) {
  try {
  const authHeader = request.headers.get("Authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const authClient = createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
    error: authErr,
  } = await authClient.auth.getUser(token);
  if (authErr || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimit(`kanban-complete:${user.id}`, 20, 60)).allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  let body: { nodeId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const nodeId = body.nodeId;
  if (!nodeId || typeof nodeId !== "string") {
    return NextResponse.json({ error: "nodeId required" }, { status: 400 });
  }

  const admin = createAdminClient();

  const { data: node, error: nErr } = await admin
    .from("memory_nodes")
    .select("id, user_id, title, value, canvas_id")
    .eq("id", nodeId)
    .eq("is_active", true)
    .single();

  if (nErr || !node || node.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const canvasId = node.canvas_id as string | null;
  if (canvasId) {
    const { data: defCols } = await admin
      .from("kanban_columns")
      .select("id, name, display_order, is_default")
      .eq("user_id", user.id)
      .eq("canvas_id", canvasId)
      .eq("is_default", true)
      .order("display_order", { ascending: true });

    let doneColumnId: string | null = null;
    const namedDone = defCols?.find((c) => c.name === "Done");
    if (namedDone) doneColumnId = namedDone.id;
    else if (defCols?.length) {
      doneColumnId = defCols[defCols.length - 1].id;
    }

    if (doneColumnId) {
      await admin
        .from("memory_nodes")
        .update({
          kanban_column_id: doneColumnId,
          kanban_status: "done",
        })
        .eq("id", nodeId)
        .eq("user_id", user.id);
    }
  }

  const { data: edges } = await admin
    .from("node_edges")
    .select("target_node_id, source_node_id")
    .eq("user_id", user.id)
    .or(`source_node_id.eq.${nodeId},target_node_id.eq.${nodeId}`);

  const linkedIds = [
    ...new Set(
      (edges ?? []).map((e) =>
        e.source_node_id === nodeId ? e.target_node_id : e.source_node_id
      )
    ),
  ];

  if (linkedIds.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  const { data: linkedNodes } = await admin
    .from("memory_nodes")
    .select("id, title, value")
    .in("id", linkedIds)
    .eq("user_id", user.id)
    .eq("is_active", true);

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json({ suggestions: [] });
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  let text = "[]";
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 500,
      messages: [
        {
          role: "user",
          content: `A task was just completed: "${node.title}" — ${node.value}

These memory nodes are linked to it:
${(linkedNodes ?? [])
  .map((n) => `- "${n.title}": ${n.value}`)
  .join("\n")}

For each linked node, suggest a brief update (max 15 words) that reflects
the task being completed. Return ONLY a JSON array:
[{ "id": "node-id", "suggestedUpdate": "updated value here" }]
Only include nodes that genuinely need updating.`,
        },
      ],
    });
    text = extractMessageText(response).trim() || "[]";
  } catch (e) {
    console.error("kanban complete AI:", e);
    return NextResponse.json({ suggestions: [] });
  }

  let suggestions: { id: string; suggestedUpdate: string }[] = [];
  try {
    const cleaned = text.replace(/```json\s*/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      suggestions = parsed.filter(
        (x: unknown) =>
          x &&
          typeof x === "object" &&
          "id" in x &&
          "suggestedUpdate" in x &&
          typeof (x as { id: unknown }).id === "string" &&
          typeof (x as { suggestedUpdate: unknown }).suggestedUpdate ===
            "string"
      ) as { id: string; suggestedUpdate: string }[];
    }
  } catch {
    suggestions = [];
  }

  return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("[kanban/complete]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
