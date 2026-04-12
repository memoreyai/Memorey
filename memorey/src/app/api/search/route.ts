import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import type { MemoryNode } from "@/types/memorey";
import { mapNodeRow } from "@/store/graphStore";
import {
  FREE_CHAT_QUERIES_PER_MONTH,
  currentYearMonth,
  isProPlan,
} from "@/lib/billing/limits";
import {
  getEffectivePlan,
  getMonthlyUsage,
  incrementChatQueryUsage,
} from "@/lib/billing/usage";
import { checkRateLimit } from "@/lib/rateLimit";

const SEARCH_SYSTEM = `You are answering a question about the user's personal memory graph.
Answer in 2-3 sentences using only the provided memory nodes.
Be specific and reference the actual content.
If nodes don't answer the question, say so honestly.`;

function extractMessageText(response: Anthropic.Message): string {
  const blocks = response.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

function rowToMemoryNode(
  row: Record<string, unknown>,
  vaultName: string
): MemoryNode {
  return mapNodeRow({
    ...row,
    category_vaults: { name: vaultName, color: null },
  } as never);
}

type SearchRpcRow = {
  id: string;
  vault_id: string;
  title: string;
  value: string;
  confidence: number;
  similarity: number;
};

export async function POST(request: Request) {
  try {
  const authHeader = request.headers.get("Authorization");
  const token =
    authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !anon || !serviceKey) {
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  const supabaseAuth = createClient(url, anon);
  const {
    data: { user },
    error: authError,
  } = await supabaseAuth.auth.getUser(token);

  if (authError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await checkRateLimit(`search:${user.id}`, 30, 60)).allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  let body: {
    query?: string;
    userId?: string;
    vaultIds?: string[];
    canvasId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const query = typeof body.query === "string" ? body.query.trim() : "";
  const userId = typeof body.userId === "string" ? body.userId : "";
  const vaultIdsRaw = Array.isArray(body.vaultIds) ? body.vaultIds : [];
  const rawCanvasId = body.canvasId;
  const canvasIdFilter =
    typeof rawCanvasId === "string" && rawCanvasId.trim().length > 0
      ? rawCanvasId.trim()
      : null;

  if (!query) {
    return NextResponse.json({ error: "query is required" }, { status: 400 });
  }
  if (userId !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(url, serviceKey);

  const plan = await getEffectivePlan(admin, user.id);
  if (!isProPlan(plan)) {
    const usage = await getMonthlyUsage(admin, user.id, currentYearMonth());
    if (usage.chatQueryCount >= FREE_CHAT_QUERIES_PER_MONTH) {
      return NextResponse.json(
        {
          error: `Free plan allows ${FREE_CHAT_QUERIES_PER_MONTH} in-app chat searches per month. Upgrade to Pro for unlimited.`,
          code: "CHAT_LIMIT",
        },
        { status: 403 }
      );
    }
  }

  const { data: vaultRows, error: vaultErr } = await admin
    .from("category_vaults")
    .select("id")
    .eq("user_id", user.id);

  if (vaultErr) {
    console.error("search vaults:", vaultErr);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }

  const allowedVaults = new Set((vaultRows ?? []).map((r) => r.id as string));
  let vaultIds = vaultIdsRaw.filter(
    (id): id is string => typeof id === "string" && allowedVaults.has(id)
  );
  if (vaultIds.length === 0) {
    vaultIds = [...allowedVaults];
  }
  if (vaultIds.length === 0) {
    return NextResponse.json({
      answer:
        "You don't have any vaults yet, so there's nothing in your graph to search.",
      relevantNodeIds: [] as string[],
      nodes: [] as MemoryNode[],
    });
  }

  if (canvasIdFilter) {
    const { data: canvasRow, error: canvasErr } = await admin
      .from("canvases")
      .select("id")
      .eq("user_id", user.id)
      .eq("id", canvasIdFilter)
      .maybeSingle();
    if (canvasErr || !canvasRow) {
      return NextResponse.json({ error: "Invalid canvas" }, { status: 400 });
    }
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  const openai = new OpenAI({ apiKey: openaiKey });
  let queryEmbedding: number[];
  try {
    const response = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: query,
    });
    const emb = response.data[0]?.embedding;
    if (!emb?.length) {
      return NextResponse.json(
        { error: "Could not embed query." },
        { status: 500 }
      );
    }
    queryEmbedding = emb;
  } catch (e) {
    console.error("openai embed:", e);
    return NextResponse.json(
      { error: "Embedding failed. Try again." },
      { status: 500 }
    );
  }

  const { data: similarRaw, error: rpcErr } = await admin.rpc("search_nodes", {
    p_user_id: user.id,
    p_query_embedding: queryEmbedding,
    p_vault_ids: vaultIds,
    p_limit: 12,
  });

  if (rpcErr) {
    console.error("search_nodes rpc:", rpcErr);
    return NextResponse.json({ error: "Search failed." }, { status: 500 });
  }

  let similarNodes = (similarRaw ?? []) as SearchRpcRow[];

  if (canvasIdFilter && similarNodes.length > 0) {
    const ids = similarNodes.map((r) => r.id);
    const { data: canvasRows, error: cnErr } = await admin
      .from("memory_nodes")
      .select("id, canvas_id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("id", ids);
    if (!cnErr && canvasRows?.length) {
      const allow = new Set(
        canvasRows
          .filter((r) => (r.canvas_id as string | null) === canvasIdFilter)
          .map((r) => r.id as string)
      );
      similarNodes = similarNodes.filter((r) => allow.has(r.id));
    } else {
      similarNodes = [];
    }
  }

  const topFiveIds = similarNodes.slice(0, 5).map((r) => r.id);
  const topFiveSet = new Set(topFiveIds);

  const neighborIds = new Set<string>();
  if (topFiveIds.length > 0) {
    const { data: e1 } = await admin
      .from("node_edges")
      .select("source_node_id, target_node_id")
      .eq("user_id", user.id)
      .in("source_node_id", topFiveIds);

    const { data: e2 } = await admin
      .from("node_edges")
      .select("source_node_id, target_node_id")
      .eq("user_id", user.id)
      .in("target_node_id", topFiveIds);

    for (const row of [...(e1 ?? []), ...(e2 ?? [])]) {
      const s = row.source_node_id as string;
      const t = row.target_node_id as string;
      if (topFiveSet.has(s)) neighborIds.add(t);
      if (topFiveSet.has(t)) neighborIds.add(s);
    }
  }

  const searchIds = new Set(similarNodes.map((r) => r.id));
  const neighborOnly = [...neighborIds].filter((id) => !searchIds.has(id));

  let neighborMemories: {
    id: string;
    title: string;
    value: string;
  }[] = [];
  if (neighborOnly.length > 0) {
    let nq = admin
      .from("memory_nodes")
      .select("id, title, value, canvas_id")
      .eq("user_id", user.id)
      .in("id", neighborOnly)
      .eq("is_active", true);
    if (canvasIdFilter) {
      nq = nq.eq("canvas_id", canvasIdFilter);
    }
    const { data: nm } = await nq;
    neighborMemories = (nm ?? []) as typeof neighborMemories;
  }

  const { data: allVaults } = await admin
    .from("category_vaults")
    .select("id, name")
    .eq("user_id", user.id);
  const vaultNameMap = new Map<string, string>();
  for (const v of allVaults ?? []) {
    vaultNameMap.set(v.id as string, (v.name as string) ?? "Personal");
  }

  const memoriesPayload = similarNodes.map((r) => ({
    id: r.id,
    title: r.title,
    value: r.value,
    similarity: r.similarity,
    role: "match" as const,
  }));

  const connectedPayload = (neighborMemories ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    value: row.value,
    role: "connected_to_top_matches" as const,
  }));

  const claudePayload = {
    vectorMatches: memoriesPayload,
    oneHopNeighborsOfTopFive: connectedPayload,
  };

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicKey) {
    return NextResponse.json(
      { error: "Server misconfiguration." },
      { status: 500 }
    );
  }

  const anthropic = new Anthropic({ apiKey: anthropicKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

  let answer: string;
  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens: 400,
      system: SEARCH_SYSTEM,
      messages: [
        {
          role: "user",
          content: `Question: ${query}\n\nRelevant memories:\n${JSON.stringify(claudePayload, null, 2)}`,
        },
      ],
    });
    answer = extractMessageText(msg).trim() || "I couldn't form an answer from those memories.";
  } catch (e) {
    console.error("claude search:", e);
    return NextResponse.json(
      { error: "Answer generation failed. Try again." },
      { status: 500 }
    );
  }

  const allResultIds = similarNodes.map((r) => r.id);
  let fullRows: Parameters<typeof rowToMemoryNode>[0][] = [];
  if (allResultIds.length > 0) {
    let fullQ = admin
      .from("memory_nodes")
      .select(
        "id, user_id, vault_id, title, value, confidence, source, is_active, created_at, updated_at, canvas_id"
      )
      .eq("user_id", user.id)
      .eq("is_active", true)
      .in("id", allResultIds);
    if (canvasIdFilter) {
      fullQ = fullQ.eq("canvas_id", canvasIdFilter);
    }
    const { data, error: fullErr } = await fullQ;
    if (fullErr) console.error("search fetch nodes:", fullErr);
    fullRows = (data ?? []) as Parameters<typeof rowToMemoryNode>[0][];
  }

  const rowById = new Map(fullRows.map((r) => [r.id, r]));
  const nodes: MemoryNode[] = similarNodes
    .map((s) => {
      const row = rowById.get(s.id);
      if (!row) return null;
      return rowToMemoryNode(row, vaultNameMap.get(s.vault_id) ?? "Personal");
    })
    .filter((n): n is MemoryNode => n != null);

  if (!isProPlan(plan)) {
    try {
      await incrementChatQueryUsage(user.id);
    } catch (e) {
      console.error("search chat usage increment:", e);
    }
  }

  return NextResponse.json({
    answer,
    relevantNodeIds: allResultIds,
    nodes,
  });
  } catch (err) {
    console.error("[api/search]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
