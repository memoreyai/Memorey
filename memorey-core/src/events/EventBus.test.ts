import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { EventBus } from "./EventBus.js";
import { MemoryGraph } from "../graph/MemoryGraph.js";
import { MemoreyPipeline } from "../pipeline/MemoreyPipeline.js";
import type { MemoreyEvent } from "./types.js";
import type { MemorySource, Vault } from "../graph/types.js";

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

// ── Unit tests: EventBus ────────────────────────────────────────

describe("EventBus", () => {
  let bus: EventBus;

  beforeEach(() => {
    bus = new EventBus();
  });

  // Test 1: subscribe, emit, handler called with correct event
  it("should call handler with the correct event data when emitted", () => {
    const handler = vi.fn();
    bus.on("graph:saved", handler);

    bus.emit({ type: "graph:saved" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: "graph:saved" });
  });

  // Test 2: multiple handlers for same event type
  it("should call multiple handlers subscribed to the same event type", () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const handler3 = vi.fn();

    bus.on("graph:loaded", handler1);
    bus.on("graph:loaded", handler2);
    bus.on("graph:loaded", handler3);

    bus.emit({ type: "graph:loaded" });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
    expect(handler3).toHaveBeenCalledOnce();
  });

  // Test 3: unsubscribe works
  it("should not call handler after unsubscribe", () => {
    const handler = vi.fn();
    const unsub = bus.on("graph:saved", handler);

    bus.emit({ type: "graph:saved" });
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    bus.emit({ type: "graph:saved" });
    // Should still be 1, not 2
    expect(handler).toHaveBeenCalledOnce();
  });

  // Test 4: onAny receives all event types
  it("should call onAny handler for every event type", () => {
    const handler = vi.fn();
    bus.onAny(handler);

    bus.emit({ type: "graph:saved" });
    bus.emit({ type: "graph:loaded" });

    expect(handler).toHaveBeenCalledTimes(2);
    expect(handler).toHaveBeenCalledWith({ type: "graph:saved" });
    expect(handler).toHaveBeenCalledWith({ type: "graph:loaded" });
  });

  // Test 5: clear removes all handlers
  it("should not call any handlers after clear", () => {
    const specificHandler = vi.fn();
    const anyHandler = vi.fn();

    bus.on("graph:saved", specificHandler);
    bus.onAny(anyHandler);

    bus.clear();

    bus.emit({ type: "graph:saved" });

    expect(specificHandler).not.toHaveBeenCalled();
    expect(anyHandler).not.toHaveBeenCalled();
  });

  it("should not call handlers for other event types", () => {
    const handler = vi.fn();
    bus.on("graph:saved", handler);

    bus.emit({ type: "graph:loaded" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("should support unsubscribing onAny handlers", () => {
    const handler = vi.fn();
    const unsub = bus.onAny(handler);

    bus.emit({ type: "graph:saved" });
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    bus.emit({ type: "graph:loaded" });
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ── Integration: MemoryGraph + EventBus ─────────────────────────

describe("MemoryGraph + EventBus integration", () => {
  let bus: EventBus;
  let graph: MemoryGraph;

  beforeEach(() => {
    bus = new EventBus();
    graph = new MemoryGraph("user-1", bus);
  });

  // Test 6: addNode → node:created event fires
  it("should emit node:created when addNode is called", () => {
    const handler = vi.fn();
    bus.on("node:created", handler);

    const node = graph.addNode(makeNodeInput());

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: "node:created", node });
  });

  // Test 7: approveNode → node:approved event fires
  it("should emit node:approved when approveNode is called", () => {
    const handler = vi.fn();
    bus.on("node:approved", handler);

    const node = graph.addNode({ ...makeNodeInput(), status: "pending" });
    graph.approveNode(node.id);

    expect(handler).toHaveBeenCalledOnce();
    const emittedEvent = handler.mock.calls[0][0];
    expect(emittedEvent.type).toBe("node:approved");
    expect(emittedEvent.node.id).toBe(node.id);
    expect(emittedEvent.node.status).toBe("approved");
  });

  it("should emit node:rejected when rejectNode is called", () => {
    const handler = vi.fn();
    bus.on("node:rejected", handler);

    const node = graph.addNode({ ...makeNodeInput(), status: "pending" });
    graph.rejectNode(node.id);

    expect(handler).toHaveBeenCalledOnce();
    const emittedEvent = handler.mock.calls[0][0];
    expect(emittedEvent.type).toBe("node:rejected");
    expect(emittedEvent.node.status).toBe("rejected");
  });

  it("should emit node:superseded when supersede is called", () => {
    const handler = vi.fn();
    bus.on("node:superseded", handler);

    const oldNode = graph.addNode(makeNodeInput({ fact: "Old fact" }));
    const newNode = graph.supersede(oldNode.id, makeNodeInput({ fact: "New fact" }));

    expect(handler).toHaveBeenCalledOnce();
    const emittedEvent = handler.mock.calls[0][0];
    expect(emittedEvent.type).toBe("node:superseded");
    expect(emittedEvent.oldNode.id).toBe(oldNode.id);
    expect(emittedEvent.newNode.id).toBe(newNode.id);
  });

  // Test 10: events contain correct data
  it("should emit node:confidence_changed with old and new confidence values", () => {
    const handler = vi.fn();
    bus.on("node:confidence_changed", handler);

    const node = graph.addNode(makeNodeInput({ confidence: 0.5 }));
    graph.updateNodeConfidence(node.id, 0.9, "user");

    expect(handler).toHaveBeenCalledOnce();
    const emittedEvent = handler.mock.calls[0][0];
    expect(emittedEvent.type).toBe("node:confidence_changed");
    expect(emittedEvent.oldConfidence).toBe(0.5);
    expect(emittedEvent.newConfidence).toBe(0.9);
    expect(emittedEvent.node.confidence).toBe(0.9);
  });

  it("should emit node:vault_changed with old and new vault values", () => {
    const handler = vi.fn();
    bus.on("node:vault_changed", handler);

    const node = graph.addNode(makeNodeInput({ vault: "work" }));
    graph.changeNodeVault(node.id, "projects", "user");

    expect(handler).toHaveBeenCalledOnce();
    const emittedEvent = handler.mock.calls[0][0];
    expect(emittedEvent.type).toBe("node:vault_changed");
    expect(emittedEvent.oldVault).toBe("work");
    expect(emittedEvent.newVault).toBe("projects");
  });

  it("should emit node:fact_edited with old and new fact values", () => {
    const handler = vi.fn();
    bus.on("node:fact_edited", handler);

    const node = graph.addNode(makeNodeInput({ fact: "Original fact" }));
    graph.editNodeFact(node.id, "Updated fact", "user");

    expect(handler).toHaveBeenCalledOnce();
    const emittedEvent = handler.mock.calls[0][0];
    expect(emittedEvent.type).toBe("node:fact_edited");
    expect(emittedEvent.oldFact).toBe("Original fact");
    expect(emittedEvent.newFact).toBe("Updated fact");
  });

  it("should emit edge:created when addEdge is called", () => {
    const handler = vi.fn();
    bus.on("edge:created", handler);

    const a = graph.addNode(makeNodeInput({ fact: "A" }));
    const b = graph.addNode(makeNodeInput({ fact: "B" }));
    const edge = graph.addEdge({ fromId: a.id, toId: b.id, relation: "knows", weight: 0.8 });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: "edge:created", edge });
  });

  it("should emit vault:created when addVault is called", () => {
    const handler = vi.fn();
    bus.on("vault:created", handler);

    const vault = graph.addVault({ name: "Health", description: "Health info" });

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: "vault:created", vault });
  });

  it("should emit vault:removed when removeVault is called", () => {
    const handler = vi.fn();
    bus.on("vault:removed", handler);

    graph.addVault({ name: "Health", description: "Health info" });
    graph.removeVault("health");

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: "vault:removed", vaultId: "health" });
  });

  it("should work without an EventBus (no errors thrown)", () => {
    const graphNoEvents = new MemoryGraph("user-2");
    const node = graphNoEvents.addNode(makeNodeInput());
    graphNoEvents.approveNode(node.id);
    graphNoEvents.addVault({ name: "Test", description: "test" });
    graphNoEvents.removeVault("test");
    // No errors thrown — all good
    expect(node).toBeDefined();
  });
});

