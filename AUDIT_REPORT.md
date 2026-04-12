# Memorey Project Audit Report

**Generated:** Saturday, April 11, 2026 at 8:10 PM IST  
**Auditor:** Automated deep audit (every source file read, all tests run, all builds attempted)

---

## 1. PROJECT STRUCTURE MAP

The Memorey workspace is a **monorepo-style** directory containing **four independent sub-projects** with no shared workspace tooling (no root `package.json`, no Turborepo/Nx/PNPM workspaces).

### Line counts

| Sub-project | Source lines (TS/TSX) | Test files | Build status |
|---|---|---|---|
| `memorey-core/` | ~27,360 | 10 files, 228 tests, all pass | ✅ Clean |
| `extension/` | ~3,840 | 0 tests | ✅ Clean |
| `memorey/` (Next.js) | ~56,094 | 0 tests | ❌ Type error |
| `mcp-server/` | 464 | 0 tests | ✅ Clean |

### File tree

```
Memorey AI/
├── MEMOREY-COMPREHENSIVE-TECHNICAL-AUDIT.md   — Previous audit document
├── built.md                                    — Build notes
├── memorey-audit-report.md                     — Previous audit document
│
├── docs/
│   ├── FINAL_AUDIT.md                          — Older audit
│   └── FINAL_AUDIT_2.md                        — Older audit
│
├── memorey-core/                               ★ Core TypeScript engine (library)
│   ├── package.json                            — ESM package, nanoid dep, vitest
│   ├── tsconfig.json                           — Strict ES2022, outDir dist/
│   ├── vitest.config.ts                        — Vitest globals, src/**/*.test.ts
│   ├── README.md                               — ⚠️ Incomplete (omits pipeline/import/export/CLI)
│   └── src/
│       ├── index.ts                            — Public barrel re-export
│       ├── utils/ids.ts                        — nanoid wrapper
│       ├── briefing/
│       │   ├── BriefingGenerator.ts            — Scores/ranks nodes into context briefings
│       │   ├── BriefingGenerator.test.ts       — ✅ 22 meaningful tests
│       │   ├── templates.ts                    — System prompt / markdown / JSON formatters
│       │   └── types.ts                        — BriefingConfig, defaults
│       ├── events/
│       │   ├── EventBus.ts                     — Pub/sub typed event system
│       │   ├── EventBus.test.ts                — ✅ 25 meaningful tests
│       │   └── types.ts                        — ⚠️ node:updated event never emitted
│       ├── export/
│       │   ├── ExportEngine.ts                 — JSON/markdown/briefing/portable export
│       │   └── ExportEngine.test.ts            — ✅ 6 tests; ⚠️ unused ImportEngine import
│       ├── extraction/
│       │   ├── ExtractionEngine.ts             — Rule + optional LLM extraction
│       │   ├── ExtractionEngine.test.ts        — ✅ 45 extensive tests
│       │   ├── local-rules.ts                  — Regex-based fact extraction
│       │   ├── prompts.ts                      — ⚠️ buildConflictDetectionPrompt unused
│       │   └── types.ts                        — ConversationExchange, ExtractedFact
│       ├── graph/
│       │   ├── MemoryGraph.ts                  — In-memory node/edge/vault store + CRUD
│       │   ├── MemoryGraph.test.ts             — ✅ 37 meaningful tests
│       │   └── types.ts                        — ⚠️ tags_changed changelog unused
│       ├── import/
│       │   ├── ImportEngine.ts                 — Auto-detect parser + pipeline integration
│       │   ├── ImportEngine.test.ts            — ✅ 19 tests, all parsers covered
│       │   ├── types.ts                        — ConversationParser, ImportResult
│       │   └── parsers/
│       │       ├── ChatGPTParser.ts            — ChatGPT export JSON parser
│       │       ├── ClaudeParser.ts             — Claude export JSON parser
│       │       ├── JsonParser.ts               — Native exchange array parser
│       │       ├── MarkdownParser.ts           — ## User / ## Assistant blocks
│       │       └── PlainTextParser.ts          — User: / Assistant: lines
│       ├── pipeline/
│       │   ├── MemoreyPipeline.ts              — Orchestrator: init, extract, reconcile, search
│       │   ├── MemoreyPipeline.test.ts         — ✅ 19 integration tests
│       │   └── types.ts                        — PipelineConfig, ExchangeResult, re-exports
│       ├── reconciliation/
│       │   ├── ReconciliationEngine.ts         — Duplicate/update/conflict detection
│       │   ├── ReconciliationEngine.test.ts    — ✅ 23 tests
│       │   ├── similarity.ts                   — TF-IDF cosine + Jaccard for fact similarity
│       │   └── types.ts                        — ⚠️ requireApprovalForConflicts never read
│       ├── search/
│       │   ├── SearchEngine.ts                 — TF-IDF local + optional API embeddings
│       │   ├── SearchEngine.test.ts            — ✅ 27 tests
│       │   ├── embeddings.ts                   — OpenAI-compatible embedding client
│       │   ├── local-embeddings.ts             — Pure TF-IDF vocabulary + cosine
│       │   └── types.ts                        — SearchResult, EmbeddingProvider
│       ├── storage/
│       │   ├── JsonStorage.ts                  — File-based JSON persistence
│       │   └── JsonStorage.test.ts             — ✅ 5 tests
│       └── cli/
│           └── index.ts                        — ⚠️ Interactive CLI, NO tests, uses substring not semantic search
│
├── extension/                                  ★ Chrome browser extension (MV3)
│   ├── package.json                            — React 18, memorey-core local dep
│   ├── manifest.json                           — ⚠️ No content_scripts registered
│   ├── tsconfig.json                           — Strict, noEmit (esbuild bundles)
│   ├── README.md                               — Build/load instructions
│   ├── .gitignore                              — node_modules, dist, *.map
│   ├── build.mjs                               — Production esbuild + node-stub plugin
│   ├── build.ts                                — ⚠️ DEAD FILE: unused, no node-stub plugin
│   ├── background.ts                           — Opens side panel on icon click
│   ├── content.ts                              — ⚠️ EMPTY STUB (4 lines, no logic)
│   └── sidebar/
│       ├── index.html                          — Side panel HTML shell
│       ├── index.tsx                            — React entry point
│       ├── App.tsx                              — ⚠️ useEvents return value unused
│       ├── store/memoreyStore.ts               — React context + useReducer state
│       ├── styles/globals.css                  — Full design system (~2200 lines)
│       ├── hooks/
│       │   ├── useEvents.ts                    — ⚠️ Subscribes to events but return never consumed
│       │   ├── useMemoreyEngine.ts             — Primary memorey-core integration point
│       │   └── usePipeline.ts                  — React context for pipeline access
│       ├── utils/
│       │   ├── colors.ts                       — Palette constants (duplicated across components)
│       │   └── time.ts                         — formatRelativeTime utility
│       ├── components/
│       │   ├── ChangelogTimeline.tsx            — Changelog entry renderer
│       │   ├── ConfidenceSlider.tsx             — Range input 0–1
│       │   ├── ConflictCard.tsx                 — Conflict resolution UI
│       │   ├── ConflictResolver.tsx             — ⚠️ Unused dispatch import
│       │   ├── FilterBar.tsx                    — Vault/status/sort filters
│       │   ├── GraphCanvas.tsx                  — Force-directed SVG graph
│       │   ├── GraphEdge.tsx                    — 🐛 BUG: midY uses x1 not y1
│       │   ├── GraphNode.tsx                    — Circle node renderer
│       │   ├── ImportForm.tsx                   — File/paste import with parser detection
│       │   ├── ImportProgress.tsx               — Progress bar + summary
│       │   ├── KanbanBoard.tsx                  — Column-based board layout
│       │   ├── KanbanCard.tsx                   — ⚠️ Unused VaultBadge import
│       │   ├── KanbanColumn.tsx                 — Column with drag-drop
│       │   ├── Layout.tsx                       — App chrome (⚠️ settings button inert)
│       │   ├── MiniMap.tsx                      — SVG minimap navigation
│       │   ├── NodeCard.tsx                     — Memory node list card
│       │   ├── NodeDetail.tsx                   — Full node editor
│       │   ├── SearchBar.tsx                    — Debounced search input
│       │   ├── StatusBadge.tsx                  — Approval status pill
│       │   ├── StatusBar.tsx                    — Footer stats bar
│       │   ├── VaultBadge.tsx                   — Colored vault pill
│       │   └── ViewSwitcher.tsx                 — Tab navigation bar
│       └── views/
│           ├── CanvasView.tsx                   — Graph visualization view
│           ├── ConflictsView.tsx                — ⚠️ Unused dispatch import
│           ├── DashboardView.tsx                — ⚠️ Unused vaults var; inconsistent conflict count
│           ├── ImportView.tsx                   — ⚠️ abortRef never set (unused abort path)
│           ├── KanbanView.tsx                   — Kanban with vault/status/source grouping
│           ├── NodeDetailView.tsx               — Wires NodeDetail to pipeline
│           ├── NodesListView.tsx                — ⚠️ Unused refreshState
│           ├── PendingView.tsx                  — ⚠️ Unused StatusBadge import
│           └── placeholder.ts                  — ⚠️ DEAD CODE: not imported anywhere
│
├── memorey/                                    ★ Next.js 16 web app (production)
│   ├── package.json                            — Next 16, React 19, Supabase, Zustand, etc.
│   ├── tsconfig.json                           — Strict, @/* alias
│   ├── next.config.ts                          — Default (empty) Next config
│   ├── eslint.config.mjs                       — ESLint 9 flat config
│   ├── postcss.config.mjs                      — Tailwind v4
│   ├── components.json                         — shadcn/ui config
│   ├── .env.local.example                      — Supabase, AI, billing env vars
│   ├── README.md                               — ⚠️ Mostly create-next-app boilerplate
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx                      — Root layout: fonts, SEO, ErrorBoundary
│   │   │   ├── page.tsx                        — Landing page re-export
│   │   │   ├── globals.css                     — Full Tailwind v4 design system
│   │   │   ├── middleware.ts                   — ⚠️ /admin not super-admin gated
│   │   │   ├── (auth)/login/                   — Login page
│   │   │   ├── (dashboard)/                    — Dashboard pages (graph, kanban, search, etc.)
│   │   │   ├── (admin)/admin/                  — Admin panel pages
│   │   │   ├── api/                            — ~25 API routes
│   │   │   │   ├── extract-nodes/route.ts      — Heuristic extraction (no LLM)
│   │   │   │   ├── search/route.ts             — OpenAI embedding + Anthropic answer
│   │   │   │   ├── embed/route.ts              — OpenAI embedding persistence
│   │   │   │   ├── graph-builder/route.ts      — Anthropic Haiku structured extraction
│   │   │   │   ├── memory-assistant/route.ts   — Anthropic Messages API proxy
│   │   │   │   └── ... (20 more routes)
│   │   │   └── auth/callback/route.ts          — OAuth callback
│   │   ├── components/                         — ~100+ React components
│   │   │   ├── graph/                          — Canvas-based memory graph (large subsystem)
│   │   │   ├── landing/                        — Landing page components
│   │   │   ├── kanban/                         — Kanban board components
│   │   │   ├── ui/                             — shadcn/ui primitives
│   │   │   └── ...
│   │   ├── store/
│   │   │   ├── graphStore.ts                   — Zustand + Immer for graph state
│   │   │   ├── vaultStore.ts                   — Vault CRUD + Supabase sync
│   │   │   ├── canvasStore.ts                  — Multi-canvas management
│   │   │   ├── diffStore.ts                    — Diff/proposal queue
│   │   │   ├── kanbanStore.ts                  — Kanban column state
│   │   │   ├── exportPanelStore.ts             — UI toggle
│   │   │   ├── vaultManagerOverlayStore.ts     — UI toggle
│   │   │   └── index.ts                        — ⚠️ EMPTY: export {}
│   │   ├── lib/
│   │   │   ├── ai/
│   │   │   │   ├── embed.ts                    — 🚨 STUB: returns []
│   │   │   │   ├── search.ts                   — 🚨 STUB: returns []
│   │   │   │   ├── extract.ts                  — Heuristic only, misleading LLM comment
│   │   │   │   └── index.ts                    — 🚨 EMPTY: export {}
│   │   │   ├── graph/
│   │   │   │   ├── operations.ts               — 🚨 STUB: returns null
│   │   │   │   ├── converters.ts               — 🚨 STUB: returns { nodes: [], links: [] }
│   │   │   │   ├── index.ts                    — 🚨 EMPTY: export {}
│   │   │   │   └── persistNodePositions.ts     — ✅ Real: debounced position persistence
│   │   │   ├── supabase/                       — ✅ Real: client/server/admin factories
│   │   │   ├── billing/                        — ✅ Real: plan limits + usage tracking
│   │   │   └── ...
│   │   ├── hooks/                              — useTrack, useMcpInbox, etc.
│   │   └── types/
│   │       ├── index.ts                        — ⚠️ EMPTY: export {}
│   │       └── memorey.ts                      — ⚠️ Incomplete label maps vs union types
│   ├── supabase/
│   │   ├── migrations/ (001–046)               — 46 SQL migrations
│   │   ├── README.md                           — Migration docs
│   │   ├── MIGRATION_ORDER.md                  — Ordering guide
│   │   └── UNUSED_FUNCTIONS.md                 — Tracked unused functions
│   └── public/                                 — Static assets, favicon, OG image
│
├── mcp-server/                                 ★ Standalone HTTP "MCP" server
│   ├── package.json                            — ⚠️ main: index.js (doesn't exist)
│   ├── tsconfig.json                           — CommonJS, strict, dist/
│   ├── README.md                               — ⚠️ Mixed auth terminology (JWT vs API key)
│   ├── .env.example                            — PORT, Supabase, OpenAI env vars
│   ├── Dockerfile                              — Multi-stage Node build
│   ├── railway.toml                            — Railway deploy config
│   └── src/
│       └── server.ts                           — Express: auth + 3 tool endpoints
│                                                 ⚠️ Unused @anthropic-ai/sdk dependency
│                                                 ⚠️ Inactive vault filter gap
```

