import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PUT(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { nodeId, title, value, vault_id, confidence } = body as {
    nodeId?: string;
    title?: string;
    value?: string;
    vault_id?: string;
    confidence?: number;
  };

  if (!nodeId)
    return NextResponse.json({ error: "nodeId required" }, { status: 400 });

  const { data: existing } = await supabase
    .from("memory_nodes")
    .select("id, title, value, vault_id, confidence")
    .eq("id", nodeId)
    .eq("user_id", user.id)
    .single();

  if (!existing)
    return NextResponse.json({ error: "Node not found" }, { status: 404 });

  const updates: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  const changes: string[] = [];

  if (title !== undefined && title !== existing.title) {
    updates.title = title;
    changes.push("Title changed");
  }
  if (value !== undefined && value !== existing.value) {
    updates.value = value;
    changes.push("Content updated");
  }
  if (vault_id !== undefined && vault_id !== existing.vault_id) {
    updates.vault_id = vault_id;
    changes.push("Vault changed");
  }
  if (confidence !== undefined && confidence !== existing.confidence) {
    updates.confidence = Math.max(0, Math.min(1, confidence));
    changes.push(
      `Confidence: ${(existing.confidence ?? 1).toFixed(2)} → ${confidence.toFixed(2)}`
    );
  }

  if (changes.length === 0) {
    return NextResponse.json({ node: existing, message: "No changes" });
  }

  const { data: updated, error } = await supabase
    .from("memory_nodes")
    .update(updates)
    .eq("id", nodeId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const { error: histErr } = await supabase.from("node_history").insert({
    node_id: nodeId,
    user_id: user.id,
    old_title: (updates.title as string) ?? existing.title,
    new_title: (updates.title as string) ?? existing.title,
    old_value: (updates.value as string) ?? existing.value,
    new_value: (updates.value as string) ?? existing.value,
    change_summary: changes.join("; "),
    triggered_by: "user",
  });
  if (histErr) console.error("History insert failed:", histErr);

  return NextResponse.json({ node: updated });
}
