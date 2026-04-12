# Memorey — Final Technical Audit (FINAL_AUDIT_5)

**Scope:** Fresh audit of the Memorey app as of this session. Evidence is drawn from the `memorey/` project: all of `src/`, all SQL migrations under `supabase/migrations/`, root configs (`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`), plus **live Supabase** metadata via MCP **user-memorey supabase** (`list_tables` verbose, `execute_sql` for policies/indexes/functions, `list_migrations`, `list_storage_buckets`).

**Out of scope:** The browser `extension/` tree and files outside `memorey/` (workspace root lists many non-project paths).

**Build verification:** `cd memorey && npm run build` — success; route table shows **`ƒ Proxy (Middleware)`** (Next.js 16 uses `src/proxy.ts` as network middleware).

---

## SECTION 1 — Build, Compilation & Code Quality

### 1a. TypeScript (`npx tsc --noEmit`)

**Command:** `cd memorey && npx tsc --noEmit`  
**Result:** Exit code **0** — no type errors reported.

**Unsafe casts (manual `grep` in `src/`):**

| File | Line | Pattern | Assessment |
|------|------|---------|------------|
| `src/store/diffStore.ts` | 257, 298 | `data as never` → `rowToMemoryNode` | **Workaround** for Supabase row typing; risk if DB shape drifts. |
| `src/app/api/admin/users/[id]/route.ts` | 168 | `profile as never` for `planFromRow` | Same — narrows joined `subscriptions` shape. |
| `src/app/api/search/route.ts` | 40 | `} as never)` | RPC/options typing escape. |
| `src/app/api/admin/users/route.ts` | 79, 148 | `p as never` / `row as never` | Plan extraction from joined rows. |
| `src/components/graph/hooks/useNodeActions.ts` | 185 | `data as never` → `mapNodeRow` | Row-to-domain mapping. |
| `src/components/graph/MemoryGraph.tsx` | 325, 370 | `savedRow as never` | Same. |
| `src/components/graph/hooks/useMemoryGraphChromeProps.ts` | 141 | `saved as never` | Same. |
| `src/components/graph/hooks/useGraphData.ts` | 33 | `r as unknown as Record<string, unknown>` | Attachment row mapping. |
| `src/components/graph/hooks/useDrawLoop.ts` | 314 | `node as unknown as MemoryNode` | Canvas draw path. |
| `src/store/vaultStore.ts` | 104 | nested `as unknown as` for vault rows | **Hiding** complex nested type. |
| `src/lib/lucideIconCanvasCache.ts` | 44 | dynamic import cast | **Justified** for lazy Lucide import typing. |
| `src/components/graph/ui/ContextMenu.tsx` | 29, 64 | `as unknown as MemoryNode` | UI narrowing. |

**Implicit `any`:** None reported under `strict: true` (`tsc` clean).

### 1b. ESLint

**Command:** `cd memorey && npx eslint .`  
**Result:** **0 errors**, **17 warnings** (all warnings, not errors).

**Verification:** Same command output ends with `✖ 17 problems (0 errors, 17 warnings)`.

**Warnings include:** `@next/next/no-img-element` (several files), `react-hooks/exhaustive-deps` (several files), `@typescript-eslint/no-unused-vars` for `_c` / `_d` in `src/lib/security/urlValidation.ts` (lines 16).

### 1c. `console.log` / `console.warn` / `console.error` in `src/`

**Verification:** `rg 'console\.(log|warn|error|debug|info)' memorey/src`

| Location | Classification |
|----------|----------------|
| API routes (`app/api/**/route.ts`) — many `console.error` on failures | **Intentional server error logging** (keep; consider structured logging later). |
| `src/proxy.ts:21` | **Intentional** — misconfigured Supabase env. |
| `src/lib/envCheck.ts:32` | **Intentional** — missing env warning. |
| `src/app/api/embed/route.ts` | **Intentional** — misconfig / API warnings. |
| `src/components/graph/canvas/fileNode.ts:39` | **Debug-ish** `console.warn` for image load — **candidate to remove** or gate behind `NODE_ENV`. |
| `src/components/graph/ui/VaultSettingsPopover.tsx:271` | **Debug leftover** in client — **remove** or replace with user-visible error. |
| `src/store/diffStore.ts` — multiple `console.error` | **Operational** — sync/import failures. |
| `src/components/diff/useDiff.ts` | **Operational**. |
| `src/components/ErrorBoundary.tsx:23`, `src/app/global-error.tsx:14` | **Error boundary logging** (keep). |