---

## 2. TEST RESULTS

### memorey-core: ✅ ALL PASS

```
 ✓ src/extraction/ExtractionEngine.test.ts    (45 tests) 14ms
 ✓ src/graph/MemoryGraph.test.ts              (37 tests) 8ms
 ✓ src/search/SearchEngine.test.ts            (27 tests) 7ms
 ✓ src/storage/JsonStorage.test.ts            (5 tests)  13ms
 ✓ src/reconciliation/ReconciliationEngine.test.ts (23 tests) 12ms
 ✓ src/events/EventBus.test.ts                (25 tests) 31ms
 ✓ src/export/ExportEngine.test.ts            (6 tests)  23ms
 ✓ src/pipeline/MemoreyPipeline.test.ts       (19 tests) 45ms
 ✓ src/import/ImportEngine.test.ts            (19 tests) 44ms
 ✓ src/briefing/BriefingGenerator.test.ts     (22 tests) 6ms

 Test Files  10 passed (10)
      Tests  228 passed (228)
   Duration  651ms
```

**Assessment:** Test coverage is excellent for memorey-core. All 228 tests are meaningful with real assertions (no stubs or `it.todo`). The test suite exercises the full engine lifecycle including extraction, graph manipulation, reconciliation, search, import/export, briefing, events, and storage.

