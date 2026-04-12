/** Pure TypeScript text similarity functions — no external dependencies */

const STOP_WORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "shall",
  "should", "may", "might", "must", "can", "could", "of", "in", "to",
  "for", "with", "on", "at", "from", "by", "about", "as", "into",
  "through", "during", "before", "after", "above", "below", "between",
  "and", "but", "or", "nor", "not", "so", "yet", "both", "either",
  "neither", "each", "every", "all", "any", "few", "more", "most",
  "other", "some", "such", "no", "only", "own", "same", "than", "too",
  "very", "just", "because", "if", "when", "where", "how", "what",
  "which", "who", "whom", "this", "that", "these", "those", "it", "its",
  "i", "me", "my", "we", "our", "you", "your", "he", "him", "his",
  "she", "her", "they", "them", "their",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

function tokenizeFiltered(text: string): string[] {
  return tokenize(text).filter((w) => !STOP_WORDS.has(w));
}

function buildFrequencyVector(tokens: string[]): Map<string, number> {
  const freq = new Map<string, number>();
  for (const token of tokens) {
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }
  return freq;
}

/**
 * Cosine similarity using word-frequency vectors.
 * Returns 0 when either input is empty.
 */
export function cosineSimilarity(a: string, b: string): number {
  const tokensA = tokenizeFiltered(a);
  const tokensB = tokenizeFiltered(b);
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const freqA = buildFrequencyVector(tokensA);
  const freqB = buildFrequencyVector(tokensB);

  // Compute dot product
  let dot = 0;
  for (const [word, countA] of freqA) {
    const countB = freqB.get(word);
    if (countB !== undefined) {
      dot += countA * countB;
    }
  }

  // Compute magnitudes
  let magA = 0;
  for (const count of freqA.values()) magA += count * count;
  let magB = 0;
  for (const count of freqB.values()) magB += count * count;

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Jaccard similarity — word overlap (intersection / union).
 * Uses content words only.
 */
export function jaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenizeFiltered(a));
  const setB = new Set(tokenizeFiltered(b));
  if (setA.size === 0 && setB.size === 0) return 0;

  let intersection = 0;
  for (const word of setA) {
    if (setB.has(word)) intersection++;
  }

  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Weighted combination of cosine and jaccard similarity.
 * Returns a value between 0 and 1.
 */
export function factSimilarity(a: string, b: string): number {
  const cosine = cosineSimilarity(a, b);
  const jaccard = jaccardSimilarity(a, b);
  // Weight cosine higher — it handles frequency/emphasis better
  return 0.6 * cosine + 0.4 * jaccard;
}

/**
 * Extracts key terms from text — content words that are likely important.
 * Returns unique terms in order of appearance.
 */
export function extractKeyTerms(text: string): string[] {
  const tokens = tokenizeFiltered(text);
  const seen = new Set<string>();
  const result: string[] = [];
  for (const token of tokens) {
    if (!seen.has(token)) {
      seen.add(token);
      result.push(token);
    }
  }
  return result;
}
