import type { CategoryVault } from "@/types/memorey";

const KANBAN_CANONICAL: Record<string, KanbanStatus> = {
  todo: "todo",
  doing: "doing",
  inprogress: "doing",
  wip: "doing",
  done: "done",
  completed: "done",
  finished: "done",
};

export type KanbanStatus = "todo" | "doing" | "done";

export interface ParsedNode {
  type: "memory" | "kanban";
  title: string;
  value: string;
  vaultId: string | null;
  vaultName: string;
  isNewVault: boolean;
  kanbanStatus?: KanbanStatus;
  selected: boolean;
  confidence: number;
}

export interface ParseResult {
  nodes: ParsedNode[];
  newVaults: string[];
  usedAI: boolean;
}

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/[-_\s]+/g, "");
}

/** Exact match only — avoids "@To-Do Need …" being read as kanban + 2-word vault. */
function resolveKanban(vaultName: string): KanbanStatus | null {
  const n = normalise(vaultName);
  return KANBAN_CANONICAL[n] ?? null;
}

function matchVault(
  name: string,
  vaults: CategoryVault[]
): CategoryVault | null {
  const n = normalise(name);
  return (
    vaults.find((v) => normalise(v.name) === n) ??
    vaults.find((v) => normalise(v.name).startsWith(n)) ??
    vaults.find((v) => n.startsWith(normalise(v.name))) ??
    null
  );
}

function inferTitleAndValue(raw: string): { title: string; value: string } {
  const text = raw.trim();

  if (text.length <= 70) {
    return { title: text, value: "" };
  }

  const sentenceMatch = text.match(/^(.{20,70}[.!?,])\s+([\s\S]+)$/);
  if (sentenceMatch) {
    return {
      title: sentenceMatch[1].replace(/[,]$/, "").trim(),
      value: sentenceMatch[2].trim(),
    };
  }

  const words = text.split(" ");
  const titleWords: string[] = [];
  let valueWords: string[] = [];
  let len = 0;

  for (let i = 0; i < words.length; i++) {
    if (len + words[i].length < 65 || titleWords.length === 0) {
      titleWords.push(words[i]);
      len += words[i].length + 1;
    } else {
      valueWords = words.slice(i);
      break;
    }
  }

  return {
    title: titleWords.join(" ").trim(),
    value: valueWords.join(" ").trim(),
  };
}

export function parseMessage(
  message: string,
  vaults: CategoryVault[]
): ParseResult {
  const trimmed = message.trim();

  if (!trimmed.includes("@")) {
    return { nodes: [], newVaults: [], usedAI: false };
  }

  const segments = trimmed.split(/(?=@)/).filter((s) => s.trim());

  const nodes: ParsedNode[] = [];
  const newVaults: string[] = [];
  const seenVaultNames = new Set<string>();

  for (const segment of segments) {
    const withoutAt = segment.replace(/^@/, "").trim();
    if (!withoutAt) continue;

    const words = withoutAt.split(/\s+/);
    let vaultName = "";
    let contentStart = 0;

    const oneWord = words[0];
    const twoWords = words.slice(0, 2).join(" ");

    if (resolveKanban(twoWords)) {
      vaultName = twoWords;
      contentStart = 2;
    } else if (resolveKanban(oneWord)) {
      vaultName = oneWord;
      contentStart = 1;
    } else if (matchVault(twoWords, vaults)) {
      vaultName = twoWords;
      contentStart = 2;
    } else {
      vaultName = oneWord;
      contentStart = 1;
    }

    const rawContent = words.slice(contentStart).join(" ").trim();
    if (!rawContent && vaultName) {
      continue;
    }

    const { title, value } = inferTitleAndValue(rawContent);

    const kanbanStatus = resolveKanban(vaultName);
    const matchedVault = matchVault(vaultName, vaults);
    let isNewVault = false;

    if (!matchedVault && !kanbanStatus) {
      const normName = normalise(vaultName);
      if (
        !seenVaultNames.has(normName) &&
        !newVaults.some((n) => normalise(n) === normName)
      ) {
        newVaults.push(vaultName.trim());
      }
      seenVaultNames.add(normName);
      isNewVault = true;
    }

    let finalVaultId = matchedVault?.id ?? null;
    let finalVaultName = matchedVault?.name ?? vaultName.trim();

    if (kanbanStatus) {
      const tasksVault =
        vaults.find((v) =>
          ["tasks", "work", "todo", "kanban"].some((k) =>
            normalise(v.name).includes(k)
          )
        ) ?? vaults[0];

      finalVaultId = tasksVault?.id ?? null;
      finalVaultName = tasksVault?.name ?? "Work";
      isNewVault = false;
    }

    nodes.push({
      type: kanbanStatus ? "kanban" : "memory",
      title: title || rawContent.slice(0, 70),
      value,
      vaultId: finalVaultId,
      vaultName: finalVaultName,
      isNewVault,
      kanbanStatus: kanbanStatus ?? undefined,
      selected: true,
      confidence: 1.0,
    });
  }

  return { nodes, newVaults, usedAI: false };
}
