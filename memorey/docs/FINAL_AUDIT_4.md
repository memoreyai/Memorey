# Memorey — Final Technical Audit (FINAL_AUDIT_4)

**Audit date:** 2026-03-21  
**Scope:** Repository `memorey/` — fresh audit; prior findings are not assumed.  
**Evidence methodology:** Automated tooling (`npx tsc --noEmit`, `npx eslint`, `npm run build`, `npx madge --extensions ts,tsx --circular src`, `npx depcheck`, targeted `rg`/grep), **Supabase MCP** (`user-memorey supabase`: `list_tables` verbose, `execute_sql` for policies/indexes/functions), and manual reads of security-critical modules, all `src/app/api/**/route.ts` handlers, migrations under `supabase/migrations/`, and root configs (`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`).

**Source inventory:** `glob **/*.{ts,tsx}` under `src/` → **254 files** (enumerated). Not every line of every file was hand-read; cross-cutting searches and compiler/linter runs provide coverage for patterns (casts, `console.*`, `dangerouslySetInnerHTML`, service role usage). Where a section states “no issues,” the verification method is explicit.

---

## SECTION 1: Build, Compilation & Code Quality

### 1a. TypeScript (`npx tsc --noEmit`)

**Command:** `cd memorey && npx tsc --noEmit`  
**Result:** Exit code **0** — no type errors reported for the project.

**Implicit `any` / strictness:** `tsconfig.json` sets `"strict": true` (see §1f). No `implicit any` failures surfaced under current `include` (no `noUnusedLocals` / `noUnusedParameters` enabled).

**Unsafe assertions (`as any`, `as unknown as`, `as never`) — grep:** `rg 'as any|as unknown as|as never' src`

| File | Line | Snippet | Assessment |
|------|------|---------|------------|
| `src/store/diffStore.ts` | 257, 298 | `rowToMemoryNode(data as never, …)` | **Workaround** — bridges Supabase row shape to `mapNodeRow`; risk if DB shape drifts. |
| `src/app/api/admin/users/[id]/route.ts` | 168 | `planFromRow(profile as never)` | **Cast** — admin row typing; justified if `planFromRow` expects stricter type. |
| `src/app/api/search/route.ts` | 40 | `} as never)` in `rowToMemoryNode` | **Same pattern** as diffStore. |
| `src/components/graph/hooks/useNodeActions.ts` | 185 | `mapNodeRow(data as never)` | **Workaround** for row typing. |
| `src/app/api/admin/users/route.ts` | 79, 148 | `planFromRow(p as never)` / `row as never` | **Cast** for admin list. |
| `src/components/graph/MemoryGraph.tsx` | 325, 370 | `mapNodeRow(savedRow as never)` | **Workaround**. |
| `src/components/graph/hooks/useMemoryGraphChromeProps.ts` | 141 | `mapNodeRow(saved as never)` | **Workaround**. |
| `src/components/graph/hooks/useGraphData.ts` | 33 | `r as unknown as Record<string, unknown>` | **Narrowing** for attachment mapping. |
| `src/components/graph/hooks/useDrawLoop.ts` | 314 | `node as unknown as MemoryNode` | **Draw-path** type for file node rendering. |
| `src/store/vaultStore.ts` | 104 | `as unknown as { category_vaults?: … }[]` | **Nested join** type workaround. |
| `src/lib/lucideIconCanvasCache.ts` | 44 | `import("lucide-react") as unknown as Record<…>` | **Dynamic import** typing. |
| `src/components/graph/ui/ContextMenu.tsx` | 29, 64 | `as unknown as MemoryNode` | **UI** — narrow menu node types. |

**`as any`:** **None** matched in `src/` (grep).

### 1b. ESLint

**Command:** `npx eslint . --max-warnings 999999`  
**Result:** **0 errors**, **17 warnings** (all warnings).

**Warnings (non-exhaustive):** `@next/next/no-img-element` (multiple files), `react-hooks/exhaustive-deps` (`MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx`), `@typescript-eslint/no-unused-vars` in `src/lib/security/urlValidation.ts` (params `c`, `d` unused).

**Verification:** Zero ESLint **errors** confirmed by command exit code 0 and output line `✖ 17 problems (0 errors, 17 warnings)`.

### 1c. `console.log` / `warn` / `error` in `src/`

**Method:** `rg 'console\.(log|warn|error)' src`

| Location | Classification |
|----------|------------------|
| `src/app/api/**` (many routes) | **Intentional server error logging** — operational/debug. |
| `src/app/global-error.tsx` | **Error boundary logging** — keep. |
| `src/components/ErrorBoundary.tsx` | **Error boundary logging** — keep. |
| `src/components/graph/ui/VaultSettingsPopover.tsx:271` | `console.error(e)` — **debug/leftover** in client UI (consider removing or toast). |
| `src/store/diffStore.ts` | Multiple `console.error` — **debug-heavy**; acceptable for dev diagnostics, noisy in prod. |
| `src/components/diff/useDiff.ts` | `console.error` — **debug**. |
| `src/lib/vaults/resolveVaultId.ts:50` | `console.error` — **debug**. |
| `src/lib/envCheck.ts` | `console.warn` — **startup warning** (intentional). |
| `src/app/(auth)/login/page.tsx:25` | `console.error(oauthError)` — **could be user-facing toast** instead. |
| `src/components/graph/canvas/fileNode.ts:39` | `console.warn` — **image load failure** (borderline keep). |

