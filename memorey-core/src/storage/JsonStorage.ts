import { readFile, writeFile } from "node:fs/promises";
import type { MemoryGraphData } from "../graph/types.js";
import { MemoryGraph } from "../graph/MemoryGraph.js";

const CURRENT_VERSION = "0.2.0";

export class JsonStorage {
  async save(graph: MemoryGraph, filePath: string): Promise<void> {
    const data = graph.getSnapshot();
    await writeFile(filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  async load(filePath: string): Promise<MemoryGraphData> {
    let raw: string;
    try {
      raw = await readFile(filePath, "utf-8");
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err as NodeJS.ErrnoException).code === "ENOENT"
      ) {
        throw new Error(`File not found: ${filePath}`);
      }
      throw err;
    }

    let data: MemoryGraphData;
    try {
      data = JSON.parse(raw) as MemoryGraphData;
    } catch {
      throw new Error(`Corrupt JSON in file: ${filePath}`);
    }

    if (!data.metadata?.version) {
      throw new Error("Missing schema version in graph data");
    }

    if (data.metadata.version !== CURRENT_VERSION) {
      throw new Error(
        `Schema version mismatch: expected ${CURRENT_VERSION}, got ${data.metadata.version}`
      );
    }

    return data;
  }
}
