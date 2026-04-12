# memorey-core

TypeScript engine for personal AI memory. Extracts atomic facts from conversations, organizes them into a knowledge graph with 8 default vaults, reconciles conflicts, and generates context briefings for any AI tool.

## Architecture

| Module | Description |
|--------|-------------|
| **Graph** | In-memory graph with nodes (facts), edges (relationships), vaults, and changelog |
| **Extraction** | Rule-based + optional LLM extraction of facts from conversation exchanges |
| **Reconciliation** | Deduplication, conflict detection, auto-approval based on confidence |
| **Search** | Local TF-IDF embeddings + optional OpenAI API embeddings for semantic search |
| **Briefing** | Generates system prompts, markdown, or structured JSON from the graph |
| **Events** | Typed event bus for node lifecycle, sync, and conflict events |
| **Import/Export** | Parsers for ChatGPT, Claude, plain text, JSON, markdown; export as JSON/markdown/portable |
| **Pipeline** | Unified API that orchestrates all modules |

## Quick Start

```bash
npm install memorey-core
```

```typescript
import { MemoreyPipeline } from "memorey-core";

const pipeline = new MemoreyPipeline({ storagePath: "./my-graph.json" });
await pipeline.init("user-123");

// Process a conversation exchange
const result = await pipeline.processExchange({
  userMessage: "I'm a software engineer at Acme Corp, working on the Flux project",
  assistantMessage: "Nice! Tell me more about the Flux project.",
  platform: "chatgpt",
  timestamp: new Date().toISOString(),
});

// Approve pending facts
pipeline.approveAll();

// Generate a briefing for another AI
const briefing = pipeline.generateBriefing({ format: "system_prompt" });
console.log(briefing.content);

// Save to disk
await pipeline.save();
```

## API Reference

### Pipeline Lifecycle

| Method | Description |
|--------|-------------|
| `init(userId)` | Initialize graph, load from storage if exists |
| `save()` | Persist graph to storage |
| `exportGraph()` | Get full graph snapshot as `MemoryGraphData` |
| `importGraph(data)` | Load a full graph snapshot |
| `getStats()` | Get counts, vault breakdown, date range |

### Processing

| Method | Description |
|--------|-------------|
| `processExchange(exchange)` | Extract facts from a single user/assistant exchange |
| `processConversation(exchanges)` | Process multiple exchanges in sequence |

### Approval Flow

| Method | Description |
|--------|-------------|
| `getPendingNodes()` | List facts awaiting approval |
| `approveNode(nodeId)` | Approve a single fact |
| `rejectNode(nodeId)` | Reject a single fact |
| `approveAll()` | Approve all pending facts |

### Node Editing

| Method | Description |
|--------|-------------|
| `editNodeFact(nodeId, newFact)` | Edit a fact's text |
| `updateNodeConfidence(nodeId, confidence)` | Update confidence score |
| `changeNodeVault(nodeId, vault)` | Move a fact to a different vault |
| `getNodeHistory(nodeId)` | Get full changelog for a node |

### Vault Management

| Method | Description |
|--------|-------------|
| `getVaults()` | List all vault definitions |
| `createVault(name, description, icon?)` | Create a custom vault |
| `removeVault(vaultId)` | Remove a vault |

### Conflict Resolution

| Method | Description |
|--------|-------------|
| `getPendingConflicts()` | List unresolved conflicts |
| `resolveConflict(action, resolution, confidence?)` | Resolve with keep_existing, use_new, or keep_both |

### Briefing

| Method | Description |
|--------|-------------|
| `generateBriefing(config?)` | Generate context briefing from the graph |
| `generateTaskBriefing(task, config?)` | Generate task-relevant briefing with boosted relevance |

### Search

| Method | Description |
|--------|-------------|
| `search(query, options?)` | Semantic search across all facts |
| `findRelated(nodeId, limit?)` | Find facts related to a specific node |

### Events

| Method | Description |
|--------|-------------|
| `on(type, handler)` | Subscribe to a specific event type |
| `onAny(handler)` | Subscribe to all events |

## CLI

Run with `npm run cli -- <command>`:

```bash
npm run cli -- init myuser            # Initialize a new graph
npm run cli -- add                     # Add exchange interactively
npm run cli -- add-file exchanges.json # Process from file
npm run cli -- pending                 # List pending facts
npm run cli -- approve <nodeId>        # Approve a fact
npm run cli -- reject <nodeId>         # Reject a fact
npm run cli -- edit <nodeId>           # Edit a node
npm run cli -- conflicts               # Resolve conflicts
npm run cli -- brief --format markdown # Generate briefing
npm run cli -- vaults                  # List vaults
npm run cli -- vault-add <name> <desc> # Create vault
npm run cli -- history <nodeId>        # Node changelog
npm run cli -- stats                   # Graph statistics
npm run cli -- search <query>          # Search facts
npm run cli -- export --output g.json  # Export graph
npm run cli -- import file.json        # Import conversations
npm run cli -- export-brief            # Export briefing to file
npm run cli -- export-graph            # Export full graph
```

Data is stored in `~/.memorey/`.

## Testing

```bash
npm test          # 228 tests
npm run test:watch
```

## Build

```bash
npm run build     # tsc → dist/
```
