import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { MemoreyPipeline } from "../pipeline/MemoreyPipeline.js";
import { ExportEngine } from "./ExportEngine.js";
import type { ConversationExchange } from "../extraction/types.js";

let tempDir: string;
let storagePath: string;
let pipeline: MemoreyPipeline;

const sampleExchanges: ConversationExchange[] = [
  {
    userMessage: "Hi, my name is Vikram and I'm 28 years old",
    assistantMessage: "Hello Vikram! Nice to meet you.",
    platform: "claude",
    timestamp: "2026-04-01T10:00:00Z",
  },
  {
    userMessage: "I work at a startup building Memorey, an AI memory product",
    assistantMessage: "That sounds like a fascinating project!",
    platform: "claude",
    timestamp: "2026-04-01T10:01:00Z",
  },
  {
    userMessage: "I live in San Francisco",
    assistantMessage: "Great city for tech!",
    platform: "chatgpt",
    timestamp: "2026-04-02T14:00:00Z",
  },
];

async function seedPipeline(): Promise<void> {
  for (const exchange of sampleExchanges) {
    await pipeline.processExchange(exchange);
  }
}

beforeEach(async () => {
  tempDir = await mkdtemp(join(tmpdir(), "memorey-export-test-"));
  storagePath = join(tempDir, "graph.json");
  pipeline = new MemoreyPipeline({ storagePath });
  await pipeline.init("vikram");
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("ExportEngine", () => {
  it("exportGraph JSON is valid JSON with correct structure", async () => {
    await seedPipeline();
    const engine = new ExportEngine(pipeline);

    const json = engine.exportGraph("json");
    const parsed = JSON.parse(json);

    expect(parsed.nodes).toBeDefined();
    expect(parsed.edges).toBeDefined();
    expect(parsed.vaultDefinitions).toBeDefined();
    expect(parsed.metadata).toBeDefined();
    expect(parsed.metadata.userId).toBe("vikram");
    expect(Array.isArray(parsed.nodes)).toBe(true);
    expect(parsed.nodes.length).toBeGreaterThan(0);
  });

  it("markdown output is valid markdown", async () => {
    await seedPipeline();
    const engine = new ExportEngine(pipeline);

    const md = engine.exportGraph("markdown");

    // Check markdown structure
    expect(md).toContain("# Memorey Graph: vikram");
    expect(md).toContain("**Created:**");
    expect(md).toContain("**Last Updated:**");
    expect(md).toContain("**Version:**");
    // Should have vault sections
    expect(md).toContain("## ");
    // Should have facts as list items
    expect(md).toContain("- ");
    // Should include confidence values
    expect(md).toContain("confidence:");
  });

  it("exportBriefing returns content", async () => {
    await seedPipeline();
    // Auto-approve so briefing has something to include
    pipeline.approveAll();

    const engine = new ExportEngine(pipeline);
    const content = engine.exportBriefing({ format: "markdown" });

    expect(content.length).toBeGreaterThan(0);
  });

  it("exportVaults filters to specified vaults", async () => {
    await seedPipeline();
    const engine = new ExportEngine(pipeline);

    const identityJson = engine.exportVaults(["identity"], "json");
    const parsed = JSON.parse(identityJson);

    // All nodes should be in the identity vault
    for (const node of parsed.nodes) {
      expect(node.vault).toBe("identity");
    }

    // Vault definitions should only include identity
    expect(parsed.vaultDefinitions.length).toBeLessThanOrEqual(1);
  });

  it("portable format can be re-imported (round-trip)", async () => {
    await seedPipeline();
    const engine = new ExportEngine(pipeline);

    // Export as portable format
    const portable = engine.exportPortable();
    const portableData = JSON.parse(portable);

    expect(portableData.format).toBe("memorey-portable");
    expect(portableData.version).toBe("1.0.0");
    expect(portableData.graph).toBeDefined();
    expect(portableData.graph.nodes.length).toBeGreaterThan(0);

    // Create a new pipeline and import
    const storagePath2 = join(tempDir, "graph2.json");
    const pipeline2 = new MemoreyPipeline({ storagePath: storagePath2 });
    await pipeline2.init("vikram2");

    // Import the graph data
    await pipeline2.importGraph(portableData.graph);

    // Verify the data round-tripped
    const reimported = pipeline2.exportGraph();
    expect(reimported.nodes.length).toBe(portableData.graph.nodes.length);
    expect(reimported.edges.length).toBe(portableData.graph.edges.length);

    // Verify facts are intact
    const originalFacts = portableData.graph.nodes
      .map((n: { fact: string }) => n.fact)
      .sort();
    const reimportedFacts = reimported.nodes
      .map((n: { fact: string }) => n.fact)
      .sort();
    expect(reimportedFacts).toEqual(originalFacts);
  });

  it("empty graph exports cleanly", () => {
    const engine = new ExportEngine(pipeline);

    const json = engine.exportGraph("json");
    const parsed = JSON.parse(json);
    expect(parsed.nodes).toHaveLength(0);
    expect(parsed.edges).toHaveLength(0);

    const md = engine.exportGraph("markdown");
    expect(md).toContain("# Memorey Graph: vikram");
    expect(md).toContain("**Total Facts:** 0");
  });
});
