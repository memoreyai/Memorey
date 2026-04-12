/**
 * Shared export formatting (server + client preview for md/json/toml).
 */

import type { ExportFormat } from "@/types/memorey";

export interface ExportNodeInput {
  vaultName: string;
  title: string;
  value: string;
  confidence: number;
}

function escapeTomlKey(s: string): string {
  const escaped = s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function tomlTableName(name: string): string {
  if (/^[\w-]+$/.test(name)) return name;
  return escapeTomlKey(name);
}

export function groupNodesByVaultDisplayOrder(
  nodes: ExportNodeInput[],
  vaultOrder: { id: string; name: string }[]
): Map<string, ExportNodeInput[]> {
  const byVault = new Map<string, ExportNodeInput[]>();
  for (const n of nodes) {
    const key = n.vaultName;
    if (!byVault.has(key)) byVault.set(key, []);
    byVault.get(key)!.push(n);
  }

  const orderedVaultNames = [...new Set(vaultOrder.map((v) => v.name))];
  const sortedKeys = [...byVault.keys()].sort((a, b) => {
    const ia = orderedVaultNames.indexOf(a);
    const ib = orderedVaultNames.indexOf(b);
    if (ia === -1 && ib === -1) return a.localeCompare(b);
    if (ia === -1) return 1;
    if (ib === -1) return -1;
    return ia - ib;
  });

  const out = new Map<string, ExportNodeInput[]>();
  for (const k of sortedKeys) {
    out.set(k, byVault.get(k)!);
  }
  return out;
}

export function formatMarkdownExport(
  nodes: ExportNodeInput[],
  vaultOrder: { id: string; name: string }[],
  generatedAt: Date,
  vaultNamesIncluded: string[],
  includeConfidence: boolean
): string {
  const grouped = groupNodesByVaultDisplayOrder(nodes, vaultOrder);
  const vaultList = vaultNamesIncluded.join(", ");
  let md = `# Memorey Context Export\n_Generated: ${generatedAt.toISOString()} | Vaults: ${vaultList}_\n\n`;

  for (const [vaultName, list] of grouped) {
    md += `## ${vaultName}\n`;
    for (const n of list) {
      const conf =
        includeConfidence && n.confidence != null
          ? ` _(confidence ${(n.confidence * 100).toFixed(0)}%)_`
          : "";
      md += `- **${n.title.replace(/\]/g, "\\]")}**: ${n.value}${conf}\n`;
    }
    md += "\n";
  }
  return md.trimEnd();
}

export function formatJsonExport(
  nodes: ExportNodeInput[],
  generatedAt: Date,
  vaultNamesIncluded: string[],
  includeConfidence: boolean
): string {
  const payload = {
    exported_at: generatedAt.toISOString(),
    vaults_included: vaultNamesIncluded,
    node_count: nodes.length,
    nodes: nodes.map((n) => ({
      vault: n.vaultName,
      title: n.title,
      value: n.value,
      ...(includeConfidence ? { confidence: n.confidence } : {}),
    })),
  };
  return JSON.stringify(payload, null, 2);
}

export function formatTomlExport(
  nodes: ExportNodeInput[],
  vaultOrder: { id: string; name: string }[],
  generatedAt: Date,
  includeConfidence: boolean
): string {
  const grouped = groupNodesByVaultDisplayOrder(nodes, vaultOrder);
  let toml = `# Memorey Context — exported ${generatedAt.toISOString()}\n\n`;
  const titleCounts = new Map<string, number>();

  for (const [vaultName, list] of grouped) {
    toml += `[${tomlTableName(vaultName)}]\n`;
    for (const n of list) {
      let key = n.title.trim() || "Untitled";
      const c = (titleCounts.get(`${vaultName}:${key}`) ?? 0) + 1;
      titleCounts.set(`${vaultName}:${key}`, c);
      if (c > 1) key = `${key} (${c})`;
      const val = n.value.replace(/\n/g, " ").trim();
      const conf =
        includeConfidence && n.confidence != null
          ? ` [confidence=${n.confidence.toFixed(2)}]`
          : "";
      toml += `${escapeTomlKey(key)} = ${escapeTomlKey(val + conf)}\n`;
    }
    toml += "\n";
  }
  return toml.trimEnd();
}

export function formatTextRoughPreview(nodes: ExportNodeInput[]): string {
  const byVault = new Map<string, ExportNodeInput[]>();
  for (const n of nodes) {
    if (!byVault.has(n.vaultName)) byVault.set(n.vaultName, []);
    byVault.get(n.vaultName)!.push(n);
  }
  const parts: string[] = [];
  for (const [vault, list] of byVault) {
    parts.push(
      `[${vault}]\n${list.map((n) => `${n.title}: ${n.value}`).join(". ")}.`
    );
  }
  return parts.join("\n\n");
}

export function buildExportContent(
  format: ExportFormat,
  nodes: ExportNodeInput[],
  vaultOrder: { id: string; name: string }[],
  vaultNamesIncluded: string[],
  generatedAt: Date,
  includeConfidence: boolean,
  textFromClaude?: string
): string {
  switch (format) {
    case "markdown":
      return formatMarkdownExport(
        nodes,
        vaultOrder,
        generatedAt,
        vaultNamesIncluded,
        includeConfidence
      );
    case "json":
      return formatJsonExport(
        nodes,
        generatedAt,
        vaultNamesIncluded,
        includeConfidence
      );
    case "toml":
      return formatTomlExport(
        nodes,
        vaultOrder,
        generatedAt,
        includeConfidence
      );
    case "text":
      return textFromClaude ?? formatTextRoughPreview(nodes);
    default:
      return formatMarkdownExport(
        nodes,
        vaultOrder,
        generatedAt,
        vaultNamesIncluded,
        includeConfidence
      );
  }
}

export function exportFilename(format: ExportFormat, d: Date): string {
  const stamp = d.toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const ext =
    format === "markdown"
      ? "md"
      : format === "json"
        ? "json"
        : format === "toml"
          ? "toml"
          : "txt";
  return `memorey-export-${stamp}.${ext}`;
}
