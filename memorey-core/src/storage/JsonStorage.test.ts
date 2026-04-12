import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { join } from "node:path";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { MemoryGraph } from "../graph/MemoryGraph.js";
import { JsonStorage } from "./JsonStorage.js";
import type { MemorySource, Vault } from "../graph/types.js";

function makeSource(): MemorySource {
  return { platform: "claude", timestamp: new Date().toISOString() };
}

function makeNodeInput(overrides?: {
  fact?: string;
  vault?: Vault;
  tags?: string[];
}) {
  return {
    fact: overrides?.fact ?? "Test fact",
    vault: (overrides?.vault ?? "work") as Vault,
    confidence: 0.9,
    source: makeSource(),
    supersededBy: null,
    tags: overrides?.tags ?? [],
  };
}

describe("JsonStorage", () => {
  let storage: JsonStorage;
  let tempDir: string;

  beforeEach(async () => {
    storage = new JsonStorage();
    tempDir = await mkdtemp(join(tmpdir(), "memorey-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("should save and load a graph preserving all data (round-trip)", async () => {
    const graph = new MemoryGraph("user-1");
    const n1 = graph.addNode(
      makeNodeInput({ fact: "Alice is a developer", vault: "identity", tags: ["name"] })
    );
    const n2 = graph.addNode(
      makeNodeInput({ fact: "Works at Acme", vault: "work" })
    );
    graph.addEdge({
      fromId: n1.id,
      toId: n2.id,
      relation: "works_at",
      weight: 0.95,
    });

    const filePath = join(tempDir, "graph.json");
    await storage.save(graph, filePath);
    const loaded = await storage.load(filePath);

    expect(loaded.nodes).toHaveLength(2);
    expect(loaded.edges).toHaveLength(1);
    expect(loaded.metadata.userId).toBe("user-1");
    expect(loaded.metadata.version).toBe("0.2.0");

    // Verify we can load into a new graph and use it
    const newGraph = new MemoryGraph("temp");
    newGraph.loadSnapshot(loaded);
    expect(newGraph.getNode(n1.id)?.fact).toBe("Alice is a developer");
    expect(newGraph.getRelated(n1.id)).toHaveLength(1);
  });

  it("should preserve changelog, status, and vaultDefinitions on round-trip", async () => {
    const graph = new MemoryGraph("user-1");
    const node = graph.addNode({ ...makeNodeInput({ fact: "Pending fact" }), status: "pending" });
    graph.approveNode(node.id);
    graph.addVault({ name: "Health", description: "Health info" });

    const filePath = join(tempDir, "graph-v2.json");
    await storage.save(graph, filePath);
    const loaded = await storage.load(filePath);

    const newGraph = new MemoryGraph("temp");
    newGraph.loadSnapshot(loaded);

    const restored = newGraph.getNode(node.id)!;
    expect(restored.status).toBe("approved");
    expect(restored.changelog).toHaveLength(2);

    expect(loaded.vaultDefinitions.length).toBe(9);
    const health = loaded.vaultDefinitions.find((v) => v.id === "health");
    expect(health).toBeDefined();
    expect(health!.isDefault).toBe(false);
  });

  it("should throw on file not found", async () => {
    const filePath = join(tempDir, "does-not-exist.json");
    await expect(storage.load(filePath)).rejects.toThrow("File not found");
  });

  it("should throw on corrupt JSON", async () => {
    const filePath = join(tempDir, "corrupt.json");
    await writeFile(filePath, "not valid json {{{", "utf-8");
    await expect(storage.load(filePath)).rejects.toThrow("Corrupt JSON");
  });

  it("should throw on schema version mismatch", async () => {
    const filePath = join(tempDir, "old-version.json");
    const data = {
      nodes: [],
      edges: [],
      vaultDefinitions: [],
      metadata: {
        userId: "user-1",
        createdAt: new Date().toISOString(),
        lastUpdated: new Date().toISOString(),
        version: "0.0.1",
      },
    };
    await writeFile(filePath, JSON.stringify(data), "utf-8");
    await expect(storage.load(filePath)).rejects.toThrow(
      "Schema version mismatch"
    );
  });
});