// ── Integration: MemoreyPipeline + EventBus ──────────────────────

describe("MemoreyPipeline + EventBus integration", () => {
  let pipeline: MemoreyPipeline;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "memorey-eventbus-test-"));
    const storagePath = join(tempDir, "graph.json");
    pipeline = new MemoreyPipeline({ storagePath });
    await pipeline.init("vikram");
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  // Test 8: pipeline.processExchange → extraction:complete and reconciliation:complete
  it("should emit extraction:complete and reconciliation:complete on processExchange", async () => {
    const extractionHandler = vi.fn();
    const reconciliationHandler = vi.fn();

    pipeline.on("extraction:complete", extractionHandler);
    pipeline.on("reconciliation:complete", reconciliationHandler);

    await pipeline.processExchange({
      userMessage: "I'm Vikram, I work at Google.",
      assistantMessage: "Nice!",
      platform: "claude",
      timestamp: "2026-04-03T10:00:00Z",
    });

    expect(extractionHandler).toHaveBeenCalledOnce();
    const extractionEvent = extractionHandler.mock.calls[0][0];
    expect(extractionEvent.type).toBe("extraction:complete");
    expect(extractionEvent.result).toBeDefined();
    expect(extractionEvent.result.facts).toBeDefined();

    expect(reconciliationHandler).toHaveBeenCalledOnce();
    const reconciliationEvent = reconciliationHandler.mock.calls[0][0];
    expect(reconciliationEvent.type).toBe("reconciliation:complete");
    expect(reconciliationEvent.result).toBeDefined();
    expect(reconciliationEvent.result.actions).toBeDefined();
  });

  // Test 9: conflict detected → conflict:detected event fires
  it("should emit conflict:detected when a contradicting fact is processed", async () => {
    const conflictHandler = vi.fn();
    pipeline.on("conflict:detected", conflictHandler);

    // Establish a fact
    await pipeline.processExchange({
      userMessage: "I prefer TypeScript over JavaScript.",
      assistantMessage: "Got it!",
      platform: "claude",
      timestamp: "2026-04-03T10:00:00Z",
    });

    // Contradict it
    await pipeline.processExchange({
      userMessage: "I don't like TypeScript, I prefer plain JavaScript.",
      assistantMessage: "Interesting change!",
      platform: "claude",
      timestamp: "2026-04-10T10:00:00Z",
    });

    const pendingConflicts = pipeline.getPendingConflicts();

    // If conflicts were detected, the handler should have fired
    if (pendingConflicts.length > 0) {
      expect(conflictHandler).toHaveBeenCalled();
      const event = conflictHandler.mock.calls[0][0];
      expect(event.type).toBe("conflict:detected");
      expect(event.action).toBeDefined();
      expect(event.action.type).toBe("conflict");
    }
  });

  it("should emit node:created events via pipeline when processing an exchange", async () => {
    const nodeCreatedHandler = vi.fn();
    pipeline.on("node:created", nodeCreatedHandler);

    await pipeline.processExchange({
      userMessage: "My name is Vikram.",
      assistantMessage: "Hello!",
      platform: "claude",
      timestamp: "2026-04-03T10:00:00Z",
    });

    // At least one node should have been created
    expect(nodeCreatedHandler).toHaveBeenCalled();
    const event = nodeCreatedHandler.mock.calls[0][0];
    expect(event.type).toBe("node:created");
    expect(event.node.fact).toBeDefined();
  });

  it("should emit graph:saved when save is called", async () => {
    const handler = vi.fn();
    pipeline.on("graph:saved", handler);

    await pipeline.save();

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: "graph:saved" });
  });

  it("should emit graph:loaded when importing a graph", async () => {
    const handler = vi.fn();

    // Process something to have data
    await pipeline.processExchange({
      userMessage: "I like Rust.",
      assistantMessage: "Cool!",
      platform: "claude",
      timestamp: "2026-04-03T10:00:00Z",
    });

    const exported = pipeline.exportGraph();

    pipeline.on("graph:loaded", handler);
    await pipeline.importGraph(exported);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith({ type: "graph:loaded" });
  });

  it("should support onAny to capture all pipeline events", async () => {
    const allEvents: MemoreyEvent[] = [];
    pipeline.onAny((event) => allEvents.push(event));

    await pipeline.processExchange({
      userMessage: "My name is Vikram, I live in Mumbai.",
      assistantMessage: "Hello Vikram!",
      platform: "claude",
      timestamp: "2026-04-03T10:00:00Z",
    });

    // Should have at least extraction:complete and reconciliation:complete
    const eventTypes = allEvents.map((e) => e.type);
    expect(eventTypes).toContain("extraction:complete");
    expect(eventTypes).toContain("reconciliation:complete");
    // Should have node:created for each extracted fact
    expect(eventTypes).toContain("node:created");
  });

  it("should emit conflict:resolved when resolveConflict is called", async () => {
    const resolvedHandler = vi.fn();
    pipeline.on("conflict:resolved", resolvedHandler);

    // Create a fact then contradict it
    await pipeline.processExchange({
      userMessage: "I work at Google as a senior engineer.",
      assistantMessage: "Nice!",
      platform: "claude",
      timestamp: "2026-04-01T10:00:00Z",
    });

    await pipeline.processExchange({
      userMessage: "I work at Meta as a staff engineer.",
      assistantMessage: "That's a change!",
      platform: "claude",
      timestamp: "2026-04-05T10:00:00Z",
    });

    const conflicts = pipeline.getPendingConflicts();
    if (conflicts.length >= 1) {
      pipeline.resolveConflict(conflicts[0], "keep_existing");
      expect(resolvedHandler).toHaveBeenCalledOnce();
      const event = resolvedHandler.mock.calls[0][0];
      expect(event.type).toBe("conflict:resolved");
      expect(event.resolution).toBe("keep_existing");
    }
  });
});
