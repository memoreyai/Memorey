import type { MemoryNode } from "../graph/types.js";
import type { ExtractionResult, ExtractedFact } from "../extraction/types.js";
import { MemoryGraph } from "../graph/MemoryGraph.js";
import { factSimilarity } from "./similarity.js";
import type {
  ReconciliationAction,
  ReconciliationResult,
  ReconciliationConfig,
  ConflictType,
} from "./types.js";
import { DEFAULT_CONFIG } from "./types.js";

/** Temporal markers that signal evolution rather than contradiction */
const EVOLUTION_MARKERS = [
  "recently", "just", "now", "started", "switched",
  "moved to", "changed to", "transitioned", "began",
  "no longer", "used to", "formerly", "previously",
  "currently", "today",
];

/** Negation patterns that signal contradiction */
const NEGATION_PATTERNS = [
  /\bnot\b/i,
  /\bno longer\b/i,
  /\bnever\b/i,
  /\bdon't\b/i,
  /\bdoesn't\b/i,
  /\bisn't\b/i,
  /\bwon't\b/i,
  /\bcan't\b/i,
  /\bhates?\b/i,
  /\bdislikes?\b/i,
  /\bstop(?:ped|s)?\b/i,
  /\bquit\b/i,
  /\bleft\b/i,
];

/**
 * Detect conflict type between an existing fact and a new fact.
 */
export function detectConflictType(
  existingFact: string,
  newFact: string
): ConflictType {
  const existingLower = existingFact.toLowerCase();
  const newLower = newFact.toLowerCase();

  // Check for temporal evolution markers in the new fact
  const hasEvolutionMarker = EVOLUTION_MARKERS.some((m) =>
    newLower.includes(m)
  );

  // Check for negation in new fact that isn't in old fact
  const existingNegation = NEGATION_PATTERNS.some((p) => p.test(existingLower));
  const newNegation = NEGATION_PATTERNS.some((p) => p.test(newLower));
  const negationDivergence =
    (newNegation && !existingNegation) || (!newNegation && existingNegation);

  // Extract content words for entity overlap analysis
  const existingWords = new Set(
    existingLower.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)
  );
  const newWords = new Set(
    newLower.replace(/[^a-z0-9\s]/g, "").split(/\s+/).filter(Boolean)
  );
  let overlap = 0;
  for (const w of existingWords) {
    if (newWords.has(w)) overlap++;
  }
  const overlapRatio =
    Math.max(existingWords.size, newWords.size) === 0
      ? 0
      : overlap / Math.max(existingWords.size, newWords.size);

  // Low entity overlap → likely an addition, not a conflict
  if (overlapRatio < 0.3) {
    return "addition";
  }

  // Negation divergence with high overlap → contradiction
  if (negationDivergence && overlapRatio >= 0.3) {
    return "contradiction";
  }

  // Evolution: temporal marker + reasonable overlap
  if (hasEvolutionMarker && overlapRatio >= 0.3) {
    return "evolution";
  }

  // High overlap but different content values → likely contradiction
  // e.g., "works at A" vs "works at B"
  if (overlapRatio >= 0.5) {
    // Check if the differing words suggest a value change
    const existingOnly = [...existingWords].filter((w) => !newWords.has(w));
    const newOnly = [...newWords].filter((w) => !existingWords.has(w));
    if (existingOnly.length > 0 && newOnly.length > 0) {
      return "contradiction";
    }
  }

  return "none";
}

export class ReconciliationEngine {
  private graph: MemoryGraph;
  private config: ReconciliationConfig;

  constructor(
    graph: MemoryGraph,
    config: ReconciliationConfig = DEFAULT_CONFIG
  ) {
    this.graph = graph;
    this.config = config;
  }

  /**
   * Takes extracted facts, compares against the graph, returns reconciliation actions.
   */
  reconcile(extracted: ExtractionResult): ReconciliationResult {
    const actions: ReconciliationAction[] = [];

    for (const fact of extracted.facts) {
      const action = this.reconcileSingleFact(fact);
      actions.push(action);
    }

    // Count results
    let pending = 0;
    let autoApproved = 0;
    let conflicts = 0;
    let duplicates = 0;

    for (const action of actions) {
      switch (action.type) {
        case "add":
          if (action.suggestedStatus === "pending") pending++;
          else if (action.suggestedStatus === "auto_approved") autoApproved++;
          break;
        case "update":
          if (action.suggestedStatus === "pending") pending++;
          else if (action.suggestedStatus === "auto_approved") autoApproved++;
          break;
        case "conflict":
          conflicts++;
          break;
        case "duplicate":
          duplicates++;
          break;
      }
    }

    return { actions, pending, autoApproved, conflicts, duplicates };
  }

