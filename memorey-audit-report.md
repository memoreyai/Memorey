# Memorey — Full System Audit Report

**Audit date:** Saturday, March 21, 2026 (local time)  
**Project path:** `Memorey AI/memorey`  
**Supabase project URL (public):** `https://yvaorgleljxhejnhvwxf.supabase.co`  
**Report location:** `Memorey AI/memorey-audit-report.md`  
**Backend evidence:** Supabase MCP (`user-memorey supabase`) — `list_tables` (verbose), `execute_sql`, `list_extensions`, `list_storage_buckets`, `list_migrations`, `get_advisors` (security + performance), `get_project_url`

---

## Executive summary

| Area | Health (0–10) | Notes |
|------|----------------|-------|
| Immediate startup / env | **9** | URL + anon configured; service role and third-party keys remain operator-dependent |
| Supabase backend | **9** | 11 `public` tables, RLS on all, migrations applied, `vector` + IVFFLAT; advisors note RLS initplan + minor FK index gaps |
| Storage | **8** | `node-attachments` bucket present (public); optional export bucket may still need setup per README |
| Frontend / product | **9** | Canvas-based graph, Kanban, search, capture, onboarding, billing hooks, MCP inbox — large surface, coherent |
| Dependencies | **9** | Critical packages present (Next 16, React 19, Supabase, Stripe, AI SDKs, graph libs) |
| Build | **10** | `tsc --noEmit` clean; `next build` succeeds (Next.js 16.1.7) |

---

## What we have built — Memorey to date

Memorey is a **personal memory graph** product: users authenticate (Google OAuth via Supabase), complete onboarding, organize memories into **vaults** and **canvases**, view and edit them on a **custom canvas graph** (not only force-graph), connect nodes with edges, track **Kanban** status on nodes, **semantic search** over embeddings, **capture** share links from AI chats to extract memories, and use **export / “Brief an AI”**, **billing** (Stripe), and an **MCP server** plus **browser extension** for external workflows. The stack is **Next.js App Router**, **Supabase** (Postgres + Auth + Realtime + Storage), **Zustand** for client state, and **server routes** for AI, Stripe, and heavy operations.

### Product pillars (accomplished in codebase)

1. **Auth & profile** — Login, `/auth/callback` with onboarding routing, `profiles` with onboarding fields, segment, graph preferences (edge style/color, master node styling), optional encrypted API key columns for BYOK-style use, `active_canvas_id`.
2. **Memory model** — `memory_nodes` with title/value limits, confidence, source enum (chat, share_link, manual, import, extension, canvas-drop), `vector` embeddings, Kanban fields, sticky vs memory node types, per-node colors, **file-backed nodes** (storage path, thumbnails, OG metadata).
3. **Organization** — `category_vaults` with ordering, visibility, export flags, lock/PIN fields, Lucide `icon_key`, **theme overrides** (JSONB light/dark), pill/card colors; **canvases** and **canvas_vaults** for multi-canvas workspaces with master-node metadata per canvas.
4. **Graph UX** — Custom canvas rendering (vault headers, minimap, search, toolbars, context menus, keyboard shortcuts, connect mode, bulk move, vault manager, node detail sheet, plain-English view, export modal, realtime subscriptions where implemented).
5. **Capture pipeline** — Dashboard capture page + `api/ingest-link` (and related extract routes) for URL ingestion and memory extraction (Anthropic/OpenAI as configured).
6. **Search & AI APIs** — `/api/search`, `/api/embed`, `/api/memory/create`, `/api/extract-nodes`, `/api/memory-assistant`, `/api/graph-builder`, `/api/landing-chat`, attachment extract meta, etc.
7. **Attachments** — `node_attachments` table + **`node-attachments`** storage bucket (50MB limit, typed MIME allowlist); edges can reference attachment endpoints.
8. **Billing** — `subscriptions`, `user_monthly_usage`, Stripe checkout/portal/webhook routes, billing summary API, upgrade UX patterns.
9. **MCP ecosystem** — Standalone `mcp-server` (Express) with Bearer JWT, tools like `get_context`, `get_graph_summary`, `propose_node_update`, rate limiting; dashboard **MCP inbox** / pending proposals bell.
10. **Chrome extension** — Separate package pointing at configurable API base for capture/quick actions.
11. **Data governance** — Export, share export, PII strip route, delete-all-data API for user-owned data removal.

---

## Part 0 — Historical fix: Invalid `supabaseUrl` (still relevant)

### What was wrong

- **`.env.local` placeholders** for `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` caused `@supabase/ssr` to fail at middleware before routes ran.

### What we did (preserved behavior)

