import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { checkRateLimit } from "@/lib/rateLimit";

type BriefFormat = "system_prompt" | "markdown" | "json" | "toml";

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

interface BriefNode {
  id: string;
  title: string;
  value: string;
  confidence: number;
  source: string;
  created_at: string;
  updated_at: string;
  vault_id: string;
  vaultName: string;
}

interface BriefEdge {
  source_node_id: string;
  target_node_id: string;
  label: string | null;
  strength: number | null;
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

  if (!(await checkRateLimit(`brief:${userId}`, 20, 60)).allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
  }

  const body = await req.json().catch(() => ({}));
  const {
    format = "system_prompt",
    vaultIds = [],
    canvasId = null,
    dateFrom = null,
    dateTo = null,
  } = body as {
    format?: BriefFormat;
    vaultIds?: string[];
    canvasId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  };

  let query = supabase
    .from("memory_nodes")
    .select(
      "id, title, value, confidence, source, created_at, updated_at, vault_id, canvas_id, category_vaults(id, name, color)"
    )
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("created_at", { ascending: true });

  if (vaultIds.length > 0) query = query.in("vault_id", vaultIds);
  if (canvasId) query = query.eq("canvas_id", canvasId);
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data: rawNodes } = await query;
  if (!rawNodes || rawNodes.length === 0) {
    return NextResponse.json({
      brief: "No memories found matching the selected filters.",
      format,
      nodeCount: 0,
      edgeCount: 0,
    });
  }

  const { data: allVaults } = await supabase
    .from("category_vaults")
    .select("id, name")
    .eq("user_id", userId)
    .eq("is_active", true);

  const vaultNameMap = new Map(
    (allVaults || []).map((v: { id: string; name: string }) => [v.id, v.name])
  );

  const nodes: BriefNode[] = rawNodes.map((n: Record<string, unknown>) => {
    const cv = n.category_vaults as { name?: string } | null;
    return {
      id: n.id as string,
      title: (n.title as string) ?? "",
      value: (n.value as string) ?? "",
      confidence: (n.confidence as number) ?? 1,
      source: (n.source as string) ?? "web",
      created_at: (n.created_at as string) ?? "",
      updated_at: (n.updated_at as string) ?? "",
      vault_id: (n.vault_id as string) ?? "",
      vaultName: cv?.name ?? vaultNameMap.get(n.vault_id as string) ?? "Unknown",
    };
  });

  const nodeIds = new Set(nodes.map((n) => n.id));
  const { data: edgeRows } = await supabase
    .from("node_edges")
    .select("source_node_id, target_node_id, label, strength")
    .eq("user_id", userId);

  const edges: BriefEdge[] = (edgeRows || []).filter(
    (e: Record<string, unknown>) =>
      nodeIds.has(e.source_node_id as string) &&
      nodeIds.has(e.target_node_id as string)
  ) as BriefEdge[];

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const brief = generateBrief(nodes, edges, nodeById, vaultNameMap, format);

  return NextResponse.json({
    brief,
    format,
    nodeCount: nodes.length,
    edgeCount: edges.length,
  });
}

function generateBrief(
  nodes: BriefNode[],
  edges: BriefEdge[],
  nodeById: Map<string, BriefNode>,
  vaultNameMap: Map<string, string>,
  format: BriefFormat
): string {
  switch (format) {
    case "system_prompt":
      return generateSystemPrompt(nodes, edges, nodeById, vaultNameMap);
    case "markdown":
      return generateMarkdown(nodes, edges, nodeById, vaultNameMap);
    case "json":
      return generateJson(nodes, edges, nodeById, vaultNameMap);
    case "toml":
      return generateToml(nodes, edges, nodeById, vaultNameMap);
    default:
      return generateSystemPrompt(nodes, edges, nodeById, vaultNameMap);
  }
}