No `console.log(` matches in `src/` from this grep (only `console.warn` / `console.error` listed).

### 1d. Unused imports / variables

**Verification:** Default ESLint config does **not** enable `unused-imports/no-unused-imports`.  

**Explicit finding:** `src/lib/security/urlValidation.ts:16` — `_c` and `_d` trigger `@typescript-eslint/no-unused-vars` **warnings** (see ESLint output).

**No project-wide exhaustive unused-import list** — tooling not configured for it.

### 1e. Circular dependencies

**Tool:** `npx madge --circular --extensions ts,tsx src` (run from `memorey/`).  
**Result:** `✔ No circular dependency found!`

### 1f. `tsconfig.json`

```7:8:memorey/tsconfig.json
    "skipLibCheck": true,
    "strict": true,
```

- **`strict`: true** — confirmed.
- **`skipLibCheck`: true** — skips type-checking of `.d.ts` in `node_modules` (common; slightly weaker than full strict on deps).
- No `noImplicitAny: false` or other overrides weakening strictness.

### 1g. `package.json` dependencies

**Runtime `dependencies` — spot-check for zero imports in `src/`:**

- All major runtime deps appear used (e.g. `@anthropic-ai/sdk` in API routes, `stripe` in Stripe routes, `graphology` in `graphStore`, `react-force-graph-2d` in landing graphs, `@base-ui/react` in UI primitives, `cmdk` in `command.tsx`, `tw-animate-css` imported from `globals.css`, `openai` in `search/route.ts`, `cheerio` in `ingest-link`, `recharts` on admin pages, `isomorphic-dompurify` on `LandingPage.tsx`).

**devDependencies:** `shadcn` CLI is dev-scoped — appropriate. No strong evidence that `eslint` / `typescript` should move to `dependencies`.

---

## SECTION 2 — Database Schema & Data Integrity

### 2a. Public tables (live DB, MCP `list_tables` verbose)

The live **`public`** schema includes: `profiles`, `category_vaults`, `memory_nodes`, `node_edges`, `node_history`, `subscriptions`, `user_monthly_usage`, `pending_proposals`, `node_attachments`, `canvases`, `canvas_vaults`, `user_events`.  

Column names and types align with `src/lib/supabase/database.types.ts` (generated-style typings present for these tables).

**Application expectation:** Code uses the same table/column names (e.g. `memory_nodes.embedding`, `kanban_status`, `node_kind_v2`, vault theme columns) — cross-checks in Section 2b.

### 2b. Supabase queries vs schema

**Method:** Grep `.from(` / `.rpc(` in `src/`, cross-referenced with MCP table list and migration history.

**Findings:**

- **No references** to non-existent tables found in `src/` for `public` tables.
- **`search_nodes` RPC** — signature matches DB (`p_user_id`, embedding, vault ids, limit); `search/route.ts` passes `p_user_id` aligned with authenticated user.
- **`admin_*` RPCs** — used from admin API routes; exist in DB.
- **`user_events`:** RLS **`no_client_access`** with `qual: false` — clients cannot read/write; **only service role / admin client** can insert (matches `/api/track`, auth callback, etc.).
- **Potential constraint risk:** `user_monthly_usage` upserts from `incrementShareLinkUsage` / `incrementChatQueryUsage` use **read-then-upsert** (`usage.ts`) — race can miscount under concurrency (logic issue, not schema mismatch).

### 2c. RLS policies (MCP SQL on `pg_policies`)

**`public` tables:** All listed tables have **RLS enabled** (per `list_tables`).