- [x] Populated public URL + anon key from Supabase (dashboard or MCP publishable keys).
- [x] **Middleware guard** — Early handling when URL/key missing or placeholder-like; development passes through, production redirects to `/login`.
- [x] **Service role** — Still must be set manually in `.env.local`; MCP does not expose it.

### Files (reference)

- `memorey/.env.local` — operator configuration  
- `memorey/src/middleware.ts` — env guard + auth + onboarding redirects  

---

## Part 1 — Supabase backend audit (MCP)

### 1.1 Project URL

- **Confirmed:** `https://yvaorgleljxhejnhvwxf.supabase.co` (`get_project_url`)

### 1.2 Tables in `public` (current)

**Source:** `list_tables` verbose + `execute_sql` row counts.

| Table | RLS | Approx. rows (audit time) | Role |
|--------|-----|---------------------------|------|
| `profiles` | On | 2 | User profile, onboarding, graph prefs, optional encrypted keys, `active_canvas_id` |
| `category_vaults` | On | 30 | Vaults with icons, theme overrides, lock/export flags |
| `memory_nodes` | On | 69 | Core memories + Kanban + file node columns + `canvas_id` |
| `node_edges` | On | 15 | Graph edges + optional attachment anchors + `canvas_id` + `color` |
| `node_history` | On | 0 | Title/value change history |
| `subscriptions` | On | 2 | Stripe-linked plan |
| `pending_proposals` | On | 0 | MCP proposal queue |
| `user_monthly_usage` | On | 0 | Monthly usage counters |
| `node_attachments` | On | 3 | File metadata linked to nodes |
| `canvases` | On | 3 | Named canvases / workspaces |
| `canvas_vaults` | On | 21 | Many-to-many canvas ↔ vault |

**vs March 18 report:** Added **`node_attachments`**, **`canvases`**, **`canvas_vaults`**; expanded columns across `profiles`, `category_vaults`, `memory_nodes`, `node_edges` for canvas workflow, file nodes, vault theming, and attachments.

---

### 1.3 Row Level Security

**Query:** `pg_tables` for `schemaname = 'public'`

- [x] **All 11 tables** have `rowsecurity: true`.

---

### 1.4 RLS policies (summary)

**Source:** `execute_sql` on `pg_policies`.

| Table | Policies |
|-------|----------|
| `profiles` | `users_own_profile` (ALL) |
| `category_vaults` | `users_own_vaults` (ALL) |
| `memory_nodes` | `users_own_nodes` (ALL) |
| `node_edges` | `users_own_edges` (ALL) |
| `node_history` | `users_own_history` (ALL) |
| `subscriptions` | `users_own_subscription` (ALL) |
| `user_monthly_usage` | `usage_select_own` (SELECT) |
| `pending_proposals` | SELECT / INSERT / UPDATE / DELETE **own rows** (`users_*_own_pending_proposals`) |
| `node_attachments` | `own_attachments` (ALL) |
| `canvases` | `own_canvases` (ALL) |
| `canvas_vaults` | `own_canvas_vaults` (ALL, via canvas ownership) |

**Update vs earlier audit:** `pending_proposals` now includes **`users_insert_own_pending_proposals`** — authenticated users can insert their own proposal rows (aligned with MCP + app flows), not only service role.

---

### 1.5 Extensions (app-critical)

**Source:** `list_extensions`

- [x] **`vector`** — installed **0.8.0** in `public` (pgvector; IVFFLAT in use on `memory_nodes.embedding`).
- [x] Other Supabase defaults: `uuid-ossp`, `pgcrypto`, `pg_graphql`, `supabase_vault`, `pg_stat_statements`, etc.

**Advisor note:** Supabase security linter flags **`vector` in `public` schema** — optional hardening is to move extension to a dedicated schema (see [extension_in_public](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)).

---

### 1.6 Indexes (notable)

**Source:** `pg_indexes` (subset)

- [x] **`idx_memory_nodes_embedding`** — `ivfflat (embedding vector_cosine_ops)` WITH `lists='100'`
- [x] **`idx_memory_nodes_user_vault`**, **`idx_memory_nodes_user_active`**, **`idx_memory_nodes_canvas`**, **`idx_memory_nodes_kanban`** (partial), **`idx_memory_nodes_kind_v2`** (partial)
- [x] **`idx_node_edges_source`**, **`idx_node_edges_target`**, unique on `(source_node_id, target_node_id)`
- [x] **`idx_node_history_node`** — `(node_id, created_at DESC)`
- [x] **`idx_category_vaults_user`**, **`idx_category_vaults_user_active`**

---

### 1.7 Database functions (app-relevant)

From `information_schema.routines` / known migrations:

