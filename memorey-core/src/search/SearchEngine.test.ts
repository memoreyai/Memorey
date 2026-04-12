import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryGraph } from "../graph/MemoryGraph.js";
import type { MemorySource, Vault, MemoryNode, ApprovalStatus } from "../graph/types.js";
import { SearchEngine } from "./SearchEngine.js";
import {
  LocalEmbeddings,
  buildVocabulary,
  tfidfVector,
  cosineSimilarityVec,
} from "./local-embeddings.js";
import type { EmbeddingProvider } from "./types.js";

function makeSource(overrides?: Partial<MemorySource>): MemorySource {
  return {
    platform: "claude",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeNodeInput(overrides?: {
  fact?: string;
  vault?: Vault;
  confidence?: number;
  tags?: string[];
  status?: ApprovalStatus;
}) {
  return {
    fact: overrides?.fact ?? "User works at Acme Corp",
    vault: (overrides?.vault ?? "work") as Vault,
    confidence: overrides?.confidence ?? 0.9,
    source: makeSource(),
    supersededBy: null,
    tags: overrides?.tags ?? [],
    ...(overrides?.status ? { status: overrides.status } : {}),
  };
}

// ── Local Embeddings (TF-IDF) ────────────────────────────────────

describe("LocalEmbeddings", () => {
  describe("buildVocabulary", () => {
    it("should build word→index mapping from documents", () => {
      const docs = ["I work at Google", "I like pizza"];
      const vocab = buildVocabulary(docs);

      expect(vocab.size).toBeGreaterThan(0);
      expect(vocab.has("work")).toBe(true);
      expect(vocab.has("google")).toBe(true);
      expect(vocab.has("pizza")).toBe(true);
      expect(vocab.has("like")).toBe(true);
    });

    it("should filter stop words", () => {
      const docs = ["I am a person"];
      const vocab = buildVocabulary(docs);

      // "I", "am", "a" are stop words
      expect(vocab.has("i")).toBe(false);
      expect(vocab.has("am")).toBe(false);
      expect(vocab.has("a")).toBe(false);
      expect(vocab.has("person")).toBe(true);
    });
  });

  describe("tfidfVector", () => {
    it("should return a vector of the correct size", () => {
      const docs = ["hello world", "foo bar"];
      const vocab = buildVocabulary(docs);
      // We need idf — use LocalEmbeddings for convenience
      const le = new LocalEmbeddings();
      le.build(docs);
      const vec = le.embed("hello world");

      expect(vec.length).toBe(vocab.size);
    });
  });

  describe("cosineSimilarityVec", () => {
    it("should return 1 for identical vectors", () => {
      const v = [1, 2, 3];
      expect(cosineSimilarityVec(v, v)).toBeCloseTo(1.0);
    });

    it("should return 0 for orthogonal vectors", () => {
      expect(cosineSimilarityVec([1, 0], [0, 1])).toBeCloseTo(0.0);
    });

    it("should return 0 for empty vectors", () => {
      expect(cosineSimilarityVec([], [])).toBe(0);
    });
  });

  describe("similarity", () => {
    it("'I work at Google' is more similar to 'User works at Google' than to 'I like pizza'", () => {
      const le = new LocalEmbeddings();
      le.build([
        "I work at Google",
        "User works at Google",
        "I like pizza",
      ]);

      const simSame = le.similarity("I work at Google", "User works at Google");
      const simDiff = le.similarity("I work at Google", "I like pizza");

      expect(simSame).toBeGreaterThan(simDiff);
    });

    it("should return 0 for completely unrelated short texts after building vocab", () => {
      const le = new LocalEmbeddings();
      le.build(["alpha beta", "gamma delta"]);

      const sim = le.similarity("alpha beta", "gamma delta");
      expect(sim).toBeCloseTo(0.0);
    });
  });

  describe("incremental indexing", () => {
    it("should grow vocabulary when new documents are added", () => {
      const le = new LocalEmbeddings();
      le.build(["cats dogs"]);
      const sizeBefore = le.vocabSize;

      le.addDocument("elephants giraffes");
      expect(le.vocabSize).toBeGreaterThan(sizeBefore);
    });

    it("should still compute similarity after incremental adds", () => {
      const le = new LocalEmbeddings();
      le.build(["User works at Google"]);
      le.addDocument("User works at Microsoft");

      const sim = le.similarity(
        "User works at Google",
        "User works at Microsoft"
      );
      expect(sim).toBeGreaterThan(0);
    });
  });
});

// ── SearchEngine ─────────────────────────────────────────────────

describe("SearchEngine", () => {
  let graph: MemoryGraph;
  let engine: SearchEngine;

  beforeEach(() => {
    graph = new MemoryGraph("user-1");

    // Seed the graph with diverse facts
    graph.addNode(makeNodeInput({ fact: "User prefers TypeScript", vault: "preferences" }));
    graph.addNode(makeNodeInput({ fact: "User works at Google", vault: "work" }));
    graph.addNode(makeNodeInput({ fact: "User likes Python for data science", vault: "preferences" }));
    graph.addNode(makeNodeInput({ fact: "User is 30 years old", vault: "identity" }));
    graph.addNode(makeNodeInput({ fact: "User lives in San Francisco", vault: "identity" }));
    graph.addNode(
      makeNodeInput({ fact: "User enjoys hiking on weekends", vault: "preferences" })
    );
    graph.addNode(
      makeNodeInput({
        fact: "User is learning Rust programming language",
        vault: "knowledge",
        tags: ["programming", "rust"],
      })
    );

    engine = new SearchEngine(graph, { useApiEmbeddings: false });
  });

  describe("search", () => {
    it("should find semantically related facts: 'programming languages' finds TypeScript/Rust", async () => {
      const results = await engine.search("programming languages");

      // Should find at least the TypeScript and Rust facts
      const facts = results.map((r) => r.node.fact);
      const hasRelevant = facts.some(
        (f) =>
          f.includes("TypeScript") ||
          f.includes("Rust") ||
          f.includes("Python")
      );
      expect(hasRelevant).toBe(true);
    });

    it("should rank exact matches higher than semantic matches", async () => {
      const results = await engine.search("TypeScript");

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].node.fact).toContain("TypeScript");
      expect(results[0].matchType).toBe("exact");
    });

    it("should respect vault filter", async () => {
      const results = await engine.search("User", {
        vaults: ["identity"],
      });

      for (const r of results) {
        expect(r.node.vault).toBe("identity");
      }
      // Should have the identity facts
      expect(results.length).toBe(2);
    });

    it("should respect status filter (excludes rejected by default)", async () => {
      // Add a rejected node
      const rejected = graph.addNode(
        makeNodeInput({
          fact: "User hates JavaScript",
          vault: "preferences",
        })
      );
      graph.rejectNode(rejected.id);

      // Rebuild index with the new node
      engine.rebuildIndex();

      const results = await engine.search("JavaScript");

      const rejectedFacts = results.filter(
        (r) => r.node.status === "rejected"
      );
      expect(rejectedFacts.length).toBe(0);
    });

    it("should include rejected when statusFilter explicitly includes it", async () => {
      const rejected = graph.addNode(
        makeNodeInput({
          fact: "User hates JavaScript",
          vault: "preferences",
        })
      );
      graph.rejectNode(rejected.id);
      engine.rebuildIndex();

      const results = await engine.search("JavaScript", {
        statusFilter: ["approved", "auto_approved", "rejected"],
      });

      const rejectedFacts = results.filter(
        (r) => r.node.status === "rejected"
      );
      expect(rejectedFacts.length).toBe(1);
    });

    it("should respect confidence threshold", async () => {
      graph.addNode(
        makeNodeInput({
          fact: "User maybe likes Go",
          vault: "preferences",
          confidence: 0.3,
        })
      );
      engine.rebuildIndex();

      const results = await engine.search("Go", { minConfidence: 0.5 });

      for (const r of results) {
        expect(r.node.confidence).toBeGreaterThanOrEqual(0.5);
      }
    });

    it("should respect limit", async () => {
      const results = await engine.search("User", { limit: 3 });
      expect(results.length).toBeLessThanOrEqual(3);
    });

    it("should exclude superseded nodes by default", async () => {
      const oldNode = graph.addNode(
        makeNodeInput({ fact: "User works at Facebook", vault: "work" })
      );
      graph.supersede(oldNode.id, makeNodeInput({ fact: "User works at Meta", vault: "work" }));
      engine.rebuildIndex();

      const results = await engine.search("Facebook");

      const superseded = results.filter(
        (r) => r.node.supersededBy !== null
      );
      expect(superseded.length).toBe(0);
    });

    it("should include superseded nodes when requested", async () => {
      const oldNode = graph.addNode(
        makeNodeInput({ fact: "User works at Facebook", vault: "work" })
      );
      graph.supersede(oldNode.id, makeNodeInput({ fact: "User works at Meta", vault: "work" }));
      engine.rebuildIndex();

      const results = await engine.search("Facebook", {
        includeSuperseded: true,
      });

      const hasSuperseded = results.some(
        (r) => r.node.fact.includes("Facebook") && r.node.supersededBy !== null
      );
      expect(hasSuperseded).toBe(true);
    });
  });

  describe("findRelated", () => {
    it("should return connected nodes via graph edges", async () => {
      const nodeA = graph.addNode(
        makeNodeInput({ fact: "User knows React", vault: "knowledge" })
      );
      const nodeB = graph.addNode(
        makeNodeInput({ fact: "User knows Next.js", vault: "knowledge" })
      );
      graph.addEdge({
        fromId: nodeA.id,
        toId: nodeB.id,
        relation: "related_to",
        weight: 0.9,
      });
      engine.rebuildIndex();

      const related = await engine.findRelated(nodeA.id);

      const relatedFacts = related.map((r) => r.node.fact);
      expect(relatedFacts).toContain("User knows Next.js");

      const nextjsResult = related.find((r) =>
        r.node.fact.includes("Next.js")
      );
      expect(nextjsResult?.matchType).toBe("related");
    });

    it("should also find semantically similar nodes not directly connected", async () => {
      const nodeA = graph.addNode(
        makeNodeInput({
          fact: "User enjoys cooking Italian food",
          vault: "preferences",
        })
      );
      graph.addNode(
        makeNodeInput({
          fact: "User loves making pasta dishes",
          vault: "preferences",
        })
      );
      engine.rebuildIndex();

      const related = await engine.findRelated(nodeA.id);

      // Should include semantically similar nodes
      expect(related.length).toBeGreaterThan(0);
    });

    it("should return empty for nonexistent node", async () => {
      const related = await engine.findRelated("nonexistent-id");
      expect(related).toEqual([]);
    });
  });

  describe("rebuildIndex", () => {
    it("should correctly rebuild after adding new nodes", async () => {
      // Initial search
      const before = await engine.search("machine learning");
      const hadML = before.some((r) =>
        r.node.fact.toLowerCase().includes("machine learning")
      );
      expect(hadML).toBe(false);

      // Add a new node and rebuild
      graph.addNode(
        makeNodeInput({
          fact: "User is studying machine learning",
          vault: "knowledge",
        })
      );
      engine.rebuildIndex();

      const after = await engine.search("machine learning");
      const hasML = after.some((r) =>
        r.node.fact.toLowerCase().includes("machine learning")
      );
      expect(hasML).toBe(true);
    });
  });

  describe("indexNode", () => {
    it("should make newly indexed node searchable", async () => {
      const node = graph.addNode(
        makeNodeInput({
          fact: "User speaks Japanese fluently",
          vault: "knowledge",
        })
      );
      engine.indexNode(node);

      const results = await engine.search("Japanese");
      const found = results.some((r) =>
        r.node.fact.includes("Japanese")
      );
      expect(found).toBe(true);
    });
  });

  describe("fallback to local embeddings", () => {
    it("should use local embeddings when no API provider configured", async () => {
      const localEngine = new SearchEngine(graph, {
        useApiEmbeddings: false,
      });

      const results = await localEngine.search("TypeScript");
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].node.fact).toContain("TypeScript");
    });
  });

  describe("API embedding provider (mocked)", () => {
    it("should use API embeddings when provider is configured", async () => {
      // Create a mock embedding provider
      const mockEmbeddings: number[][] = [];
      const mockProvider: EmbeddingProvider = {
        embed: vi.fn(async (_text: string): Promise<number[]> => {
          // Return a simple deterministic embedding
          return [0.1, 0.2, 0.3, 0.4, 0.5];
        }),
        embedBatch: vi.fn(async (texts: string[]): Promise<number[][]> => {
          // Return slightly different embeddings per text
          return texts.map((_, i) => [
            0.1 + i * 0.01,
            0.2 + i * 0.01,
            0.3 + i * 0.01,
            0.4 + i * 0.01,
            0.5 + i * 0.01,
          ]);
        }),
      };

      const apiEngine = new SearchEngine(graph, {
        useApiEmbeddings: true,
        embeddingProvider: mockProvider,
      });

      const results = await apiEngine.search("TypeScript");

      // The provider should have been called
      expect(mockProvider.embed).toHaveBeenCalled();
      expect(results.length).toBeGreaterThan(0);
    });

    it("should cache API embeddings for subsequent searches", async () => {
      const embedCallCount = { embed: 0, batch: 0 };
      const mockProvider: EmbeddingProvider = {
        embed: vi.fn(async (_text: string): Promise<number[]> => {
          embedCallCount.embed++;
          return [0.1, 0.2, 0.3];
        }),
        embedBatch: vi.fn(async (texts: string[]): Promise<number[][]> => {
          embedCallCount.batch++;
          return texts.map(() => [0.1, 0.2, 0.3]);
        }),
      };

      const apiEngine = new SearchEngine(graph, {
        useApiEmbeddings: true,
        embeddingProvider: mockProvider,
      });

      // First search — should call embedBatch for candidates
      await apiEngine.search("TypeScript");
      const firstBatchCount = embedCallCount.batch;

      // Second search — candidates already cached, no new batch call
      await apiEngine.search("Python");
      expect(embedCallCount.batch).toBe(firstBatchCount);
    });
  });
});