### extension: ❌ NO TESTS

No test runner configured. No test files exist.

### memorey (Next.js): ❌ NO TESTS

No `test` script in package.json. Zero test files in the entire app.

### mcp-server: ❌ NO TESTS

`test` script is a placeholder: `echo "Error: no tests specified" && exit 1`.

---

## 3. BUILD RESULTS

### memorey-core: ✅ CLEAN BUILD

```
> memorey-core@0.1.0 build
> tsc
(no errors)
```

### extension: ✅ CLEAN BUILD

```
> memorey-extension@0.1.0 build
> node build.mjs
  dist/background.js      296b
  dist/content.js           65b
  dist/sidebar/index.js  462.3kb
  dist/sidebar/index.css  42.6kb
Build complete!
```

### memorey (Next.js): ❌ BUILD FAILS — TYPE ERROR

```
> memorey@0.1.0 build
> next build

./src/app/(dashboard)/dashboard/onboarding/page.tsx:269:29
Type error: Type 'Canvas | { id: string; name: string; emoji: null; ... }' 
is not assignable to type 'Canvas'.
  Type '{ id: string; ... }' is missing the following properties 
  from type 'Canvas': userId, createdAt
```

**Root cause:** The onboarding page constructs a partial `Canvas` object without `userId` and `createdAt` properties, then pushes it into the `canvases` array which expects full `Canvas` objects.