**Policy summary (abbrev.):**

| Table | Policy pattern |
|-------|----------------|
| `profiles` | `SELECT`/`UPDATE` own row only. |
| `category_vaults`, `memory_nodes`, `node_edges`, `node_history`, `node_attachments`, `canvases`, `canvas_vaults` | `user_id` / ownership checks. |
| `subscriptions` | `SELECT` own. |
| `user_monthly_usage` | `SELECT` own. |
| `pending_proposals` | Split policies for `INSERT`/`SELECT`/`UPDATE`/`DELETE` — all scoped to `user_id`. |
| `user_events` | **`ALL` with `USING false`** — **no direct client access** (good for analytics). |

**`storage.objects`:** Policies restrict `bucket_id = 'node-attachments'` and **first path segment = `auth.uid()`** — aligns with user-scoped paths.

**Overly permissive:** None found for `public` app tables; **`user_events`** intentionally blocked for clients.

### 2d. Functions & triggers

**From MCP `execute_sql` on `pg_proc` (public):**  
`handle_new_user`, `update_updated_at`, `protect_admin_flag`, `seed_*`, `search_nodes`, `get_connected_nodes`, `admin_*` metrics RPCs, etc.

**Usage:**  
- `search_nodes`, `get_connected_nodes`, `seed_default_vaults`, `seed_canvas_vaults` — referenced from app code.  
- `admin_*` — admin API + RPC.  
- **Orphaned:** None obvious; all listed functions map to migrations or admin features.

### 2e. Indexes

**MCP `pg_indexes` on `public`:** PKs + sensible btree indexes on `user_id`, `canvas_id`, `vault_id`, IVFFlat on `embedding`, partial indexes for kanban, etc.

**Gaps / redundancy (analysis):**

- **`user_events`:** indexes on `(user_id, created_at)`, `(event_name, created_at)`, `(created_at)` — admin queries filtering by `event_name` and time range are covered; at very large scale, **partial** indexes per event could help.
- **Redundant:** `storage.objects` has two overlapping policies (see 2c) — **policy** duplication, not index duplication.

### 2f. Migrations order

**Local:** `memorey/supabase/migrations/` contains **`001` through `035`** — sequential numbering, no gaps in filenames.

**Remote (MCP `list_migrations`):** Ordered list applied on the linked project; names differ slightly from filenames but **no conflict** detected from tooling.

---

## SECTION 3 — Authentication & Authorization

### 3a. Auth paths

1. **Login:** `src/app/(auth)/login/page.tsx` — Supabase OAuth; errors logged `console.error` line ~25.
2. **Callback:** `src/app/auth/callback/route.ts` — `exchangeCodeForSession`, optional `user_events` `signup_completed` insert (service role), redirect by onboarding.
3. **Session:** `@supabase/ssr` in `src/lib/supabase/server.ts` + cookies; **`src/proxy.ts`** refreshes session via `createServerClient` cookie adapter.
4. **Middleware / proxy:** `src/proxy.ts` — redirects unauthenticated users from protected paths to `/login`.
5. **Logout:** Settings page `signOut()` (`settings/page.tsx` ~85–90).

**Gaps:** No explicit “session expired” UX beyond failed fetches (see §10c).

### 3b. Routes & protection

**Network middleware (`src/proxy.ts`):** Matcher includes `/dashboard`, `/graph`, `/settings`, `/login`, `/admin` — **build confirms `ƒ Proxy (Middleware)`**.

| Area | Auth |
|------|------|
| `/`, landing | **Public** (not in matcher — unauthenticated access). |
| `/login` | Public; logged-in users redirected to dashboard/onboarding. |
| `/dashboard/*`, `/graph`, `/settings` | **Requires user**; onboarding gate redirects incomplete users. |
| `/admin/*` | **Requires login** in proxy; **does not** check `is_super_admin` in proxy. |

**API routes:** Each handler must validate session or bearer token — most do; see Section 5.

