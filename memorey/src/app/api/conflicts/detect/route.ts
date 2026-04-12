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

interface ConflictNode {
  id: string;
  title: string;
  value: string;
  vault: string;
  confidence: number;
  created_at: string;
  source: string;
}

interface DetectedConflict {
  id: string;
  nodeA: ConflictNode;
  nodeB: ConflictNode;
  reason: string;
  type: "contradiction" | "evolution" | "duplicate";
  autoResolvable: boolean;
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

  const { data: nodes } = await supabase
    .from("memory_nodes")
    .select("id, title, value, vault_id, confidence, created_at, source, category_vaults(name)")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (!nodes || nodes.length < 2) {
    return NextResponse.json({ conflicts: [] });
  }

  const conflicts = detectConflicts(nodes as Record<string, unknown>[]);
  return NextResponse.json({ conflicts });
}

function computeSimilarity(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 && wordsB.size === 0) return 0;
  let intersection = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) intersection++;
  }
  const union = new Set([...wordsA, ...wordsB]);
  return union.size === 0 ? 0 : intersection / union.size;
}

function classifyConflict(
  textA: string,
  textB: string
): "contradiction" | "evolution" | "duplicate" | "none" {
  const temporalMarkers = [
    "recently", "just", "now", "used to", "no longer",
    "moved to", "switched to", "changed to", "started", "stopped",
  ];
  const hasTemporalA = temporalMarkers.some((m) => textA.includes(m));
  const hasTemporalB = temporalMarkers.some((m) => textB.includes(m));
  if (hasTemporalA || hasTemporalB) return "evolution";

  const contradictionPatterns = [
    /works? at|employed at|job at/i,
    /lives? in|based in|located in|from/i,
    /prefers?|favorite|likes?/i,
    /\d+ years? old|age \d+|born in/i,
    /uses?|using|switched to/i,
    /speaks?|language/i,
    /studying|studies|major/i,
  ];

  for (const pattern of contradictionPatterns) {
    if (pattern.test(textA) && pattern.test(textB)) {
      return "contradiction";
    }
  }

  return "none";
}

function getConflictReason(type: string): string {
  if (type === "duplicate")
    return "These nodes contain very similar information";
  if (type === "evolution")
    return "These nodes may represent an update — one might be outdated";
  return "These nodes contain potentially contradictory information about the same topic";
}

function detectConflicts(nodes: Record<string, unknown>[]): DetectedConflict[] {
  const conflicts: DetectedConflict[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < nodes.length; i++) {
    for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i];
      const b = nodes[j];

      if (a.vault_id !== b.vault_id) continue;

      const textA = `${a.title ?? ""} ${a.value ?? ""}`.toLowerCase();
      const textB = `${b.title ?? ""} ${b.value ?? ""}`.toLowerCase();
      const similarity = computeSimilarity(textA, textB);

      const pairKey = [a.id as string, b.id as string].sort().join("|");
      if (seen.has(pairKey)) continue;

      if (similarity >= 0.9) {
        seen.add(pairKey);
        conflicts.push({
          id: pairKey,
          nodeA: mapNode(a),
          nodeB: mapNode(b),
          reason: "These nodes appear to be duplicates",
          type: "duplicate",
          autoResolvable: true,
        });
      } else if (similarity > 0.4) {
        const conflictType = classifyConflict(textA, textB);
        if (conflictType !== "none") {
          seen.add(pairKey);
          conflicts.push({
            id: pairKey,
            nodeA: mapNode(a),
            nodeB: mapNode(b),
            reason: getConflictReason(conflictType),
            type: conflictType,
            autoResolvable: conflictType === "duplicate",
          });
        }
      }
    }
  }

  return conflicts;
}

function mapNode(n: Record<string, unknown>): ConflictNode {
  const vault = n.category_vaults as Record<string, unknown> | null;
  return {
    id: n.id as string,
    title: (n.title as string) ?? "",
    value: (n.value as string) ?? "",
    vault: (vault?.name as string) ?? "",
    confidence: (n.confidence as number) ?? 1,
    created_at: (n.created_at as string) ?? "",
    source: (n.source as string) ?? "web",
  };
}