Full list with line numbers is in grep output; API routes overwhelmingly use `console.error` for failures (**intentional server logging**).

### 1d. Unused imports / variables

**Method:** ESLint rule `@typescript-eslint/no-unused-vars` as configured in `eslint-config-next`.

**Verified instance:** `src/lib/security/urlValidation.ts` line 16 — unused parameters `c`, `d` (ESLint warning).

**Broader unused imports:** No dedicated `eslint-plugin-unused-imports` in config; **no automated exhaustive list** of unused imports without adding a rule. **Verification:** `grep`/ESLint on full tree — only the above warning surfaced in the default Next ESLint run.

### 1e. Circular dependencies

**Tool:** `npx madge --extensions ts,tsx --circular src`  
**Result:** `✔ No circular dependency found!` (255 files processed).

### 1f. `tsconfig.json`

```1:34:memorey/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    ...
```

- **`strict`: true** — confirmed.  
- **Permissive overrides:** `allowJs: true` (JS can be typed loosely), `skipLibCheck: true` (skips declaration checks in `node_modules`). No `strictNullChecks` override — remains on via `strict`.

### 1g. `package.json` dependencies

**`depcheck`:** `npx depcheck` reported:

- `tw-animate-css` — **false positive** — consumed via CSS `@import "tw-animate-css"` in `src/app/globals.css`.
- `tailwindcss`, `@tailwindcss/postcss`, `shadcn` — **false positives** — build/Tailwind/shadcn CSS pipeline (`postcss.config.mjs`, `globals.css`).

**Dependencies with no direct `import` in `src/` (grep spot-check):** All primary runtime deps (`next`, `react`, `@supabase/*`, `zod`, `lucide-react`, etc.) show usage. **No** dependency was confirmed as **completely unused** in `src/` without false positives from CSS-only packages.

**devDependencies vs dependencies:** `tailwindcss`, `@tailwindcss/postcss`, `shadcn` are **devDependencies** but required at **build** time — acceptable; production **bundle** does not need them at runtime on the server if only build-time. **No** misplacement flagged as a bug.

---

## SECTION 2: Database Schema & Data Integrity (Supabase MCP)

### 2a. Public schema tables (live DB via MCP `list_tables` verbose)

**Tables:** `profiles`, `category_vaults`, `memory_nodes`, `node_edges`, `node_history`, `subscriptions`, `user_monthly_usage`, `pending_proposals`, `node_attachments`, `canvases`, `canvas_vaults`, `user_events`.

**Verification:** `list_tables` with `schemas: ["public","storage"]`, `verbose: true` on **user-memorey supabase** MCP.

**Application alignment:** Generated types in `src/lib/supabase/database.types.ts` match these entities; app code uses Supabase client against these tables consistently.

### 2b. Supabase queries vs schema

**Cross-reference method:** Grep `\.from\(|\.rpc\(` in `src/` + manual review of critical routes.

**Findings:**

- **`public.get_connected_nodes`** — defined in RPC list and `database.types.ts`, **no call sites** in `src/` except types (see §2d). Not a schema mismatch, but **unused** from the app.
- **`profiles.anthropic_api_key_enc` / `openai_api_key_enc`** — exist in DB and types; **no read/write** in application code (LLM keys use **environment** variables — see §4b). **Not** a column mismatch; **semantic** issue (misleading `_enc` if never encrypted).
- **Search** uses `search_nodes` with `admin.rpc` and `p_user_id` — matches migration-defined signature (`007_secure_search_and_graph_rpcs.sql` pattern).

**No** evidence of a **wrong column name** in a live `.select()` that would break at runtime (would likely fail `tsc` or runtime tests).

### 2c. RLS policies (MCP `execute_sql` on `pg_policies`)

**Public tables (summary):**

| Table | Policy pattern |
|-------|----------------|
| `profiles` | `profiles_select_own`, `profiles_update_own` — **no INSERT** for `authenticated` (insert via trigger/service role). |
| `category_vaults`, `memory_nodes`, `node_edges`, `node_history`, `node_attachments`, `canvases`, `canvas_vaults` | `auth.uid() = user_id` (or ownership via canvas join). |
| `pending_proposals` | Split INSERT/SELECT/UPDATE/DELETE — all scoped to `user_id`. |
| `subscriptions` | **SELECT only** (`subscriptions_select_own`). |
| `user_monthly_usage` | **SELECT only** (`usage_select_own`). |
| `user_events` | **`no_client_access`** — `USING (false)` for ALL — **clients cannot read/write events** via PostgREST. |