**Gap:** **`/admin` pages are static (○) in build output** — HTML shell can load for any logged-in user; **sensitive admin data** is gated by **`AdminLayoutClient`** + API `assertAdmin` (see 3e).

### 3c. IDOR

**Pattern:** Routes using **Bearer token** + `getUser(token)` then **`.eq("user_id", user.id)`** or **RLS-scoped Supabase client** are safe.  
**`src/app/api/attachments/route.ts`** — verifies `memory_nodes` row belongs to user (lines 114–126) before insert — **good**.

**`src/app/api/memory/create/route.ts`** — verifies vault with `.eq("id", vaultId).eq("user_id", user.id)` — **good**.

**CRITICAL — `src/app/api/nodes/create-file/route.ts`:** Authenticates the user but **does not verify** that `body.vaultId` belongs to `user.id` before insert. RLS on `memory_nodes` only enforces `user_id = auth.uid()`, **not** that `vault_id` is owned by the same user — an attacker could pass another user’s `vault_id` UUID and create a **corrupt / cross-tenant row** (same-user_id with foreign vault reference). **Must add** the same vault ownership select as `memory/create` (or DB constraint).

```72:78:memorey/src/app/api/nodes/create-file/route.ts
    const { data, error } = await supabase
      .from("memory_nodes")
      .insert({
        ...baseRow,
        source: "manual",
      })
```

**`src/app/api/export/route.ts`** — rejects `body.userId !== user.id` (lines 52–55).

**Admin routes** — `assertAdmin()` + target `id` from URL — **super-admin only**.

### 3d. `assertAdmin`

```13:37:memorey/src/lib/admin/assertAdmin.ts
export async function assertAdmin(): Promise<AssertAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.is_super_admin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, userId: user.id };
}
```

**Bypass:** Not realistically bypassable without a valid session **and** `profiles.is_super_admin = true` (DB enforced; `protect_admin_flag` trigger prevents user self-promotion except via service role).

**Edge cases:** `maybeSingle()` with no row → 403 (treated as non-admin). Race: if profile row deleted mid-request — fails closed to 403.

### 3e. Admin UI flash

**`AdminLayoutClient`** (`src/app/(admin)/admin/AdminLayoutClient.tsx`): `gate` starts `"loading"` — shows **skeleton only** until `/api/admin/stats` returns **200**. On 401/403 → redirect.  

**Worst case:** User sees **non-sensitive skeleton**, not metrics — **no admin data flash** observed in code path.

---

## SECTION 4 — Security

### 4a. XSS

**`dangerouslySetInnerHTML`:**

1. **`src/app/layout.tsx:97`** — inline **theme boot** script; content is **static string** in source, not user input.
2. **`src/components/landing/LandingPage.tsx:2134-2136`** — AI message HTML via **`DOMPurify.sanitize(msg.html)`** before inject.

```2132:2137:memorey/src/components/landing/LandingPage.tsx
                          {msg.role === "ai" ? (
                            <span
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(msg.html),
                              }}
```

**Other patterns:** No `document.write` in `src/`. `innerHTML` not grep-matched beyond React pattern above.

### 4b. API key columns (`anthropic_api_key_enc`, `openai_api_key_enc`)

**Verification:** `rg 'anthropic_api_key|openai_api_key' memorey/src` — **only** `database.types.ts` references.

**Conclusion:** Columns exist in DB (MCP `profiles` columns) but **no application code reads or writes them** in `src/`. **No encryption implementation** in repo — names suggest encryption intent; **currently unused**, so **neither plaintext nor real crypto** in app logic.

**Server AI keys:** `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` env vars (`envCheck.ts`).

### 4c. Service role exposure

**Files referencing `SUPABASE_SERVICE_ROLE_KEY` or `createAdminClient`:**  
(admin routes, `auth/callback`, `assertAdmin`, `billing/usage`, `search/route.ts`, `export/route.ts`, `export/share/route.ts`, embed, ingest, memory/create analytics, etc.)

