import type { MemoreyPipeline } from "../pipeline/MemoreyPipeline.js";
import type { BriefingConfig } from "../briefing/types.js";
import type { MemoryGraphData, Vault, VaultDefinition } from "../graph/types.js";

export class ExportEngine {
  constructor(private pipeline: MemoreyPipeline) {}

  /** Export full graph as JSON or markdown */
  exportGraph(format: "json" | "markdown"): string {
    const data = this.pipeline.exportGraph();

    if (format === "json") {
      return JSON.stringify(data, null, 2);
    }

    return this.graphToMarkdown(data);
  }

  /** Export briefing */
  exportBriefing(config?: Partial<BriefingConfig>): string {
    const briefing = this.pipeline.generateBriefing(config);
    return briefing.content;
  }

  /** Export specific vaults */
  exportVaults(vaults: Vault[], format: "json" | "markdown"): string {
    const data = this.pipeline.exportGraph();

    // Filter nodes to only the specified vaults
    const filteredNodes = data.nodes.filter((n) => vaults.includes(n.vault));
    // Filter edges to only those connecting filtered nodes
    const nodeIds = new Set(filteredNodes.map((n) => n.id));
    const filteredEdges = data.edges.filter(
      (e) => nodeIds.has(e.fromId) && nodeIds.has(e.toId)
    );
    // Filter vault definitions
    const filteredVaults = data.vaultDefinitions.filter((v) =>
      vaults.includes(v.id)
    );

    const filtered: MemoryGraphData = {
      ...data,
      nodes: filteredNodes,
      edges: filteredEdges,
      vaultDefinitions: filteredVaults,
    };

    if (format === "json") {
      return JSON.stringify(filtered, null, 2);
    }

    return this.graphToMarkdown(filtered);
  }

  /** Export as portable Memorey format (can be re-imported by another instance) */
  exportPortable(): string {
    const data = this.pipeline.exportGraph();

    // Build portable format: array of ConversationExchange-like entries
    // derived from the graph nodes, preserving all facts
    const portable = {
      format: "memorey-portable",
      version: "1.0.0",
      exportedAt: new Date().toISOString(),
      graph: data,
    };

    return JSON.stringify(portable, null, 2);
  }

  private graphToMarkdown(data: MemoryGraphData): string {
    const lines: string[] = [];
    const { metadata, nodes, edges, vaultDefinitions } = data;

    lines.push(`# Memorey Graph: ${metadata.userId}`);
    lines.push("");
    lines.push(`- **Created:** ${metadata.createdAt}`);
    lines.push(`- **Last Updated:** ${metadata.lastUpdated}`);
    lines.push(`- **Version:** ${metadata.version}`);
    lines.push(`- **Total Facts:** ${nodes.length}`);
    lines.push(`- **Total Edges:** ${edges.length}`);
    lines.push("");

    // Group nodes by vault
    const byVault = new Map<string, typeof nodes>();
    for (const node of nodes) {
      if (node.supersededBy !== null) continue; // skip superseded
      const existing = byVault.get(node.vault) ?? [];
      existing.push(node);
      byVault.set(node.vault, existing);
    }

    // Build vault name lookup
    const vaultNames = new Map<string, VaultDefinition>();
    for (const v of vaultDefinitions) {
      vaultNames.set(v.id, v);
    }

    for (const [vaultId, vaultNodes] of byVault) {
      const vaultDef = vaultNames.get(vaultId);
      const displayName = vaultDef
        ? `${vaultDef.icon ? vaultDef.icon + " " : ""}${vaultDef.name}`
        : vaultId;

      lines.push(`## ${displayName}`);
      lines.push("");

      for (const node of vaultNodes) {
        const status =
          node.status === "approved" || node.status === "auto_approved"
            ? ""
            : ` *(${node.status})*`;
        lines.push(
          `- ${node.fact}${status} (confidence: ${node.confidence.toFixed(2)})`
        );
      }

      lines.push("");
    }

    if (edges.length > 0) {
      lines.push("## Relationships");
      lines.push("");

      for (const edge of edges) {
        lines.push(
          `- \`${edge.fromId}\` --[${edge.relation}]--> \`${edge.toId}\` (weight: ${edge.weight.toFixed(2)})`
        );
      }

      lines.push("");
    }

    return lines.join("\n");
  }
}