### mcp-server: ✅ CLEAN BUILD

```
> mcp-server@1.0.0 build
> tsc
(no errors)
```

---

## 4. ARCHITECTURE ANALYSIS

### 4.1 Sub-project relationships

```
┌──────────────┐
│ memorey-core │  TypeScript library (ESM, 0 external deps except nanoid)
└──────┬───────┘
       │ file: dependency
       ▼
┌──────────────┐
│  extension   │  Chrome MV3 extension, bundles memorey-core via esbuild
└──────────────┘

┌──────────────┐
│   memorey    │  Next.js web app — does NOT use memorey-core at all
└──────────────┘

┌──────────────┐
│  mcp-server  │  Standalone Express API — does NOT use memorey-core
└──────────────┘
```

**Critical finding:** The web app (`memorey/`) and MCP server do **not** depend on or reference `memorey-core`. They re-implement extraction, search, and graph operations independently using Supabase + AI APIs. This means:

- The `memorey-core` engine is only consumed by the Chrome extension
- There is significant logic duplication between the core engine and the web app
- The web app has stub files (`lib/ai/embed.ts`, `lib/ai/search.ts`, `lib/graph/operations.ts`, `lib/graph/converters.ts`) that suggest planned integration that never happened

### 4.2 Data flow

| System | Storage | Extraction | Search | Graph |
|--------|---------|------------|--------|-------|
| memorey-core | JSON files | Regex rules + optional LLM | TF-IDF local + optional OpenAI | In-memory `MemoryGraph` |
| extension | chrome.storage.local | Via memorey-core pipeline | Via memorey-core SearchEngine | Via memorey-core MemoryGraph |
| memorey (web) | Supabase (PostgreSQL + pgvector) | Heuristic chunking / Anthropic Haiku | OpenAI embeddings + pgvector RPC | Supabase tables + Zustand |
| mcp-server | Supabase (same DB) | N/A (reads only) | OpenAI embeddings + search_nodes RPC | N/A |