**Verification:** All such imports live under **`src/app/api/**`**, **`src/lib/**`**, **`src/app/auth/**`** — **no** `"use client"` files import `createAdminClient`.  

**Next.js:** Server bundles API routes separately — **service key not sent to browser** by design.

### 4d. Storage

**Bucket (MCP):** `node-attachments`, **private**, 50MB limit, MIME allowlist.

**RLS:** Path first folder = user id — **cannot read other users’ objects** with normal user JWT.

### 4e. CSRF

**Cookie-auth routes** (e.g. `vaults/set-active`, `billing/summary`, `delete-all-data`): **No CSRF tokens**. Mitigation: **SameSite cookies** (Supabase SSR defaults) + **JSON APIs** (not simple form POST from third-party origin). **Residual risk:** classical CSRF against cookie session if SameSite ever mis-set — **medium** for state-changing POSTs.

### 4f. Rate limiting

**Implemented via `checkRateLimit`:** `landing-chat`, `attachments/extract-meta`, `graph-builder`, `ingest-link`, `embed`, `memory-assistant`, `extract-nodes`, `search`, `track` (see grep in Section 1 workspace search).

**Many routes have NO rate limit:** e.g. `memory/create`, `attachments` POST, `vaults/create`, `export`, `billing`, `stripe/*`, `kanban/complete`, `profile/onboarding`, `delete-all-data`, `vaults/set-active` — **expensive or sensitive** endpoints partially unprotected.

### 4g. Input validation

- **Zod:** `memory/create`, `vaults/create`, parts of validation in `lib/validation/schemas.ts`.
- **Manual:** many routes use typeof checks; export route validates `vaultIds`, `format`, `maxNodes`.

### 4h. `api/user/delete-all-data`

**Tables touched:** `user_events`, `pending_proposals`, `node_attachments`, `node_history`, `node_edges`, `memory_nodes`, `canvas_vaults`, `canvases`, `category_vaults` (delete + reseed), `user_monthly_usage`, storage `node-attachments`.

**Does NOT delete:** `profiles`, `subscriptions`, `auth.users` — **documented in file header** (lines 6–9).

**Storage:** Lists/removes under `${userId}/` prefix — **aligned** with RLS path pattern.

**Gaps:** If `pending_proposals` delete fails, error is **logged but not added to `errors`** (lines 64–72) — **inconsistent** partial failure reporting.

### 4i. SQL injection

**No raw string-built SQL** in app code; Supabase client + RPCs use parameters. **No** `execute_sql` from app.

### 4j. Secrets in repo

**Grep:** No hardcoded `sk-` API keys in `src/`.  

**`.env.local`:** Present locally per glob; **`.gitignore` excludes `.env.local`** (`memorey/.gitignore` lines 33–36). **Do not commit** env files.

---

## SECTION 5 — API Routes — Complete Review

**Legend:** Auth: **cookie** = `createClient()` server; **bearer** = `Authorization: Bearer`; **none** = public or special.

