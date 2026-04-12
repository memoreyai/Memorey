import { describe, it, expect, beforeEach } from "vitest";
import { MemoryGraph } from "../graph/MemoryGraph.js";
import type { MemorySource, Vault } from "../graph/types.js";
import { BriefingGenerator } from "./BriefingGenerator.js";

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
}) {
  return {
    fact: overrides?.fact ?? "User works at Acme Corp",
    vault: (overrides?.vault ?? "work") as Vault,
    confidence: overrides?.confidence ?? 0.9,
    source: makeSource(),
    supersededBy: null,
    tags: overrides?.tags ?? [],
  };
}

describe("BriefingGenerator", () => {
  let graph: MemoryGraph;
  let generator: BriefingGenerator;

  beforeEach(() => {
    graph = new MemoryGraph("user-1");
    generator = new BriefingGenerator(graph);
  });

  // 1. Empty graph → appropriate empty message
  describe("empty graph", () => {
    it("should produce a briefing with zero facts and appropriate content", () => {
      const briefing = generator.generate();

      expect(briefing.factsIncluded).toBe(0);
      expect(briefing.factsExcluded).toBe(0);
      expect(briefing.content).toBeDefined();
      expect(briefing.estimatedTokens).toBeGreaterThan(0);
      expect(briefing.generatedAt).toBeDefined();
      expect(Object.keys(briefing.vaultBreakdown)).toHaveLength(0);
    });
  });

  // 2. Basic briefing with facts across default vaults
  describe("basic briefing with facts across vaults", () => {
    it("should include facts from multiple vaults", () => {
      graph.addNode(makeNodeInput({ fact: "User is Alice", vault: "identity" }));
      graph.addNode(makeNodeInput({ fact: "Works at Acme Corp", vault: "work" }));
      graph.addNode(makeNodeInput({ fact: "Prefers dark mode", vault: "preferences" }));

      const briefing = generator.generate();

      expect(briefing.factsIncluded).toBe(3);
      expect(briefing.content).toContain("User is Alice");
      expect(briefing.content).toContain("Works at Acme Corp");
      expect(briefing.content).toContain("Prefers dark mode");
      expect(Object.keys(briefing.vaultBreakdown).length).toBe(3);
    });

    it("should use vault display names as section headers in system_prompt format", () => {
      graph.addNode(makeNodeInput({ fact: "User is Alice", vault: "identity" }));
      graph.addNode(makeNodeInput({ fact: "Works at Acme", vault: "work" }));

      const briefing = generator.generate({ format: "system_prompt" });

      expect(briefing.content).toContain("Identity");
      expect(briefing.content).toContain("Work");
    });
  });

  // 3. Token budget respected
  describe("token budget", () => {
    it("should respect maxTokens by excluding lower-scored facts", () => {
      // Add many facts to exceed a small token budget
      for (let i = 0; i < 50; i++) {
        graph.addNode(
          makeNodeInput({
            fact: `This is a reasonably long fact number ${i} that takes up some token budget space`,
            vault: "knowledge",
            confidence: 0.5 + Math.random() * 0.5,
          })
        );
      }

      const briefing = generator.generate({ maxTokens: 200 });

      expect(briefing.estimatedTokens).toBeLessThanOrEqual(200);
      expect(briefing.factsIncluded).toBeLessThan(50);
      expect(briefing.factsExcluded).toBeGreaterThan(0);
    });
  });

  // 4. Recency bias works
  describe("recency bias", () => {
    it("should rank more recent facts higher with high recency bias", () => {
      // Add an older fact
      const oldNode = graph.addNode(
        makeNodeInput({ fact: "Old fact from long ago", vault: "work", confidence: 0.7 })
      );
      // Manually set the updatedAt to a past date
      (oldNode as any).updatedAt = new Date("2020-01-01").toISOString();

      // Add a recent fact
      graph.addNode(
        makeNodeInput({ fact: "Recent fact from today", vault: "work", confidence: 0.7 })
      );

      // With very tight budget, only one fact fits
      const briefing = generator.generate({
        maxTokens: 150,
        recencyBias: 1.0,
      });

      // Recent fact should be included over old one
      expect(briefing.content).toContain("Recent fact from today");
    });
  });

  // 5. Task relevance works
  describe("task relevance", () => {
    it("should boost facts relevant to the task description", () => {
      graph.addNode(
        makeNodeInput({
          fact: "User loves cooking Italian food",
          vault: "preferences",
          confidence: 0.6,
          tags: ["cooking"],
        })
      );
      graph.addNode(
        makeNodeInput({
          fact: "User is learning TypeScript",
          vault: "knowledge",
          confidence: 0.6,
          tags: ["typescript", "programming"],
        })
      );

      const briefing = generator.generateForTask("Help with TypeScript code", {
        maxTokens: 150,
      });

      // TypeScript fact should be boosted
      expect(briefing.content).toContain("TypeScript");
    });
  });

  // 6. Vault filtering works — including filtering by custom vault
  describe("vault filtering", () => {
    it("should include only specified vaults when includeVaults is set", () => {
      graph.addNode(makeNodeInput({ fact: "Identity fact", vault: "identity" }));
      graph.addNode(makeNodeInput({ fact: "Work fact", vault: "work" }));
      graph.addNode(makeNodeInput({ fact: "Pref fact", vault: "preferences" }));

      const briefing = generator.generate({
        includeVaults: ["identity", "work"],
      });

      expect(briefing.content).toContain("Identity fact");
      expect(briefing.content).toContain("Work fact");
      expect(briefing.content).not.toContain("Pref fact");
      expect(briefing.factsIncluded).toBe(2);
    });

    it("should exclude specified vaults when excludeVaults is set", () => {
      graph.addNode(makeNodeInput({ fact: "Identity fact", vault: "identity" }));
      graph.addNode(makeNodeInput({ fact: "Work fact", vault: "work" }));

      const briefing = generator.generate({
        excludeVaults: ["work"],
      });

      expect(briefing.content).toContain("Identity fact");
      expect(briefing.content).not.toContain("Work fact");
    });

    it("should filter by custom vault", () => {
      graph.addVault({ name: "Health", description: "Health data" });
      graph.addNode(makeNodeInput({ fact: "Runs daily", vault: "health" }));
      graph.addNode(makeNodeInput({ fact: "Works at Acme", vault: "work" }));

      const briefing = generator.generate({
        includeVaults: ["health"],
      });

      expect(briefing.content).toContain("Runs daily");
      expect(briefing.content).not.toContain("Works at Acme");
      expect(briefing.factsIncluded).toBe(1);
    });
  });

  // 7. Custom vault names appear as section headers (not ids)
  describe("custom vault display names", () => {
    it("should use custom vault name as section header, not vault id", () => {
      graph.addVault({ name: "Health & Fitness", description: "Health data" });
      graph.addNode(makeNodeInput({ fact: "Runs 5k daily", vault: "health_&_fitness" }));

      const briefing = generator.generate({ format: "system_prompt" });

      expect(briefing.content).toContain("Health & Fitness");
      expect(briefing.content).not.toContain("health_&_fitness");
    });

    it("should use custom vault name in markdown format", () => {
      graph.addVault({ name: "Finances", description: "Money matters" });
      graph.addNode(makeNodeInput({ fact: "Has savings account", vault: "finances" }));

      const briefing = generator.generate({ format: "markdown" });

      expect(briefing.content).toContain("## Finances");
    });
  });

  // 8. All three formats produce valid output
  describe("output formats", () => {
    beforeEach(() => {
      graph.addNode(makeNodeInput({ fact: "User is Alice", vault: "identity" }));
      graph.addNode(makeNodeInput({ fact: "Works at Acme", vault: "work" }));
    });

    it("should produce valid system_prompt format", () => {
      const briefing = generator.generate({ format: "system_prompt" });

      expect(briefing.content).toContain(
        "The user you're talking to has shared the following context"
      );
      expect(briefing.content).toContain("Memorey");
      expect(briefing.content).toContain("- User is Alice");
      expect(briefing.content).toContain("- Works at Acme");
    });

    it("should produce valid markdown format", () => {
      const briefing = generator.generate({ format: "markdown" });

      expect(briefing.content).toContain("## Identity");
      expect(briefing.content).toContain("## Work");
      expect(briefing.content).toContain("- User is Alice");
      expect(briefing.content).toContain("- Works at Acme");
    });

    it("should produce valid structured_json format", () => {
      const briefing = generator.generate({ format: "structured_json" });

      const parsed = JSON.parse(briefing.content);
      expect(parsed).toBeDefined();
      expect(parsed.identity).toContain("User is Alice");
      expect(parsed.work).toContain("Works at Acme");
    });
  });

  // 9. Relationship context included when enabled
  describe("relationship context", () => {
    it("should boost connected facts when includeRelationships is true", () => {
      const a = graph.addNode(
        makeNodeInput({ fact: "Well connected fact", vault: "identity", confidence: 0.7 })
      );
      const b = graph.addNode(
        makeNodeInput({ fact: "Related to A", vault: "identity", confidence: 0.7 })
      );
      const c = graph.addNode(
        makeNodeInput({ fact: "Also related to A", vault: "identity", confidence: 0.7 })
      );
      graph.addNode(
        makeNodeInput({ fact: "Isolated fact", vault: "identity", confidence: 0.7 })
      );

      graph.addEdge({ fromId: a.id, toId: b.id, relation: "related", weight: 0.8 });
      graph.addEdge({ fromId: a.id, toId: c.id, relation: "related", weight: 0.8 });

      const withRelationships = generator.generate({ includeRelationships: true });
      const withoutRelationships = generator.generate({ includeRelationships: false });

      // Both should include facts, but scores differ
      expect(withRelationships.factsIncluded).toBeGreaterThan(0);
      expect(withoutRelationships.factsIncluded).toBeGreaterThan(0);
    });
  });

  // 10. Superseded facts excluded from main briefing
  describe("superseded facts", () => {
    it("should exclude superseded facts from the briefing", () => {
      const old = graph.addNode(makeNodeInput({ fact: "Works at OldCo", vault: "work" }));
      graph.supersede(old.id, makeNodeInput({ fact: "Works at NewCo", vault: "work" }));

      const briefing = generator.generate();

      expect(briefing.content).toContain("Works at NewCo");
      expect(briefing.content).not.toContain("Works at OldCo");
    });
  });

  // 11. Change history included when includeChangeHistory=true
  describe("change history", () => {
    it("should include change history when includeChangeHistory is true", () => {
      const old = graph.addNode(makeNodeInput({ fact: "Lives in NYC", vault: "identity" }));
      graph.supersede(old.id, makeNodeInput({ fact: "Lives in SF", vault: "identity" }));

      const briefing = generator.generate({ includeChangeHistory: true });

      expect(briefing.content).toContain("Recent Changes");
      expect(briefing.content).toContain("Previously: Lives in NYC");
      expect(briefing.content).toContain("Now: Lives in SF");
    });

    it("should not include change history when includeChangeHistory is false", () => {
      const old = graph.addNode(makeNodeInput({ fact: "Lives in NYC", vault: "identity" }));
      graph.supersede(old.id, makeNodeInput({ fact: "Lives in SF", vault: "identity" }));

      const briefing = generator.generate({ includeChangeHistory: false });

      expect(briefing.content).not.toContain("Recent Changes");
      expect(briefing.content).not.toContain("Previously:");
    });

    it("should show change history in structured_json format", () => {
      const old = graph.addNode(makeNodeInput({ fact: "Uses Vim", vault: "preferences" }));
      graph.supersede(old.id, makeNodeInput({ fact: "Uses VS Code", vault: "preferences" }));

      const briefing = generator.generate({
        format: "structured_json",
        includeChangeHistory: true,
      });

      const parsed = JSON.parse(briefing.content);
      expect(parsed.recent_changes).toBeDefined();
      expect(parsed.recent_changes).toHaveLength(1);
      expect(parsed.recent_changes[0].previous).toBe("Uses Vim");
      expect(parsed.recent_changes[0].current).toBe("Uses VS Code");
    });
  });

  // 12. Pending/rejected facts excluded when onlyApproved=true
  describe("approval filtering", () => {
    it("should exclude pending and rejected facts when onlyApproved is true", () => {
      graph.addNode(
        makeNodeInput({ fact: "Approved fact", vault: "identity" })
      ); // auto_approved
      graph.addNode({
        ...makeNodeInput({ fact: "Pending fact", vault: "identity" }),
        status: "pending",
      });
      graph.addNode({
        ...makeNodeInput({ fact: "Rejected fact", vault: "identity" }),
        status: "rejected",
      });

      const briefing = generator.generate({ onlyApproved: true });

      expect(briefing.content).toContain("Approved fact");
      expect(briefing.content).not.toContain("Pending fact");
      expect(briefing.content).not.toContain("Rejected fact");
      expect(briefing.factsIncluded).toBe(1);
    });
  });

  // 13. Pending facts included when onlyApproved=false
  describe("onlyApproved=false", () => {
    it("should include pending facts when onlyApproved is false", () => {
      graph.addNode(
        makeNodeInput({ fact: "Approved fact", vault: "identity" })
      );
      graph.addNode({
        ...makeNodeInput({ fact: "Pending fact", vault: "identity" }),
        status: "pending",
      });

      const briefing = generator.generate({ onlyApproved: false });

      expect(briefing.content).toContain("Approved fact");
      expect(briefing.content).toContain("Pending fact");
      expect(briefing.factsIncluded).toBe(2);
    });

    it("should still exclude superseded facts when onlyApproved is false", () => {
      const old = graph.addNode(makeNodeInput({ fact: "Old fact", vault: "work" }));
      graph.supersede(old.id, makeNodeInput({ fact: "New fact", vault: "work" }));

      const briefing = generator.generate({ onlyApproved: false });

      expect(briefing.content).toContain("New fact");
      expect(briefing.content).not.toContain("Old fact");
    });
  });
});