### 4.3 Technology stack

| Layer | memorey-core | extension | memorey (web) | mcp-server |
|-------|-------------|-----------|---------------|------------|
| Runtime | Node.js | Chrome V8 | Vercel/Node | Node.js |
| UI | CLI (readline) | React 18 | React 19 / Next 16 | None |
| State | In-memory objects | React context + useReducer | Zustand + Immer | Stateless |
| Styling | N/A | Custom CSS (~2200 lines) | Tailwind v4 + shadcn/ui | N/A |
| AI | Optional OpenAI | Via memorey-core | Anthropic + OpenAI | OpenAI |
| Auth | N/A | N/A | Supabase Auth + JWT | Bearer JWT |

---

## 5. BUGS AND CRITICAL ISSUES

### 5.1 Build-breaking type error (CRITICAL)

**File:** `memorey/src/app/(dashboard)/dashboard/onboarding/page.tsx:269`  
**Issue:** Partial `Canvas` object missing `userId` and `createdAt` pushed into typed array.  
**Impact:** Production build fails. The app cannot be deployed.

### 5.2 Graph edge label misposition (BUG)

**File:** `extension/sidebar/components/GraphEdge.tsx`  
**Issue:** `midY = (x1 + y2) / 2 - 8` mixes X and Y axes. Should be `(y1 + y2) / 2 - 8`.  
**Impact:** Edge labels rendered at wrong vertical positions on the graph canvas.

### 5.3 Admin UI not gated at middleware level (SECURITY)

**File:** `memorey/src/middleware.ts`  
**Issue:** The `/admin` route is only protected by "is logged in" — any authenticated user can load the admin UI. The API routes behind it use `assertAdmin()` to check `is_super_admin`, so data is protected, but the admin pages are accessible to all users.  
**Impact:** Non-admin users see the admin UI skeleton before API calls fail with 403.

### 5.4 Content script registered nowhere (DEAD CODE)

**Files:** `extension/content.ts` + `extension/manifest.json`  
**Issue:** `content.ts` is a 4-line stub with no logic. The manifest has no `content_scripts` entry. The build produces `dist/content.js` (65 bytes) that is never injected.  
**Impact:** None (dead code), but represents incomplete feature work.

### 5.5 Inactive vault filter gap (LOGIC)