| Route | Methods | Auth | Validation | Supabase client | Errors | Rate limit | Issues |
|-------|---------|------|------------|-----------------|--------|------------|--------|
| `/api/admin/stats` | GET | cookie + assertAdmin | assertAdmin | admin | implicit | no | — |
| `/api/admin/analytics/funnel` | GET | assertAdmin | days parsed | admin | yes | no | — |
| `/api/admin/analytics/feature-usage` | GET | assertAdmin | query | admin | yes | no | — |
| `/api/admin/analytics/overview` | GET | assertAdmin | query | admin | yes | no | — |
| `/api/admin/activity` | GET | assertAdmin | — | admin | yes | no | — |
| `/api/admin/revenue` | GET | assertAdmin | — | admin | yes | no | MRR not real revenue (see §7e) |
| `/api/admin/users` | GET | assertAdmin | — | admin | yes | no | — |
| `/api/admin/users/[id]` | GET | assertAdmin | — | admin | yes | no | — |
| `/api/attachments` | POST | bearer | manual | user JWT + RLS | yes | **no** | No RL |
| `/api/attachments/extract-meta` | POST | cookie + RL | — | — | yes | yes | — |
| `/api/billing/summary` | GET | cookie | — | admin | try/catch | no | — |
| `/api/embed` | POST | cookie + RL | — | admin | yes | yes | — |
| `/api/export` | POST | bearer | manual | admin | yes | **no** | Heavy work, no RL |
| `/api/export/share` | POST | bearer | — | admin | yes | **no** | — |
| `/api/export/strip-pii` | POST | bearer | manual | — | yes | **no** | LLM cost; no RL |
| `/api/extract-nodes` | POST | cookie + RL | — | — | yes | yes | — |
| `/api/graph-builder` | POST | cookie + RL | — | — | yes | yes | — |
| `/api/ingest-link` | POST | cookie + RL | — | admin | yes | yes | — |
| `/api/kanban/complete` | POST | cookie | — | admin | yes | **no** | LLM |
| `/api/landing-chat` | POST | none + RL | — | — | yes | yes | Public RL by IP |
| `/api/memory-assistant` | POST | cookie + RL | — | — | yes | yes | — |
| `/api/memory/create` | POST | bearer | Zod | user + admin | yes | **no** | — |
| `/api/nodes/create-file` | POST | bearer | **none (unsafe)** | user + admin | yes | **no** | **IDOR: vaultId not verified — §3c** |
| `/api/profile/onboarding` | PATCH | cookie | — | — | yes | **no** | — |
| `/api/search` | POST | cookie + RL | — | admin + RPC | yes | yes | — |
| `/api/stripe/checkout` | POST | cookie | — | admin | yes | **no** | — |
| `/api/stripe/portal` | POST | cookie | — | admin | yes | **no** | — |
| `/api/stripe/webhook` | POST | Stripe sig | raw body | admin | yes | **no** | Webhook-specific |
| `/api/track` | POST | cookie (optional) | manual | admin | swallowed | yes | Silent 200 if unauth |
| `/api/user/delete-all-data` | POST | cookie | confirm string | admin | yes | **no** | Destructive |
| `/api/vaults/create` | POST | bearer | Zod | user + admin | yes | **no** | — |
| `/api/vaults/set-active` | POST | cookie | manual | admin | yes | **no** | — |

**Notes on flagged routes:**

- **`/api/export/strip-pii/route.ts`** — **Bearer auth** required (`getUser(token)` lines 7–28); sends content to Anthropic — **expensive**, no rate limit.
- **`/api/nodes/create-file/route.ts`** — **Bearer auth** present; **vault ownership not verified** — see §3c (critical).

---

## SECTION 6 — Frontend

### 6a. SSR safety

**Verification:** Client components (`"use client"`) dominate interactive UI; `LandingPage` uses `localStorage` inside **`useEffect`** (lines 189–199) — **safe**.

**`src/app/layout.tsx`** theme script uses `localStorage` inside **string** executed only in browser — OK.

**`sidebar-context.tsx`** guards with `typeof window === "undefined"` — OK.

### 6b. `useEffect` audit

