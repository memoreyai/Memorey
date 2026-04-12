# Memorey — Final Technical Audit (Fresh)

**Date:** 2025-03-21  
**Scope:** Application root `memorey/` (Next.js 16 app). Primary focus: `memorey/src/`, `memorey/supabase/migrations/`, root configs (`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `components.json`).  
**Backend verification:** Supabase project via MCP **user-memorey supabase** (`list_tables` verbose, `execute_sql` for policies, indexes, routine privileges, functions).  
**Methodology note:** This report is evidence-based. Where exhaustive line-by-line reading of every one of 600+ source files is impractical in a single pass, sections state the verification method (build, grep, ESLint, MCP SQL, targeted file reads). Static claims are backed by command output or file citations.

---

## SECTION 1: Build, Compilation & Code Quality

### 1a. TypeScript (`npx tsc --noEmit`)

**Command:** `cd memorey && npx tsc --noEmit`  
**Result:** Exit code **0** — no type errors reported.

**Unsafe casts (`as any` / `as unknown as` / `as never`) — grep:**  
`rg " as any|as unknown as| as never" memorey/src`

| File | Line | Snippet | Assessment |
|------|------|---------|--------------|
| `src/store/diffStore.ts` | 257, 298 | `rowToMemoryNode(data as never, ...)` | **Technical debt** — bridges Supabase row shape to `MemoryNode` without generated narrow typing. Risk: silent mismatch if schema drifts. |
| `src/app/api/admin/users/[id]/route.ts` | 168 | `plan: planFromRow(profile as never)` | Same pattern for admin profile row. |
| `src/app/api/search/route.ts` | 40 | `} as never);` inside `mapNodeRow`-like helper | **Convenience cast** for joined row shape. |
| `src/components/graph/hooks/useNodeActions.ts` | 185 | `mapNodeRow(data as never)` | Client mutation response typing. |
| `src/app/api/admin/users/route.ts` | 79, 148 | `planFromRow(p as never)` | Admin list filtering. |
| `src/components/graph/MemoryGraph.tsx` | 325, 370 | `mapNodeRow(savedRow as never)` | Optimistic / returned rows. |
| `src/components/graph/hooks/useMemoryGraphChromeProps.ts` | 141 | `mapNodeRow(saved as never)` | Same. |
| `src/components/graph/hooks/useGraphData.ts` | 33 | `mapAttachmentRow(r as unknown as Record<string, unknown>)` | Explicit unknown bridge. |
| `src/components/graph/hooks/useDrawLoop.ts` | 314 | `node as unknown as MemoryNode` | Canvas draw path; **justified** for renderer vs store type. |
| `src/store/vaultStore.ts` | 104 | `(data ?? []) as unknown as { category_vaults?: ... }[]` | **Fragile** — nested join typing. |
| `src/lib/lucideIconCanvasCache.ts` | 44 | `(await import("lucide-react")) as unknown as Record<...>` | Dynamic import typing — common pattern. |
| `src/components/graph/ui/ContextMenu.tsx` | 29, 64 | `as unknown as MemoryNode` | UI narrowing. |

No `as any` occurrences were found in `src/` by the same grep.

### 1b. ESLint

**Commands:**  
- `npx eslint .` — **0 errors**, **17 warnings** (see ESLint output).  
- `npx eslint . --quiet` — **no output**, exit code **0** → **zero errors**.

**Conclusion:** There are **no ESLint errors**; only warnings (e.g. `@next/next/no-img-element`, `react-hooks/exhaustive-deps`, `@typescript-eslint/no-unused-vars` in `urlValidation.ts`).

### 1c. `console.log` / `warn` / `error` in `src/`

**Method:** `rg "console\\.(log|warn|error|debug|info)" memorey/src`

| Location | Classification |
|----------|----------------|
| API routes (`delete-all-data`, `landing-chat`, `graph-builder`, `ingest-link`, `embed`, `memory-assistant`, `extract-nodes`, `search`, `admin/*`, `vaults/*`, `memory/create`, `nodes/create-file`, `stripe/*`, `export/*`, `billing/*`, `kanban/complete`, `profile/onboarding`, `attachments`) | **Keep** — server-side error/diagnostic logging (operational). |
| `src/proxy.ts` | **Keep** — misconfiguration warning. |
| `src/lib/envCheck.ts` | **Keep** — startup env warning. |
| `src/lib/vaults/resolveVaultId.ts` | **Keep** — resolution failure (consider user-facing toast instead). |
| `src/components/graph/ui/VaultSettingsPopover.tsx` | **Review** — `console.error(e)` on client; **debug-ish**; prefer toast. |
| `src/store/diffStore.ts` | **Keep** / **trim** — multiple `console.error` for sync failures; noisy in production. |
| `src/app/(dashboard)/dashboard/kanban/page.tsx` | **Review** — `console.error(e1)`. |
| `src/components/graph/ui/NodeDetailSheet.tsx` | **Review** — `console.error(err)`. |
| `src/components/diff/useDiff.ts` | **Review** — vault fetch failures. |
| `src/components/graph/ui/ChatGraphBuilder.tsx` | **Keep** / **trim** — chat errors. |
| `src/app/(auth)/login/page.tsx` | **Keep** — OAuth error. |
| `src/components/graph/canvas/fileNode.ts` | **Keep** — image load warning. |
| `src/components/ErrorBoundary.tsx`, `src/app/global-error.tsx` | **Keep** — error boundary logging. |

No `console.log` used for routine debug in grep results (only warn/error patterns above).

### 1d. Unused imports / variables

**Method:** ESLint output from §1b.

- `src/lib/security/urlValidation.ts` **16:51** — parameters `'c'`, `'d'` **defined but never used** (eslint `@typescript-eslint/no-unused-vars`).

**Additional:** `@dnd-kit/sortable` is listed in `package.json` but **`rg "@dnd-kit/sortable" memorey/src` returns no matches** — unused dependency (see §1g).

### 1e. Circular dependencies

**Method:** `npx madge --circular --extensions ts,tsx src` (from `memorey/`).  
**Result:** `✔ No circular dependency found!` (255 files processed).

### 1f. `tsconfig.json`

```7:8:memorey/tsconfig.json
    "strict": true,
    "noEmit": true,
```

- **`strict`: `true`** — good.  
- **`skipLibCheck`: `true`** — skips type checking of declaration files (common for speed; slightly weaker guarantees for `.d.ts`).  
- **`allowJs`: `true`** — allows JS files; no weakening of TS strictness for `.ts`/`.tsx` themselves.

### 1g. `package.json` dependencies

**Runtime dependencies with no direct import found in `src/` (grep):**

| Package | Verification |
|---------|--------------|
| `@dnd-kit/sortable` | No imports in `src/` (`rg "@dnd-kit/sortable"` empty). **Unused.** |
| `dompurify` | No `from "dompurify"` in `src/`; **Landing** uses `isomorphic-dompurify`. The standalone `dompurify` package may be redundant if not required as a transitive peer (verify lockfile). |

**devDependencies vs dependencies:**  
- `shadcn` CLI in **devDependencies** — correct for codegen.  
- `@tailwindcss/postcss`, `tailwindcss`, `eslint`, `typescript` — correctly dev-only.  
- No obvious misplaced production packages found; optional cleanup: remove unused `@dnd-kit/sortable`.

---

## SECTION 2: Database Schema & Data Integrity

### 2a. Public tables (MCP `list_tables` verbose + FK list)

Live database (MCP) includes at least:

| Table | RLS | Notes |
|-------|-----|--------|
| `profiles` | yes | `id` → `auth.users`; includes `anthropic_api_key_enc`, `openai_api_key_enc`, `is_super_admin`, graph/canvas prefs. |
| `category_vaults` | yes | User vaults; theme columns, `pin_hash`, `color_overrides` jsonb. |
| `memory_nodes` | yes | Embeddings `vector`, kanban, file node columns, OG fields, `source` CHECK. |
| `node_edges` | yes | Attachment FKs optional. |
| `node_history` | yes | |
| `subscriptions` | yes | PK `user_id`; Stripe fields. |
| `user_monthly_usage` | yes | Composite PK `(user_id, year_month)`. |
| `pending_proposals` | yes | Split INSERT/UPDATE/DELETE/SELECT policies. |
| `node_attachments` | yes | |
| `canvases` | yes | |
| `canvas_vaults` | yes | Composite PK. |
| `user_events` | yes | Analytics; see policies. |

**Storage (MCP):** `storage.buckets`, `storage.objects` (RLS enabled). App uses bucket id **`node-attachments`** (see §4d).

### 2b. Query vs schema cross-check

- Application code references tables/columns that **exist** in MCP schema (`memory_nodes.file_url`, `node_kind_v2`, `profiles.active_canvas_id`, etc.).  
- **`search_nodes` RPC** (verified in DB) expects `p_user_id`, embedding, `p_vault_ids` — matches `src/app/api/search/route.ts` usage.  
- **`user_monthly_usage`:** RLS on table is **SELECT-only** for `authenticated` (`usage_select_own`). Writes go through **service role** in `src/lib/billing/usage.ts` — consistent.

**Issue — SECURITY DEFINER RPCs (critical, see §2c/§4):**  
Functions `admin_funnel_metrics`, `admin_memory_node_counts_by_canvas`, `admin_memory_node_counts_by_vault` are **`SECURITY DEFINER`** and (on the live DB) **`EXECUTE` is granted to `anon` and `authenticated`** (MCP `information_schema.routine_privileges`).  
- `admin_funnel_metrics` aggregates **all users** (counts across `profiles`, `memory_nodes`, `user_events`, `subscriptions`) — **no `auth.uid()` guard inside the function body** (see MCP function definition).  
- Admin count functions filter by **`p_user_id` only** — any caller passing another user’s UUID gets **cross-user aggregates** (IDOR at the database layer).

**Migration intent vs reality:**  
`supabase/migrations/023_admin_aggregation_rpcs.sql` and `025_fix_funnel_metrics.sql` include `REVOKE ALL ... FROM PUBLIC` and `GRANT EXECUTE ... TO service_role` only. **Live DB still shows EXECUTE for `anon` and `authenticated`.** This is a **privilege drift / ineffective lockdown** (possible Supabase default grants on function replace, or migration not applied as file).

### 2c. RLS policies (MCP `pg_policies`)

**`public`:** All main content tables use **owner = `auth.uid()`** (or ownership via `canvases`) — appropriate for user data.  
**`user_events`:** Policy `no_client_access` — `cmd: ALL`, `qual: false` → **clients cannot read/write** `user_events` via PostgREST; inserts use **service role** from API routes. Good.  
**`storage.objects`:** Policies restrict `bucket_id = 'node-attachments'` and **first path segment = `auth.uid()`** — path-based isolation (see §4d).

**Gap:** Not an RLS “hole” for `user_events` client access, but **RPC + GRANT issue** bypasses RLS for admin aggregates (§2b).

### 2d. Functions & triggers (MCP + migrations)

- **App-relevant:** `search_nodes`, `get_connected_nodes`, `seed_default_vaults`, `seed_default_vaults_internal`, `seed_canvas_vaults`, `handle_new_user` (trigger), `update_updated_at`, admin RPCs, vector helpers.  
- **`seed_canvas_vaults`:** `SECURITY DEFINER`, **no `auth.uid() = p_user_id` check** in function body (MCP definition). Callable with service or, if granted broadly, **abusable**.  
- **Orphaned:** Many `vector`/`halfvec` symbols are **extension internals** — not “orphaned app functions.”

### 2e. Indexes (MCP `pg_indexes`)

Reasonable coverage: `memory_nodes` (user, vault, canvas, embedding ivfflat, kanban partial), `node_edges` (source/target), `user_events` (time, user, event_name), etc.  
**Risk at scale:** Admin routes that pull large slices of `user_events` / `profiles` without tight filters (see §7b, §9a).

### 2f. Migrations order & gaps

**Repo folder** `memorey/supabase/migrations/` now uses **sequential `001_`–`029_` prefixes** (no duplicate numbers); see `supabase/MIGRATION_ORDER.md`.

**Remote (MCP `list_migrations`):** Migrations are applied with **unique timestamps** (e.g. `20260321010601 fix_funnel_metrics`) — **ordered and non-conflicting on the hosted project**. Local filenames are for human readability; remote history remains timestamp-based.

---

## SECTION 3: Authentication & Authorization

### 3a. Auth paths

1. **Login:** `src/app/(auth)/login/page.tsx` — `signInWithOAuth({ provider: 'google', redirectTo: .../auth/callback })`.  
2. **Callback:** `src/app/auth/callback/route.ts` — `exchangeCodeForSession(code)` → session cookies → optional `user_events` insert `signup_completed` via **admin client** → redirect by `profiles.onboarding_completed`.  
3. **Session refresh:** `@supabase/ssr` server client in `src/lib/supabase/server.ts` and **Next “Proxy”** (`src/proxy.ts`) — cookie-based refresh pattern.  
4. **Middleware:** Next build lists **`ƒ Proxy (Middleware)`** — Next.js 16 wires `src/proxy.ts` as edge middleware (verified `npm run build`).  
5. **Logout:** Settings page `supabase.auth.signOut()` (and similar).

**Gaps:** Session expiry UX (§10c). OAuth error path redirects to `/login?error=oauth_failed` — OK.

### 3b. Routes & protection

**Edge (`src/proxy.ts`):** Matcher includes `/dashboard`, `/graph`, `/settings`, `/login`, `/admin`. Unauthenticated users hitting protected paths → redirect `/login`. Logged-in users on `/login` → onboarding or dashboard. **Onboarding gate:** incomplete onboarding users are forced to `/dashboard/onboarding` (except that route).

| Area | Auth |
|------|------|
| `/` (landing) | Public |
| `/login` | Public (redirect if session) |
| `/dashboard/*`, `/graph`, `/settings` | **Cookie session required** |
| `/admin/*` | **Session required** — **not** `is_super_admin` at edge |

**API routes:** Mixed — many use **Bearer token** (`Authorization`) for Supabase user-scoped queries; others use **cookie** server client (`createClient()` from `@/lib/supabase/server`). **Not** all routes go through `proxy.ts` (middleware does not run on `/api/*` by default) — **each route must validate auth** (most do).

### 3c. IDOR

- **Bearer + RLS routes** (`memory/create`, `vaults/create`, `attachments`, etc.): Vault/node checks use **`eq('user_id', user.id)`** or insert with user id — **strong**.  
- **Cookie routes** (`vaults/set-active`, `billing/summary`, etc.): **Ownership** enforced via `user.id` filters or admin client with explicit `eq('user_id', user.id)` — **good** (`src/app/api/vaults/set-active/route.ts` lines 31–38, 60–64).  
- **Critical:** **`admin_*` RPCs** callable with arbitrary `p_user_id` if DB grants allow (§2b) — **database-level IDOR** for aggregate counts and **global** funnel leakage for `admin_funnel_metrics`.

### 3d. `assertAdmin` (`src/lib/admin/assertAdmin.ts`)

```13:37:memorey/src/lib/admin/assertAdmin.ts
export async function assertAdmin(): Promise<AssertAdminResult> {
  const supabase = await createClient();
  ...
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
```

- **Bypass:** Not bypassable via spoofed headers if session is valid — checks **DB flag** with service role.  
- **Edge cases:** `maybeSingle()` with missing profile → **403** (safe). Race: user promoted/demoted during request — acceptable.  
- **Does not** protect **database RPCs** if those are still exposed to `anon` (§2b).

### 3e. Admin UI flash

`src/app/(admin)/admin/AdminLayoutClient.tsx`: **`gate` state** starts `"loading"` → fetches `/api/admin/stats` → only on success sets `"ok"`. **Skeleton** shown while loading — **no admin metrics** rendered before auth. **Low risk** of sensitive data flash; worst case is **chrome skeleton** (sidebar/header placeholders).

---

## SECTION 4: Security

### 4a. XSS

| File | Line | Notes |
|------|------|------|
| `src/app/layout.tsx` | 97 | `dangerouslySetInnerHTML` for **inline theme boot script** — static string, no user input. |
| `src/components/landing/LandingPage.tsx` | 2134–2136 | AI message HTML via **`DOMPurify.sanitize(msg.html)`** before `dangerouslySetInnerHTML`. |

**Other patterns:** No `document.write` found. **Prefer** maintaining sanitization for any future rich HTML from models.

### 4b. API key columns (`anthropic_api_key_enc`, `openai_api_key_enc`)

**Evidence:** Columns exist on `profiles` (MCP schema). **`rg "anthropic_api_key_enc|encrypt"` in `src/`** only hits **`database.types.ts`** — **no application code** reading/writing these fields in `src/` was found in this audit.

**Conclusion:** Names suggest encryption; **no encrypt/decrypt implementation** appears in app code — **likely placeholder / future** or handled outside this repo. **Treat as sensitive columns;** if storing plaintext, **misleading names** and **RLS-only** protection apply.

### 4c. Service role exposure

**Files referencing `SUPABASE_SERVICE_ROLE_KEY` / `createAdminClient`:** listed in grep (API routes, `assertAdmin`, `auth/callback`, `lib/billing/usage.ts`, `lib/envCheck.ts`, `search/route.ts` / `export/route.ts` direct `createClient` with service key).

**Verification:** All are under `src/app/api/**`, `src/lib/**`, `src/app/auth/**` — **server-only** in Next.js App Router. **No** `createAdminClient` in `src/components/**` client bundles. **Build:** `next build` succeeds; service key is **not** `NEXT_PUBLIC_*`.

### 4d. Storage

- **Bucket:** `node-attachments` (private; MCP `storage.buckets` shows `public: false`).  
- **RLS:** `storage.objects` policies require **`(storage.foldername(name))[1] = auth.uid()::text`** — user-scoped prefix.  
- **Upload path:** Should be `${userId}/${filename}` — matches policy intent.

### 4e. CSRF

- APIs use **JSON** + **Bearer** or **cookie** session. SameSite cookies reduce CSRF risk for cookie-backed routes.  
- **No** custom CSRF tokens — **typical** for SPA + SameSite + JSON APIs. **Residual risk** for cookie-only POSTs from same-site attacker pages — **low** for JSON `Content-Type` requirements.

### 4f. Rate limiting (`src/lib/rateLimit.ts`)

- **In-memory** sliding window — **does not** coordinate across serverless instances (documented in file).  
- Applied on: `track`, `search`, `graph-builder`, `ingest-link`, `embed`, `memory-assistant`, `extract-nodes`, `landing-chat` (IP), `extract-meta`, etc.  
- **Gaps:** Many **admin** routes have **no** `checkRateLimit` — acceptable if admin-only, but **brute-force session** could still hammer (**low** priority vs RPC issue).

### 4g. Input validation

- **Zod:** `graph-builder`, `extract-nodes`, `vaults/create`, `memory/create`, `profile/onboarding` PATCH.  
- **Manual:** Most other routes (attachments, stripe, export, etc.).  
- **Risk:** `src/app/api/nodes/create-file/route.ts` casts `request.json()` to a large inline type **without Zod** — malformed bodies may cause partial undefined behavior; core fields are trimmed defensively.

### 4h. `api/user/delete-all-data`

See `src/app/api/user/delete-all-data/route.ts`. Deletes: `user_events`, `pending_proposals`, `node_attachments`, `node_history`, `node_edges`, `memory_nodes`, `canvas_vaults`, `canvases`, `category_vaults` (then re-seeds defaults), `user_monthly_usage`, storage under user prefix; inserts `data_reset` event.

**Does not delete:** `profiles`, `subscriptions`, `auth.users` — **documented in file header** (lines 6–9).

**Partial failure:** Several steps **log** `console.error` but **do not fail the request** (e.g. `user_events` delete error) — **user data could remain** in those tables while API returns `ok: true`.

### 4i. SQL injection

- Supabase JS **parameterized** filters.  
- **No** raw string-concat SQL in app code found; RPCs use fixed definitions.

### 4j. Secrets in repo

**Grep:** No `sk-` / `AIza` patterns in `src/`.  
**`.gitignore`:** includes `.env`, `.env.local` — good.

---

## SECTION 5: API Routes — Summary Table

**Legend:** Auth: how identity is established. Validation: Zod vs manual vs none.

| Route | Methods | Auth | Validation | Supabase client | Error handling | Rate limit | Issues |
|-------|---------|------|------------|-----------------|----------------|------------|--------|
| `/api/user/delete-all-data` | POST | Cookie `getUser` | Manual (`confirm`) | Server + **admin** | try/catch; partial steps only log | No | Partial cleanup success still returns 200; see §4h |
| `/api/admin/analytics/funnel` | GET | Cookie + **assertAdmin** | Query `days` manual | **admin** | JSON error on RPC fail | No | **DB RPC also exposed** — §2b |
| `/api/landing-chat` | POST | None | Manual | Env AI | try/catch | Yes (IP) | Public LLM cost abuse mitigated partially |
| `/api/attachments/extract-meta` | POST | Cookie | Manual URL | Server | try/catch | Yes | — |
| `/api/graph-builder` | POST | Bearer | **Zod** | User + env | try/catch | Yes | — |
| `/api/ingest-link` | POST | Bearer | Partial/JSON | User + **admin** | try/catch | Yes | Complex; ensure billing paths |
| `/api/embed` | POST | Bearer | Manual | **admin** | try/catch | Yes | — |
| `/api/admin/stats` | GET | **assertAdmin** | — | **admin** | try/catch | No | — |
| `/api/admin/users/[id]` | GET | **assertAdmin** | — | **admin** | try/catch | No | Uses `planFromRow` casts |
| `/api/memory-assistant` | POST | Cookie | Manual | Server + AI | try/catch | Yes | — |
| `/api/extract-nodes` | POST | Cookie | **Zod** | Server + AI | try/catch | Yes | — |
| `/api/search` | POST | Bearer | Manual | User + **admin** + AI | try/catch | Yes | `as never` row mapping |
| `/api/track` | POST | Cookie | Manual | **admin** | Swallows errors | Yes | Silent 200 for abuse UX |
| `/api/admin/users` | GET | **assertAdmin** | Manual query | **admin** | try/catch | No | Heavy queries |
| `/api/admin/activity` | GET | **assertAdmin** | — | **admin** | try/catch | No | — |
| `/api/vaults/create` | POST | Bearer | **Zod** | User + **admin** event | try/catch | No | — |
| `/api/nodes/create-file` | POST | Bearer | Manual cast | User + **admin** event | try/catch | No | No Zod |
| `/api/memory/create` | POST | Bearer | **Zod** | User + **admin** event | try/catch | No | User/vault ID checks |
| `/api/admin/revenue` | GET | **assertAdmin** | — | **admin** | try/catch | No | — |
| `/api/admin/analytics/feature-usage` | GET | **assertAdmin** | — | **admin** | try/catch | No | — |
| `/api/admin/analytics/overview` | GET | **assertAdmin** | — | **admin** | try/catch | No | — |
| `/api/vaults/set-active` | POST | Cookie | Manual | **admin** (scoped) | try/catch | No | Uses admin with user filter OK |
| `/api/export/strip-pii` | POST | Bearer | Manual | AI | try/catch | No | — |
| `/api/export/share` | POST | Bearer | Manual | **admin** storage | try/catch | No | — |
| `/api/stripe/webhook` | POST | Stripe signature | N/A | **admin** | try/catch | No (Stripe) | — |
| `/api/export` | POST | Bearer | Manual | User + **admin** | try/catch | No | — |
| `/api/billing/summary` | GET | Cookie | — | Server + **admin** | try/catch | No | — |
| `/api/stripe/portal` | POST | Cookie | — | **admin** | try/catch | No | — |
| `/api/stripe/checkout` | POST | Cookie | — | **admin** | try/catch | No | — |
| `/api/kanban/complete` | POST | Bearer | JSON parse | User + **admin** | try/catch | No | — |
| `/api/profile/onboarding` | PATCH | Cookie | **Zod** | Server | try/catch | No | — |
| `/api/attachments` | POST | Bearer | Manual | User | try/catch | No | Ownership check on node |

**Notes:** The **highest-risk** issue is **not** a single route handler but **Postgres privileges** on **`SECURITY DEFINER` admin functions** (§2b, Summary tables).

---

## SECTION 6: Frontend — Component & State Audit

### 6a. SSR safety

- **`layout.tsx` theme script** uses `localStorage` / `document` inside a **string** executed in browser — OK.  
- **`login/page.tsx`:** `window.location.origin` inside **click handler** — OK (not during render).  
- **Landing / onboarding:** `localStorage` / `window` inside **`useEffect`** — OK.  
- **`sidebar-context.tsx`:** `initialExpanded` guards `typeof window === "undefined"` — OK.

### 6b. `useEffect` (sampling)

ESLint reports **missing dependencies** in `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx` — risk of **stale closures** or **missed updates**; not proven runtime bugs.

### 6c. Zustand stores

| Store | Notes |
|-------|------|
| `graphStore` | Immer; comment warns about proxy leakage — mitigated with cloning for ForceGraph. |
| `vaultStore` | Immer; complex `canvas_vaults` sync — **race** possible with rapid tab updates (§10b). |
| `canvasStore` | Creates canvas + optional RPC `seed_canvas_vaults`; analytics `fetch('/api/track')` fire-and-forget. |
| `diffStore` | Network + graph mutations; heavy `console.error` on failure. |
| `exportPanelStore` | UI state. |
| `vaultManagerOverlayStore` | UI state. |

### 6d. Client `fetch` error handling

- **`useTrack`:** Ignores failures by design (`try/catch` empty).  
- **Export / billing:** Mostly toast on error — OK pattern.  
- **Admin pages:** Redirect on 401/403 — OK.

### 6e. Error boundaries

- **`ErrorBoundary`:** class component; catches **render** errors in subtree.  
- **`global-error.tsx`:** Next **root** error UI.  
- **Misses:** Event handler errors, async errors outside React — **uncaught promise** may still crash UX unless handled.

### 6f–6h. Loading / empty / forms

- **Loading:** Many routes define `loading.tsx` (e.g. kanban); admin uses skeletons in `AdminLayoutClient`.  
- **Empty states:** Graph/kanban rely on store state — **possible blank** if data empty and no dedicated empty component (not exhaustively verified per screen).  
- **Forms:** Onboarding and settings use client validation + server routes + DB constraints — **layered**.

---

## SECTION 7: Admin Dashboard

### 7a. API correctness

- **Funnel** uses `admin_funnel_metrics(p_since)` — formulas in SQL (MCP). **“Upgraded to pro”** = `COUNT(*) WHERE plan <> 'free'` — **includes legacy/non-stripe “pro”** rows.  
- **Revenue** pie uses `subscriptions.plan` distribution — **not** audited against Stripe ground truth in this pass.

### 7b. Query performance

- `admin/users` loads profiles + activity aggregates — **O(N)** event scans as user base grows.  
- **At 10k–100k users:** consider **materialized views**, **rolling summaries**, or **restricted date ranges** + indexes on `user_events (created_at, event_name)`.

### 7c. Frontend completeness

- Admin list/detail pages use **charts**, **loading redirects**, **skeletons** in layout — broadly complete. **Responsive:** sidebar collapses on small screens (`AdminLayoutClient`).

### 7d. Admin access control

- **Edge:** Only requires login — **non-admin** can hit `/admin` URL.  
- **Client:** `AdminLayoutClient` **blocks content** until `/api/admin/stats` returns **200**; **403** → toast + redirect `/dashboard`.  
- **Slow network:** User sees **loading skeleton**, not metrics.

### 7e. Data accuracy

- **Funnel:** Defined entirely in SQL function `admin_funnel_metrics` (MCP). **Active last 7 days** uses **any** `user_events` activity — not “active in app” beyond analytics pings.  
- **MRR/ARR:** If shown, verify against Stripe — **`/api/admin/revenue`** uses DB plan counts, **not** Stripe revenue API.

---

## SECTION 8: Analytics

### 8a. Pipeline

**Client** `useTrack` → `POST /api/track` → **service role** insert into `user_events` (after auth + dedupe). **Lossy** by design (fire-and-forget). **Duplicates** mitigated by 1s client debounce + 2s server dedupe for same `event_name`.

### 8b. Event coverage

| Event | Fired from (examples) |
|-------|-------------------------|
| `page_view` | `TrackPageView`, settings |
| `onboarding_completed` | onboarding page |
| `node_created` | kanban, node actions, API inserts |
| `edge_created` | `useNodeActions` |
| `search_performed` | `useSearch` |
| `capture_chat_sent` | `ChatGraphBuilder` |
| `capture_link_ingested` | `ShareLinkInput` |
| `vault_created` | `vaults/create` API |
| `canvas_created` | `canvasStore` |
| `export_triggered` | `ExportPanel` (**label** in `eventLabels.ts` says `export_started` — **mismatch**) |
| `signup_completed` | `auth/callback` |

**Gaps:** `eventLabels.ts` lists **`onboarding_started`, `share_link_created`, `billing_checkout_started`, `export_started`** — **no grep hits** for those exact strings in `src/` (verification: `rg` on event names). Either **unused labels** or **missing instrumentation**.

### 8c. Rate limit

- `track`: **60/min per user** — reasonable. **DB growth:** abusive authenticated users could still insert up to rate limit — **monitor** `user_events` size.

### 8d. Privacy / delete

- **Account data delete** endpoint removes **`user_events`** for user then re-inserts `data_reset`. **Full account deletion** not implemented (see route header). **Privacy policy** not in repo — **document** retention.

---

## SECTION 9: Performance & Scalability

### 9a. Expensive queries (candidates)

1. `search_nodes` vector query over user’s vaults — **ivfflat** index helps; tune `lists` with scale.  
2. Admin aggregates over `user_events` / `profiles`.  
3. Full graph load client-side — **all active nodes** in memory.  
4. `ingest-link` + cheerio + LLM — **multi-step**.  
5. Kanban list fetching all active memory nodes for user — **index** `idx_memory_nodes_kanban` helps.

### 9b. Bundle / heavy imports

- **Recharts** on admin pages — **could** be lazy-loaded.  
- **Landing** force-graph — heavy; **already** landing-only.

### 9c. Canvas / graph

- **No virtualization** for large graphs in main canvas (custom canvas renderer). Practical limit depends on device — **risk** beyond low thousands of nodes.

### 9d. Serverless timeouts

- **LLM routes** (`search`, `ingest-link`, `graph-builder`) can approach **timeout** on slow providers — **risk** on hobby tier.

### 9e. DB connections

- Each serverless invocation creates short-lived clients — **typical**; watch **pooling** if moving to long-lived Node servers.

### 9f. Storage growth

- **Attachments** + **embeddings** dominate. **Estimate** per user depends on usage; monitor Supabase **disk** and **vector** index size.

---

## SECTION 10: Edge Cases & Reliability

### 10a. External dependency failure

- **Supabase down:** Auth and data fail — redirects/errors.  
- **Anthropic/OpenAI down:** LLM routes return 5xx or fallbacks (route-dependent).  
- **Stripe down:** Checkout/portal fail — user sees error toast.

### 10b. Concurrency

- **Two tabs** editing same node: last write wins at DB — **possible overwrite** without OT.  
- **Rapid clicks:** UI should disable buttons; not universally verified.

### 10c. Session expiry

- **Stale client** may get **401/403** from APIs — UX depends on per-fetch handling; **global** session refresh UX not fully audited.

### 10d. Browser compatibility

- Targets **modern Evergreen** browsers; **ES2017** `tsconfig` target. **No IE11** support.

### 10e. Plan limits

- Enforced in API (`memory/create`, `vaults/set-active`, billing) — users should see **HTTP errors** / toasts; verify each entry point for **consistent messaging**.

---

## SECTION 11: Accessibility

### 11a–11d. (Sampling)

- **Interactive components** use Radix/Base UI primitives in many places — **partial** ARIA coverage.  
- **Graph/canvas** is **mouse-first**; keyboard shortcuts exist (`useKeyboardShortcuts`) but **full graph navigation** may not be WCAG-complete.  
- **Contrast:** Dark theme + vault colors — **not** formally contrast-tested in this audit.  
- **Dynamic updates:** Many regions lack **`aria-live`** — screen reader may miss updates.

**Verification:** Manual/code review sampling; **no** automated axe run in this audit.

---

## SECTION 12: Mobile Responsiveness

**Verification:** Tailwind breakpoints used across dashboard (`md:`, `lg:`). **Not** every page was resized in a device emulator for this document. **Graph** on touch: pinch/pan behavior depends on canvas handlers — **test on real devices** before claiming production readiness.

---

## SECTION 13: Summary & Fix Priority

### Table 1 — Critical (must fix before launch)

| Issue | Location | Suggested fix | Effort |
|-------|----------|---------------|--------|
| **`SECURITY DEFINER` admin RPCs granted to `anon`/`authenticated`** — global funnel + per-user aggregates leak | DB privileges + functions `admin_funnel_metrics`, `admin_memory_node_counts_by_canvas`, `admin_memory_node_counts_by_vault` (MCP `routine_privileges`; migrations `021`, `023`) | **`REVOKE EXECUTE` from `PUBLIC`, `anon`, `authenticated`**; **`GRANT EXECUTE` only to `service_role`**. Add **`auth.uid()` = `p_user_id` OR `is_super_admin`** inside functions OR split into **internal** functions only callable by service role. Re-verify with `information_schema.routine_privileges`. | **Medium** |
| **`seed_canvas_vaults` (SECURITY DEFINER) lacks user authorization check** | MCP function body; called from `src/store/canvasStore.ts` | Require **`auth.uid() = p_user_id`** inside function, or revoke public execute (service-only). | **Medium** |
| **`delete-all-data` returns success while some deletes may fail** | `src/app/api/user/delete-all-data/route.ts` (e.g. 61–62, 68–72) | **Fail request** (500) if critical tables fail delete; **transaction** if possible. | **Medium** |

### Table 2 — High

| Issue | Location | Suggested fix | Effort |
|-------|----------|---------------|--------|
| ~~Migration/repo duplicate numeric prefixes~~ | `supabase/migrations/*` | ~~Rename or document order~~ **Done:** sequential `001_`–`029_` + `MIGRATION_ORDER.md` | **Small** |
| **Event name drift** (`export_triggered` vs `export_started` in labels) | `eventLabels.ts` vs `ExportPanel.tsx` | Align names and labels | **Small** |
| **Rate limiter not distributed** | `src/lib/rateLimit.ts` | Redis / Upstash for production | **Large** |
| **Admin funnel “pro” count** includes any non-free DB row | SQL `admin_funnel_metrics` | Tie to Stripe subscription state if that’s the product definition | **Medium** |

### Table 3 — Medium

| Issue | Location | Suggested fix | Effort |
|-------|----------|---------------|--------|
| **`as never` row mapping** | Multiple files | Regenerate types / zod schemas from DB | **Medium** |
| **Unused dependency** `@dnd-kit/sortable` | `package.json` | Remove if confirmed unused | **Small** |
| **ESLint warnings** (hooks deps, `no-img-element`) | Various | Fix incrementally | **Medium** |

### Table 4 — Low

| Issue | Location | Suggested fix | Effort |
|-------|----------|---------------|--------|
| **Placeholder event labels** never fired | `eventLabels.ts` | Remove or implement tracking | **Small** |
| **Console noise** on client | diff/store/components | Route to toast / telemetry | **Small** |

---

## Production readiness verdict

**Is this codebase ready to deploy to production for real users, assuming critical and high issues are addressed first?**

**NO.**

**Reason:** The live database (verified via MCP) grants **`EXECUTE` on `admin_funnel_metrics` and admin per-user aggregate functions to `anon` and `authenticated`**, while those functions are **`SECURITY DEFINER`** and **do not enforce admin-only or self-only access** in a way that blocks arbitrary RPC callers. That is a **direct confidentiality breach** for analytics and per-user statistics until **privileges and/or function bodies** are fixed. Address **Table 1** (especially RPC grants and authorization inside `SECURITY DEFINER` functions) **before** public launch.

---

## Appendix: Commands & queries reference

| Check | Command / query |
|-------|-----------------|
| Typecheck | `cd memorey && npx tsc --noEmit` |
| ESLint | `cd memorey && npx eslint .` ; `npx eslint . --quiet` |
| Cycles | `cd memorey && npx madge --circular --extensions ts,tsx src` |
| Build / middleware | `cd memorey && npm run build` (confirms `ƒ Proxy (Middleware)`) |
| Unsafe casts | `rg " as any\\|as unknown as\\| as never" memorey/src` |
| Console | `rg "console\\.(log\\|warn\\|error)" memorey/src` |
| MCP tables | `list_tables` `{ "schemas": ["public","storage"], "verbose": true }` |
| MCP policies | `SELECT ... FROM pg_policies WHERE schemaname IN ('public','storage')` |
| MCP routine privs | `SELECT ... FROM information_schema.routine_privileges WHERE routine_schema='public' AND routine_name LIKE 'admin_%'` |