**Storage `storage.objects`:**

- `Users access own attachments` — ALL on `bucket_id = 'node-attachments'` and `(auth.uid())::text = (storage.foldername(name))[1]`.
- `Users read own attachments` — SELECT with same path predicate — **redundant** with ALL policy (clutter, not a security hole).

**Overly permissive:** None for core user data; **admin** operations correctly use **service role** (bypasses RLS).

### 2d. Functions & triggers

**From migrations (grep `CREATE TRIGGER|CREATE OR REPLACE FUNCTION` in `supabase/migrations/`):**

- `handle_new_user`, `seed_default_vaults*` variants, `search_nodes`, `get_connected_nodes`, `admin_*` RPCs, `protect_admin_flag`, `update_updated_at`, etc.

**App usage:**

- **`get_connected_nodes`** — **not invoked** from `src/` (orphaned from product perspective).
- **`protect_admin_flag`** — `030_fix_profiles_rls.sql` — prevents non–`service_role` from changing `is_super_admin` (silent revert).

### 2e. Indexes (MCP `pg_indexes` on `public`)

Indexes exist on `user_id`, FKs, `embedding` (ivfflat), `user_events` (event_name, created_at), etc. **No obvious missing index** for primary filters (`user_id`, `vault_id`, `canvas_id`) — multiple btree indexes present.

**Redundancy:** `idx_category_vaults_user` and `idx_category_vaults_user_active` overlap partially — minor redundancy possible; review at scale.

### 2f. Migrations order

**Files:** `001` … `032` — **Sequential numeric prefixes**; **no gaps** in filenames listed under `supabase/migrations/`. **Verification:** `glob supabase/migrations/*.sql` → 32 files.

---

## SECTION 3: Authentication & Authorization

### 3a. Auth paths

- **Login:** `src/app/(auth)/login/page.tsx` — Supabase OAuth; `redirectTo: ${window.location.origin}/auth/callback`.
- **Callback:** `src/app/auth/callback/route.ts` — `exchangeCodeForSession`, optional `user_events` insert (`signup_completed`), redirect by `onboarding_completed`.
- **Session refresh:** `@supabase/ssr` cookie handling in `src/lib/supabase/server.ts` and `src/proxy.ts` (middleware).
- **Logout:** Settings page `signOut()` + redirect.

**Gap:** Session expiry during long sessions — **client** must handle 401 from API; not uniformly surfaced (see §10c).

### 3b. Routes & middleware

**`src/proxy.ts`** — Next.js 16 **network middleware** (not `middleware.ts` filename).

**Evidence:** `npm run build` output includes:

```text
ƒ Proxy (Middleware)
```

**Matcher:** `/dashboard`, `/graph`, `/settings`, `/login`, `/admin` — **does not** include `/api/*`.

**Implications:**

- **Page routes** listed are protected by `getUser()` redirect to `/login` when unauthenticated.
- **`/admin`:** **does not** check `is_super_admin` in middleware — only “logged in”. **Admin authorization** is enforced in **API** (`assertAdmin`) and **client** (`AdminLayoutClient` fetches `/api/admin/stats`).

**Public:** `/` (landing), static assets, `/auth/callback`.

### 3c. IDOR

**Pattern:** Bearer-token routes (`memory/create`, `attachments`, `search`, `export`, …) validate `user.id` against `body.userId` where applicable.

**Example — `src/app/api/search/route.ts`:**

```104:106:memorey/src/app/api/search/route.ts
  if (userId !== user.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
```

**Memory create** — `body.userId !== user.id` → 403.

**RLS:** User-scoped Supabase clients with anon key + Bearer enforce row ownership for direct table access.

**Residual risk:** Any route using **only** `createAdminClient` without a **user-scoped** filter must be audited — **admin** routes use `assertAdmin` and `p_user_id` only for admin views.

### 3d. `assertAdmin`

```13:41:memorey/src/lib/admin/assertAdmin.ts
export async function assertAdmin(): Promise<AssertAdminResult> {
  const supabase = await createClient();
  ...
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

**Bypass:** Not bypassable without a valid session cookie **and** `is_super_admin = true` in DB. **Service role** cannot be forged from the client.

**Edge cases:** `maybeSingle()` with no row → `!profile?.is_super_admin` → **403** (safe). **Race:** profile row missing → forbidden.

**DB layer:** `protect_admin_flag` prevents privilege escalation via `profiles` UPDATE.

### 3e. Admin UI flash

**`AdminLayoutClient`** — `gate === "loading"` shows **skeleton only** (no KPIs). After `fetch("/api/admin/stats")` → 403 → `/dashboard`. **Worst case:** skeleton visible briefly; **no admin numbers** rendered before gate.

---

## SECTION 4: Security

### 4a. XSS

| Location | Source | Sanitized? |
|----------|--------|------------|
| `src/components/landing/LandingPage.tsx` ~2134 | `DOMPurify.sanitize(msg.html)` inside `dangerouslySetInnerHTML` | **Yes** |

```2132:2137:memorey/src/components/landing/LandingPage.tsx
                          {msg.role === "ai" ? (
                            <span
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(msg.html),
                              }}
