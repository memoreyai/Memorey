import type { Vault } from "../graph/types.js";
import type { ConversationExchange, ExtractedFact } from "./types.js";

interface PatternRule {
  pattern: RegExp;
  vault: Vault;
  buildFact: (match: RegExpMatchArray) => string;
  confidence: number;
  extractEntities: (match: RegExpMatchArray) => string[];
  category: string;
}

/** Capitalize first letter of each word */
function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Clean up extracted value — trim, remove trailing punctuation */
function clean(s: string): string {
  return s.trim().replace(/[.,;!?]+$/, "").trim();
}

// Common sentence boundary: punctuation, conjunctions, or end of string
const B = "(?:[.,;!?]|\\band\\b|\\bbut\\b|\\bso\\b|$)";

const IDENTITY_PATTERNS: PatternRule[] = [
  {
    pattern: /\bmy name is (\w[\w\s]*?)(?:[.,;!?]|\band\b|\bbut\b|$)/i,
    vault: "identity",
    buildFact: (m) => `User's name is ${titleCase(clean(m[1]))}`,
    confidence: 0.95,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "identity",
  },
  {
    // "I'm Vikram" — proper noun (capitalized first letter, not a role word)
    pattern: /\bI'?m ([A-Z][a-z]+)\b/,
    vault: "identity",
    buildFact: (m) => `User's name is ${clean(m[1])}`,
    confidence: 0.7,
    extractEntities: (m) => [clean(m[1])],
    category: "identity",
  },
  {
    pattern: /\bI'?m (\w[\w\s]*?) years old\b/i,
    vault: "identity",
    buildFact: (m) => `User is ${clean(m[1])} years old`,
    confidence: 0.9,
    extractEntities: () => [],
    category: "identity",
  },
  {
    pattern: /\bI(?:'m| am) (\d{2,3})\b/i,
    vault: "identity",
    buildFact: (m) => `User is ${m[1]} years old`,
    confidence: 0.7,
    extractEntities: () => [],
    category: "identity",
  },
  {
    pattern: new RegExp(`\\bI live in ([A-Z][\\w\\s,]*?)${B}`, "i"),
    vault: "identity",
    buildFact: (m) => `User lives in ${titleCase(clean(m[1]))}`,
    confidence: 0.9,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "identity",
  },
  {
    pattern: new RegExp(`\\bI'?m from ([A-Z][\\w\\s,]*?)${B}`, "i"),
    vault: "identity",
    buildFact: (m) => `User is from ${titleCase(clean(m[1]))}`,
    confidence: 0.9,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "identity",
  },
];

const WORK_PATTERNS: PatternRule[] = [
  {
    pattern: new RegExp(`\\bI work at ([A-Z][\\w\\s&.-]*?)${B}`, "i"),
    vault: "work",
    buildFact: (m) => `User works at ${titleCase(clean(m[1]))}`,
    confidence: 0.9,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "work",
  },
  {
    pattern: new RegExp(`\\bI work (?:as|for) (?:a |an )?([A-Za-z][\\w\\s&.-]*?)${B}`, "i"),
    vault: "work",
    buildFact: (m) => `User works as ${clean(m[1]).toLowerCase()}`,
    confidence: 0.85,
    extractEntities: () => [],
    category: "work",
  },
  {
    pattern: /\bI'?m (?:a |an )([\w\s]+?(?:developer|engineer|designer|manager|analyst|scientist|architect|consultant|founder|CEO|CTO|CPO|CFO|COO|director|lead|intern|student))\b/i,
    vault: "work",
    buildFact: (m) => `User is a ${clean(m[1]).toLowerCase()}`,
    confidence: 0.9,
    extractEntities: () => [],
    category: "work",
  },
  {
    pattern: new RegExp(`\\bmy company is ([A-Z][\\w\\s&.-]*?)${B}`, "i"),
    vault: "work",
    buildFact: (m) => `User's company is ${titleCase(clean(m[1]))}`,
    confidence: 0.9,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "work",
  },
  {
    pattern: new RegExp(`\\bI'?m building ([A-Za-z][\\w\\s]*?)${B}`, "i"),
    vault: "work",
    buildFact: (m) => `User is building ${clean(m[1])}`,
    confidence: 0.85,
    extractEntities: (m) => [clean(m[1])],
    category: "work",
  },
  {
    pattern: new RegExp(`\\bI work at (?:a )?(\\w[\\w\\s]*?)${B}`, "i"),
    vault: "work",
    buildFact: (m) => `User works at ${clean(m[1])}`,
    confidence: 0.85,
    extractEntities: (m) => [clean(m[1])],
    category: "work",
  },
];

const PREFERENCE_PATTERNS: PatternRule[] = [
  {
    pattern: new RegExp(`\\bI prefer (\\w[\\w\\s]*?) over (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "preferences",
    buildFact: (m) => `User prefers ${clean(m[1])} over ${clean(m[2])}`,
    confidence: 0.9,
    extractEntities: (m) => [clean(m[1]), clean(m[2])],
    category: "preferences",
  },
  {
    pattern: new RegExp(`\\bI prefer (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "preferences",
    buildFact: (m) => `User prefers ${clean(m[1])}`,
    confidence: 0.85,
    extractEntities: (m) => [clean(m[1])],
    category: "preferences",
  },
  {
    pattern: new RegExp(`\\bI (?:really )?like (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "preferences",
    buildFact: (m) => `User likes ${clean(m[1])}`,
    confidence: 0.8,
    extractEntities: (m) => [clean(m[1])],
    category: "preferences",
  },
  {
    pattern: new RegExp(`\\bI don'?t like (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "preferences",
    buildFact: (m) => `User does not like ${clean(m[1])}`,
    confidence: 0.85,
    extractEntities: (m) => [clean(m[1])],
    category: "preferences",
  },
  {
    pattern: new RegExp(`\\bI use (\\w[\\w\\s]*?) for (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "preferences",
    buildFact: (m) => `User uses ${clean(m[1])} for ${clean(m[2])}`,
    confidence: 0.85,
    extractEntities: (m) => [clean(m[1])],
    category: "preferences",
  },
  {
    pattern: new RegExp(`\\bmy fav(?:ou?rite)? (\\w[\\w\\s]*?) is (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "preferences",
    buildFact: (m) => `User's favorite ${clean(m[1])} is ${clean(m[2])}`,
    confidence: 0.9,
    extractEntities: (m) => [clean(m[2])],
    category: "preferences",
  },
];

const RELATION_WORDS = "wife|husband|partner|spouse|girlfriend|boyfriend|brother|sister|mother|father|mom|dad|son|daughter|boss|manager|cofounder|co-founder|friend|colleague|mentor|team lead|teammate";

const RELATIONSHIP_PATTERNS: PatternRule[] = [
  {
    pattern: new RegExp(`\\bmy (${RELATION_WORDS})(?:'s name)? is (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "relationships",
    buildFact: (m) => `User's ${clean(m[1]).toLowerCase()} is ${titleCase(clean(m[2]))}`,
    confidence: 0.9,
    extractEntities: (m) => [titleCase(clean(m[2]))],
    category: "relationships",
  },
  {
    pattern: new RegExp(`\\b(\\w[\\w\\s]*?) is my (${RELATION_WORDS})${B}`, "i"),
    vault: "relationships",
    buildFact: (m) => `User's ${clean(m[2]).toLowerCase()} is ${titleCase(clean(m[1]))}`,
    confidence: 0.9,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "relationships",
  },
  {
    pattern: new RegExp(`\\bI work with (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "relationships",
    buildFact: (m) => `User works with ${titleCase(clean(m[1]))}`,
    confidence: 0.8,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "relationships",
  },
  {
    pattern: /\bmy (?:cofounder|co-founder) (\w[\w\s]*?) and I\b/i,
    vault: "relationships",
    buildFact: (m) => `User's cofounder is ${titleCase(clean(m[1]))}`,
    confidence: 0.9,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "relationships",
  },
];

const PROJECT_PATTERNS: PatternRule[] = [
  {
    pattern: new RegExp(`\\bI'?m working on (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "projects",
    buildFact: (m) => `User is working on ${clean(m[1])}`,
    confidence: 0.85,
    extractEntities: (m) => [clean(m[1])],
    category: "projects",
  },
  {
    pattern: new RegExp(`\\bmy project (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "projects",
    buildFact: (m) => `User has a project called ${clean(m[1])}`,
    confidence: 0.85,
    extractEntities: (m) => [clean(m[1])],
    category: "projects",
  },
  {
    pattern: new RegExp(`\\b(?:we're|we are|are) building (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "projects",
    buildFact: (m) => `User is building ${clean(m[1])}`,
    confidence: 0.8,
    extractEntities: (m) => [clean(m[1])],
    category: "projects",
  },
  {
    pattern: new RegExp(`\\bthe deadline is ([A-Za-z0-9][\\w\\s,]*?)${B}`, "i"),
    vault: "projects",
    buildFact: (m) => `User has a deadline: ${clean(m[1])}`,
    confidence: 0.85,
    extractEntities: () => [],
    category: "projects",
  },
];

const TEMPORAL_PATTERNS: PatternRule[] = [
  {
    pattern: new RegExp(`\\bI (?:just |recently )?moved (?:from ([A-Z][\\w\\s,]*?) )?to ([A-Z][\\w\\s,]*?)${B}`, "i"),
    vault: "identity",
    buildFact: (m) => {
      const from = m[1] ? titleCase(clean(m[1])) : null;
      const to = titleCase(clean(m[2]));
      return from
        ? `User recently moved from ${from} to ${to}`
        : `User recently moved to ${to}`;
    },
    confidence: 0.85,
    extractEntities: (m) => {
      const entities = [titleCase(clean(m[2]))];
      if (m[1]) entities.unshift(titleCase(clean(m[1])));
      return entities;
    },
    category: "identity",
  },
  {
    pattern: new RegExp(`\\bI recently started (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "history",
    buildFact: (m) => `User recently started ${clean(m[1])}`,
    confidence: 0.8,
    extractEntities: (m) => [clean(m[1])],
    category: "history",
  },
  {
    pattern: new RegExp(`\\blast (?:week|month|year) I (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "history",
    buildFact: (m) => `User ${clean(m[1])} recently`,
    confidence: 0.75,
    extractEntities: () => [],
    category: "history",
  },
  {
    pattern: new RegExp(`\\bI used to (?:work at|work for) ([A-Z][\\w\\s&.-]*?)${B}`, "i"),
    vault: "history",
    buildFact: (m) => `User used to work at ${titleCase(clean(m[1]))}`,
    confidence: 0.85,
    extractEntities: (m) => [titleCase(clean(m[1]))],
    category: "history",
  },
  {
    pattern: new RegExp(`\\bI used to (\\w[\\w\\s]*?)${B}`, "i"),
    vault: "history",
    buildFact: (m) => `User used to ${clean(m[1])}`,
    confidence: 0.75,
    extractEntities: () => [],
    category: "history",
  },
];

const ALL_PATTERNS: PatternRule[] = [
  ...IDENTITY_PATTERNS,
  ...WORK_PATTERNS,
  ...PREFERENCE_PATTERNS,
  ...RELATIONSHIP_PATTERNS,
  ...PROJECT_PATTERNS,
  ...TEMPORAL_PATTERNS,
];

/** Deduplicate facts by checking if one fact string is a substring of another */
function deduplicateFacts(facts: ExtractedFact[]): ExtractedFact[] {
  const result: ExtractedFact[] = [];
  for (const fact of facts) {
    const dominated = result.some(
      (existing) =>
        existing.fact === fact.fact ||
        (existing.vault === fact.vault &&
          existing.fact.includes(fact.fact) &&
          existing.confidence >= fact.confidence)
    );
    if (!dominated) {
      // Remove any existing facts that this new one supersedes
      for (let i = result.length - 1; i >= 0; i--) {
        if (
          result[i].vault === fact.vault &&
          fact.fact.includes(result[i].fact) &&
          fact.confidence >= result[i].confidence
        ) {
          result.splice(i, 1);
        }
      }
      result.push(fact);
    }
  }
  return result;
}

/**
 * Rule-based extraction — fast, no LLM needed.
 * Processes only the user's message from the exchange.
 */
export function extractByRules(exchange: ConversationExchange): ExtractedFact[] {
  const text = exchange.userMessage;
  if (!text || text.trim().length === 0) return [];

  const facts: ExtractedFact[] = [];

  for (const rule of ALL_PATTERNS) {
    const match = text.match(rule.pattern);
    if (!match) continue;

    const fact = rule.buildFact(match);
    const entities = rule.extractEntities(match);

    facts.push({
      fact,
      originalExcerpt: match[0].trim(),
      vault: rule.vault,
      confidence: rule.confidence,
      entities,
      relationships: [],
    });
  }

  return deduplicateFacts(facts);
}