**File:** `mcp-server/src/server.ts`  
**Issue:** When `body.vaults` is explicitly set, the vault filter does not enforce `is_active === true`, unlike the default path. An explicitly named inactive vault's nodes could be included.  
**Impact:** Minor data leakage of soft-deleted vault content.

---

## 6. DEAD CODE AND STUBS

### 6.1 Empty/stub files in memorey (web app)

| File | Content | Status |
|------|---------|--------|
| `src/lib/ai/embed.ts` | `export async function embed() { return [] as number[]; }` | 🚨 STUB |
| `src/lib/ai/search.ts` | `export async function search() { return []; }` | 🚨 STUB |
| `src/lib/ai/index.ts` | `export {};` | 🚨 EMPTY |
| `src/lib/graph/operations.ts` | `export function graphOperations() { return null; }` | 🚨 STUB |
| `src/lib/graph/converters.ts` | `export function toGraphData() { return { nodes: [], links: [] }; }` | 🚨 STUB |
| `src/lib/graph/index.ts` | `export {};` | 🚨 EMPTY |
| `src/store/index.ts` | `export {};` | 🚨 EMPTY |
| `src/types/index.ts` | `export {};` | 🚨 EMPTY |

**Assessment:** These 8 files are vestigial. Real implementations live in API routes and Zustand stores. They should be removed or documented as intentional placeholders.

### 6.2 Dead code in extension

| Item | Location | Issue |
|------|----------|-------|
| `build.ts` | `extension/build.ts` | Duplicate of `build.mjs`, not referenced by scripts, lacks node-stub plugin |
| `content.ts` | `extension/content.ts` | 4-line stub, not registered in manifest |
| `placeholder.ts` | `extension/sidebar/views/placeholder.ts` | Not imported by any file |
| `useEvents` return | `extension/sidebar/App.tsx` | Hook called, return value discarded |

### 6.3 Dead code in memorey-core

| Item | Location | Issue |
|------|----------|-------|
| `knownVaultIds` | `BriefingGenerator.ts` | Built but never used |
| `buildConflictDetectionPrompt` | `extraction/prompts.ts` | Exported but never called by any engine |
| `node:updated` event | `events/types.ts` | Defined but never emitted |
| `tags_changed` changelog | `graph/types.ts` | Defined but no API sets it |
| `requireApprovalForConflicts` | `reconciliation/types.ts` | Config field never read |
| `platform` | `briefing/types.ts` | `BriefingConfig.platform` never consumed |

### 6.4 Unused imports in extension

| File | Unused import |
|------|---------------|
| `ConflictResolver.tsx` | `useMemoreyDispatch` / `dispatch` |
| `ConflictsView.tsx` | `useMemoreyDispatch` / `dispatch` |
| `KanbanCard.tsx` | `VaultBadge` |
| `PendingView.tsx` | `StatusBadge` |
| `NodesListView.tsx` | `refreshState` from `usePipeline()` |
| `DashboardView.tsx` | `vaults` from state |
| `ExportEngine.test.ts` | `ImportEngine` |

---

## 7. MISSING FEATURES AND INCOMPLETE WORK

### 7.1 Content script / page extraction (extension)

The extension was designed to detect AI platforms (ChatGPT, Claude, etc.) and extract conversation context from web pages. This is documented in comments but zero implementation exists. The content script is empty and not registered in the manifest.

### 7.2 LLM-powered conflict detection (memorey-core)

`buildConflictDetectionPrompt` exists in `extraction/prompts.ts` for LLM-based conflict detection, but `ReconciliationEngine` uses purely heuristic similarity matching. The LLM path was planned but never integrated.

### 7.3 Settings page (extension)

The Layout component has a settings gear icon button with no `onClick` handler. No settings view exists.

### 7.4 Import abort (extension)

`ImportView.tsx` has an `abortRef` for canceling imports mid-batch, but there is no UI control to trigger it. The abort path is dead code.

### 7.5 memorey-core integration with web app

The web app (`memorey/`) was apparently designed to use `memorey-core` (evidenced by stub files in `lib/ai/` and `lib/graph/`), but this integration never materialized. The web app reimplements everything with Supabase + AI APIs directly.

---

## 8. DEPENDENCY ANALYSIS

### 8.1 memorey-core dependencies