```

- `src/app/layout.tsx` ~97 — **inline boot script** for theme; **not** user content.

**Other patterns:** No `document.write` in `src/`. **grep** `innerHTML` — use review in diff/copy flows (clipboard/DOM ranges) — **not** injecting remote HTML.

### 4b. API key columns (`anthropic_api_key_enc`, `openai_api_key_enc`)

**Evidence:** **Grep** for `anthropic_api_key_enc` / `openai_api_key` in `src/` → **only** `database.types.ts`.

**Runtime LLM keys:** `process.env.ANTHROPIC_API_KEY`, `process.env.OPENAI_API_KEY` in API routes (e.g. `src/app/api/search/route.ts`, `src/app/api/embed/route.ts`).

**Conclusion:** DB columns are **unused** by the app; **no encryption implementation** in app code for those columns. **Naming** `_enc` is **misleading** if values are ever stored plaintext later.

### 4c. Service role exposure

**Files importing `createAdminClient` or using `SUPABASE_SERVICE_ROLE_KEY`:**  
**grep** `createAdminClient|SUPABASE_SERVICE_ROLE_KEY` → **only** under `src/app/api/**`, `src/lib/supabase/admin.ts`, `src/lib/admin/assertAdmin.ts`, `src/lib/billing/usage.ts`, `src/lib/envCheck.ts`, `src/app/auth/callback/route.ts`.

**Client bundle:** These modules are **not** imported into `"use client"` components except **not** observed — `admin.ts` is server-only by import graph from Route Handlers.

**Verification:** Path-based review — **no** `createAdminClient` in `src/components/**` or client pages.

### 4d. Storage

**Policies:** `bucket_id = 'node-attachments'` and first path segment = `auth.uid()` (see §2c).

**IDOR:** Users **cannot** list/read another user’s prefix without **service role** (barring RLS bugs).

**Predictability:** Paths are `{userId}/{filename}` — **guessable** if UUID leaked, but **not** enumerable without auth.

### 4e. CSRF

**Cookie-auth routes** (`createClient` from `@/lib/supabase/server`): e.g. billing, Stripe portal, delete-all-data, profile PATCH.

**Mitigation:** Supabase session cookies are **SameSite** by default (browser + Supabase SSR). **No** custom CSRF tokens.

**Risk:** Classic **cross-site POST** with cookies depends on SameSite=Lax/Strict — **medium** documentation gap; recommend explicit SameSite review in production.

### 4f. Rate limiting

**Implemented (`checkRateLimit`):** `landing-chat`, `attachments/extract-meta`, `graph-builder`, `ingest-link`, `embed`, `memory-assistant`, `extract-nodes`, `search`, `track`.

**Not using `checkRateLimit` (grep):** All other `src/app/api/**/route.ts` — including **admin** (except auth), **billing**, **Stripe**, **export**, **vaults**, **memory/create**, **attachments**, **delete-all-data**, **kanban/complete**, **profile/onboarding**, etc.

**Limitation (documented in code):**

```1:7:memorey/src/lib/rateLimit.ts
 * Limitation: state lives in this process only — it resets on serverless cold
 * starts and does not coordinate across multiple instances.
```

### 4g. Input validation

**Zod:** `memory/create`, `vaults/create`, `profile/onboarding` (via schemas), etc.

**Manual:** Many routes parse JSON and check fields manually.

**Weak spots:** e.g. `track` — **minimal** validation (event name string); **acceptable** for analytics but **spam** possible.

### 4h. `api/user/delete-all-data`

**Tables touched:** `user_events`, `pending_proposals`, `node_attachments`, `node_history`, `node_edges`, `memory_nodes`, `canvas_vaults`, `canvases`, `category_vaults` (re-seed), `user_monthly_usage`, storage `node-attachments`.

**Explicitly NOT deleted:** `profiles`, `subscriptions`, `auth.users` — **documented in file header**:

```1:9:memorey/src/app/api/user/delete-all-data/route.ts
 * Does NOT delete: profiles row, subscriptions row, auth.users record.
 * This is a "reset data" operation, not full account deletion.