  /**
   * Reconcile a single extracted fact against the graph.
   */
  private reconcileSingleFact(fact: ExtractedFact): ReconciliationAction {
    // Get all active nodes from the same vault
    const candidates = this.graph
      .getActiveNodes()
      .filter((n) => n.vault === fact.vault);

    // Find best match
    let bestMatch: { node: MemoryNode; similarity: number } | null = null;

    for (const node of candidates) {
      const sim = factSimilarity(node.fact, fact.fact);
      if (bestMatch === null || sim > bestMatch.similarity) {
        bestMatch = { node, similarity: sim };
      }
    }

    // No match above conflict threshold → new fact
    if (!bestMatch || bestMatch.similarity < this.config.conflictThreshold) {
      return {
        type: "add",
        fact,
        suggestedStatus:
          fact.confidence >= this.config.autoApproveMinConfidence
            ? "auto_approved"
            : "pending",
      };
    }

    // Duplicate check
    if (bestMatch.similarity >= this.config.duplicateThreshold) {
      return {
        type: "duplicate",
        existingNodeId: bestMatch.node.id,
      };
    }

    // Similarity is between conflictThreshold and duplicateThreshold
    const conflictType = detectConflictType(bestMatch.node.fact, fact.fact);

    switch (conflictType) {
      case "addition":
        return {
          type: "add",
          fact,
          suggestedStatus:
            fact.confidence >= this.config.autoApproveMinConfidence
              ? "auto_approved"
              : "pending",
        };

      case "evolution":
        return {
          type: "update",
          existingNodeId: bestMatch.node.id,
          fact,
          suggestedStatus:
            fact.confidence >= this.config.autoApproveMinConfidence
              ? "auto_approved"
              : "pending",
        };

      case "contradiction":
        return {
          type: "conflict",
          existingNodeId: bestMatch.node.id,
          fact,
          reason: `Contradicts existing fact: "${bestMatch.node.fact}"`,
        };

      case "none":
      default:
        // Uncertain — treat as conflict to be safe
        return {
          type: "conflict",
          existingNodeId: bestMatch.node.id,
          fact,
          reason: `Potentially conflicts with existing fact: "${bestMatch.node.fact}"`,
        };
    }
  }

  /**
   * Apply a single reconciliation action to the graph.
   */
  applyAction(action: ReconciliationAction): MemoryNode | null {
    switch (action.type) {
      case "add": {
        const node = this.graph.addNode({
          fact: action.fact.fact,
          originalFact: action.fact.originalExcerpt,
          vault: action.fact.vault,
          confidence: action.fact.confidence,
          source: {
            platform: "extraction",
            timestamp: new Date().toISOString(),
          },
          supersededBy: null,
          tags: action.fact.entities,
          status: action.suggestedStatus,
        });
        return node;
      }

      case "update": {
        const newNode = this.graph.supersede(action.existingNodeId, {
          fact: action.fact.fact,
          originalFact: action.fact.originalExcerpt,
          vault: action.fact.vault,
          confidence: action.fact.confidence,
          source: {
            platform: "extraction",
            timestamp: new Date().toISOString(),
          },
          supersededBy: null,
          tags: action.fact.entities,
          status: action.suggestedStatus,
        });
        return newNode;
      }

      case "duplicate":
        // Nothing to do — fact already exists
        return null;

      case "conflict":
        // Don't apply until user resolves
        return null;
    }
  }

  /**
   * Apply all non-conflict actions and create edges between related facts.
   */
  applyAutoActions(result: ReconciliationResult): {
    applied: MemoryNode[];
    pendingConflicts: ReconciliationAction[];
  } {
    const applied: MemoryNode[] = [];
    const pendingConflicts: ReconciliationAction[] = [];

    for (const action of result.actions) {
      if (action.type === "conflict") {
        pendingConflicts.push(action);
        continue;
      }

      const node = this.applyAction(action);
      if (node) {
        applied.push(node);
      }
    }

    // Create edges between newly added nodes that share entities
    this.createEntityEdges(applied);

    return { applied, pendingConflicts };
  }

  /**
   * User resolves a conflict.
   */
  resolveConflict(
    action: ReconciliationAction & { type: "conflict" },
    resolution: "keep_existing" | "use_new" | "keep_both",
    userConfidence?: number
  ): void {
    switch (resolution) {
      case "keep_existing":
        // New fact is rejected — nothing changes in the graph
        break;

      case "use_new": {
        const confidence = userConfidence ?? action.fact.confidence;
        this.graph.supersede(action.existingNodeId, {
          fact: action.fact.fact,
          originalFact: action.fact.originalExcerpt,
          vault: action.fact.vault,
          confidence,
          source: {
            platform: "extraction",
            timestamp: new Date().toISOString(),
          },
          supersededBy: null,
          tags: action.fact.entities,
          status: "approved",
        });
        break;
      }

      case "keep_both": {
        const confidence = userConfidence ?? action.fact.confidence;
        this.graph.addNode({
          fact: action.fact.fact,
          originalFact: action.fact.originalExcerpt,
          vault: action.fact.vault,
          confidence,
          source: {
            platform: "extraction",
            timestamp: new Date().toISOString(),
          },
          supersededBy: null,
          tags: action.fact.entities,
          status: "approved",
        });
        break;
      }
    }
  }

  /**
   * Create edges between nodes that share entities.
   */
  private createEntityEdges(nodes: MemoryNode[]): void {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];

        const aEntities = new Set(a.tags.map((t) => t.toLowerCase()));
        const bEntities = new Set(b.tags.map((t) => t.toLowerCase()));

        let sharedCount = 0;
        for (const entity of aEntities) {
          if (bEntities.has(entity)) sharedCount++;
        }

        if (sharedCount > 0) {
          this.graph.addEdge({
            fromId: a.id,
            toId: b.id,
            relation: "shares_entity",
            weight: sharedCount / Math.max(aEntities.size, bEntities.size),
          });
        }
      }
    }
  }
}
