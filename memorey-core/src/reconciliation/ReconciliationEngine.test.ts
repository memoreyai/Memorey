import { describe, it, expect, beforeEach } from "vitest";
import { MemoryGraph } from "../graph/MemoryGraph.js";
import type { MemorySource } from "../graph/types.js";
import type { ExtractedFact, ExtractionResult } from "../extraction/types.js";
import { ReconciliationEngine, detectConflictType } from "./ReconciliationEngine.js";
import type { ReconciliationAction, ReconciliationConfig } from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

function makeSource(overrides?: Partial<MemorySource>): MemorySource {
  return {
    platform: "claude",
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeFact(overrides?: Partial<ExtractedFact>): ExtractedFact {
  return {
    fact: overrides?.fact ?? "User works at Acme Corp",
    originalExcerpt: overrides?.originalExcerpt ?? "I work at Acme Corp",
    vault: overrides?.vault ?? "work",
    confidence: overrides?.confidence ?? 0.9,
    entities: overrides?.entities ?? ["Acme Corp"],
    relationships: overrides?.relationships ?? [],
  };
}

function makeExtractionResult(
  facts: ExtractedFact[],
  source?: MemorySource
): ExtractionResult {
  return {
    facts,
    source: source ?? makeSource(),
  };
}

describe("ReconciliationEngine", () => {
  let graph: MemoryGraph;
  let engine: ReconciliationEngine;

  beforeEach(() => {
    graph = new MemoryGraph("user-1");
    engine = new ReconciliationEngine(graph);
  });

  // ── Test 1: New fact, no conflicts, high confidence → add with auto_approved ──
  describe("new facts without conflicts", () => {
    it("should add with auto_approved when confidence is high", () => {
      const extraction = makeExtractionResult([
        makeFact({ fact: "User works at Acme Corp", confidence: 0.9 }),
      ]);

      const result = engine.reconcile(extraction);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("add");
      if (result.actions[0].type === "add") {
        expect(result.actions[0].suggestedStatus).toBe("auto_approved");
      }
      expect(result.autoApproved).toBe(1);
      expect(result.pending).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(result.duplicates).toBe(0);
    });

    // ── Test 2: New fact, no conflicts, low confidence → add with pending ──
    it("should add with pending when confidence is low", () => {
      const extraction = makeExtractionResult([
        makeFact({ fact: "User might like hiking", confidence: 0.4 }),
      ]);

      const result = engine.reconcile(extraction);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("add");
      if (result.actions[0].type === "add") {
        expect(result.actions[0].suggestedStatus).toBe("pending");
      }
      expect(result.pending).toBe(1);
      expect(result.autoApproved).toBe(0);
    });
  });

  // ── Test 3: Exact duplicate → duplicate action ──
  describe("duplicate detection", () => {
    it("should detect duplicate when fact is nearly identical", () => {
      // Add an existing node to the graph
      graph.addNode({
        fact: "User works at Acme Corp",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      const extraction = makeExtractionResult([
        makeFact({ fact: "User works at Acme Corp", confidence: 0.95 }),
      ]);

      const result = engine.reconcile(extraction);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("duplicate");
      expect(result.duplicates).toBe(1);
    });
  });

  // ── Test 4: Clear conflict → conflict action, not applied until resolved ──
  describe("conflict detection", () => {
    it("should detect contradiction as conflict", () => {
      graph.addNode({
        fact: "User works at Acme Corp",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      const extraction = makeExtractionResult([
        makeFact({
          fact: "User works at Globex Corp",
          vault: "work",
          confidence: 0.9,
          entities: ["Globex Corp"],
        }),
      ]);

      const result = engine.reconcile(extraction);

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0];
      expect(action.type).toBe("conflict");
      if (action.type === "conflict") {
        expect(action.reason).toContain("Acme Corp");
      }
      expect(result.conflicts).toBe(1);

      // Applying a conflict action should do nothing
      const node = engine.applyAction(action);
      expect(node).toBeNull();
    });
  });

  // ── Test 5: Evolution with temporal signal → update action, auto-approved ──
  describe("evolution detection", () => {
    it("should detect evolution with temporal signal and create update action", () => {
      graph.addNode({
        fact: "User works at Acme Corp as engineer",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      // Use lower conflict threshold to catch related-but-different facts
      const evolutionEngine = new ReconciliationEngine(graph, {
        ...DEFAULT_CONFIG,
        conflictThreshold: 0.25,
      });

      const extraction = makeExtractionResult([
        makeFact({
          fact: "User just started working at Globex Corp as engineer",
          vault: "work",
          confidence: 0.9,
          entities: ["Globex Corp"],
        }),
      ]);

      const result = evolutionEngine.reconcile(extraction);

      expect(result.actions).toHaveLength(1);
      const action = result.actions[0];
      expect(action.type).toBe("update");
      if (action.type === "update") {
        expect(action.suggestedStatus).toBe("auto_approved");
      }
    });
  });

  // ── Test 6: Addition (not conflict) → add action ──
  describe("addition detection", () => {
    it("should treat addition as add action, not conflict", () => {
      graph.addNode({
        fact: "User works at Acme Corp",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      // A fact that adds detail about a different aspect — low entity overlap
      const extraction = makeExtractionResult([
        makeFact({
          fact: "User enjoys playing guitar on weekends",
          vault: "preferences",
          confidence: 0.8,
          entities: [],
        }),
      ]);

      const result = engine.reconcile(extraction);

      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("add");
    });
  });

  // ── Tests 7-10: Conflict resolution ──
  describe("conflict resolution", () => {
    let conflictAction: ReconciliationAction & { type: "conflict" };

    beforeEach(() => {
      graph.addNode({
        fact: "User works at Acme Corp",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      const extraction = makeExtractionResult([
        makeFact({
          fact: "User works at Globex Corp",
          vault: "work",
          confidence: 0.9,
          entities: ["Globex Corp"],
        }),
      ]);

      const result = engine.reconcile(extraction);
      conflictAction = result.actions[0] as ReconciliationAction & { type: "conflict" };
    });

    // Test 7: keep_existing → new fact rejected
    it("should keep existing and reject new on keep_existing", () => {
      engine.resolveConflict(conflictAction, "keep_existing");

      const active = graph.getActiveNodes();
      expect(active).toHaveLength(1);
      expect(active[0].fact).toBe("User works at Acme Corp");
    });

    // Test 8: use_new → old fact superseded, new added
    it("should supersede old and add new on use_new", () => {
      const existingId = conflictAction.existingNodeId;
      engine.resolveConflict(conflictAction, "use_new");

      const oldNode = graph.getNode(existingId)!;
      expect(oldNode.supersededBy).not.toBeNull();

      const active = graph.getActiveNodes();
      expect(active).toHaveLength(1);
      expect(active[0].fact).toBe("User works at Globex Corp");
      expect(active[0].status).toBe("approved");
    });

    // Test 9: keep_both → both exist as active
    it("should keep both facts as active on keep_both", () => {
      engine.resolveConflict(conflictAction, "keep_both");

      const active = graph.getActiveNodes();
      expect(active).toHaveLength(2);
      const facts = active.map((n) => n.fact).sort();
      expect(facts).toEqual([
        "User works at Acme Corp",
        "User works at Globex Corp",
      ]);
    });

    // Test 10: resolve with custom confidence
    it("should apply custom confidence when resolving conflict", () => {
      engine.resolveConflict(conflictAction, "use_new", 0.75);

      const active = graph.getActiveNodes();
      expect(active).toHaveLength(1);
      expect(active[0].confidence).toBe(0.75);
    });
  });

  // ── Test 11: Edge creation between facts sharing entities ──
  describe("entity edge creation", () => {
    it("should create edges between facts that share entities", () => {
      const extraction = makeExtractionResult([
        makeFact({
          fact: "User works at Acme Corp",
          vault: "work",
          confidence: 0.9,
          entities: ["Acme Corp"],
        }),
        makeFact({
          fact: "User is the CTO of Acme Corp",
          vault: "work",
          confidence: 0.85,
          entities: ["Acme Corp"],
        }),
      ]);

      // Use low thresholds to avoid duplicate detection between these two
      const customEngine = new ReconciliationEngine(graph, {
        ...DEFAULT_CONFIG,
        duplicateThreshold: 0.99,
        conflictThreshold: 0.95,
      });

      const result = customEngine.reconcile(extraction);
      const { applied } = customEngine.applyAutoActions(result);

      expect(applied).toHaveLength(2);

      // Check edges between the two nodes
      const related = graph.getRelated(applied[0].id);
      const entityEdge = related.find((r) => r.edge.relation === "shares_entity");
      expect(entityEdge).toBeDefined();
      expect(entityEdge!.node.id).toBe(applied[1].id);
    });
  });

  // ── Test 12: Changelog entries created for all operations ──
  describe("changelog entries", () => {
    it("should create changelog entries for add actions", () => {
      const extraction = makeExtractionResult([
        makeFact({ fact: "User likes TypeScript", confidence: 0.9 }),
      ]);

      const result = engine.reconcile(extraction);
      const { applied } = engine.applyAutoActions(result);

      expect(applied).toHaveLength(1);
      expect(applied[0].changelog).toHaveLength(1);
      expect(applied[0].changelog[0].changeType).toBe("created");
    });

    it("should create changelog entries for update (supersede) actions", () => {
      const existingNode = graph.addNode({
        fact: "User works at Acme Corp as engineer",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      const evolutionEngine = new ReconciliationEngine(graph, {
        ...DEFAULT_CONFIG,
        conflictThreshold: 0.25,
      });

      const extraction = makeExtractionResult([
        makeFact({
          fact: "User just started working at Globex Corp as engineer",
          vault: "work",
          confidence: 0.9,
          entities: ["Globex Corp"],
        }),
      ]);

      const result = evolutionEngine.reconcile(extraction);
      const { applied } = evolutionEngine.applyAutoActions(result);

      expect(applied).toHaveLength(1);
      // New node has "created" changelog
      expect(applied[0].changelog[0].changeType).toBe("created");

      // Old node has "superseded" changelog
      const oldNode = graph.getNode(existingNode.id)!;
      const supersededEntry = oldNode.changelog.find(
        (e) => e.changeType === "superseded"
      );
      expect(supersededEntry).toBeDefined();
    });

    it("should create changelog entries for conflict resolution", () => {
      graph.addNode({
        fact: "User works at Acme Corp",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      const extraction = makeExtractionResult([
        makeFact({
          fact: "User works at Globex Corp",
          vault: "work",
          confidence: 0.9,
          entities: ["Globex Corp"],
        }),
      ]);

      const result = engine.reconcile(extraction);
      const conflictAction = result.actions[0] as ReconciliationAction & { type: "conflict" };

      engine.resolveConflict(conflictAction, "use_new");

      const active = graph.getActiveNodes();
      expect(active).toHaveLength(1);
      expect(active[0].changelog[0].changeType).toBe("created");

      // Old node should have superseded entry
      const oldNode = graph.getNode(conflictAction.existingNodeId)!;
      expect(
        oldNode.changelog.some((e) => e.changeType === "superseded")
      ).toBe(true);
    });
  });

  // ── applyAutoActions ──
  describe("applyAutoActions", () => {
    it("should apply non-conflict actions and return pending conflicts", () => {
      graph.addNode({
        fact: "User works at Acme Corp",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      const extraction = makeExtractionResult([
        // New fact — should be added
        makeFact({
          fact: "User enjoys hiking in the mountains",
          vault: "preferences",
          confidence: 0.9,
          entities: [],
        }),
        // Conflict with existing
        makeFact({
          fact: "User works at Globex Corp",
          vault: "work",
          confidence: 0.9,
          entities: ["Globex Corp"],
        }),
      ]);

      const result = engine.reconcile(extraction);
      const { applied, pendingConflicts } = engine.applyAutoActions(result);

      expect(applied).toHaveLength(1);
      expect(applied[0].fact).toBe("User enjoys hiking in the mountains");
      expect(pendingConflicts).toHaveLength(1);
      expect(pendingConflicts[0].type).toBe("conflict");
    });
  });

  // ── detectConflictType unit tests ──
  describe("detectConflictType", () => {
    it("should detect contradiction for opposing facts", () => {
      const result = detectConflictType(
        "User works at Acme Corp",
        "User works at Globex Corp"
      );
      expect(result).toBe("contradiction");
    });

    it("should detect evolution with temporal markers", () => {
      const result = detectConflictType(
        "User works at Acme Corp",
        "User just started at Globex Corp"
      );
      expect(result).toBe("evolution");
    });

    it("should detect addition for low-overlap facts", () => {
      const result = detectConflictType(
        "User works at Acme Corp",
        "User leads the frontend team"
      );
      expect(result).toBe("addition");
    });

    it("should detect contradiction for negation divergence", () => {
      const result = detectConflictType(
        "User likes JavaScript",
        "User doesn't like JavaScript"
      );
      expect(result).toBe("contradiction");
    });
  });

  // ── Edge cases ──
  describe("edge cases", () => {
    it("should handle empty extraction result", () => {
      const result = engine.reconcile(makeExtractionResult([]));
      expect(result.actions).toHaveLength(0);
      expect(result.pending).toBe(0);
      expect(result.autoApproved).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(result.duplicates).toBe(0);
    });

    it("should handle reconciliation against empty graph", () => {
      const extraction = makeExtractionResult([
        makeFact({ fact: "User is a software engineer", confidence: 0.9 }),
        makeFact({ fact: "User likes coffee", confidence: 0.6, vault: "preferences" }),
      ]);

      const result = engine.reconcile(extraction);

      expect(result.actions).toHaveLength(2);
      expect(result.actions[0].type).toBe("add");
      expect(result.actions[1].type).toBe("add");
      if (result.actions[0].type === "add") {
        expect(result.actions[0].suggestedStatus).toBe("auto_approved");
      }
      if (result.actions[1].type === "add") {
        expect(result.actions[1].suggestedStatus).toBe("pending");
      }
    });

    it("should not match facts across different vaults", () => {
      graph.addNode({
        fact: "User works at Acme Corp",
        vault: "work",
        confidence: 0.9,
        source: makeSource(),
        supersededBy: null,
        tags: ["Acme Corp"],
      });

      // Same fact text but different vault → no conflict
      const extraction = makeExtractionResult([
        makeFact({
          fact: "User works at Acme Corp",
          vault: "history",
          confidence: 0.9,
        }),
      ]);

      const result = engine.reconcile(extraction);
      expect(result.actions).toHaveLength(1);
      expect(result.actions[0].type).toBe("add");
    });

    it("should handle duplicate action in applyAction", () => {
      const node = engine.applyAction({
        type: "duplicate",
        existingNodeId: "some-id",
      });
      expect(node).toBeNull();
    });
  });
});