| Dependency | Used | Notes |
|------------|------|-------|
| `nanoid` | ✅ | ID generation in `utils/ids.ts` |
| `@types/node` | ✅ | Type definitions |
| `typescript` | ✅ | Build toolchain |
| `vitest` | ✅ | Test runner |
| `tsx` | ❌ Not listed | Used by `cli` script but not in devDeps (relies on global install) |

### 8.2 extension dependencies

| Dependency | Used | Notes |
|------------|------|-------|
| `memorey-core` | ✅ | Core engine for sidebar |
| `react` / `react-dom` | ✅ | UI framework |
| `esbuild` | ✅ | Build tool |
| `@types/chrome` | ✅ | Chrome API types |
| `typescript` | ✅ | Type checking |

### 8.3 mcp-server dependencies

| Dependency | Used | Notes |
|------------|------|-------|
| `express` | ✅ | HTTP framework |
| `@supabase/supabase-js` | ✅ | Database client |
| `openai` | ✅ | Embeddings |
| `helmet` | ✅ | Security headers |
| `cors` | ✅ | CORS middleware |
| `express-rate-limit` | ✅ | Rate limiting |
| `dotenv` | ✅ | Environment loading |
| `@anthropic-ai/sdk` | ❌ Not used | Listed but never imported in server.ts |

### 8.4 memorey (web app) — notable

| Dependency | Notes |
|------------|-------|
| `@anthropic-ai/sdk` | Used in API routes (graph-builder, memory-assistant) |
| `openai` | Used in API routes (embed, search) |
| `@supabase/ssr` + `@supabase/supabase-js` | Core data layer |
| `zustand` + `immer` | Client state management |
| `d3` + `graphology` + `react-force-graph-2d` | Graph visualization (multiple libraries!) |
| `dodopayments` | Billing integration |
| `cheerio` | URL content ingestion |
| `zod` | Request validation |

---

## 9. CODE QUALITY ASSESSMENT

### 9.1 Strengths

1. **memorey-core is well-architected.** Clean separation of concerns (extraction → reconciliation → graph → search → briefing), comprehensive test coverage (228 tests), pure TypeScript with minimal dependencies, and a clear public API barrel.

2. **Extension sidebar is functional.** Complete UI with 8 views (dashboard, nodes list, canvas, kanban, import, pending, conflicts, node detail), proper React patterns, and solid integration with memorey-core through the pipeline hook.

3. **Web app has production-ready infrastructure.** Supabase auth with SSR, rate limiting, billing/quota enforcement, admin panel, 46 database migrations, proper middleware, and a polished UI with shadcn/ui components.

4. **MCP server is focused and deployable.** Small, well-structured Express app with proper security (Helmet, CORS, rate limiting, JWT auth), Docker support, and Railway deployment config.

### 9.2 Weaknesses

1. **No test coverage outside memorey-core.** The web app has 56,000+ lines of code with zero tests. The extension has 3,800+ lines with zero tests. The MCP server has no tests.

2. **Significant dead code.** 8 stub/empty files in the web app, a dead build script and content script in the extension, and several unused exports/imports throughout.

3. **Duplicated logic.** Vault color palettes are defined in at least 3 places in the extension (`colors.ts`, `GraphNode.tsx`, `VaultBadge.tsx`). Extraction/search logic exists in both memorey-core and the web app with different implementations.

4. **No monorepo tooling.** Four sub-projects with no shared workspace configuration. `memorey-core` must be manually built before the extension. No CI/CD configuration visible.

5. **Documentation is outdated.** The memorey-core README omits major subsystems. The web app README is still create-next-app boilerplate. Multiple prior audit files exist but aren't maintained.

6. **Build is broken.** The web app fails to build due to a type error, meaning the current codebase cannot be deployed.

### 9.3 Code style

- TypeScript strict mode is used across all sub-projects ✅
- No runtime type assertions or `any` casts in production code (few `as any` in tests only) ✅
- Consistent ESM in memorey-core and extension; CommonJS in mcp-server ⚠️
- No linting errors in memorey-core (passes `tsc --strict`) ✅
- Extension uses `eslint-disable` comments in `GraphCanvas.tsx` for effect deps ⚠️

---

## 10. SECURITY CONCERNS

