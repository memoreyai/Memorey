import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AttachmentSource, FileType } from "@/types/memorey";
import { checkRateLimit } from "@/lib/rateLimit";

const FILE_TYPES: FileType[] = [
  "image",
  "video",
  "pdf",
  "doc",
  "spreadsheet",
  "presentation",
  "audio",
  "link",
  "other",
];

const SOURCES: AttachmentSource[] = [
  "url",
  "googledrive",
  "dropbox",
  "onedrive",
];

function createUserSupabase(accessToken: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, anon, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get("Authorization");
    const token =
      authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) {
      return NextResponse.json(
        { error: "Missing auth token" },
        { status: 401 }
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabaseAuth = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const {
      data: { user },
      error: authError,
    } = await supabaseAuth.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: "Invalid or expired token" },
        { status: 401 }
      );
    }

    if (!(await checkRateLimit(`attachments:${user.id}`, 30, 60)).allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded" },
        { status: 429 }
      );
    }

    let body: {
      nodeId?: string;
      fileUrl?: string;
      fileName?: string;
      fileType?: string;
      mimeType?: string | null;
      thumbnailUrl?: string | null;
      source?: string;
      sourceFileId?: string | null;
      title?: string | null;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const nodeId =
      typeof body.nodeId === "string" ? body.nodeId.trim() : "";
    const fileUrl =
      typeof body.fileUrl === "string" ? body.fileUrl.trim() : "";
    if (!nodeId || !fileUrl) {
      return NextResponse.json(
        { error: "nodeId and fileUrl are required" },
        { status: 400 }
      );
    }

    try {
      new URL(fileUrl);
    } catch {
      return NextResponse.json({ error: "Invalid fileUrl" }, { status: 400 });
    }

    const fileType = FILE_TYPES.includes(body.fileType as FileType)
      ? (body.fileType as FileType)
      : "link";
    const source = SOURCES.includes(body.source as AttachmentSource)
      ? (body.source as AttachmentSource)
      : "url";

    const fileName =
      typeof body.fileName === "string" && body.fileName.trim()
        ? body.fileName.trim().slice(0, 500)
        : fileUrl.split("/").pop()?.split("?")[0]?.slice(0, 500) || "File";

    const supabase = createUserSupabase(token);

    const { data: mem, error: memErr } = await supabase
      .from("memory_nodes")
      .select("id")
      .eq("id", nodeId)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .maybeSingle();

    if (memErr || !mem) {
      return NextResponse.json(
        { error: "Memory node not found or access denied" },
        { status: 403 }
      );
    }

    const { data: row, error: insertError } = await supabase
      .from("node_attachments")
      .insert({
        user_id: user.id,
        node_id: nodeId,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        mime_type:
          body.mimeType === null || body.mimeType === undefined
            ? null
            : String(body.mimeType).slice(0, 255),
        thumbnail_url:
          body.thumbnailUrl === null || body.thumbnailUrl === undefined
            ? null
            : String(body.thumbnailUrl).slice(0, 2000),
        source,
        source_file_id:
          body.sourceFileId === null || body.sourceFileId === undefined
            ? null
            : String(body.sourceFileId).slice(0, 500),
        title:
          body.title === null || body.title === undefined || body.title === ""
            ? null
            : String(body.title).slice(0, 500),
      })
      .select("*")
      .single();

    if (insertError) {
      console.error("attachments insert:", insertError);
      return NextResponse.json(
        { error: "Operation failed. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({ attachment: row }, { status: 201 });
  } catch (err) {
    console.error("POST /api/attachments:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
