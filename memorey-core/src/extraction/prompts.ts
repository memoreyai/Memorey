import type { VaultDefinition } from "../graph/types.js";
import type { ConversationExchange } from "./types.js";

/**
 * Build the main extraction prompt for LLM-based fact extraction.
 * Instructs the model to return ONLY a JSON array.
 */
export function buildExtractionPrompt(
  exchange: ConversationExchange,
  existingFacts: string[],
  vaults: VaultDefinition[]
): string {
  const vaultList = vaults
    .map((v) => `- "${v.id}": ${v.description}`)
    .join("\n");

  const existingSection =
    existingFacts.length > 0
      ? `\nExisting known facts about this user (check for contradictions or updates):\n${existingFacts.map((f) => `- ${f}`).join("\n")}\n`
      : "\nNo existing facts are known about this user.\n";

  return `You are a memory extraction engine. Your task is to extract atomic facts about the USER from a conversation exchange.

RULES:
1. Extract facts ONLY about the user, not about the assistant or general knowledge.
2. Each fact must be a single, atomic, third-person statement (e.g., "User works at Acme Corp").
3. Classify each fact into exactly one vault from the list below.
4. Rate your confidence from 0 to 1 based on how explicit and clear the statement is.
5. Identify all named entities (people, places, companies, products) mentioned in each fact.
6. If a new fact contradicts an existing fact, note the contradiction in the relationships array with relation "contradicts".
7. If a new fact updates or refines an existing fact, note it with relation "updates".

Available vaults:
${vaultList}
${existingSection}
Conversation exchange:
Platform: ${exchange.platform}
Timestamp: ${exchange.timestamp}

User: ${exchange.userMessage}
Assistant: ${exchange.assistantMessage}

Respond ONLY with a JSON array. No markdown fences, no explanation, no preamble. Each element must have this shape:
{
  "fact": "string — atomic third-person statement",
  "originalExcerpt": "string — the raw text from the user message this was extracted from",
  "vault": "string — one of the vault IDs listed above",
  "confidence": number,
  "entities": ["string"],
  "relationships": [{"targetFact": "string", "relation": "contradicts | updates | related_to"}]
}

If no facts can be extracted, return an empty array: []`;
}

/**
 * Build a prompt for detecting conflicts between a new fact and existing facts.
 */
export function buildConflictDetectionPrompt(
  newFact: string,
  existingFacts: string[]
): string {
  const factsList = existingFacts.map((f, i) => `${i + 1}. ${f}`).join("\n");

  return `You are a contradiction detector. Determine whether the new fact contradicts, updates, or is unrelated to each existing fact.

New fact: "${newFact}"

Existing facts:
${factsList}

Respond ONLY with a JSON array. No markdown fences, no explanation. Each element must have this shape:
{
  "existingFact": "string — the existing fact text",
  "relation": "contradicts | updates | unrelated",
  "explanation": "string — brief reason"
}

Only include entries where the relation is "contradicts" or "updates". Omit "unrelated" entries. If there are no contradictions or updates, return an empty array: []`;
}