function groupByVault(nodes: BriefNode[]): Map<string, BriefNode[]> {
  const map = new Map<string, BriefNode[]>();
  for (const n of nodes) {
    const key = n.vaultName;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(n);
  }
  return map;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function edgeConnectionsFor(
  nodeId: string,
  edges: BriefEdge[],
  nodeById: Map<string, BriefNode>
): { toTitle: string; toVault: string; label: string }[] {
  const conns: { toTitle: string; toVault: string; label: string }[] = [];
  for (const e of edges) {
    if (e.source_node_id === nodeId) {
      const target = nodeById.get(e.target_node_id);
      if (target)
        conns.push({
          toTitle: target.title,
          toVault: target.vaultName,
          label: e.label || "related",
        });
    } else if (e.target_node_id === nodeId) {
      const source = nodeById.get(e.source_node_id);
      if (source)
        conns.push({
          toTitle: source.title,
          toVault: source.vaultName,
          label: e.label || "related",
        });
    }
  }
  return conns;
}

function generateSystemPrompt(
  nodes: BriefNode[],
  edges: BriefEdge[],
  nodeById: Map<string, BriefNode>,
  vaultNameMap: Map<string, string>
): string {
  const grouped = groupByVault(nodes);
  const vaultCount = grouped.size;
  const now = new Date();
  const lines: string[] = [];

  lines.push(
    "You are talking to a user who has shared the following context about themselves through their personal memory system. Use this information to personalize your responses without explicitly mentioning you have this data unless asked."
  );
  lines.push("");

  for (const [vault, vaultNodes] of grouped) {
    lines.push(vault);
    lines.push("");
    for (const n of vaultNodes) {
      const conf =
        n.confidence < 1
          ? ` (${n.confidence < 0.5 ? "low" : "high"} confidence)`
          : "";
      const since = ` (since ${fmtDateShort(n.created_at)})`;
      lines.push(`${n.title}: ${n.value}${conf}${since}`);

      const conns = edgeConnectionsFor(n.id, edges, nodeById);
      if (conns.length > 0) {
        const connStrs = conns.map(
          (c) => `"${c.toTitle}" (${c.toVault})`
        );
        lines.push(`→ Connected to: ${connStrs.join(", ")}`);
      }
    }
    lines.push("");
  }

  const recent = [...nodes]
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    )
    .slice(0, 10);

  if (recent.length > 0) {
    lines.push("Recent Changes");
    lines.push("");
    for (const n of recent) {
      const date = fmtDateShort(n.updated_at || n.created_at);
      lines.push(`${date}: ${n.title} — ${n.value}`);
    }
    lines.push("");
  }

  lines.push(
    `Context generated by Memorey on ${fmtDate(now.toISOString())}. Total: ${nodes.length} memories across ${vaultCount} categories.`
  );

  return lines.join("\n");
}