**Representative issues:** ESLint **exhaustive-deps warnings** in `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, etc. — risk of **stale closures** or **missed updates**; not proven runtime bugs without tests.

### 6c. Zustand stores

**Files:** `graphStore`, `vaultStore`, `canvasStore`, `diffStore`, `exportPanelStore`, `vaultManagerOverlayStore`.

**Immer:** Used in `graphStore`, `vaultStore`, `diffStore` — consistent with comment about draft leakage in `graphStore`.

**Race conditions:** Possible in **`usage.ts`**-style counters (server) and concurrent graph saves — not fully serialized client-side.

### 6d. Client `fetch` error handling

**Pattern:** Most dashboards check `res.ok` and toast errors; **`useTrack`** swallows errors by design.

### 6e. Error boundaries

**`ErrorBoundary`:** Catches **render errors** in children; logs to console; shows fallback UI.

**`global-error.tsx`:** Catches **root layout errors** in App Router.

**Misses:** Event handler errors, async errors outside React — **not caught**.

### 6f. / 6g. Loading & empty states

**Admin pages:** Use skeletons in layout or page-level loading patterns (e.g. `AdminLayoutClient` loading state).  

**Graph:** Complex — empty graph scenarios depend on `graphStore` data; **verify manually** on empty account.

### 6h. Forms

**Examples:** Onboarding steps, `QuickCreateForm`, node detail, vault settings — mix of **client validation** and **DB constraints** (`char_length` checks on DB). **Exhaustive per-form matrix** omitted here for length; **no central form library** beyond primitives + Zod on select API routes.

---

## SECTION 7 — Admin Dashboard

### 7a. API correctness

**`admin_funnel_metrics` RPC** — `used_search` / `used_capture` filter by `p_since`; **`active_last_7_days_rolling`** intentionally **not** filtered by `p_since` (comment in DB function). UI must label this **rolling 7d**, not “within selected window”.

**`total_signups`:** Counts **all profiles ever**, not signups in window — **funnel labeling** can mislead.

### 7b. Performance

**Admin routes** pull large counts (`select *` count on big tables) — **O(n)** table scans as data grows. **Recommend:** materialized views or incremental rollups for 10k+ users.

### 7c. Frontend completeness

**AdminLayoutClient** provides loading skeleton; pages use charts (`recharts`). **Responsive:** sidebar collapses — **spot-check** on 375px recommended.

### 7d. Access control

See **3e** — skeleton only until stats 200.

### 7e. Data accuracy

**“Conversion rate”** in `admin/stats` — `nonFreeRes.count / totalUsers` (plans not `free`) — **plan-based**, not Stripe-verified MRR.

**Revenue page:** Likely **estimated** from subscriptions — confirm Stripe linkage in UI copy.

---

## SECTION 8 — Analytics

### 8a. Pipeline

`useTrack` → `POST /api/track` → **dedupe** (1s client, 2s server) → `user_events` insert via admin client.

**Loss:** Fire-and-forget — network fail = silent loss.

### 8b. Event coverage

**Defined labels** (`eventLabels.ts`) vs **fired:**

| Event | Fired? |
|-------|--------|
| `signup_completed` | `auth/callback` insert |
| `vault_created` | `vaults/create` + label map |
| `canvas_created` | `canvasStore` fetch to `/api/track` |
| `export_triggered` | `ExportPanel` fetch |
| `node_created` | **Both** API inserts (`memory/create`, `create-file`) **and** client `track` — **double-count risk** |
| `page_view` | `TrackPageView` / settings |
| `kanban_status_changed` | kanban page — **not in `EVENT_LABELS`** (still stored) |

### 8c. Rate limit on `/api/track`

**60/min per user** — malicious user can still write **60 events/min** sustained; DB grows. **Mitigation:** partial; consider server-side aggregation.

### 8d. Privacy

**Delete-all-data** removes `user_events` for user — **good**.  

**Account deletion** (auth user delete) — **not implemented** in delete-all-data (stated in comments).

---

## SECTION 9 — Performance & Scalability

### 9a. Heavy queries

1. Admin dashboard full counts on `memory_nodes`, `node_edges`, etc.
2. Vector search with IVFFlat — tune `lists` as data grows.
3. `user_events` scans for funnel metrics.

### 9b. Bundle

**Heavy:** `recharts`, `react-force-graph-2d`, graph canvas code — **lazy-load** admin and landing demos where possible.

### 9c. Canvas / graph

**No virtualization** observed for large graphs — **performance degrades** with node count (heuristic limit depends on device).

### 9d. Serverless timeouts

**LLM routes** (`search`, `ingest-link`, `graph-builder`, etc.) — risk **>10s** on cold start + long model calls on hobby tier.

### 9e. DB connections

Each API handler creates clients — **connection pooling** via Supabase HTTP API (not raw PG per request) — typical pattern; under extreme parallel load, watch **Supabase pool limits**.

### 9f. Storage growth

**Attachments + rows** — scales with usage; **monitor** dashboard.

---

## SECTION 10 — Edge Cases & Reliability

### 10a. External outages

- **Supabase down:** Auth and data fail — redirects / errors.
- **Anthropic/OpenAI:** API routes return errors; UX depends on each route’s handling (mostly JSON error).

### 10b. Concurrency

**Two tabs:** Last write wins on nodes — **no OT/CRDT**.

**Usage counters:** **Race** in `usage.ts` increment pattern.

### 10c. Session expiry

**No global refresh handler** — failed API calls may surface as generic errors until user refreshes login.

### 10d. Browser support

**ES2017 target** + modern React — **no IE**. Minimum **evergreen browsers**.

### 10e. Plan limits

**memory/create** returns `MEMORY_LIMIT` JSON — **clear**. **Vault limits** in `vaults/set-active` — clear error object.

---

## SECTION 11 — Accessibility

**Verification:** No automated a11y suite run. **Manual gaps likely:** canvas/graph **mouse-first**; some buttons may lack **`aria-label`** — **not exhaustively listed** (would require per-component audit).

### 11b. Keyboard

**Graph interactions** — primarily pointer-based; keyboard shortcuts exist in hooks (`useKeyboardShortcuts.ts`) — **partial** coverage.

---

## SECTION 12 — Mobile Responsiveness

**Verification:** Tailwind breakpoints used; **no emulator run in this audit**.  

**Risk:** Graph and kanban **dense UIs** — **manual QA on 375px** recommended.

---

## SECTION 13 — Summary & Fix Priority

### Table 1 — Critical

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| **IDOR / bad vault on file-node create** — `vaultId` not verified against user | `src/app/api/nodes/create-file/route.ts` | `select id from category_vaults where id = ? and user_id = ?` before insert (mirror `memory/create`) | Small |
| **Destructive / high-impact routes without rate limits** (export, delete-all-data, Stripe) | `src/app/api/export/route.ts`, `user/delete-all-data`, `stripe/*` | Add `checkRateLimit` + stricter caps | Medium |
| **Usage increment race** (billing accuracy) | `src/lib/billing/usage.ts` | DB-side `UPDATE ... SET count = count + 1` or RPC | Medium |
| **Partial delete inconsistency** (`pending_proposals` error not aggregated) | `delete-all-data/route.ts` ~64–72 | Push to `errors[]` like other steps | Small |

### Table 2 — High

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| **Analytics double-count** `node_created` | API + `useNodeActions` / `memory/create` | Single source of truth | Medium |
| **Funnel metrics misleading** (`total_signups` = all time) | DB function `admin_funnel_metrics` + UI labels | Rename / filter by window | Medium |
| **CSRF residual** on cookie POSTs | API routes | SameSite audit + optional CSRF token | Medium |
| **ESLint exhaustive-deps** warnings | Multiple components | Fix or suppress with comment | Medium |

### Table 3 — Medium

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| In-memory rate limiter limitations | `src/lib/rateLimit.ts` | Redis / edge limiter | Large |
| `as never` casts | multiple files | Narrow Supabase generated types | Medium |
| `fileNode.ts` console.warn | line 39 | Remove or dev-only | Small |

### Table 4 — Low

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Unused `_c` / `_d` eslint warnings | `urlValidation.ts:16` | Prefix or remove | Small |
| `@next/next/no-img-element` warnings | various | Use `next/image` where appropriate | Small |

---

## Production readiness

**Is this codebase ready to deploy to production for real users, assuming critical and high issues are addressed first?**

**NO** until **`/api/nodes/create-file` vault ownership is verified** (§3c / Table 1) — that issue is a **data-integrity / authorization defect**. After fixing that and addressing Table 1–2 launch items (**rate limits**, **usage races**, **funnel labeling**), the codebase is **much closer** to production-ready; remaining items are **operational hardening**.

---

*Generated as FINAL_AUDIT_5. Methodology: CLI (`tsc`, `eslint`, `npm run build`, `madge`), `rg` searches, and Supabase MCP (`user-memorey supabase`).*