- [x] `handle_new_user` — signup pipeline  
- [x] `seed_default_vaults` (+ internal helpers)  
- [x] `seed_canvas_vaults`  
- [x] `search_nodes`  
- [x] `get_connected_nodes`  
- [x] `update_updated_at`  

**Security advisor:** `update_updated_at` and `seed_canvas_vaults` flagged as **[function search path mutable](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)** — consider `SET search_path` on function definitions for defense in depth.

---

### 1.8 Trigger `on_auth_user_created`

**Source:** `pg_trigger` on `auth.users`

- [x] **`on_auth_user_created`** AFTER INSERT ON **`auth.users`** → **`handle_new_user()`**

---

### 1.9 Applied migrations (remote)

**Source:** `list_migrations`

| Version | Name |
|---------|------|
| 20260318124508 | 001_memorey_schema |
| 20260318140231 | 004_app_backend_alignment |
| 20260318172553 | seed_default_vaults_secure |
| 20260318172612 | secure_search_and_graph_rpcs |
| 20260318172627 | pending_proposals_insert_own |
| 20260318214158 | node_attachments |
| 20260319115637 | add_memory_nodes_custom_text_color |
| 20260319115645 | add_profiles_memory_goals |
| 20260319115646 | add_profiles_primary_use_case |
| 20260319115647 | add_profiles_anthropic_key_enc |
| 20260319115659 | profiles_openai_api_key_enc_column |
| 20260319231943 | vault_card_default_colors |
| 20260319231945 | profiles_graph_edge_color |
| 20260320123322 | node_edges_add_color |
| 20260320141933 | storage_node_attachments_master_line_columns |
| 20260320143134 | memory_nodes_file_node_columns |
| 20260320210523 | allow_canvas_drop_source_fix |
| 20260320214641 | ensure_canvas_drop_in_source_check_idempotent |
| 20260320220158 | add_vault_pill_theme_and_icon_key_columns |
| 20260320225323 | vault_color_overrides |

---

### 1.10 Storage buckets

**Source:** `list_storage_buckets`

| Bucket | Public | Notes |
|--------|--------|--------|
| `node-attachments` | Yes | 50MB limit; images, PDF, docs, text/markdown, etc. |

**Note:** App README still describes a **private** `memorey-exports` (or `SUPABASE_EXPORT_BUCKET`) for share links — that bucket is **not** listed by MCP at audit time. Create/configure it in the Supabase dashboard if “Share via link” is required in production.

---

### 1.11 Live data snapshot (audit time)

**Query:** aggregate counts  

| Metric | Value |
|--------|------:|
| Profiles | 2 |
| Vaults | 30 |
| Memory nodes | 69 |
| Edges | 15 |
| Canvases | 3 |
| Pending proposals | 0 |
| Node attachments | 3 |

---

### 1.12 Supabase advisors (lints)

**Security** (`get_advisors` type `security`):

- [WARN] Function search path mutable: `update_updated_at`, `seed_canvas_vaults` — [remediation](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable)  
- [WARN] Extension `vector` in public — [remediation](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public)  
- [WARN] Leaked password protection disabled (Auth) — [password security](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)  

**Performance** (`get_advisors` type `performance`):

