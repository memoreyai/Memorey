import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ExportFormat } from "@/types/memorey";
import {
  buildExportContent,
  exportFilename,
  type ExportNodeInput,
} from "./formatExport";

const TEXT_SYSTEM = `Rewrite these memory nodes as natural first-person sentences grouped by category. No bullet points. Each category becomes a paragraph. Sound like a human introducing themselves, not a database dump. Keep it under 400 words total.`;

function extractMessageText(response: Anthropic.Message): string {
  const blocks = response.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}

type Row = {
  vault_id: string;
  title: string;
  value: string;
  confidence: number;
  updated_at: string;
};

export async function executeExport(
  admin: SupabaseClient,
  userId: string,
  vaultIds: string[],
  format: ExportFormat,
  includeConfidence: boolean,
  maxNodes: number
): Promise<
  | { ok: true; content: string; nodeCount: number; filename: string; format: ExportFormat }
  | { ok: false; error: string; status: number }
> {
  const uniqueIds = [...new Set(vaultIds.filter((id) => typeof id === "string" && id.length > 0))];
  if (uniqueIds.length === 0) {
    return { ok: false, error: "vaultIds is required and must be non-empty", status: 400 };
  }

  const { data: vaultRows, error: vaultErr } = await admin
    .from("category_vaults")
    .select("id, name, display_order")
    .eq("user_id", userId)
    .in("id", uniqueIds)
    .order("display_order", { ascending: true });

  if (vaultErr) {
    return { ok: false, error: "Could not verify vaults.", status: 500 };
  }

  if (!vaultRows || vaultRows.length !== uniqueIds.length) {
    return {
      ok: false,
      error: "One or more vaults are not accessible.",
      status: 403,
    };
  }

  const vaultOrder = vaultRows.map((r) => ({
    id: r.id as string,
    name: (r.name as string) ?? "Vault",
  }));
  const nameByVaultId = new Map(vaultOrder.map((v) => [v.id, v.name]));

  const { data: rawNodes, error: nodeErr } = await admin
    .from("memory_nodes")
    .select("vault_id, title, value, confidence, updated_at")
    .eq("user_id", userId)
    .in("vault_id", uniqueIds)
    .eq("is_active", true)
    .limit(8000);

  if (nodeErr) {
    return { ok: false, error: "Could not load memories.", status: 500 };
  }

  const rows = (rawNodes ?? []) as Row[];
  rows.sort((a, b) => {
    const va = a.vault_id;
    const vb = b.vault_id;
    if (va !== vb) return va.localeCompare(vb);
    return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
  });

  const limited = rows.slice(0, maxNodes);
  const nodes: ExportNodeInput[] = limited.map((r) => ({
    vaultName: nameByVaultId.get(r.vault_id) ?? "Vault",
    title: r.title ?? "",
    value: r.value ?? "",
    confidence: typeof r.confidence === "number" ? r.confidence : 0,
  }));

  const vaultNamesIncluded = [...new Set(vaultOrder.map((v) => v.name))];
  const generatedAt = new Date();
  let textFromClaude: string | undefined;

  if (format === "text") {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) {
      return { ok: false, error: "Plain text export requires AI configuration.", status: 500 };
    }
    const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
    const payload = nodes.map((n) => ({
      category: n.vaultName,
      title: n.title,
      value: n.value,
    }));
    const anthropic = new Anthropic({ apiKey: key });
    try {
      const msg = await anthropic.messages.create({
        model,
        max_tokens: 1200,
        system: TEXT_SYSTEM,
        messages: [
          {
            role: "user",
            content: `Memory nodes (JSON):\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      });
      textFromClaude = extractMessageText(msg).trim();
      if (!textFromClaude) {
        textFromClaude = nodes.map((n) => `${n.title}: ${n.value}`).join("\n");
      }
    } catch {
      return { ok: false, error: "Could not generate plain text export.", status: 500 };
    }
  }

  const content = buildExportContent(
    format,
    nodes,
    vaultOrder,
    vaultNamesIncluded,
    generatedAt,
    includeConfidence,
    textFromClaude
  );

  return {
    ok: true,
    content,
    nodeCount: nodes.length,
    filename: exportFilename(format, generatedAt),
    format,
  };
}
