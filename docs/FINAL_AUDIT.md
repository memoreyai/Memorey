# Memorey — Final Technical Audit

**Scope:** Evidence-based audit of the Memorey app (`memorey/`) as of **2026-03-21**.  
**Sources:** Full read of `src/` (253 `.ts`/`.tsx` files per glob), all SQL under `supabase/migrations/`, root configs (`package.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `postcss.config.mjs`, `.gitignore`, `.env.local.example`), plus **live Supabase project** verification via MCP **user-memorey supabase** (`list_tables` verbose, `execute_sql` for policies/indexes/functions, `list_migrations`).

**Important:** Prior audit documents are not assumed valid; this report supersedes them.

---

## SECTION 1: Build, Compilation & Code Quality

### 1a. TypeScript (`npx tsc --noEmit`)

**Command:** `cd memorey && npx tsc --noEmit`  
**Result:** Exit code **0** — no compiler errors.

**Stricter unused check:** `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`  
**Result:** **1 error** — unused variable (see §1d).

**Unsafe assertions found (`rg` across `src/`):**

| File | Line | Pattern | Assessment |
|------|------|---------|------------|
| `src/store/diffStore.ts` | 257, 298 | `as never` for `rowToMemoryNode` | **Workaround** — bridges Supabase row shape to `mapNodeRow`; justified but fragile if schema drifts. |
| `src/app/api/admin/users/[id]/route.ts` | 168 | `planFromRow(profile as never)` | **Workaround** — typing gap between admin query row and helper. |
| `src/app/api/search/route.ts` | 40 | `} as never)` in `mapNodeRow` | **Workaround** — same pattern as above. |
| `src/app/api/admin/users/route.ts` | 79, 148 | `as never` for `planFromRow` | Same. |
| `src/components/graph/hooks/useNodeActions.ts` | 185 | `mapNodeRow(data as never)` | Same. |
| `src/components/graph/MemoryGraph.tsx` | 325, 370 | `as never` | Same. |
| `src/components/graph/hooks/useMemoryGraphChromeProps.ts` | 141 | `as never` | Same. |
| `src/components/graph/hooks/useGraphData.ts` | 33 | `as unknown as Record<string, unknown>` | **Narrowing** for attachment row mapping. |
| `src/components/graph/hooks/useDrawLoop.ts` | 314 | `as unknown as MemoryNode` | **Rendering** — file node vs memory node union; justified for draw helper. |
| `src/store/vaultStore.ts` | 104 | `as unknown as { ... }[]` | **Narrowing** for joined query shape. |
| `src/lib/lucideIconCanvasCache.ts` | 44 | `as unknown as Record<...>` | **Dynamic import** typing. |
| `src/components/graph/ui/ContextMenu.tsx` | 29, 64 | `as unknown as MemoryNode` | **UI** — menu node typing. |

**Verification:** `rg ' as any|as unknown as| as never' memorey/src`

No `as any` matches were found in `src/`.

### 1b. ESLint

**Commands:**

- `npx eslint .` — reports **0 errors, 15 warnings** (React hooks deps, `@next/next/no-img-element`).
- `npx eslint . --quiet` — **no output**, exit code **0** (errors only).

**Conclusion:** **Zero ESLint errors.** Warnings are listed in the eslint output (files: `AttachPanel.tsx`, `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx`, `DashboardShell.tsx`).

### 1c. `console.*` in `src/`

**Verification:** `rg 'console\\.(log|warn|error|debug|info)' memorey/src`

| File | Line | Call | Classification |
|------|------|------|----------------|
| `app/api/graph-builder/route.ts` | 65, 122 | `console.error` | **Keep** — server error / failure path |
| `components/graph/ui/VaultSettingsPopover.tsx` | 271 | `console.error` | **Debug leftover** — client catch; prefer user toast only |
| `app/api/ingest-link/route.ts` | 260, 426, 436 | `console.error` | **Keep** — server |
| `store/diffStore.ts` | 151, 162, 199, 208, 244, 253, 270, 290 | `console.error` | **Debug leftover** — client store; noisy for production |
| `app/api/embed/route.ts` | 51, 74, 84, 98, 108 | `warn` / `error` | **Keep** — server |
| `lib/vaults/resolveVaultId.ts` | 50 | `console.error` | **Debug leftover** — client lib |
| `app/api/memory-assistant/route.ts` | 93 | `console.error` | **Keep** |
| `app/api/extract-nodes/route.ts` | 46 | `console.error` | **Keep** |
| `app/api/search/route.ts` | 130, 174, 189, 292, 309, 326, 336 | `console.error` | **Keep** |
| `app/(dashboard)/dashboard/kanban/page.tsx` | 161 | `console.error` | **Debug leftover** |
| `components/graph/ui/NodeDetailSheet.tsx` | 1259 | `console.error` | **Debug leftover** |
| `app/api/admin/users/route.ts` | 70 | `console.error` | **Keep** |
| `components/diff/useDiff.ts` | 111–112, 131–132 | `console.error` | **Debug leftover** |
| `app/api/user/delete-all-data/route.ts` | many | `console.error` | **Keep** — operational logging |
| `proxy.ts` | 21 | `console.error` | **Keep** — misconfig |
| `app/api/admin/activity/route.ts` | 18 | `console.error` | **Keep** |
| `components/graph/ui/ChatGraphBuilder.tsx` | 582, 638, 723 | `console.error` | **Debug leftover** |
| `app/api/vaults/create/route.ts` | 93, 114 | `console.error` | **Keep** |
| `app/api/nodes/create-file/route.ts` | 111 | `console.error` | **Keep** |
| `app/api/memory/create/route.ts` | 144, 165 | `console.error` | **Keep** |
| `app/api/admin/revenue/route.ts` | 14 | `console.error` | **Keep** |
| `app/api/admin/analytics/feature-usage/route.ts` | 36 | `console.error` | **Keep** |
| `lib/envCheck.ts` | 32 | `console.warn` | **Keep** — startup check |
| `app/(auth)/login/page.tsx` | 25 | `console.error` | **Debug leftover** |
| `app/api/vaults/set-active/route.ts` | 67, 73 | `console.error` | **Keep** |
| `app/api/export/strip-pii/route.ts` | 123 | `console.error` | **Keep** |
| `app/api/export/share/route.ts` | 160 | `console.error` | **Keep** |
| `app/api/stripe/webhook/route.ts` | 127, 193, 199 | `console.error` | **Keep** |
| `app/api/export/route.ts` | 102 | `console.error` | **Keep** |
| `app/api/billing/summary/route.ts` | 65 | `console.error` | **Keep** |
| `app/api/stripe/portal/route.ts` | 50 | `console.error` | **Keep** |
| `app/api/stripe/checkout/route.ts` | 74 | `console.error` | **Keep** |
| `app/api/kanban/complete/route.ts` | 114, 140 | `console.error` | **Keep** |
| `app/api/landing-chat/route.ts` | 87 | `console.error` | **Keep** |
| `app/api/profile/onboarding/route.ts` | 50, 59 | `console.error` | **Keep** |
| `app/global-error.tsx` | 14 | `console.error` | **Keep** — error boundary |
| `components/ErrorBoundary.tsx` | 23 | `console.error` | **Keep** — error boundary |
| `components/graph/canvas/fileNode.ts` | 39 | `console.warn` | **Debug leftover** |
| `app/api/attachments/route.ts` | 162, 173 | `console.error` | **Keep** |

No `console.log` matches in `src/` from this search (only `log` not used in pattern for debug — pattern covered warn/error).

### 1d. Unused imports / variables

**Method:** `tsc --noUnusedLocals --noUnusedParameters` (stricter than default `tsconfig`).

| File | Line | Issue |
|------|------|--------|
| `src/components/graph/canvas/vault.ts` | 112 | `groupPos` declared but never read (`TS6133`) |

**Note:** Default `tsconfig.json` does **not** enable `noUnusedLocals` / `noUnusedParameters`; the above is the only hit when those flags are enabled.

### 1e. Circular dependencies

**Tool:** `npx madge --circular --extensions ts,tsx src`  
**Result:** `✔ No circular dependency found!` (254 files processed, 83 madge warnings unrelated to cycles).

### 1f. `tsconfig.json`

```1:34:memorey/tsconfig.json
{
  "compilerOptions": {
    ...
    "strict": true,
    ...
    "skipLibCheck": true,
    ...
  },
  ...
}
```

- **`strict`: true** — verified in file.
- **Permissive overrides:** `skipLibCheck: true` skips type checking of declaration files (common for Next.js; slightly weaker guarantees for `.d.ts`). No `strictNullChecks`/`noImplicitAny` overrides disabling strictness.

### 1g. `package.json` — dependency usage

**Verification:** ripgrep import usage vs `dependencies` list.

| Package | In `dependencies` | Used in `src/`? |
|---------|-------------------|-----------------|
| `graphology-shortest-path` | yes | **No imports found** — dead dependency |
| `graphology-layout-forceatlas2` | yes | **No imports found** — dead dependency |
| `shadcn` | yes | **No runtime import** — CLI/scaffolding tool; typically **devDependency** |
| Others (`@anthropic-ai/sdk`, `@base-ui/react`, `@dnd-kit/*`, `cheerio`, `cmdk`, `dompurify`, `graphology`, `immer`, `isomorphic-dompurify`, `lucide-react`, `next`, `openai`, `react-force-graph-2d`, `recharts`, `sonner`, `stripe`, `tailwind-merge`, `tw-animate-css`, `zod`, `zustand`, `@supabase/*`) | — | **Used** (spot-checked + grep) |

**tw-animate-css:** imported from `src/app/globals.css` (`@import "tw-animate-css"`).

**devDependencies vs dependencies:** No incorrect placement found that breaks production install for listed runtime imports; the main issue is **unused** graphology subpackages and **`shadcn`** as a production dependency.

---

## SECTION 2: Database Schema & Data Integrity

### 2a. Public schema tables (live DB — MCP `list_tables` verbose)

The remote database contains **13 tables** in `public` (names, RLS on, columns summarized):

1. **profiles** — user profile, onboarding, theme keys, `anthropic_api_key_enc`, `openai_api_key_enc`, `is_super_admin`, FK to `auth.users`, optional FK to `canvases.active_canvas_id`.
2. **category_vaults** — vaults per user, styling columns, `pin_hash`, `color_overrides` jsonb.
3. **memory_nodes** — nodes, embedding vector, kanban, file-node columns, FKs to vault/canvas/user.
4. **node_edges** — edges, optional attachment/canvas FKs.
5. **node_history** — history rows.
6. **subscriptions** — plan, Stripe ids.
7. **user_monthly_usage** — `(user_id, year_month)` PK, counters.
8. **pending_proposals** — proposals.
9. **node_attachments** — attachments metadata.
10. **canvases** — canvases.
11. **canvas_vaults** — M2M canvas↔vault.
12. **user_events** — analytics events.

**App alignment:** Generated types in `src/lib/supabase/database.types.ts` match the listed columns (verified against MCP column list for `profiles`, `memory_nodes`, `category_vaults`).

### 2b. Supabase queries vs schema

**Method:** `rg '\\.from\\(|\\.rpc\\(' memorey/src` + manual review of RPC names vs migrations/MCP.

- **No references** to non-existent tables/columns were found in static review; RPCs used (`search_nodes`, `seed_default_vaults`, `seed_canvas_vaults`, `admin_funnel_metrics`, `admin_memory_node_counts_by_canvas`, `admin_memory_node_counts_by_vault`) exist in migrations / MCP `routine` list.
- **Constraint risk:** Inserts go through RLS user client or validated routes; `memory_nodes` title/value length enforced in DB (`CHECK`) and Zod on some API routes.

### 2c. RLS policies (MCP `pg_policies` on `public`)

| Table | Policy summary |
|-------|------------------|
| `profiles` | `users_own_profile` ALL — `auth.uid() = id` |
| `category_vaults` | `users_own_vaults` ALL — `auth.uid() = user_id` |
| `memory_nodes` | `users_own_nodes` ALL — `auth.uid() = user_id` |
| `node_edges` | `users_own_edges` ALL — `auth.uid() = user_id` |
| `node_history` | `users_own_history` ALL — `auth.uid() = user_id` |
| `node_attachments` | `own_attachments` ALL — `auth.uid() = user_id` |
| `subscriptions` | `users_own_subscription` ALL — `auth.uid() = user_id` |
| `pending_proposals` | split INSERT/SELECT/UPDATE/DELETE — user-scoped |
| `canvases` | `own_canvases` ALL — `auth.uid() = user_id` |
| `canvas_vaults` | `own_canvas_vaults` ALL — subquery via canvas ownership |
| `user_events` | **`no_client_access` ALL — `qual: false`** (client cannot read/write) |
| `user_monthly_usage` | **`usage_select_own` SELECT only** — no INSERT/UPDATE/DELETE for `authenticated` via RLS (writes must use **service role** — matches `lib/billing/usage.ts`) |

**Overly permissive / gaps:** None on `public` tables for typical authenticated users beyond intentional service-only tables.

### 2d. Functions & triggers (subset)

**App-specific SQL functions** (from migration `021_admin_aggregation_rpcs.sql` + MCP):

- `admin_funnel_metrics`, `admin_memory_node_counts_by_canvas`, `admin_memory_node_counts_by_vault` — **used** by admin API routes (`GRANT EXECUTE` to `service_role` only).
- `search_nodes`, `seed_default_vaults`, `seed_canvas_vaults`, `get_connected_nodes` — referenced from app code.

**Vector extension noise:** Many `vector`/`halfvec` symbols appear in `information_schema.routines` from the **pgvector** extension — not application functions.

**Triggers (MCP `information_schema.triggers` on `public`):**

| Table | Trigger | Timing | Event | Function |
|-------|---------|--------|-------|----------|
| `memory_nodes` | `memory_nodes_updated_at` | BEFORE | UPDATE | `update_updated_at()` |

### 2e. Indexes (MCP `pg_indexes`)

Indexes exist on foreign keys, `user_id` filters, IVFFlat on `memory_nodes.embedding`, partial kanban index, etc. **Potential gap:** admin routes that aggregate `user_events` by date scan filtered by `created_at` — index `idx_user_events_created` supports this.

**Redundancy:** Not fully automated; no obvious duplicate btree on same columns from the listing.

### 2f. Migrations order & remote

**Local folder issue:** Multiple files share numeric prefixes (e.g. two `013_*.sql`) — **ordering by filename alone is ambiguous**; rely on timestamps in Supabase.

**Remote (MCP `list_migrations`):** Single ordered chain from `001_memorey_schema` through `admin_aggregation_rpcs` with **no reported gaps** in the tool output.

---

## SECTION 3: Authentication & Authorization

### 3a. Auth paths

1. **Login:** `app/(auth)/login/page.tsx` — `signInWithOAuth({ provider: "google", redirectTo: .../auth/callback })` (client).
2. **Callback:** `app/auth/callback/route.ts` — `exchangeCodeForSession`, optional `user_events` insert `signup_completed`, redirect by `profiles.onboarding_completed`.
3. **Session refresh:** `@supabase/ssr` in `proxy.ts` / server client — cookie-based refresh (standard Supabase pattern).
4. **Logout:** Settings page `signOut()` (client).

**Gaps:** No explicit **global** handling for expired session on client Supabase calls beyond per-request failures (see §10c).

### 3b. Routes vs protection

**Network middleware:** `src/proxy.ts` — `matcher` includes `/dashboard`, `/graph`, `/settings`, `/login`, `/admin`. Uses `createServerClient` + `getUser()`.

| Area | Auth |
|------|------|
| `/login` | Public; redirects logged-in users |
| `/dashboard`, `/graph`, `/settings` | **Requires login**; onboarding gate for non-completed |
| `/admin` | **Requires login only in proxy** — **not** `is_super_admin` at edge |

**API routes:** Not all use `proxy.ts` — each handler must validate session (Bearer or cookies). Many LLM routes use **Bearer** + `getUser(token)`.

### 3c. IDOR

- **Pattern:** Routes that accept `userId` generally compare to `user.id` (e.g. `search/route.ts` lines 104–106).
- **Attachments POST:** Verifies `memory_nodes.id` belongs to user before insert (`attachments/route.ts`).
- **RLS:** User-scoped tables enforce ownership for browser Supabase client.

**Residual risk:** Any route that skipped user check would be vulnerable — **spot-check** favored Bearer + id match; admin routes use `assertAdmin` + service role.

### 3d. `assertAdmin`

```13:40:memorey/src/lib/admin/assertAdmin.ts
export async function assertAdmin(): Promise<AssertAdminResult> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (error || !profile?.is_super_admin) {
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }

  return { ok: true, userId: user.id };
}
```

- **Bypass:** Not realistically bypassable without a valid session + DB flag `is_super_admin`.
- **Edge cases:** `maybeSingle()` + missing profile → **403**; race if profile deleted mid-request → 403.

### 3e. Admin UI flash

`AdminLayoutClient` gates on `fetch("/api/admin/stats")` — shows **skeleton** until 401/403/ok (`AdminLayoutClient.tsx` lines 34–77). **No admin metrics content** renders before gate resolves; worst case user sees loading chrome then redirect.

---

## SECTION 4: Security

### 4a. XSS

| File | Line | Pattern | Sanitization |
|------|------|---------|--------------|
| `components/landing/LandingPage.tsx` | 2134 | `dangerouslySetInnerHTML` | **`DOMPurify.sanitize(msg.html)`** before inject |
| `app/layout.tsx` | 97 | `dangerouslySetInnerHTML` | **Static** theme boot script string (no user input) |

**Other:** No `document.write` in `src/`. `rg 'innerHTML\\s*='` not exhaustively run; primary risk path is above.

### 4b. API key columns (`anthropic_api_key_enc`, `openai_api_key_enc`)

**Evidence:** Columns exist on `profiles` (MCP). **No reads/writes** to these columns appear in `src/` (grep only hits `database.types.ts`).

**Conclusion:** Columns are **unused in application code**; **no encryption implementation** is present in-repo. Names suggest future BYOK; **do not store plaintext** in these columns without real encryption (KMS/app-level crypto).

### 4c. Service role exposure

**Files referencing `SUPABASE_SERVICE_ROLE_KEY` or `createAdminClient`:**  
`grep` listed: `lib/supabase/admin.ts`, `lib/billing/usage.ts`, `lib/admin/assertAdmin.ts`, `auth/callback`, and **only** `src/app/api/**` route handlers plus `ingest-link`, `embed`, `search`, `export`, `share`, `stripe/webhook`, `track`, `user/delete-all-data`, `vaults/*`, `memory/create`, `nodes/create-file`, `billing/summary`, `kanban/complete`, admin routes.

**Client bundle:** These modules are **not** imported by `"use client"` components except through **server-only** API boundaries — Next.js routes and `server`/`admin` live in server context.

**Verification:** `rg` import paths + architectural rule: `createAdminClient` is only imported from server route modules and server libs.

### 4d. Storage security — **critical finding**

**MCP `pg_policies` on `storage`:**

1. **`Public read node-attachments`** — `cmd: SELECT`, `qual: (bucket_id = 'node-attachments')`  
2. **`Users access own attachments`** — `cmd: ALL`, `qual` / `with_check` include `auth.uid()` matching folder.

**Issue:** For `SELECT`, **either** permissive policy can grant access. Policy (1) allows **any** authenticated user (and potentially broader, depending on role membership) to **read every object** in the bucket because it only filters `bucket_id`, **not** `name` / owner folder.

**Evidence snippet (policy qual from DB):**

```text
"Public read node-attachments": qual = (bucket_id = 'node-attachments'::text)
```

**Impact:** Cross-user file read if object URLs/paths are known or enumerable.

**Bucket:** Migration `017_storage_node_attachments_private.sql` sets `public = false` on bucket — does not fix RLS overbreadth.

### 4e. CSRF

Cookie-based routes use SameSite session cookies (Supabase default). **No CSRF tokens** on POST APIs. Risk is **moderate** for cookie-authenticated routes; Bearer-token routes are not CSRF-targetable in the classic sense.

### 4f. Rate limiting

Implemented via `checkRateLimit` in: `graph-builder`, `ingest-link`, `embed`, `memory-assistant`, `extract-nodes`, `search`, `track`. **Not** applied to many other POST routes (e.g. `landing-chat`, `attachments/extract-meta`, `export`, `memory/create` uses Bearer but no rate limit in file).

**Limitation (documented in code):** in-memory limiter — ineffective across many serverless instances.

```4:7:memorey/src/lib/rateLimit.ts
 * Limitation: state lives in this process only — it resets on serverless cold
 * starts and does not coordinate across multiple instances.
```

### 4g. Input validation

- **Strong Zod:** `graph-builder`, `memory/create`, `profile/onboarding`, parts of validation centralized in `lib/validation/schemas.ts`.
- **Weak / none:** `attachments/extract-meta` — only checks URL starts with `http` (**see §4h SSRF**).

### 4h. Data deletion — `api/user/delete-all-data`

Deletes: `user_events`, `pending_proposals`, `node_attachments`, `node_history`, `node_edges`, `memory_nodes`, `canvas_vaults`, `canvases`, `category_vaults` (then re-seeds default vaults), `user_monthly_usage`, storage files under `node-attachments/{userId}/`.

**Does not delete:** `subscriptions`, `profiles` row, **auth user**, Stripe customer linkage in DB, etc. Partial deletion semantics — **document** clearly for users/GDPR.

### 4i. SQL injection

**No raw string-built SQL** in app code; Supabase client + RPCs use parameters. **No** unsafe `.rpc()` string interpolation observed.

### 4j. Secrets in repo

- `rg` for `sk_live|sk_test|password :=` in `src/` — **no hits**.
- `.env.local` is **gitignored** (`.gitignore` lines 33–36). **Do not commit** `.env.local`.

---

## SECTION 5: API Routes — Summary Table

**Legend:** Auth: Cookie = `createClient()` from `@/lib/supabase/server`; Bearer = `Authorization` header + anon client `getUser(token)`.

| Route | Methods | Auth | Validation | Supabase client | Error handling | Rate limit | Notes |
|-------|---------|------|------------|-------------------|----------------|------------|-------|
| `/api/graph-builder` | POST | Bearer | Zod | Anon + auth | try/catch | 10/min | OK |
| `/api/ingest-link` | POST | Bearer | Partial/manual | Anon + admin | try/catch | 10/min | Heavy |
| `/api/embed` | POST | Bearer | Manual | Admin | try/catch | 30/min | OK |
| `/api/admin/stats` | GET | Cookie + assertAdmin | n/a | Admin | checks | no | OK |
| `/api/admin/analytics/funnel` | GET | assertAdmin | n/a | Admin | checks | no | Funnel SQL semantics |
| `/api/admin/users/[id]` | GET | assertAdmin | n/a | Admin | checks | no | OK |
| `/api/memory-assistant` | POST | Bearer | Zod? / manual | N/A anthropic | try/catch | 20/min | OK |
| `/api/extract-nodes` | POST | Bearer | Zod | — | try/catch | 20/min | OK |
| `/api/search` | POST | Bearer | Manual | Service | try/catch | 30/min | userId checked |
| `/api/track` | POST | Cookie | Manual | Admin | silent catch | 60/min | Fire-and-forget |
| `/api/admin/users` | GET | assertAdmin | query params manual | Admin | checks | no | OK |
| `/api/user/delete-all-data` | POST | Cookie | confirm string | Admin | partial | no | Deletes partial vs account |
| `/api/admin/activity` | GET | assertAdmin | n/a | Admin | checks | no | OK |
| `/api/vaults/create` | POST | Cookie | manual | user + admin | try/catch | no | OK |
| `/api/nodes/create-file` | POST | Cookie | Zod/manual | user + admin | try/catch | no | OK |
| `/api/memory/create` | POST | Bearer | Zod | User RLS | try/catch | no | OK |
| `/api/admin/revenue` | GET | assertAdmin | n/a | Admin | checks | no | OK |
| `/api/admin/analytics/feature-usage` | GET | assertAdmin | n/a | Admin | checks | no | OK |
| `/api/admin/analytics/overview` | GET | assertAdmin | days param | Admin | checks | no | Heavy at scale |
| `/api/vaults/set-active` | POST | Cookie | manual | Admin | try/catch | no | OK |
| `/api/export/strip-pii` | POST | Cookie | manual | — | try/catch | no | Anthropic |
| `/api/export/share` | POST | Cookie | manual | Service | try/catch | no | OK |
| `/api/stripe/webhook` | POST | Stripe signature | n/a | Admin | try/catch | Stripe | OK |
| `/api/export` | POST | Bearer | manual | Service | try/catch | no | OK |
| `/api/billing/summary` | GET | Cookie | n/a | Admin | try/catch | no | OK |
| `/api/stripe/portal` | POST | Cookie | n/a | Admin + Stripe | try/catch | no | OK |
| `/api/stripe/checkout` | POST | Cookie | n/a | Admin + Stripe | try/catch | no | OK |
| `/api/kanban/complete` | POST | Cookie | manual | Admin | try/catch | no | LLM |
| `/api/landing-chat` | POST | **none** | minimal | HTTP | try/catch | **no** | **Public LLM abuse** |
| `/api/profile/onboarding` | PATCH | Cookie | Zod | User RLS | try/catch | no | OK |
| `/api/attachments/extract-meta` | POST | **none** | URL string only | fetch URL | try/catch | **no** | **SSRF / abuse** |
| `/api/attachments` | POST | Bearer | manual | User RLS | try/catch | no | OK |

**Detailed issues:**

1. **`/api/attachments/extract-meta`** — unauthenticated fetch of arbitrary URLs (SSRF, DoS amplification). **Critical.**
2. **`/api/landing-chat`** — no auth, no rate limit; burns Anthropic quota. **High.**

---

## SECTION 6: Frontend (selected evidence)

### 6a. SSR safety

Many components use `window`/`document` inside **`useEffect`** or **`"use client"`** files — safe pattern.

**Notable guarded server-safe parsing:** `parseCssColorToHex6` checks `typeof document === "undefined"` before canvas path (`parseCssColor.ts` lines 69–71).

### 6b. `useEffect` — sampling

ESLint reports **missing dependencies** in `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx` — risk of **stale closures** (see eslint output §1b).

### 6c. Zustand stores

Files: `graphStore.ts`, `vaultStore.ts`, `canvasStore.ts`, `diffStore.ts`, `exportPanelStore.ts`, `vaultManagerOverlayStore.ts`.

- **Immer:** `import "@/lib/immer-config"` in layout — used in graph store patterns.
- **Race conditions:** Possible under rapid tab sync; no CRDT; **accepted** for v1.

### 6d–6h. UI error/loading/empty/forms

- **Loading:** Several routes provide `loading.tsx` under dashboard; admin uses skeletons in `AdminLayoutClient`.
- **Forms:** Onboarding uses API + Zod; settings billing uses fetch with toast errors.

---

## SECTION 7: Admin Dashboard

### 7a–7b. Queries & performance

- **Funnel RPC** (`021_admin_aggregation_rpcs.sql`): `used_search` / `used_capture` count **distinct users ever** (no date window) — **misleading** vs typical funnel semantics.

```66:75:memorey/supabase/migrations/023_admin_aggregation_rpcs.sql
    (
      SELECT COUNT(DISTINCT ue.user_id)::bigint
      FROM public.user_events ue
      WHERE ue.event_name = 'search_performed'
    ),
    (
      SELECT COUNT(DISTINCT ue.user_id)::bigint
      FROM public.user_events ue
      WHERE ue.event_name IN ('capture_chat_sent', 'capture_link_ingested')
    ),
```

- **Overview route** loads raw `user_events` for range — **O(events)** in Node for daily bucketing — will **slow** at large event volume.

### 7c. Frontend

Admin pages use charts (recharts), toast errors, loading states on layout gate.

### 7d. Access control

Non-admin hits `/admin` → layout fetch → **403** → toast + redirect `/dashboard`. **No sensitive counts** in HTML before fetch completes (children still mount after gate — only skeleton/empty shell; **page content** is under layout).

### 7e. Revenue / MRR

`admin/revenue` aggregates subscription rows — verify Stripe plan prices externally; code uses **counts by plan**, not true MRR without price tables.

---

## SECTION 8: Analytics

### 8a. Pipeline

`useTrack` → `fetch("/api/track")` → `createAdminClient().insert(user_events)` with dedupe window.

**Loss:** Silent `catch` in `track` route — events dropped on failure.

### 8b. Event coverage

**Labels in `eventLabels.ts` never fired from app code** (grep only found in `eventLabels.ts`): `onboarding_started`, `share_link_created`, `export_started`, `billing_checkout_started`.

**Fired elsewhere:** `signup_completed` (callback), `vault_created` (API), `canvas_created` (`canvasStore`), `track()` calls for searches, nodes, etc.

### 8c. Rate limit on `/api/track`

60 events/min/user — **adequate** for normal use; malicious user still inserts until limit; DB growth risk.

### 8d. Privacy

`user_events` deleted in `delete-all-data` — **good**. No separate analytics vendor.

---

## SECTION 9: Performance & Scalability (high level)

- **Heavy queries:** Admin overview, funnel-less search/capture metrics, vector search — review indexes (present) and consider **materialized** admin stats at 10k+ users.
- **Bundle:** `recharts`, `react-force-graph-2d`, `lucide-react` — consider lazy loading admin and graph routes.
- **Serverless:** LLM routes can approach timeout on slow providers — monitor Vercel logs.

---

## SECTION 10: Edge Cases & Reliability

- **Supabase down:** API routes return 500 / errors; client toasts.
- **Anthropic/OpenAI down:** respective routes error JSON.
- **Concurrent edits:** Last-write-wins on nodes; possible divergence — no OT.
- **Session expiry:** Client may see RLS errors until refresh — **needs** unified handling.

---

## SECTION 11–12: Accessibility & Mobile

- **Not fully audited line-by-line** (253 files); ESLint a11y not fully configured beyond Next defaults.
- Graph/canvas interactions are **pointer-heavy** — keyboard shortcuts exist (`useKeyboardShortcuts.ts`) but full WCAG coverage not verified.
- Responsive: Tailwind used; **375px / 768px** testing not automated in this audit.

---

## SECTION 13: Summary & Fix Priority

### Table 1 — Critical

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Storage RLS allows bucket-wide read via “Public read node-attachments” | DB `storage.objects` policies | **Drop or narrow** policy (1); require `foldername(name)[1] = auth.uid()::text` for SELECT | **small** SQL migration |
| Unauthenticated SSRF / open proxy in link preview | `src/app/api/attachments/extract-meta/route.ts` | Require auth; **block private IPs**; strict allowlist; rate limit | **medium** |
| Public LLM endpoint abuse | `src/app/api/landing-chat/route.ts` | Add rate limit + optional Turnstile; or remove from prod | **medium** |

### Table 2 — High

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| `delete-all-data` incomplete vs “full account” | `src/app/api/user/delete-all-data/route.ts` | Document scope; optionally delete `subscriptions`, call auth admin delete | **medium** |
| Funnel metrics misleading (`used_search` / `used_capture`) | `021_admin_aggregation_rpcs.sql` | Add time bounds or rename labels | **small** |
| In-memory rate limit ineffective at scale | `src/lib/rateLimit.ts` | Redis / Upstash | **large** |
| Dead dependencies | `package.json` | Remove unused graphology packages; move `shadcn` to devDeps | **small** |

### Table 3 — Medium

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Unused variable `groupPos` | `src/components/graph/canvas/vault.ts:112` | Remove or use | **small** |
| `as never` sprawl | multiple files | Generate stricter DB types / mappers | **large** |
| ESLint hook dependency warnings | several components | Refactor deps | **medium** |
| Analytics labels without instrumentation | `eventLabels.ts` vs `useTrack` | Implement or remove labels | **small** |

### Table 4 — Low

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Client `console.error` noise | `diffStore`, etc. | Gate on `NODE_ENV` or use logger | **small** |
| `<img>` vs `next/image` warnings | eslint output files | Use `Image` where appropriate | **small** |

---

## Production readiness

**Is this codebase ready to deploy for real users, assuming critical and high issues are addressed first?**

**NO** — until **storage RLS is fixed** (cross-user file read), **extract-meta is locked down** (SSRF), and **landing-chat** is abuse-protected or disabled, the system is **not** safe for production data. After those fixes, **YES** with continued hardening (rate limits, admin query scaling, account deletion semantics).

---

## Verification commands (reference)

```bash
cd memorey && npx tsc --noEmit
cd memorey && npx eslint . --quiet
cd memorey && npx madge --circular --extensions ts,tsx src
rg 'console\.(log|warn|error)' src/
rg ' as any|as unknown as| as never' src/
```

MCP: **user-memorey supabase** — `list_tables`, `execute_sql` (policies, indexes, routines), `list_migrations`.