function generateMarkdown(
  nodes: BriefNode[],
  edges: BriefEdge[],
  nodeById: Map<string, BriefNode>,
  vaultNameMap: Map<string, string>
): string {
  const grouped = groupByVault(nodes);
  const now = new Date();
  const lines: string[] = [];

  lines.push("# Memory Brief");
  lines.push(
    `Generated: ${now.toLocaleString("en-US", { dateStyle: "full", timeStyle: "short" })}`
  );
  lines.push(`Memories: ${nodes.length} across ${grouped.size} categories`);
  lines.push("");
  lines.push("---");
  lines.push("");

  for (const [vault, vaultNodes] of grouped) {
    lines.push(`## ${vault}`);
    lines.push("| Memory | Confidence | Added |");
    lines.push("|--------|-----------|-------|");
    for (const n of vaultNodes) {
      const conf = `${(n.confidence * 100).toFixed(0)}%`;
      const date = fmtDate(n.created_at);
      const mem = `${n.title}: ${n.value}`.replace(/\|/g, "\\|");
      lines.push(`| ${mem} | ${conf} | ${date} |`);
    }
    lines.push("");
  }

  if (edges.length > 0) {
    lines.push("---");
    lines.push("");
    lines.push("## Connections");
    const seen = new Set<string>();
    for (const e of edges) {
      const key = [e.source_node_id, e.target_node_id].sort().join("|");
      if (seen.has(key)) continue;
      seen.add(key);
      const source = nodeById.get(e.source_node_id);
      const target = nodeById.get(e.target_node_id);
      if (source && target) {
        const label = e.label || "related";
        lines.push(
          `- "${source.title}" (${source.vaultName}) ←[${label}]→ "${target.title}" (${target.vaultName})`
        );
      }
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push("## Timeline (Recent First)");

  const timeline = [...nodes].sort(
    (a, b) =>
      new Date(b.updated_at || b.created_at).getTime() -
      new Date(a.updated_at || a.created_at).getTime()
  );

  for (const n of timeline.slice(0, 20)) {
    const date = fmtDate(n.updated_at || n.created_at);
    const conf = `confidence: ${(n.confidence * 100).toFixed(0)}%`;
    lines.push(`- **${date}**: ${n.title} — ${n.value} (${n.vaultName}, ${conf})`);
  }

  return lines.join("\n");
}

function generateJson(
  nodes: BriefNode[],
  edges: BriefEdge[],
  nodeById: Map<string, BriefNode>,
  _vaultNameMap: Map<string, string>
): string {
  const grouped = groupByVault(nodes);
  const now = new Date();

  const vaults: Record<
    string,
    {
      memories: {
        id: string;
        title: string;
        content: string;
        confidence: number;
        source: string;
        created_at: string;
        connections: { to_id: string; to_title: string; to_vault: string; relationship: string }[];
      }[];
    }
  > = {};

  for (const [vault, vaultNodes] of grouped) {
    vaults[vault] = {
      memories: vaultNodes.map((n) => ({
        id: n.id,
        title: n.title,
        content: n.value,
        confidence: n.confidence,
        source: n.source,
        created_at: n.created_at,
        connections: edgeConnectionsFor(n.id, edges, nodeById).map((c) => ({
          to_id:
            edges.find(
              (e) =>
                (e.source_node_id === n.id || e.target_node_id === n.id) &&
                nodeById.get(
                  e.source_node_id === n.id
                    ? e.target_node_id
                    : e.source_node_id
                )?.title === c.toTitle
            )
              ? nodeById.get(
                  (() => {
                    const edge = edges.find(
                      (e) =>
                        (e.source_node_id === n.id || e.target_node_id === n.id) &&
                        nodeById.get(
                          e.source_node_id === n.id ? e.target_node_id : e.source_node_id
                        )?.title === c.toTitle
                    );
                    return edge
                      ? edge.source_node_id === n.id
                        ? edge.target_node_id
                        : edge.source_node_id
                      : "";
                  })()
                )?.id ?? ""
              : "",
          to_title: c.toTitle,
          to_vault: c.toVault,
          relationship: c.label,
        })),
      })),
    };
  }

  const timeline = [...nodes]
    .sort(
      (a, b) =>
        new Date(b.updated_at || b.created_at).getTime() -
        new Date(a.updated_at || a.created_at).getTime()
    )
    .slice(0, 20)
    .map((n) => ({
      date: (n.updated_at || n.created_at).slice(0, 10),
      memory: `${n.title}: ${n.value}`,
      vault: n.vaultName,
    }));

  const payload = {
    generated_at: now.toISOString(),
    total_memories: nodes.length,
    total_connections: edges.length,
    vaults,
    timeline,
  };

  return JSON.stringify(payload, null, 2);
}

function generateToml(
  nodes: BriefNode[],
  edges: BriefEdge[],
  nodeById: Map<string, BriefNode>,
  _vaultNameMap: Map<string, string>
): string {
  const grouped = groupByVault(nodes);
  const now = new Date();
  const lines: string[] = [];

  lines.push(`generated_at = "${now.toISOString()}"`);
  lines.push(`total_memories = ${nodes.length}`);
  lines.push(`total_connections = ${edges.length}`);
  lines.push("");

  for (const [vault, vaultNodes] of grouped) {
    const safeVault = vault.replace(/[^a-zA-Z0-9_-]/g, "_");

    for (const n of vaultNodes) {
      lines.push(`[[vaults.${safeVault}.memories]]`);
      lines.push(`title = ${escapeToml(n.title)}`);
      lines.push(`content = ${escapeToml(n.value)}`);
      lines.push(`confidence = ${n.confidence}`);
      lines.push(`source = ${escapeToml(n.source)}`);
      lines.push(`created_at = "${n.created_at}"`);

      const conns = edgeConnectionsFor(n.id, edges, nodeById);
      for (const c of conns) {
        lines.push(`  [[vaults.${safeVault}.memories.connections]]`);
        lines.push(`  to_title = ${escapeToml(c.toTitle)}`);
        lines.push(`  to_vault = ${escapeToml(c.toVault)}`);
        lines.push(`  relationship = ${escapeToml(c.label)}`);
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

function escapeToml(s: string): string {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n")}"`;
}
