import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { ExportFormat } from "@/types/memorey";
import { executeExport } from "@/lib/export/executeExport";
import { checkRateLimit } from "@/lib/rateLimit";

const FORMATS: ExportFormat[] = ["markdown", "json", "toml", "text"];

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

  if (!(await checkRateLimit(`export:${user.id}`, 10, 60)).allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 }
    );
  }

  let body: {
    userId?: string;
    vaultIds?: unknown;
    format?: string;
    includeConfidence?: boolean;
    maxNodes?: number;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  if (userId !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const vaultIdsRaw = body.vaultIds;
  if (!Array.isArray(vaultIdsRaw) || vaultIdsRaw.length === 0) {
    return NextResponse.json(
      { error: "vaultIds is required and must be a non-empty array." },
      { status: 400 }
    );
  }
  const vaultIds = vaultIdsRaw.filter((id): id is string => typeof id === "string");

  const format = body.format as ExportFormat;
  if (!format || !FORMATS.includes(format)) {
    return NextResponse.json(
      { error: "format must be markdown, json, toml, or text." },
      { status: 400 }
    );
  }

  const includeConfidence = Boolean(body.includeConfidence);
  let maxNodes =
    typeof body.maxNodes === "number" && Number.isFinite(body.maxNodes)
      ? Math.floor(body.maxNodes)
      : 100;
  maxNodes = Math.min(500, Math.max(1, maxNodes));

  const admin = createClient(url, serviceKey);
  const result = await executeExport(
    admin,
    user.id,
    vaultIds,
    format,
    includeConfidence,
    maxNodes
  );

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json({
    content: result.content,
    format: result.format,
    nodeCount: result.nodeCount,
    filename: result.filename,
  });
  } catch (err) {
    console.error("[export]", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