| Issue | Severity | Location | Description |
|-------|----------|----------|-------------|
| Admin UI visible to all users | Medium | `memorey/src/middleware.ts` | `/admin` only checks logged-in, not `is_super_admin`. API routes are properly gated. |
| Service role key in API routes | Low | `memorey/src/lib/supabase/admin.ts` | Standard pattern but admin client must never leak to client. `createAdminClient` throws if missing — good. |
| `dangerouslySetInnerHTML` for theme | Low | `memorey/src/app/layout.tsx` | Script is hardcoded (no user input), acceptable for FOUC prevention. |
| External font URL in extension | Low | `extension/sidebar/styles/globals.css` | Google Fonts import may be blocked by CSP policies. Could cause style degradation. |
| Bearer token in MCP server | Low | `mcp-server/src/server.ts` | Auth via Supabase JWT verification is solid. Token hashing for rate limiting is good. |
| No CSRF protection | Info | `memorey/` API routes | Next.js API routes don't have CSRF tokens, but use cookie-based auth with SameSite (Supabase SSR handles this). |

---

## 11. RECOMMENDATIONS

### P0 — Fix immediately

1. **Fix the build-breaking type error** in `memorey/src/app/(dashboard)/dashboard/onboarding/page.tsx:269`. Add `userId` and `createdAt` to the `Canvas` object being constructed.

2. **Fix the `GraphEdge.tsx` axis bug.** Change `midY = (x1 + y2) / 2 - 8` to `midY = (y1 + y2) / 2 - 8`.

### P1 — Fix soon

3. **Add middleware gate for `/admin`** — check `is_super_admin` in `middleware.ts` before allowing admin routes.

4. **Delete dead code:**
   - Remove `extension/build.ts` (unused duplicate)
   - Remove `extension/content.ts` or register it in manifest
   - Remove `extension/sidebar/views/placeholder.ts`
   - Remove or document the 8 stub files in `memorey/src/lib/`
   - Clean up unused imports across extension components

5. **Add test coverage** to the web app and MCP server. At minimum:
   - API route integration tests
   - Store unit tests
   - Critical path E2E tests

### P2 — Address in next cycle

6. **Consolidate vault color definitions** in the extension into a single source of truth.

7. **Set up monorepo tooling** (PNPM workspaces, Turborepo, or similar) to manage cross-project dependencies and builds.

8. **Add `tsx` to memorey-core devDependencies** for the CLI script.

9. **Remove `@anthropic-ai/sdk`** from mcp-server dependencies (unused).

10. **Fix `mcp-server/package.json` `main` field** — currently points to `index.js` which doesn't exist.

11. **Update README files** across all sub-projects to accurately reflect current functionality.

12. **Decide the memorey-core integration story.** Either:
    - Integrate memorey-core into the web app (replacing stubs with real implementations), or
    - Accept the divergence and remove the stub files

### P3 — Nice to have

13. Add CI/CD pipeline (GitHub Actions) with test, lint, and build steps.
14. Add `DashboardView` conflict count consistency fix (use same filter as `ViewSwitcher`).
15. Implement the content script for automatic conversation extraction from AI platforms.
16. Wire up the extension settings button to a settings view.
17. Implement the import abort UI in `ImportView`.
18. Add `USER_SEGMENT_LABELS` entries for missing segments (`student`, `designer`, `other`).

---

## 12. SUMMARY SCORECARD

| Dimension | Score | Notes |
|-----------|-------|-------|
| **Architecture** | 7/10 | Clean engine design; but web app diverged from core, creating two parallel systems |
| **Code Quality** | 7/10 | Strong TypeScript, good patterns; marred by dead code and stubs |
| **Test Coverage** | 4/10 | Excellent in memorey-core (228 tests); zero everywhere else |
| **Build Health** | 5/10 | 3 of 4 sub-projects build; web app (the main product) does not |
| **Security** | 7/10 | Good auth patterns; admin UI gate gap; proper service role isolation |
| **Documentation** | 3/10 | READMEs are outdated or boilerplate; multiple stale audit docs |
| **Deployment Readiness** | 5/10 | MCP server is deployable; web app build is broken; extension builds clean |
| **Dead Code** | 4/10 | Significant accumulation of stubs, unused imports, and dead features |
| **Overall** | **5.5/10** | Solid foundation with real production value, but needs cleanup and the build fix before shipping |

---

*End of audit report.*
