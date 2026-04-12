import type { DiffProposal, ProposedNode } from "@/types/memorey";

function slugify(s: string, i: number): string {
  const t = s.slice(0, 48).trim() || `item-${i}`;
  return t.replace(/\s+/g, " ");
}

/**
 * Build memory proposals from free text (onboarding / capture).
 * Replace with LLM extraction when OPENAI_API_KEY is set.
 */
export async function extractNodesFromText(text: string): Promise<DiffProposal> {
  const trimmed = text.trim();
  if (!trimmed) {
    return { proposals: [], summary: "No text to extract." };
  }

  const chunks = trimmed
    .split(/(?<=[.!?])\s+|\n+/)
    .map((c) => c.trim())
    .filter((c) => c.length > 3)
    .slice(0, 8);

  const proposals: ProposedNode[] =
    chunks.length > 0
      ? chunks.map((chunk, i) => ({
          tempId: `extract-${i}-${Date.now()}`,
          category: "Personal",
          title: slugify(chunk.split(/\s+/).slice(0, 6).join(" "), i),
          newValue: chunk,
          confidence: 0.82 + (i % 5) * 0.02,
          isNew: true,
        }))
      : [
          {
            tempId: `extract-0-${Date.now()}`,
            category: "Personal",
            title: "About you",
            newValue: trimmed,
            confidence: 0.88,
            isNew: true,
          },
        ];

  return {
    proposals,
    summary: `Extracted ${proposals.length} memory candidate(s) from your note.`,
    totalExtracted: proposals.length,
  };
}