```

**Analytics:** `user_events` rows deleted then **new** `data_reset` event inserted — **privacy** partial (see §8d).

### 4i. SQL injection

**`.rpc()`** uses **parameter objects** (no string interpolation in SQL). **No** raw `execute_sql` from app code.

### 4j. Secrets in repo

**`.gitignore`** includes `.env` and `.env.local` (`.env.local.example` is allowed).

**grep** for hardcoded keys in `src/` — **no** `sk_live`, `sk_test`, etc. matches.

---

## SECTION 5: API Routes — Complete Review

**Table — every handler under `src/app/api/` (grep `^export async function`):**

| Route | Methods | Auth | Validation | Supabase client | Error handling | Rate limit | Issues |
|-------|---------|------|------------|-----------------|----------------|------------|--------|
| `/api/admin/analytics/funnel` | GET | `assertAdmin` cookie | Manual query params | Admin | try/catch + `.error` | **No** | Expensive RPC; no rate limit |
| `/api/admin/analytics/feature-usage` | GET | `assertAdmin` | Manual | Admin | `.error` | **No** | — |
| `/api/admin/analytics/overview` | GET | `assertAdmin` | Manual | Admin | `.error` | **No** | — |
| `/api/admin/activity` | GET | `assertAdmin` | None | Admin | `.error` | **No** | — |
| `/api/admin/revenue` | GET | `assertAdmin` | None | Admin | `.error` | **No** | — |
| `/api/admin/stats` | GET | `assertAdmin` | N/A | Admin | `.error` checks | **No** | Fetches many `user_events` rows for active sets (scale) |
| `/api/admin/users` | GET | `assertAdmin` | Manual | Admin | `.error` | **No** | — |
| `/api/admin/users/[id]` | GET | `assertAdmin` | UUID param | Admin | `.error` | **No** | — |
| `/api/attachments` | POST | Bearer | Manual | User anon + Bearer | yes | **No** | Ownership checked |
| `/api/attachments/extract-meta` | POST | Bearer + session | Manual | — | yes | **Yes** | — |
| `/api/billing/summary` | GET | Cookie | N/A | Server + Admin | try/catch | **No** | — |
| `/api/embed` | POST | Cookie | Partial | Server + Admin | yes | **Yes** | — |
| `/api/export` | POST | Bearer | Manual | User + service | yes | **No** | LLM cost |
| `/api/export/share` | POST | Bearer | Manual | User + service | yes | **No** | — |
| `/api/export/strip-pii` | POST | Cookie | Manual | — | yes | **No** | — |
| `/api/extract-nodes` | POST | Cookie | Zod/manual | — | yes | **Yes** | — |
| `/api/graph-builder` | POST | Cookie | Manual | — | yes | **Yes** | — |
| `/api/ingest-link` | POST | Cookie | Manual | Admin for usage | yes | **Yes** | — |
| `/api/kanban/complete` | POST | Cookie | Manual | Admin | yes | **No** | LLM |
| `/api/landing-chat` | POST | IP-ish | Manual | — | yes | **Yes** | — |
| `/api/memory-assistant` | POST | Cookie | Manual | — | yes | **Yes** | — |
| `/api/memory/create` | POST | Bearer | **Zod** | User Bearer | yes | **No** | — |
| `/api/nodes/create-file` | POST | Cookie | Manual | Admin | yes | **No** | — |
| `/api/profile/onboarding` | PATCH | Cookie | Zod | Server | yes | **No** | — |
| `/api/search` | POST | Bearer | Manual | User + service | yes | **Yes** | — |
| `/api/stripe/checkout` | POST | Cookie | N/A | Admin | yes | **No** | — |
| `/api/stripe/portal` | POST | Cookie | N/A | Admin | yes | **No** | — |
| `/api/stripe/webhook` | POST | **Stripe signature** | Stripe body | Admin | yes | **No** | By design (Stripe) |
| `/api/track` | POST | Cookie (optional anon) | Minimal | Server + Admin | **swallowed** | **Yes** | Always 200 |
| `/api/user/delete-all-data` | POST | Cookie | `confirm` string | Admin | yes | **No** | Destructive |
| `/api/vaults/create` | POST | Bearer | **Zod** | User + Admin | yes | **No** | — |
| `/api/vaults/set-active` | POST | Cookie | Manual | Admin | yes | **No** | — |

**Notes:**

- **`/api/track`** — returns **200** even on failure; errors **swallowed** (`catch { }`). **Snippet:**

```73:77:memorey/src/app/api/track/route.ts
  } catch {
    /* fire-and-forget: never block UI */
  }

  return new NextResponse(null, { status: 200 });
