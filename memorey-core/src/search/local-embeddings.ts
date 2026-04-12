/** Pure TypeScript TF-IDF vectorizer — no external dependencies */

const STOP_WORDS = new Set([
  "a", "am", "an", "the", "is", "are", "was", "were", "be", "been", "being",
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
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/** Build word→index mapping from a set of documents */
export function buildVocabulary(documents: string[]): Map<string, number> {
  const vocab = new Map<string, number>();
  let index = 0;
  for (const doc of documents) {
    for (const word of tokenize(doc)) {
      if (!vocab.has(word)) {
        vocab.set(word, index++);
      }
    }
  }
  return vocab;
}

/** Compute IDF values: log(N / df) for each term */
function computeIdf(
  documents: string[],
  vocabulary: Map<string, number>
): Map<string, number> {
  const N = documents.length;
  const df = new Map<string, number>();

  for (const doc of documents) {
    const unique = new Set(tokenize(doc));
    for (const word of unique) {
      if (vocabulary.has(word)) {
        df.set(word, (df.get(word) ?? 0) + 1);
      }
    }
  }

  const idf = new Map<string, number>();
  for (const [word] of vocabulary) {
    const docFreq = df.get(word) ?? 0;
    // Smoothed IDF: log((N + 1) / (df + 1)) + 1
    idf.set(word, Math.log((N + 1) / (docFreq + 1)) + 1);
  }

  return idf;
}

/** Compute TF-IDF vector for a single text against a vocabulary */
export function tfidfVector(
  text: string,
  vocabulary: Map<string, number>,
  idf: Map<string, number>
): number[] {
  const tokens = tokenize(text);
  const vec = new Array(vocabulary.size).fill(0);

  if (tokens.length === 0) return vec;

  // Term frequency (normalized by doc length)
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }

  for (const [word, count] of tf) {
    const idx = vocabulary.get(word);
    if (idx !== undefined) {
      const termFreq = count / tokens.length;
      const idfVal = idf.get(word) ?? 1;
      vec[idx] = termFreq * idfVal;
    }
  }

  return vec;
}

/** Cosine similarity between two numeric vectors */
export function cosineSimilarityVec(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;

  let dot = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    magA += a[i] * a[i];
    magB += b[i] * b[i];
  }

  const denom = Math.sqrt(magA) * Math.sqrt(magB);
  return denom === 0 ? 0 : dot / denom;
}

/**
 * Local TF-IDF embedding engine — always works offline, no API required.
 * Maintains an internal vocabulary built from indexed documents.
 */
export class LocalEmbeddings {
  private vocabulary: Map<string, number> = new Map();
  private idf: Map<string, number> = new Map();
  private documents: string[] = [];

  /** Build the index from a set of documents */
  build(documents: string[]): void {
    this.documents = [...documents];
    this.vocabulary = buildVocabulary(this.documents);
    this.idf = computeIdf(this.documents, this.vocabulary);
  }

  /** Incrementally add a document to the index */
  addDocument(text: string): void {
    this.documents.push(text);
    // Add any new words to vocabulary
    for (const word of tokenize(text)) {
      if (!this.vocabulary.has(word)) {
        this.vocabulary.set(word, this.vocabulary.size);
      }
    }
    // Recompute IDF (relatively cheap for incremental adds)
    this.idf = computeIdf(this.documents, this.vocabulary);
  }

  /** Get TF-IDF embedding vector for a text */
  embed(text: string): number[] {
    return tfidfVector(text, this.vocabulary, this.idf);
  }

  /** Compute similarity between two texts */
  similarity(a: string, b: string): number {
    const vecA = this.embed(a);
    const vecB = this.embed(b);
    return cosineSimilarityVec(vecA, vecB);
  }

  /** Number of terms in the vocabulary */
  get vocabSize(): number {
    return this.vocabulary.size;
  }
}