- [INFO] Several **unindexed foreign keys** (e.g. `memory_nodes.vault_id` per linter — note composite indexes may overlap usage), `node_edges` FKs, `node_history.user_id`, `profiles.active_canvas_id` — [remediation](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys)  
- [WARN] **Auth RLS initplan** — policies using `auth.uid()` re-evaluated per row; Supabase recommends `(select auth.uid())` pattern — [RLS perf](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select), [lint](https://supabase.com/docs/guides/database/database-linter?lint=0003_auth_rls_initplan)  
- [INFO] **Unused indexes** reported (e.g. IVFFLAT embedding, some partials) — expected on young projects until semantic search traffic grows — [unused index](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)  

---

### 1.13 Google OAuth

- [ ] **Provider enablement** not exposed via MCP — confirm in **Supabase Dashboard → Authentication → Providers → Google** and redirect URLs including `{origin}/auth/callback`.

---

## Part 2 — Frontend & configuration

### 2.1 Environment variables (patterns unchanged)

| Variable class | Role |
|----------------|------|
| `NEXT_PUBLIC_SUPABASE_*` | Browser + server Supabase client |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin client: webhooks, exports, some inserts, billing side effects |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Embeddings, extraction, assistants |
| `STRIPE_*` | Checkout, portal, webhooks |
| Optional | `NEXT_PUBLIC_MCP_SERVER_URL`, `SUPABASE_EXPORT_BUCKET`, theme/MCP URLs |

Placeholders still **disable** the features that depend on each secret.

---

### 2.2 Supabase clients

- `src/lib/supabase/client.ts` — browser  
- `src/lib/supabase/server.ts` — server + cookies  
- `src/lib/supabase/admin.ts` — service role (throws if misconfigured)  

---

### 2.3 Middleware

- Protects `/dashboard`, `/graph`, `/settings`  
- Env guard for invalid Supabase URL/key  
- Login redirect and onboarding-aware redirects for authenticated users  

---

### 2.4 API routes (inventory)

**From production build output:**

- Attachments: `api/attachments`, `api/attachments/extract-meta`  
- Billing: `api/billing/summary`, `api/stripe/checkout`, `api/stripe/portal`, `api/stripe/webhook`  
- Export: `api/export`, `api/export/share`, `api/export/strip-pii`  
- Core memory: `api/search`, `api/embed`, `api/memory/create`, `api/nodes/create-file`, `api/ingest-link`, `api/extract-nodes`  
- AI helpers: `api/memory-assistant`, `api/graph-builder`, `api/landing-chat`  
- Vaults / Kanban: `api/vaults/create`, `api/vaults/set-active`, `api/kanban/complete`  
- User: `api/user/delete-all-data`  

---

### 2.5 Pages (App Router)

| Route | Purpose |
|-------|---------|
| `/` | Marketing / landing (incl. interactive demos) |
| `/login` | Google OAuth |
| `/dashboard` | Main graph (with shell) |
| `/graph` | Full-page graph |
| `/dashboard/kanban` | Kanban board |
| `/dashboard/search` | Search |
| `/dashboard/capture` | Share-link capture |
| `/dashboard/onboarding` | Onboarding |
| `/dashboard/settings`, `/settings` | Settings (duplicate paths — same pattern as before) |

**Capture page:** Still **ShareLinkInput**-only; **`InAppChat` is not on this page** — add if product requires in-app chat beside link paste.

---

### 2.6 MCP server (`mcp-server/`)

- **Default PORT:** `3000` (`PORT` env overrides) — README documents Railway-style deploy; align any external docs that still say 3001.  
- **Tools:** `get_context`, `get_graph_summary`, `propose_node_update` (see README).  
- **Auth:** `Authorization: Bearer <Supabase JWT>`.

---

### 2.7 Chrome extension

- Configurable API base (e.g. `extension/src/api-base.ts`) for pointing at local or production Next URL.

---

## Part 3 — Dependencies & build

**Critical packages** (from `package.json`): `@supabase/ssr`, `@supabase/supabase-js`, `next` 16.1.7, `react` 19, `stripe`, `openai`, `@anthropic-ai/sdk`, `graphology`, `react-force-graph-2d`, `zustand`, `immer`, `cheerio`, `resend`, `next-themes`, `lucide-react`, `@dnd-kit/*`, etc.

**Verification (this audit):**

- `npx tsc --noEmit` — **exit 0**  
- `npm run build` — **success** (middleware deprecation warning for future `proxy` migration)

---

## Part 4 — Prioritised follow-ups

### Critical (blocks paid / AI / admin paths)

- [ ] **`SUPABASE_SERVICE_ROLE_KEY`** set in production and local from Supabase → Settings → API  
- [ ] **Stripe** keys + price IDs for real billing  
- [ ] **`OPENAI_API_KEY`** for embeddings and OpenAI-backed routes  
- [ ] **`ANTHROPIC_API_KEY`** for extraction / assistants where used  

### High

- [ ] **Google OAuth** + redirect URLs  
- [ ] **Export bucket** — create `memorey-exports` (or configured name) if share-by-link is required; align with README  
- [ ] **RLS performance** — adopt `(select auth.uid())` in policies at scale — [docs](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)  

### Medium

- [ ] **Capture page:** optional `InAppChat` if in-scope for v1  
- [ ] **Settings route duplication** — `/dashboard/settings` vs `/settings` UX consistency  
- [ ] **Storage:** `node-attachments` is **public** in dashboard — confirm this matches threat model (signed URLs vs public read)  

### Low

- [ ] Next.js **middleware → proxy** when migrating  
- [ ] Supabase **function `search_path`** hardening on triggers/helpers  
- [ ] Trim extraneous npm packages if any appear in `npm ls`  

---

## Reader checklist

**Working (with valid public Supabase URL + anon + session):**

- App boots; middleware and protected routes behave as designed.  
- Schema, RLS, migrations, signup trigger, vector index, multi-canvas and attachment model.  
- Production build succeeds.

**Requires real secrets:**

- Service role operations, Stripe, OpenAI, Anthropic-dependent features.

---

*End of report.*
