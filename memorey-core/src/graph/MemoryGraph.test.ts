import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryGraph } from "./MemoryGraph.js";
import type { MemorySource, Vault } from "./types.js";

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
  originalFact?: string;
}) {
  return {
    fact: overrides?.fact ?? "User works at Acme Corp",
    vault: (overrides?.vault ?? "work") as Vault,
    confidence: overrides?.confidence ?? 0.9,
    source: makeSource(),
    supersededBy: null,
    tags: overrides?.tags ?? [],
    ...(overrides?.originalFact ? { originalFact: overrides.originalFact } : {}),
  };
}

describe("MemoryGraph", () => {
  let graph: MemoryGraph;

  beforeEach(() => {
    graph = new MemoryGraph("user-1");
  });

  // ── Existing tests (updated for new fields) ──────────────────────

  describe("addNode", () => {
    it("should add a node and auto-generate id and timestamps", () => {
      const node = graph.addNode(makeNodeInput());

      expect(node.id).toBeDefined();
      expect(node.id.length).toBeGreaterThan(0);
      expect(node.fact).toBe("User works at Acme Corp");
      expect(node.vault).toBe("work");
      expect(node.createdAt).toBeDefined();
      expect(node.updatedAt).toBeDefined();
    });

    it("should default status to auto_approved", () => {
      const node = graph.addNode(makeNodeInput());
      expect(node.status).toBe("auto_approved");
    });

    it("should create an initial changelog entry of type created", () => {
      const node = graph.addNode(makeNodeInput());
      expect(node.changelog).toHaveLength(1);
      expect(node.changelog[0].changeType).toBe("created");
      expect(node.changelog[0].changedBy).toBe("system");
      expect(node.changelog[0].newValue).toBe("User works at Acme Corp");
    });

    it("should accept optional originalFact", () => {
      const node = graph.addNode(
        makeNodeInput({ fact: "Works at Acme", originalFact: "yeah i work at acme corp" })
      );
      expect(node.originalFact).toBe("yeah i work at acme corp");
    });

    it("should accept optional status override", () => {
      const node = graph.addNode({ ...makeNodeInput(), status: "pending" });
      expect(node.status).toBe("pending");
    });

    it("should add nodes to different vaults", () => {
      const identity = graph.addNode(
        makeNodeInput({ fact: "User is named Alice", vault: "identity" })
      );
      const prefs = graph.addNode(
        makeNodeInput({ fact: "Prefers dark mode", vault: "preferences" })
      );
      const knowledge = graph.addNode(
        makeNodeInput({ fact: "Knows TypeScript", vault: "knowledge" })
      );

      expect(identity.vault).toBe("identity");
      expect(prefs.vault).toBe("preferences");
      expect(knowledge.vault).toBe("knowledge");

      expect(graph.getNodesByVault("identity")).toHaveLength(1);
      expect(graph.getNodesByVault("preferences")).toHaveLength(1);
      expect(graph.getNodesByVault("knowledge")).toHaveLength(1);
      expect(graph.getNodesByVault("work")).toHaveLength(0);
    });
  });

  describe("getNode", () => {
    it("should return the node by id", () => {
      const added = graph.addNode(makeNodeInput());
      const found = graph.getNode(added.id);
      expect(found).toEqual(added);
    });

    it("should return null for non-existent id", () => {
      expect(graph.getNode("nonexistent")).toBeNull();
    });
  });

  describe("addEdge", () => {
    it("should create an edge between two existing nodes", () => {
      const a = graph.addNode(makeNodeInput({ fact: "User is Alice" }));
      const b = graph.addNode(
        makeNodeInput({ fact: "Alice works at Acme", vault: "work" })
      );

      const edge = graph.addEdge({
        fromId: a.id,
        toId: b.id,
        relation: "works_at",
        weight: 0.95,
      });

      expect(edge.id).toBeDefined();
      expect(edge.fromId).toBe(a.id);
      expect(edge.toId).toBe(b.id);
      expect(edge.relation).toBe("works_at");
      expect(edge.createdAt).toBeDefined();
    });

    it("should throw when source node does not exist", () => {
      const b = graph.addNode(makeNodeInput());
      expect(() =>
        graph.addEdge({
          fromId: "nonexistent",
          toId: b.id,
          relation: "test",
          weight: 1,
        })
      ).toThrow("Node not found: nonexistent");
    });

    it("should throw when target node does not exist", () => {
      const a = graph.addNode(makeNodeInput());
      expect(() =>
        graph.addEdge({
          fromId: a.id,
          toId: "nonexistent",
          relation: "test",
          weight: 1,
        })
      ).toThrow("Node not found: nonexistent");
    });
  });

  describe("supersede", () => {
    it("should mark old node as superseded and create new node with edge", () => {
      const old = graph.addNode(
        makeNodeInput({ fact: "User works at Acme Corp" })
      );

      const replacement = graph.supersede(
        old.id,
        makeNodeInput({ fact: "User works at Globex Corp" })
      );

      const updatedOld = graph.getNode(old.id)!;
      expect(updatedOld.supersededBy).toBe(replacement.id);
      expect(replacement.fact).toBe("User works at Globex Corp");

      const related = graph.getRelated(replacement.id);
      expect(related).toHaveLength(1);
      expect(related[0].node.id).toBe(old.id);
      expect(related[0].edge.relation).toBe("supersedes");
    });

    it("should add changelog entries to both old and new nodes", () => {
      const old = graph.addNode(makeNodeInput({ fact: "Old fact" }));
      const replacement = graph.supersede(
        old.id,
        makeNodeInput({ fact: "New fact" })
      );

      const oldNode = graph.getNode(old.id)!;
      const supersededEntry = oldNode.changelog.find(
        (e) => e.changeType === "superseded"
      );
      expect(supersededEntry).toBeDefined();
      expect(supersededEntry!.newValue).toBe(replacement.id);

      // New node has a "created" entry
      expect(replacement.changelog).toHaveLength(1);
      expect(replacement.changelog[0].changeType).toBe("created");
    });

    it("should throw when superseding a non-existent node", () => {
      expect(() =>
        graph.supersede("nonexistent", makeNodeInput())
      ).toThrow("Node not found: nonexistent");
    });
  });

  describe("getActiveNodes", () => {
    it("should exclude superseded nodes", () => {
      const a = graph.addNode(makeNodeInput({ fact: "Old fact" }));
      graph.addNode(makeNodeInput({ fact: "Still active" }));
      graph.supersede(a.id, makeNodeInput({ fact: "Replacement fact" }));

      const active = graph.getActiveNodes();
      const facts = active.map((n) => n.fact);

      expect(facts).toContain("Still active");
      expect(facts).toContain("Replacement fact");
      expect(facts).not.toContain("Old fact");
    });

    it("should exclude pending and rejected nodes", () => {
      graph.addNode({ ...makeNodeInput({ fact: "Approved" }), status: "approved" });
      graph.addNode({ ...makeNodeInput({ fact: "Auto approved" }) }); // defaults to auto_approved
      graph.addNode({ ...makeNodeInput({ fact: "Pending" }), status: "pending" });
      graph.addNode({ ...makeNodeInput({ fact: "Rejected" }), status: "rejected" });

      const active = graph.getActiveNodes();
      const facts = active.map((n) => n.fact);

      expect(facts).toContain("Approved");
      expect(facts).toContain("Auto approved");
      expect(facts).not.toContain("Pending");
      expect(facts).not.toContain("Rejected");
    });
  });

  describe("getRelated", () => {
    it("should return all connected nodes regardless of edge direction", () => {
      const a = graph.addNode(makeNodeInput({ fact: "A" }));
      const b = graph.addNode(makeNodeInput({ fact: "B" }));
      const c = graph.addNode(makeNodeInput({ fact: "C" }));

      graph.addEdge({
        fromId: a.id,
        toId: b.id,
        relation: "knows",
        weight: 0.8,
      });
      graph.addEdge({
        fromId: c.id,
        toId: a.id,
        relation: "related_to",
        weight: 0.5,
      });

      const related = graph.getRelated(a.id);
      expect(related).toHaveLength(2);

      const relatedFacts = related.map((r) => r.node.fact).sort();
      expect(relatedFacts).toEqual(["B", "C"]);
    });

    it("should return empty array for node with no edges", () => {
      const a = graph.addNode(makeNodeInput({ fact: "Lonely node" }));
      expect(graph.getRelated(a.id)).toEqual([]);
    });
  });

  describe("search", () => {
    it("should find nodes by fact text (case-insensitive)", () => {
      graph.addNode(makeNodeInput({ fact: "User works at Acme Corp" }));
      graph.addNode(makeNodeInput({ fact: "User prefers dark mode" }));
      graph.addNode(makeNodeInput({ fact: "User knows TypeScript" }));

      const results = graph.search("acme");
      expect(results).toHaveLength(1);
      expect(results[0].fact).toBe("User works at Acme Corp");
    });

    it("should find nodes by tags", () => {
      graph.addNode(
        makeNodeInput({ fact: "Some fact", tags: ["typescript", "backend"] })
      );
      graph.addNode(
        makeNodeInput({ fact: "Another fact", tags: ["frontend"] })
      );

      const results = graph.search("typescript");
      expect(results).toHaveLength(1);
      expect(results[0].tags).toContain("typescript");
    });

    it("should return empty array when no matches found", () => {
      graph.addNode(makeNodeInput({ fact: "User works at Acme" }));
      expect(graph.search("zzzzz")).toEqual([]);
    });
  });

  describe("getSnapshot / loadSnapshot", () => {
    it("should produce a complete snapshot with metadata", () => {
      graph.addNode(makeNodeInput({ fact: "Fact 1" }));
      const snapshot = graph.getSnapshot();

      expect(snapshot.nodes).toHaveLength(1);
      expect(snapshot.metadata.userId).toBe("user-1");
      expect(snapshot.metadata.version).toBe("0.2.0");
    });

    it("should round-trip through snapshot preserving all data", () => {
      const n1 = graph.addNode(
        makeNodeInput({ fact: "Fact 1", vault: "identity", tags: ["name"] })
      );
      const n2 = graph.addNode(
        makeNodeInput({ fact: "Fact 2", vault: "work" })
      );
      graph.addEdge({
        fromId: n1.id,
        toId: n2.id,
        relation: "related",
        weight: 0.7,
      });

      const snapshot = graph.getSnapshot();
      const newGraph = new MemoryGraph("temp");
      newGraph.loadSnapshot(snapshot);

      const restored = newGraph.getSnapshot();
      expect(restored.nodes).toHaveLength(2);
      expect(restored.edges).toHaveLength(1);
      expect(restored.metadata.userId).toBe("user-1");
      expect(newGraph.getNode(n1.id)?.fact).toBe("Fact 1");
      expect(newGraph.getNode(n2.id)?.fact).toBe("Fact 2");
    });

    it("should round-trip preserving changelog, status, and vaultDefinitions", () => {
      const n1 = graph.addNode({ ...makeNodeInput({ fact: "Fact A" }), status: "pending" });
      graph.approveNode(n1.id);
      graph.addVault({ name: "Health", description: "Health-related facts" });

      const snapshot = graph.getSnapshot();
      const newGraph = new MemoryGraph("temp");
      newGraph.loadSnapshot(snapshot);

      const restoredNode = newGraph.getNode(n1.id)!;
      expect(restoredNode.status).toBe("approved");
      expect(restoredNode.changelog).toHaveLength(2);
      expect(restoredNode.changelog[1].changeType).toBe("approved");

      const vaults = newGraph.getVaults();
      const healthVault = vaults.find((v) => v.id === "health");
      expect(healthVault).toBeDefined();
      expect(healthVault!.isDefault).toBe(false);
    });
  });

  // ── New tests ────────────────────────────────────────────────────

  describe("updateNodeConfidence", () => {
    it("should update confidence and add changelog entry with previous and new values", () => {
      const node = graph.addNode(makeNodeInput({ confidence: 0.5 }));
      const updated = graph.updateNodeConfidence(node.id, 0.9, "user");

      expect(updated.confidence).toBe(0.9);
      expect(updated.changelog).toHaveLength(2);

      const entry = updated.changelog[1];
      expect(entry.changeType).toBe("confidence_changed");
      expect(entry.previousValue).toBe("0.5");
      expect(entry.newValue).toBe("0.9");
      expect(entry.changedBy).toBe("user");
    });

    it("should update updatedAt timestamp", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      const node = graph.addNode(makeNodeInput());
      vi.setSystemTime(new Date("2025-01-01T00:01:00Z"));
      const updated = graph.updateNodeConfidence(node.id, 0.3, "system");
      expect(updated.updatedAt).not.toBe(node.createdAt);
      vi.useRealTimers();
    });
  });

  describe("changeNodeVault", () => {
    it("should move node to a different vault and log the change", () => {
      const node = graph.addNode(makeNodeInput({ vault: "work" }));
      const updated = graph.changeNodeVault(node.id, "projects", "user");

      expect(updated.vault).toBe("projects");
      expect(graph.getNodesByVault("work")).toHaveLength(0);
      expect(graph.getNodesByVault("projects")).toHaveLength(1);

      const entry = updated.changelog[1];
      expect(entry.changeType).toBe("vault_changed");
      expect(entry.previousValue).toBe("work");
      expect(entry.newValue).toBe("projects");
    });
  });

  describe("editNodeFact", () => {
    it("should update fact text and log old and new values", () => {
      const node = graph.addNode(makeNodeInput({ fact: "Original fact" }));
      const updated = graph.editNodeFact(node.id, "Corrected fact", "user");

      expect(updated.fact).toBe("Corrected fact");
      expect(updated.changelog).toHaveLength(2);

      const entry = updated.changelog[1];
      expect(entry.changeType).toBe("fact_edited");
      expect(entry.previousValue).toBe("Original fact");
      expect(entry.newValue).toBe("Corrected fact");
      expect(entry.changedBy).toBe("user");
    });
  });

  describe("approveNode / rejectNode", () => {
    it("should set status to approved and add changelog entry", () => {
      const node = graph.addNode({ ...makeNodeInput(), status: "pending" });
      expect(node.status).toBe("pending");

      const approved = graph.approveNode(node.id);
      expect(approved.status).toBe("approved");

      const entry = approved.changelog.find((e) => e.changeType === "approved");
      expect(entry).toBeDefined();
      expect(entry!.changedBy).toBe("user");
    });

    it("should set status to rejected and add changelog entry", () => {
      const node = graph.addNode({ ...makeNodeInput(), status: "pending" });
      const rejected = graph.rejectNode(node.id);
      expect(rejected.status).toBe("rejected");

      const entry = rejected.changelog.find((e) => e.changeType === "rejected");
      expect(entry).toBeDefined();
      expect(entry!.changedBy).toBe("user");
    });
  });

  describe("getNodesByStatus", () => {
    it("should return only nodes matching the given status", () => {
      graph.addNode({ ...makeNodeInput({ fact: "A" }), status: "pending" });
      graph.addNode({ ...makeNodeInput({ fact: "B" }), status: "pending" });
      graph.addNode(makeNodeInput({ fact: "C" })); // auto_approved

      const pending = graph.getNodesByStatus("pending");
      expect(pending).toHaveLength(2);
      expect(pending.every((n) => n.status === "pending")).toBe(true);

      const auto = graph.getNodesByStatus("auto_approved");
      expect(auto).toHaveLength(1);
      expect(auto[0].fact).toBe("C");
    });
  });

  describe("getNodeHistory", () => {
    it("should return changelog entries sorted newest first", () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2025-01-01T00:00:00Z"));
      const node = graph.addNode(makeNodeInput({ confidence: 0.5 }));
      vi.setSystemTime(new Date("2025-01-01T00:01:00Z"));
      graph.updateNodeConfidence(node.id, 0.7, "system");
      vi.setSystemTime(new Date("2025-01-01T00:02:00Z"));
      graph.updateNodeConfidence(node.id, 0.9, "user");

      const history = graph.getNodeHistory(node.id);
      expect(history).toHaveLength(3);
      // Newest first
      expect(history[0].changeType).toBe("confidence_changed");
      expect(history[0].newValue).toBe("0.9");
      expect(history[2].changeType).toBe("created");
      vi.useRealTimers();
    });
  });

  describe("vault management", () => {
    it("should initialize with 8 default vaults", () => {
      const vaults = graph.getVaults();
      expect(vaults).toHaveLength(8);
      expect(vaults.every((v) => v.isDefault)).toBe(true);
    });

    it("should add a custom vault and include it in getVaults", () => {
      const custom = graph.addVault({
        name: "Health",
        description: "Health-related information",
        icon: "🏥",
      });

      expect(custom.id).toBe("health");
      expect(custom.isDefault).toBe(false);
      expect(custom.icon).toBe("🏥");

      const vaults = graph.getVaults();
      expect(vaults).toHaveLength(9);
    });

    it("should remove a custom vault", () => {
      graph.addVault({ name: "Finances", description: "Money stuff" });
      expect(graph.getVaults()).toHaveLength(9);

      graph.removeVault("finances");
      expect(graph.getVaults()).toHaveLength(8);
    });

    it("should throw when removing a default vault", () => {
      expect(() => graph.removeVault("identity")).toThrow(
        "Cannot remove default vault: identity"
      );
    });

    it("should throw when adding a vault that already exists", () => {
      graph.addVault({ name: "Health", description: "Health stuff" });
      expect(() =>
        graph.addVault({ name: "Health", description: "Duplicate" })
      ).toThrow("Vault already exists: health");
    });
  });
});
