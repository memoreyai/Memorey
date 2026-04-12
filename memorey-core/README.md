# memorey-core

Core memory graph engine for Memorey AI. An in-memory graph database for storing, relating, and querying atomic facts extracted from AI conversations.

## Setup

```bash
npm install
```

## Development

```bash
# Run tests
npm test

# Watch mode
npm run test:watch

# Build
npm run build
```

## Architecture

### Graph Data Model

- **MemoryNode** — A single atomic fact (e.g. "User works at Acme Corp") categorized into one of 8 vaults
- **MemoryEdge** — A weighted, labeled relationship between two nodes
- **Vault** — One of: `identity`, `work`, `preferences`, `knowledge`, `relationships`, `projects`, `history`, `context`

### Core Classes

- **MemoryGraph** — In-memory graph engine with CRUD, search, supersession, and snapshot support
- **JsonStorage** — Persist and restore a graph to/from a JSON file