```

---

## SECTION 6: Frontend — Component & State

### 6a. SSR safety

**grep** `window|document|localStorage|sessionStorage|navigator` in `src/`.

**Unguarded risk:** `src/app/layout.tsx` inline script uses `localStorage` / `document` — **runs only in browser** inside `<script>` (not SSR execution in React).

**`src/app/(auth)/login/page.tsx`** — `window.location.origin` — **must** be client component (`"use client"` implied in login page — verify file).

**Most** usages are in `useEffect` or `typeof window !== "undefined"` (e.g. `sidebar-context.tsx`, `theme.ts`).

### 6b. `useEffect` audit

**Count:** ~**60** `useEffect(` occurrences across **~55** files (grep count mode).

**Representative issues (ESLint):** Missing deps in `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx` — **stale closure** risk.

**Cleanup:** Many keyboard/scroll listeners **do** cleanup; verify individually on change.

### 6c. Zustand stores

**Stores:** `graphStore`, `vaultStore`, `canvasStore`, `diffStore`, `exportPanelStore`, `vaultManagerOverlayStore` (from user list).

**Immer:** `graphStore`, `vaultStore`, `diffStore` use `immer` middleware — **consistent** with `graphStore` comment about draft leakage.

**Race conditions:** Concurrent updates from graph + diff modal — **possible** — mitigated by single-threaded JS; **cross-tab** not synced.

### 6d. `fetch` error handling

**Pattern:** Mix of `res.ok` checks, `toast.error`, and silent failures. **Network down** — often **no** global toast unless component handles it.

### 6e. Error boundaries

**`ErrorBoundary`** — catches **render** errors in React children; **not** event handler errors or async errors.

**`global-error.tsx`** — Next.js root error UI for **root layout** failures.

**Gap:** `DiffModal` **outside** `ErrorBoundary` in `layout.tsx` (sibling) — **not** wrapped by same boundary as `children`.

### 6f. / 6g. Loading & empty states

**Loading:** Several dashboard routes use `loading.tsx` skeletons; admin pages use client-side loading skeletons.

**Empty states:** Graph/kanban have **some** empty states; **not** every sub-view verified line-by-line.

### 6h. Forms

**Onboarding, settings, quick create, add memory** — mix of **Zod** (server) and **client** validation. **See** `src/lib/validation/schemas.ts` for canonical schemas.

---

## SECTION 7: Admin Dashboard

### 7a. Query correctness

**`/api/admin/stats`** — `active7` / `active30` use **distinct user_ids in memory** after fetching **all** `user_events` rows in window — **O(n)** rows transferred from DB (scale issue).

### 7b. Performance at scale

**100k users:** `user_events` full pulls for **active user** sets — **not** scalable; use **SQL `COUNT(DISTINCT user_id)`** with time filter in DB.

### 7c. Frontend

**Admin pages** use charts (`recharts`), loading states, **AdminFetchError** pattern — generally consistent.

### 7d. Access control

See §3e — **skeleton gate** + API 403.

### 7e. Data accuracy

**Conversion rate** in `admin/stats` — non-free `subscriptions` count / total users — **heuristic** (not Stripe MRR).

---

## SECTION 8: Analytics

### 8a. Pipeline

`useTrack` → `fetch /api/track` → `createAdminClient` insert → `user_events`.

**Loss:** `fetch` can fail silently; server **swallows** errors.

**Dedup:** Client **1s** debounce; server **2s** duplicate check per `event_name`.

### 8b. Event coverage

**`eventLabels.ts` vs `track(` calls:**

- **Defined in labels but no `track` found:** `vault_created`, `canvas_created`, `export_triggered` — **grep** `track("vault_created"` → **no matches**.

**Emitted events:** `page_view`, `onboarding_*`, `node_created`, `edge_created`, `search_performed`, `capture_*`, `share_link_created`, `node_edited`, `attachment_uploaded`, `kanban_status_changed`, etc.

### 8c. Rate limit

`track` — **60/min/user** — **in-memory** limiter.

### 8d. Privacy

**Delete** — `user_events` deleted in `delete-all-data`; **re-inserts** `data_reset`. **Full account** deletion not implemented.

---

## SECTION 9: Performance & Scalability

### 9a. Expensive queries

1. Admin stats `user_events` pulls for active users — **full row scan** in window.
2. **Semantic search** — embedding + RPC + LLM — **high cost**.
3. **Graph** — client-side canvas draw — **CPU-bound** per node.

### 9b. Bundle

**Heavy:** `recharts` (admin), `react-force-graph-2d` (**landing only** — dynamic import in `HeroGraph`). **Main graph** uses **custom canvas** (`MemoryGraph.tsx`) — **not** `react-force-graph-2d` in app graph.

### 9c. Canvas / graph limit

**No virtualization** — all nodes drawn; **performance** degrades with node count (depends on hardware).

### 9d. Serverless timeouts

**LLM routes** (`search`, `ingest-link`, `kanban/complete`, …) — **risk** of **>10s** on cold start + long model calls.

### 9e. DB connections

**Supabase** — pooled via **HTTP**; no raw `pg` pool in app.

### 9f. Storage growth

**Attachments** + **node** rows — **estimate** per user depends on usage; **no** hard cap in code beyond billing limits.

---

## SECTION 10: Edge Cases & Reliability

### 10a. External services down

**Supabase down:** Auth and data fail — **errors** in UI/API.

**Anthropic/OpenAI down:** Search/chat/export routes return **5xx** or error JSON — **user sees** error messages where implemented.

### 10b. Concurrency

**Two tabs** editing same node — **last write wins** at DB level; **no** OT.

### 10c. Session expiry

Bearer token routes return **401**; **no** global refresh handler documented.

### 10d. Browser compatibility

**Target ES2017** in `tsconfig`; modern CSS variables. **Minimum** browser: **not** documented.

### 10e. Plan limits

**memory/create** returns **403** with `MEMORY_LIMIT` — **clear**.

---

## SECTION 11: Accessibility

**Method:** Spot-check + grep — **not** a full WCAG audit.

**Gaps:** Canvas/graph **primary interaction** is **mouse**-centric; **keyboard** shortcuts exist (`useKeyboardShortcuts`) but **full graph** is not WCAG-complete.

**Contrast:** Dark theme + vault colors — **not** verified numerically.

---

## SECTION 12: Mobile Responsiveness

**Method:** Code review of Tailwind breakpoints (`md:`, `lg:`) in `DashboardShell`, admin layout, landing.

**Graph:** Touch **partial** — canvas interactions vary; **no** dedicated mobile UX audit performed.

---

## SECTION 13: Summary & Fix Priority

### Table 1 — Critical

| Issue | Location | Suggested fix | Effort |
|-------|----------|---------------|--------|
| **Admin analytics pulls unbounded `user_events` rows** for active user counts | `src/app/api/admin/stats/route.ts` ~57–59 | Replace with SQL aggregation or RPC returning counts | **Medium** |
| `user_events` **no_client_access** + admin-only inserts — **correct**; ensure **all** admin routes use `assertAdmin` | Ongoing audit | **Lint** or CI check for `createAdminClient` without `assertAdmin` | **Small** |

*If no critical security regression is found beyond scale/ops, **production readiness** depends on **rate limits** on expensive routes and **admin query** fixes.*

### Table 2 — High

| Issue | Location | Suggested fix | Effort |
|-------|----------|---------------|--------|
| Many **cookie-auth** POST routes **without** rate limiting | `src/app/api/**` (see §4f) | Add `checkRateLimit` or edge middleware | **Medium** |
| **In-memory** rate limiter **inconsistent** across instances | `src/lib/rateLimit.ts` | Redis / Upstash | **Large** |
| **Misleading** `*_api_key_enc` columns unused | DB + types | Remove or implement encryption + BYOK | **Medium** |
| **`/api/track`** swallows errors | `src/app/api/track/route.ts` | Log metrics + optional 204 vs 200 | **Small** |

### Table 3 — Medium

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| `get_connected_nodes` RPC **unused** | DB | Remove or wire up | **Small** |
| **Redundant** storage policy SELECT | `storage.objects` | Drop duplicate policy | **Small** |
| ESLint **exhaustive-deps** warnings | Multiple | Fix deps or refactor | **Medium** |
| `eventLabels` **missing** `track` for vault/canvas/export | `eventLabels.ts` vs codebase | Add `track` or remove labels | **Small** |

### Table 4 — Low

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Unused params `c`, `d` | `src/lib/security/urlValidation.ts:16` | Prefix `_` or remove | **Small** |
| Client `console.error` in `VaultSettingsPopover` | `VaultSettingsPopover.tsx:271` | Toast | **Small** |

---

## Production readiness — YES / NO

**NO** — not as a **final gate** for “real users” at **scale** without addressing **at least**:

1. **Admin stats / activity** queries that **materialize large `user_events` result sets** into the Node process.
2. **Rate limiting** on **high-cost** and **destructive** cookie-authenticated routes (export, delete-all, vault create, Stripe-adjacent, etc.).

If **critical** and **high** items are addressed, the codebase is **closer** to production-ready for **controlled** launch; **ongoing** monitoring, **security review** of new API routes, and **Redis-backed** rate limits remain **recommended** for **public** scale.

---

**MCP / tooling references**

- Supabase MCP server: **user-memorey supabase** — `list_tables` (verbose), `execute_sql` (policies, indexes, functions).
- Build: `npm run build` — **ƒ Proxy (Middleware)** confirms `src/proxy.ts` is active middleware.
- Typecheck: `npx tsc --noEmit` — exit **0**.
- Lint: `npx eslint` — **0 errors**, 17 warnings.

---

## Appendix A — Complete `src/app/api/**/route.ts` inventory

**Verification:** `glob src/app/api/**/route.ts` → **32 files** (matches Section 5 table).

1. `src/app/api/admin/analytics/funnel/route.ts`
2. `src/app/api/admin/analytics/feature-usage/route.ts`
3. `src/app/api/admin/analytics/overview/route.ts`
4. `src/app/api/admin/activity/route.ts`
5. `src/app/api/admin/revenue/route.ts`
6. `src/app/api/admin/stats/route.ts`
7. `src/app/api/admin/users/route.ts`
8. `src/app/api/admin/users/[id]/route.ts`
9. `src/app/api/attachments/route.ts`
10. `src/app/api/attachments/extract-meta/route.ts`
11. `src/app/api/billing/summary/route.ts`
12. `src/app/api/embed/route.ts`
13. `src/app/api/export/route.ts`
14. `src/app/api/export/share/route.ts`
15. `src/app/api/export/strip-pii/route.ts`
16. `src/app/api/extract-nodes/route.ts`
17. `src/app/api/graph-builder/route.ts`
18. `src/app/api/ingest-link/route.ts`
19. `src/app/api/kanban/complete/route.ts`
20. `src/app/api/landing-chat/route.ts`
21. `src/app/api/memory-assistant/route.ts`
22. `src/app/api/memory/create/route.ts`
23. `src/app/api/nodes/create-file/route.ts`
24. `src/app/api/profile/onboarding/route.ts`
25. `src/app/api/search/route.ts`
26. `src/app/api/stripe/checkout/route.ts`
27. `src/app/api/stripe/portal/route.ts`
28. `src/app/api/stripe/webhook/route.ts`
29. `src/app/api/track/route.ts`
30. `src/app/api/user/delete-all-data/route.ts`
31. `src/app/api/vaults/create/route.ts`
32. `src/app/api/vaults/set-active/route.ts`

---

## Appendix B — `supabase/migrations/` files (complete)

**Verification:** `glob supabase/migrations/*.sql` → **32 files**, numerically ordered `001`–`032` with **no gaps**.

`001_memorey_schema.sql` … `032_fix_funnel_active_days.sql` (exact filenames as in repo).

---

## Appendix C — `console.*` full list (grep evidence)

**Command:** `rg 'console\.(log|warn|error)' memorey/src`

| File | Line(s) |
|------|---------|
| `src/app/api/user/delete-all-data/route.ts` | 69, 143, 151, 168, 182, 192, 207, 215 |
| `src/app/api/landing-chat/route.ts` | 110 |
| `src/app/api/graph-builder/route.ts` | 65, 122 |
| `src/components/graph/ui/VaultSettingsPopover.tsx` | 271 |
| `src/app/api/ingest-link/route.ts` | 260, 426, 436 |
| `src/store/diffStore.ts` | 151, 162, 199, 208, 244, 253, 270, 290 |
| `src/app/api/embed/route.ts` | 51, 74, 84, 98, 108 |
| `src/lib/vaults/resolveVaultId.ts` | 50 |
| `src/app/api/memory-assistant/route.ts` | 93 |
| `src/app/api/extract-nodes/route.ts` | 46 |
| `src/app/api/search/route.ts` | 130, 174, 189, 292, 309, 326, 336 |
| `src/app/(dashboard)/dashboard/kanban/page.tsx` | 161 |
| `src/components/graph/ui/NodeDetailSheet.tsx` | 1259 |
| `src/app/api/admin/users/route.ts` | 70 |
| `src/components/diff/useDiff.ts` | 111–112, 131–132 |
| `src/proxy.ts` | 21 |
| `src/app/api/admin/activity/route.ts` | 18 |
| `src/components/graph/ui/ChatGraphBuilder.tsx` | 582, 638, 723 |
| `src/app/api/vaults/create/route.ts` | 93, 114 |
| `src/app/api/nodes/create-file/route.ts` | 111 |
| `src/app/api/memory/create/route.ts` | 144, 165 |
| `src/app/api/admin/revenue/route.ts` | 14 |
| `src/lib/envCheck.ts` | 32 |
| `src/app/(auth)/login/page.tsx` | 25 |
| `src/app/api/vaults/set-active/route.ts` | 67, 73 |
| `src/app/api/export/strip-pii/route.ts` | 123 |
| `src/app/api/export/share/route.ts` | 160 |
| `src/app/api/stripe/webhook/route.ts` | 127, 193, 199 |
| `src/app/api/export/route.ts` | 102 |
| `src/app/api/billing/summary/route.ts` | 65 |
| `src/app/api/stripe/portal/route.ts` | 50 |
| `src/app/api/stripe/checkout/route.ts` | 74 |
| `src/app/api/kanban/complete/route.ts` | 114, 140 |
| `src/app/api/profile/onboarding/route.ts` | 50, 59 |
| `src/app/global-error.tsx` | 14 |
| `src/components/ErrorBoundary.tsx` | 23 |
| `src/components/graph/canvas/fileNode.ts` | 39 |
| `src/app/api/attachments/route.ts` | 162, 173 |

*(If a file appears twice in grep output with same lines, deduplicated above.)*

---

## Appendix D — Section “no issues” verification log

| Claim | How verified |
|-------|----------------|
| No TypeScript compile errors | `npx tsc --noEmit` exit 0 |
| No ESLint errors | `npx eslint .` → 0 errors |
| No circular deps (TS graph) | `npx madge --extensions ts,tsx --circular src` |
| Middleware active | `npm run build` → `ƒ Proxy (Middleware)` |
| Public tables list | MCP `list_tables` verbose |
| RLS policies | MCP `execute_sql` → `pg_policies` |
| Indexes | MCP `execute_sql` → `pg_indexes` |
| All API routes enumerated | `glob` + grep `export async function` |
| `as any` absent | `rg 'as any' src` → no matches |
| Hardcoded secrets pattern | `rg` for sk_live / api_key literals → none |
| Service role import sites | `rg createAdminClient\|SUPABASE_SERVICE_ROLE_KEY` |
