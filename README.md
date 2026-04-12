# Memorey

Your memory, not the AI's memory.

Personal, platform-agnostic AI memory system. Captures context from AI conversations, builds a knowledge graph, and lets you brief any AI tool with your personal context.

## Products

| Product | Directory | Description | Status |
|---------|-----------|-------------|--------|
| Web App | `memorey/` | Full-featured memory management | Production |
| Chrome Extension | `extension/` | Browser sidebar for memory management | Beta |
| Core Engine | `memorey-core/` | TypeScript library for extraction, reconciliation, search, briefing | Stable |
| MCP Server | `mcp-server/` | API for AI tool integration (Claude Desktop, Cursor) | Beta |

## Architecture

The web app and MCP server share a Supabase backend. The Chrome extension runs memorey-core locally with optional Supabase sync. See individual READMEs for setup.

## Quick Start

- Web App: see [memorey/README.md](./memorey/README.md)
- Extension: see [extension/README.md](./extension/README.md)
- Core Engine: see [memorey-core/README.md](./memorey-core/README.md)
- MCP Server: see [mcp-server/README.md](./mcp-server/README.md)
