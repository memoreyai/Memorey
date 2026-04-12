# Memorey — Third-Party Services & Environment Variable Audit

> Generated: April 11, 2026
> Scope: `memorey/` (web app), `mcp-server/`, `memorey-core/`, `extension/`

---

## Table of Contents

1. [Complete Environment Variable Registry](#complete-environment-variable-registry)
2. [Services Currently In Use](#services-currently-in-use)
3. [Client-Side Exposure Audit](#client-side-exposure-audit)
4. [Hardcoded Values Audit](#hardcoded-values-audit)
5. [Service Dependency Map](#service-dependency-map)
6. [Per-Package Breakdown](#per-package-breakdown)
7. [Deployment Checklist](#deployment-checklist)

---

## Complete Environment Variable Registry

### memorey (Next.js web app) — 16 variables

| Variable | Required | Server/Client | Used In |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | **REQUIRED** | Both (NEXT_PUBLIC) | `client.ts`, `server.ts`, `admin.ts`, `middleware.ts`, `supabaseUserClient.ts`, `resolveAvatarUrl.ts`, 10+ API routes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | **REQUIRED** | Both (NEXT_PUBLIC) | `client.ts`, `server.ts`, `middleware.ts`, `supabaseUserClient.ts`, 10+ API routes |
| `SUPABASE_SERVICE_ROLE_KEY` | **REQUIRED** | Server only | `admin.ts`, `search/route.ts`, `export/route.ts`, `export/share/route.ts` |
| `ANTHROPIC_API_KEY` | **REQUIRED** | Server only | `landing-chat`, `memory-assistant`, `graph-builder`, `search`, `kanban/complete`, `export/strip-pii`, `executeExport.ts`, `ingest-link` |
| `ANTHROPIC_MODEL` | Optional | Server only | Same as ANTHROPIC_API_KEY files. Default: `claude-sonnet-4-6` |
| `OPENAI_API_KEY` | **REQUIRED** | Server only | `embed/route.ts`, `search/route.ts` |
| `NEXT_PUBLIC_APP_URL` | Optional | Both (NEXT_PUBLIC) | `dodo/checkout`, `dodo/portal`, `nodes/create-file`. Default: `https://memorey.co` |
| `NEXT_PUBLIC_SITE_URL` | Optional | Both (NEXT_PUBLIC) | `layout.tsx` (metadata/OG). Falls back to VERCEL_URL → `https://memorey.co` |
| `NEXT_PUBLIC_MCP_SERVER_URL` | Optional | Both (NEXT_PUBLIC) | `settings/page.tsx` (display only — shows MCP URL to users) |
| `DODO_SECRET_KEY` | Optional | Server only | `dodo/checkout`, `dodo/portal`. Billing disabled without this |
| `DODO_WEBHOOK_SECRET` | Optional | Server only | `dodo/webhook`. Webhook verification disabled without this |
| `DODO_PRO_MONTHLY_PRICE_ID` | Optional | Server only | `dodo/checkout` |
| `DODO_PRO_YEARLY_PRICE_ID` | Optional | Server only | `dodo/checkout` |
| `SUPABASE_EXPORT_BUCKET` | Optional | Server only | `export/share/route.ts`. Default: `memorey-exports` |
| `VERCEL_URL` | Auto-set | Server only | `layout.tsx`. Auto-injected by Vercel at deploy time |
| `NODE_ENV` | Auto-set | Server only | `middleware.ts` (dev bypass for missing Supabase config) |

### mcp-server (Express.js) — 6 variables

| Variable | Required | Used In |
|---|---|---|
| `PORT` | Optional | `server.ts`. Default: `3000` |
| `SUPABASE_URL` | **REQUIRED** (or `NEXT_PUBLIC_SUPABASE_URL`) | `server.ts` — falls back to `NEXT_PUBLIC_SUPABASE_URL` |
| `SUPABASE_ANON_KEY` | **REQUIRED** (or `NEXT_PUBLIC_SUPABASE_ANON_KEY`) | `server.ts` — falls back to `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| `SUPABASE_SERVICE_ROLE_KEY` | **REQUIRED** | `server.ts` — admin operations |
| `OPENAI_API_KEY` | Optional | `server.ts` — semantic search in `get_context`. Falls back to recent-nodes if unavailable |
| `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Fallback | `server.ts` — fallback aliases for the above |

### memorey-core — 0 variables

No `process.env` references. All configuration passed via constructor params (`LLMProviderConfig`, `OpenAIEmbeddingConfig`). This is correct — it's a portable library.

### extension — 0 runtime variables

Only `process.env.NODE_ENV` at compile time in `build.ts` (esbuild define replacement). No runtime env vars, no hardcoded URLs, no external service calls. The extension operates purely locally using `memorey-core`.

---

## Services Currently In Use

### 1. Supabase (Auth + Database + Storage)

- **What it does for Memorey**: Authentication (email/OAuth), PostgreSQL database (memory nodes, vaults, edges, subscriptions, profiles, proposals), Storage (file attachments, export share links), RLS for row-level security, `search_nodes` RPC for vector similarity search
- **Where it's used**:
  - **Web app**: `lib/supabase/client.ts` (browser), `lib/supabase/server.ts` (server components), `lib/supabase/admin.ts` (service role), `middleware.ts`, `supabaseUserClient.ts`, `auth/callback/route.ts`, and every API route
  - **MCP server**: `server.ts` — auth client + admin client
- **Required environment variables**: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- **Pricing tier needed**: Free tier works for dev. Pro ($25/mo) recommended for production (connection pooling, daily backups, 8GB database)
- **Dashboard URL**: https://supabase.com/dashboard → Project Settings → API
- **Is it actually needed?**: **YES — essential**. Core data layer, auth, and storage. Cannot be replaced without a full rewrite.

### 2. Anthropic (Claude API)

- **What it does for Memorey**: AI-powered features — memory extraction from conversations, graph builder (structured memory creation from free text), search answer generation (RAG), landing page demo chat, Kanban task completion suggestions, PII stripping for exports, plain text export narration
- **Where it's used**:
  - `api/landing-chat/route.ts` — landing page demo (raw fetch to `https://api.anthropic.com/v1/messages`)
  - `api/memory-assistant/route.ts` — in-app assistant (raw fetch)
  - `api/graph-builder/route.ts` — structured extraction (uses `@anthropic-ai/sdk` via admin import)
  - `api/search/route.ts` — answer generation after vector search (uses `@anthropic-ai/sdk`)
  - `api/kanban/complete/route.ts` — task completion suggestions (uses `@anthropic-ai/sdk`)
  - `api/export/strip-pii/route.ts` — PII removal (uses `@anthropic-ai/sdk`)
  - `api/ingest-link/route.ts` — link content extraction
  - `lib/export/executeExport.ts` — plain text export narration (uses `@anthropic-ai/sdk`)
- **Required environment variables**: `ANTHROPIC_API_KEY`, optionally `ANTHROPIC_MODEL`
- **Pricing tier needed**: Pay-as-you-go. No minimum plan. ~$3/M input tokens, ~$15/M output tokens for Claude Sonnet
- **Dashboard URL**: https://console.anthropic.com/ → API Keys
- **Is it actually needed?**: **YES — essential** for all AI features. The landing-chat has a mock fallback when key is missing, but all authenticated features require it.

### 3. OpenAI (Embeddings API)

- **What it does for Memorey**: Generates vector embeddings for memory nodes using `text-embedding-3-small`. Enables semantic search (find memories by meaning, not just keywords). Also used in MCP server for session-purpose-aware context retrieval.
- **Where it's used**:
  - `api/embed/route.ts` — generates and stores embeddings when nodes are created/updated (raw fetch to `https://api.openai.com/v1/embeddings`)
  - `api/search/route.ts` — embeds search query for vector similarity (uses `openai` SDK)
  - `mcp-server/server.ts` — embeds `session_purpose` for smart context filtering (uses `openai` SDK)
- **Required environment variables**: `OPENAI_API_KEY`
- **Pricing tier needed**: Pay-as-you-go. `text-embedding-3-small` costs $0.02/M tokens — very cheap
- **Dashboard URL**: https://platform.openai.com/api-keys
- **Is it actually needed?**: **YES — essential** for search. Without embeddings, search degrades to no vector matching. The embed route gracefully skips if key is missing, but search will fail.

### 4. Dodo Payments (Billing)

- **What it does for Memorey**: Handles Pro plan subscriptions — checkout session creation, webhook processing for subscription lifecycle (active, renewed, cancelled, expired, failed, on_hold), customer billing portal
- **Where it's used**:
  - `api/dodo/checkout/route.ts` — creates checkout sessions via `dodopayments` SDK
  - `api/dodo/webhook/route.ts` — processes Standard Webhooks with HMAC-SHA256 signature verification
  - `api/dodo/portal/route.ts` — opens customer billing portal
  - `api/billing/summary/route.ts` — reads subscription state (no Dodo API calls, just DB)
- **Required environment variables**: `DODO_SECRET_KEY`, `DODO_WEBHOOK_SECRET`, `DODO_PRO_MONTHLY_PRICE_ID`, `DODO_PRO_YEARLY_PRICE_ID`
- **Pricing tier needed**: Dodo Payments pricing (check dashboard)
- **Dashboard URL**: https://app.dodopayments.com/ → Developer → API Keys
- **Is it actually needed?**: **YES — but only if billing is enabled**. All Dodo routes return 503 gracefully when keys are missing. The app works fine on free-tier-only mode without Dodo configured. Billing features are fully optional.

### 5. Vercel (Hosting — implicit)

- **What it does for Memorey**: Hosts the Next.js web app, provides Edge Network, serverless API routes, auto-sets `VERCEL_URL`
- **Where it's used**: `layout.tsx` uses `VERCEL_URL` for metadata fallback
- **Required environment variables**: `VERCEL_URL` (auto-injected), all other env vars must be set in Vercel dashboard
- **Is it actually needed?**: **YES — essential** as the deployment platform for the web app. Could be replaced with any Next.js-compatible host.

### 6. Railway (MCP Server Hosting)

- **What it does for Memorey**: Hosts the Express.js MCP server as a Docker container
- **Where it's used**: `mcp-server/railway.toml` — Dockerfile-based build, `/health` healthcheck
- **Required environment variables**: Set in Railway dashboard: `PORT`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`
- **Is it actually needed?**: **YES — essential** for MCP functionality (Claude Desktop / Cursor integration). Could be replaced with any Docker-compatible host.

---

## Services Referenced But Potentially Unused

**None found.** All imported services are actively used in production code paths.

Note: `memorey-core` exports `OpenAIEmbeddings` and `ExtractionEngine` with LLM support, but these are library-level exports consumed by the extension (which operates locally). They're not dead code — they're the extension's local processing engine.

---

## Client-Side Exposure Audit

### Safe NEXT_PUBLIC_ variables used in client code

| Variable | Client File | Risk |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `lib/supabase/client.ts` (browser client) | **Safe** — public project URL, required for Supabase auth |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `lib/supabase/client.ts` (browser client) | **Safe** — anon key is designed to be public, RLS enforces access |
| `NEXT_PUBLIC_MCP_SERVER_URL` | `settings/page.tsx` (client component) | **Safe** — display-only, shows MCP server URL to user |
| `NEXT_PUBLIC_APP_URL` | Not used in client components | **Safe** — only in API routes |
| `NEXT_PUBLIC_SITE_URL` | `layout.tsx` (server component) | **Safe** — metadata only |

### Danger check: Non-NEXT_PUBLIC_ vars in client code

**Result: NONE FOUND.**

- No `process.env` references in `memorey/src/store/` (0 matches)
- No `process.env` references in `memorey/src/hooks/` (0 matches)
- No `process.env` references in `memorey/src/components/` (0 matches)
- The `settings/page.tsx` is `"use client"` but only uses `NEXT_PUBLIC_MCP_SERVER_URL` (safe)

### Server-only secrets properly isolated

All of these are used **exclusively** in API routes (`app/api/`), server components, middleware, or `lib/` server files:

- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `OPENAI_API_KEY`
- `DODO_SECRET_KEY`
- `DODO_WEBHOOK_SECRET`

**Verdict: No secret leakage to the client bundle.**

---

## Hardcoded Values Audit

### Hardcoded URLs (all safe)

| URL | File | Purpose | Risk |
|---|---|---|---|
| `https://memorey.co` | `dodo/checkout`, `dodo/portal`, `layout.tsx` | Fallback app URL when `NEXT_PUBLIC_APP_URL` not set | **Safe** — just the production domain |
| `https://api.anthropic.com/v1/messages` | `landing-chat`, `memory-assistant` | Anthropic API endpoint | **Safe** — public API endpoint |
| `https://api.openai.com/v1/embeddings` | `embed/route.ts` | OpenAI API endpoint | **Safe** — public API endpoint |
| `https://api.openai.com/v1` | `memorey-core/search/embeddings.ts` | Default base URL for OpenAI-compatible embeddings | **Safe** — overridable default |
| Unsplash photo URLs | `landingPageData.ts` | Landing page demo images | **Safe** — public stock photos |
| `https://chat.openai.com/c/…` | `MemoreyLanding.tsx` | UI placeholder text | **Safe** — display only |

### Hardcoded secrets

| Type | Result |
|---|---|
| API keys (`sk-*`) | **NONE found** |
| Anthropic keys (`sk-ant-*`) | **NONE found** |
| JWT tokens (`eyJ*`) | **NONE found** in source files |
| Supabase URLs with `.supabase.co` | **NONE** in source (only in `node_modules/` library comments) |

**Verdict: No hardcoded credentials found anywhere in source code.**

---

## Service Dependency Map

```
User → Web App (Vercel / Next.js)
         ├── Supabase (auth + database + storage + vector search RPC)
         │     ├── Auth: email + OAuth sign-in
         │     ├── PostgreSQL: memory_nodes, category_vaults, node_edges,
         │     │                subscriptions, profiles, pending_proposals,
         │     │                canvases, usage_counters
         │     ├── Storage: file attachments, export share links
         │     └── RPC: search_nodes (pgvector similarity)
         │
         ├── Anthropic Claude API
         │     ├── Memory extraction from conversations (graph-builder)
         │     ├── In-app memory assistant chat (memory-assistant)
         │     ├── Search answer generation / RAG (search)
         │     ├── Landing page demo chat (landing-chat)
         │     ├── Kanban task completion suggestions (kanban/complete)
         │     ├── PII stripping for exports (export/strip-pii)
         │     ├── Plain text export narration (executeExport)
         │     └── Link content extraction (ingest-link)
         │
         ├── OpenAI API
         │     ├── Embedding generation: text-embedding-3-small (embed)
         │     └── Query embedding for semantic search (search)
         │
         └── Dodo Payments (optional — billing)
               ├── Checkout session creation (dodo/checkout)
               ├── Webhook processing with HMAC verification (dodo/webhook)
               └── Customer billing portal (dodo/portal)

User → Chrome Extension (local-only)
         ├── memorey-core (local processing engine)
         │     ├── ExtractionEngine (rule-based + optional LLM)
         │     ├── ReconciliationEngine (dedup/merge)
         │     ├── SearchEngine (local TF-IDF or API embeddings)
         │     └── BriefingGenerator
         └── No external service calls
             (all data stays local in extension storage)

User → MCP Server (Railway / Express.js)
         ├── Supabase (same instance as web app)
         │     ├── Auth: validates bearer tokens
         │     ├── Admin: reads/writes memory_nodes, category_vaults,
         │     │          pending_proposals
         │     └── RPC: search_nodes (semantic search)
         └── OpenAI API (optional — embeddings for session_purpose search)
```

---

## Per-Package Breakdown

### memorey (Web App)

**API Route → External Service Map:**

| API Route | Supabase | Anthropic | OpenAI | Dodo |
|---|---|---|---|---|
| `api/embed` | ✅ auth + write | — | ✅ embeddings | — |
| `api/search` | ✅ auth + read + RPC | ✅ answer gen | ✅ query embed | — |
| `api/memory-assistant` | ✅ auth + billing | ✅ chat | — | — |
| `api/graph-builder` | ✅ auth + billing | ✅ extraction | — | — |
| `api/landing-chat` | — | ✅ demo chat | — | — |
| `api/ingest-link` | ✅ auth + write | ✅ extraction | — | — |
| `api/kanban/complete` | ✅ auth + read | ✅ suggestions | — | — |
| `api/export/strip-pii` | ✅ auth | ✅ PII removal | — | — |
| `api/export` | ✅ auth + read | ✅ (text format) | — | — |
| `api/export/share` | ✅ auth + storage | — | — | — |
| `api/dodo/checkout` | ✅ auth + read | — | — | ✅ checkout |
| `api/dodo/webhook` | ✅ admin write | — | — | — (receives) |
| `api/dodo/portal` | ✅ auth + read | — | — | ✅ portal |
| `api/billing/summary` | ✅ auth + read | — | — | — |
| `api/memory/create` | ✅ auth + write | — | — | — |
| `api/vaults/create` | ✅ auth + write | — | — | — |
| `api/nodes/create-file` | ✅ auth + write | — | — | — |
| `api/attachments` | ✅ auth + read/write | — | — | — |
| `api/attachments/extract-meta` | — (just fetch) | — | — | — |
| `auth/callback` | ✅ auth callback | — | — | — |

### mcp-server

| Endpoint | Supabase | OpenAI |
|---|---|---|
| `POST /tools/get_context` | ✅ admin read + RPC | ✅ (optional) query embed |
| `POST /tools/get_graph_summary` | ✅ admin read | — |
| `POST /tools/propose_node_update` | ✅ admin write | — |

### memorey-core

No external service calls. LLM and embedding providers are injected via constructor config. The library uses raw `fetch()` to call OpenAI-compatible endpoints when configured.

### extension

Zero external service dependencies at runtime. All processing happens locally via `memorey-core`. Build-time only: `process.env.NODE_ENV` replaced by esbuild.

---

## Deployment Checklist

### Required for basic operation

- [ ] `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anon (public) key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Supabase service role key (**never expose to client**)
- [ ] `ANTHROPIC_API_KEY` — Anthropic API key
- [ ] `OPENAI_API_KEY` — OpenAI API key

### Required for billing (optional feature)

- [ ] `DODO_SECRET_KEY` — Dodo Payments secret key
- [ ] `DODO_WEBHOOK_SECRET` — Dodo webhook signing secret
- [ ] `DODO_PRO_MONTHLY_PRICE_ID` — Product ID for monthly plan
- [ ] `DODO_PRO_YEARLY_PRICE_ID` — Product ID for yearly plan

### Recommended for production

- [ ] `NEXT_PUBLIC_APP_URL` — Set to `https://memorey.co` (or your domain)
- [ ] `NEXT_PUBLIC_SITE_URL` — Set for OG/metadata (falls back to VERCEL_URL)
- [ ] `NEXT_PUBLIC_MCP_SERVER_URL` — Set to Railway deployment URL
- [ ] `SUPABASE_EXPORT_BUCKET` — Create a private bucket named `memorey-exports` in Supabase Storage

### MCP Server (Railway) environment

- [ ] `SUPABASE_URL` — Same Supabase project URL
- [ ] `SUPABASE_ANON_KEY` — Same anon key
- [ ] `SUPABASE_SERVICE_ROLE_KEY` — Same service role key
- [ ] `OPENAI_API_KEY` — For semantic search (optional but recommended)
- [ ] `PORT` — Railway auto-assigns, or set to `3000`

### Supabase setup requirements

- [ ] `search_nodes` RPC function deployed (pgvector)
- [ ] `memorey-exports` storage bucket created (for share links)
- [ ] RLS policies configured on all tables
- [ ] OAuth providers configured (if using social login)

### Cost estimates (production)

| Service | Estimated Monthly Cost |
|---|---|
| Supabase Pro | $25/mo |
| Anthropic (Claude Sonnet) | $5–50/mo depending on usage |
| OpenAI (text-embedding-3-small) | $1–5/mo (very cheap) |
| Vercel (Next.js hosting) | Free tier or $20/mo Pro |
| Railway (MCP server) | ~$5/mo |
| Dodo Payments | Per-transaction fees |
| **Total (low usage)** | **~$36/mo** |
| **Total (moderate usage)** | **~$100/mo** |
