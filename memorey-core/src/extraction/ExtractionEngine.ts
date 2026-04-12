import type { VaultDefinition, MemorySource } from "../graph/types.js";
import type {
  ConversationExchange,
  ExtractedFact,
  ExtractionResult,
} from "./types.js";
import { extractByRules } from "./local-rules.js";
import { buildExtractionPrompt } from "./prompts.js";
import { DEFAULT_VAULTS } from "../graph/types.js";

export interface LLMProviderConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

export interface ExtractionEngineConfig {
  useLLM: boolean;
  llmProvider?: LLMProviderConfig;
  vaults?: VaultDefinition[];
}

/** Build default vault definitions from the DEFAULT_VAULTS list */
function defaultVaultDefinitions(): VaultDefinition[] {
  const descriptions: Record<string, string> = {
    identity: "Who the user is — name, age, location, roles",
    work: "Job, company, projects, professional context",
    preferences: "Likes, dislikes, communication style, tool preferences",
    knowledge: "What the user knows, skills, expertise areas",
    relationships: "People the user mentions, teams, connections",
    projects: "Active projects, goals, deadlines",
    history: "Past events, decisions, milestones",
    context: "Current situation, mood, recent focus areas",
  };
  return DEFAULT_VAULTS.map((id) => ({
    id,
    name: id.charAt(0).toUpperCase() + id.slice(1),
    description: descriptions[id] ?? id,
    isDefault: true,
    createdAt: new Date().toISOString(),
  }));
}

/**
 * Parse an LLM response string into an array of ExtractedFact objects.
 * Handles markdown fences and malformed JSON gracefully.
 */
function parseLLMResponse(raw: string): ExtractedFact[] {
  let cleaned = raw.trim();

  // Strip markdown code fences if present
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
  }

  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(
        (item: Record<string, unknown>) =>
          typeof item.fact === "string" && typeof item.vault === "string"
      )
      .map((item: Record<string, unknown>) => ({
        fact: item.fact as string,
        originalExcerpt: (item.originalExcerpt as string) ?? "",
        vault: item.vault as string,
        confidence: typeof item.confidence === "number" ? item.confidence : 0.7,
        entities: Array.isArray(item.entities)
          ? (item.entities as string[])
          : [],
        relationships: Array.isArray(item.relationships)
          ? (item.relationships as Array<{ targetFact: string; relation: string }>)
          : [],
      }));
  } catch {
    return [];
  }
}

/**
 * Merge rule-based and LLM-extracted facts, deduplicating by fact text similarity.
 * Rule-based facts get a slight confidence boost since they matched explicit patterns.
 */
function mergeResults(
  ruleFacts: ExtractedFact[],
  llmFacts: ExtractedFact[]
): ExtractedFact[] {
  // Boost rule-based confidence slightly
  const boosted = ruleFacts.map((f) => ({
    ...f,
    confidence: Math.min(1, f.confidence + 0.05),
  }));

  const merged = [...boosted];

  for (const llmFact of llmFacts) {
    const normalizedLLM = llmFact.fact.toLowerCase().trim();
    const isDuplicate = merged.some((existing) => {
      const normalizedExisting = existing.fact.toLowerCase().trim();
      return (
        normalizedExisting === normalizedLLM ||
        normalizedExisting.includes(normalizedLLM) ||
        normalizedLLM.includes(normalizedExisting)
      );
    });

    if (!isDuplicate) {
      merged.push(llmFact);
    }
  }

  return merged;
}

export class ExtractionEngine {
  private useLLM: boolean;
  private llmProvider?: LLMProviderConfig;
  private vaults: VaultDefinition[];

  constructor(config: ExtractionEngineConfig) {
    this.useLLM = config.useLLM;
    this.llmProvider = config.llmProvider;
    this.vaults = config.vaults ?? defaultVaultDefinitions();

    if (this.useLLM && !this.llmProvider) {
      throw new Error(
        "llmProvider config is required when useLLM is true"
      );
    }
  }

  /** Update vault definitions (when user creates new ones) */
  setVaults(vaults: VaultDefinition[]): void {
    this.vaults = vaults;
  }

  /**
   * Main extraction method — processes one exchange, returns extracted facts.
   *
   * Always runs rule-based extraction first.
   * If useLLM is true, also runs LLM extraction and merges/deduplicates results.
   */
  async extract(
    exchange: ConversationExchange,
    existingFacts?: string[]
  ): Promise<ExtractionResult> {
    const source: MemorySource = {
      platform: exchange.platform,
      conversationId: exchange.conversationId,
      timestamp: exchange.timestamp,
    };

    // Tier 1: rule-based extraction (always runs)
    const ruleFacts = extractByRules(exchange);

    // Tier 2: LLM extraction (if enabled)
    let llmFacts: ExtractedFact[] = [];
    if (this.useLLM && this.llmProvider) {
      llmFacts = await this.extractWithLLM(exchange, existingFacts ?? []);
    }

    // Merge and deduplicate
    const facts =
      llmFacts.length > 0
        ? mergeResults(ruleFacts, llmFacts)
        : ruleFacts;

    return { facts, source };
  }

  /** Call LLM for extraction via OpenAI-compatible chat completions endpoint */
  private async extractWithLLM(
    exchange: ConversationExchange,
    existingFacts: string[]
  ): Promise<ExtractedFact[]> {
    const provider = this.llmProvider!;
    const baseUrl = provider.baseUrl ?? "https://api.openai.com/v1";
    const prompt = buildExtractionPrompt(exchange, existingFacts, this.vaults);

    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${provider.apiKey}`,
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`LLM API error ${response.status}: ${errorText}`);
      }

      const data = (await response.json()) as {
        choices: Array<{ message: { content: string } }>;
      };

      const content = data.choices?.[0]?.message?.content;
      if (!content) return [];

      return parseLLMResponse(content);
    } catch (error) {
      // On LLM failure, return empty — rule-based results still apply
      console.error("LLM extraction failed:", error);
      return [];
    }
  }
}
