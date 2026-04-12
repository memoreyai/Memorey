import type { MemoryNode } from "../graph/types.js";

export interface ChangeHistoryEntry {
  previousFact: string;
  currentFact: string;
}

export function formatSystemPrompt(
  groupedFacts: Map<string, MemoryNode[]>,
  changeHistory: ChangeHistoryEntry[]
): string {
  const lines: string[] = [];

  lines.push(
    "The user you're talking to has shared the following context about themselves across previous conversations. Use this to personalize your responses without explicitly referencing that you have this information unless asked."
  );
  lines.push("");

  for (const [vaultName, nodes] of groupedFacts) {
    if (nodes.length === 0) continue;
    lines.push(vaultName);
    lines.push("");
    for (const node of nodes) {
      lines.push(`- ${node.fact}`);
    }
    lines.push("");
  }

  if (changeHistory.length > 0) {
    lines.push("Recent Changes");
    lines.push("");
    for (const entry of changeHistory) {
      lines.push(`- Previously: ${entry.previousFact} → Now: ${entry.currentFact}`);
    }
    lines.push("");
  }

  lines.push("Note: This context was provided by the user's personal memory system (Memorey).");

  return lines.join("\n");
}

export function formatMarkdown(
  groupedFacts: Map<string, MemoryNode[]>,
  changeHistory: ChangeHistoryEntry[]
): string {
  const lines: string[] = [];

  for (const [vaultName, nodes] of groupedFacts) {
    if (nodes.length === 0) continue;
    lines.push(`## ${vaultName}`);
    lines.push("");
    for (const node of nodes) {
      lines.push(`- ${node.fact}`);
    }
    lines.push("");
  }

  if (changeHistory.length > 0) {
    lines.push("## Recent Changes");
    lines.push("");
    for (const entry of changeHistory) {
      lines.push(`- Previously: ${entry.previousFact} → Now: ${entry.currentFact}`);
    }
    lines.push("");
  }

  return lines.join("\n").trim();
}

export function formatStructuredJson(
  groupedFacts: Map<string, MemoryNode[]>,
  vaultIdToName: Map<string, string>,
  changeHistory: ChangeHistoryEntry[]
): string {
  const result: Record<string, unknown> = {};

  // Use vault ids as keys, with facts as string arrays
  const nameToId = new Map<string, string>();
  for (const [id, name] of vaultIdToName) {
    nameToId.set(name, id);
  }

  for (const [vaultName, nodes] of groupedFacts) {
    if (nodes.length === 0) continue;
    const vaultId = nameToId.get(vaultName) ?? vaultName;
    result[vaultId] = nodes.map((n) => n.fact);
  }

  if (changeHistory.length > 0) {
    result["recent_changes"] = changeHistory.map((entry) => ({
      previous: entry.previousFact,
      current: entry.currentFact,
    }));
  }

  return JSON.stringify(result, null, 2);
}
