# Memorey — Final Technical Audit (FINAL_AUDIT_6)

**Scope:** Fresh audit of the Memorey app (`memorey/`) as of the audit run. Evidence from repository inspection, `npx tsc --noEmit`, `npx eslint`, `npm run build`, `npx madge --circular`, ripgrep scans, and **Supabase MCP `user-memorey supabase`** (`list_tables` verbose, `execute_sql` for policies/indexes/functions, `list_storage_buckets`).

**Verification note:** The codebase contains **254** TypeScript/TSX files under `src/` (glob `**/*.{ts,tsx}`). This report uses **pattern scans across all of `src/`** plus **full reads** of `tsconfig.json`, `package.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next.config.ts`, and **all 36 files** in `supabase/migrations/`. Individual deep line-by-line reads of every source file are not listed exhaustively; claims tied to repo-wide patterns cite the grep/command used.

---

## SECTION 1 — Build, Compilation & Code Quality

### 1a. TypeScript (`npx tsc --noEmit`)

**Result: FAIL — 2 errors (same root cause).**

```
src/lib/billing/usage.ts(50,37): error TS2345: Argument of type '"increment_usage"' is not assignable to parameter of type ...
src/lib/billing/usage.ts(61,37): error TS2345: Argument of type '"increment_usage"' is not assignable to parameter of type ...
```

**Evidence:**

```47:66:memorey/src/lib/billing/usage.ts
export async function incrementShareLinkUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const yearMonth = currentYearMonth();
  const { error } = await admin.rpc("increment_usage", {
    p_user_id: userId,
    p_year_month: yearMonth,
    p_field: "share_link_count",
  });
  if (error) console.error("Failed to increment share_link_count:", error.message);
}

export async function incrementChatQueryUsage(userId: string): Promise<void> {
  const admin = createAdminClient();
  const yearMonth = currentYearMonth();
  const { error } = await admin.rpc("increment_usage", {
```

**Root cause:** `increment_usage` exists in Postgres (migration `036_atomic_usage_increment.sql` and MCP `execute_sql` on `pg_proc`) but is **absent** from `Database["public"]["Functions"]` in `src/lib/supabase/database.types.ts` (the `Functions` block ends at `admin_funnel_metrics` with no `increment_usage` entry — verified by grep on `Functions:` / `increment_usage`).

**Impact:** `next build` also fails at the same lines (**verified:** `npm run build` → TypeScript step failed).

**Unsafe casts (`as any`, `as unknown as`, `as never`) — grep:** `rg ' as any| as unknown as | as never' memorey/src`  

| File | Line | Snippet | Assessment |
|------|------|---------|------------|
| `src/app/api/search/route.ts` | 40 | `} as never);` in `rowToMemoryNode` | **Workaround** for `mapNodeRow` typing; masks structural mismatch — **risk** if RPC shape drifts. |
| `src/app/api/admin/users/route.ts` | 79, 148 | `planFromRow(p as never)` | **Workaround** for loose profile row typing. |
| `src/app/api/admin/users/[id]/route.ts` | 168 | `plan: planFromRow(profile as never)` | Same. |
| `src/components/graph/hooks/useNodeActions.ts` | 204 | `mapNodeRow(json.node as never)` | **Workaround** for API JSON. |
| `src/store/diffStore.ts` | 257, 298 | `rowToMemoryNode(data as never, ...)` | Same. |
| `src/components/graph/MemoryGraph.tsx` | 325, 370 | `mapNodeRow(... as never)` | Same. |
| `src/components/graph/hooks/useMemoryGraphChromeProps.ts` | 141 | `mapNodeRow(saved as never)` | Same. |
| `src/components/graph/hooks/useGraphData.ts` | 33 | `mapAttachmentRow(r as unknown as Record<string, unknown>)` | **Narrowing** from Supabase row — reasonable. |
| `src/components/graph/hooks/useDrawLoop.ts` | 314 | `node as unknown as MemoryNode` | **Narrowing** for canvas draw path. |
| `src/store/vaultStore.ts` | 104 | `(data ?? []) as unknown as { ... }[]` | **Workaround** for joined query shape. |
| `src/lib/lucideIconCanvasCache.ts` | 44 | `await import("lucide-react") as unknown as Record<...>` | **Dynamic import typing** — common pattern. |
| `src/components/graph/ui/ContextMenu.tsx` | 29, 64 | `as unknown as MemoryNode` | **Narrowing** from graph node union. |

None of these are `as any`; most are `as never` / `unknown` bridges around incomplete generated types.

### 1b. ESLint

**Command:** `cd memorey && npx eslint . --max-warnings 999999`  

**Result:** **0 errors**, **17 warnings** (all warnings, no errors).

**Warnings (summary):** `@next/next/no-img-element` in several components; `react-hooks/exhaustive-deps` in `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx`; `@typescript-eslint/no-unused-vars` for `_c`/`_d` in `src/lib/security/urlValidation.ts:16`.

### 1c. `console.log` / `console.warn` / `console.error`

**Method:** `rg 'console\.(log|warn|error|debug|info)' memorey/src` — **no `console.log` or `console.debug`** matched; only `warn`/`error` as listed below.

| File | Line | Kind |
|------|------|------|
| `src/app/(dashboard)/dashboard/kanban/page.tsx` | 161 | **error** — log exception (keep / tighten) |
| `src/app/api/memory/create/route.ts` | 153, 174 | **error** — server error logging (keep) |
| `src/app/api/user/delete-all-data/route.ts` | 148–220 | **error** — operational logging (keep) |
| `src/lib/billing/usage.ts` | 55, 66 | **error** — failed RPC (keep; fix types so failures are visible in CI) |
| `src/app/api/vaults/create/route.ts` | 101, 122 | **error** — server (keep) |
| `src/app/api/attachments/route.ts` | 170, 181 | **error** — server (keep) |
| `src/app/api/kanban/complete/route.ts` | 122, 148 | **error** — server (keep) |
| `src/app/api/export/strip-pii/route.ts` | 131 | **error** — server (keep) |
| `src/app/api/export/share/route.ts` | 168 | **error** — server (keep) |
| `src/app/api/export/route.ts` | 110 | **error** — server (keep) |
| `src/app/api/nodes/create-file/route.ts` | 126 | **error** — server (keep) |
| `src/app/api/landing-chat/route.ts` | 110 | **error** — server (keep) |
| `src/app/api/graph-builder/route.ts` | 65, 122 | **error** — server (keep) |
| `src/components/graph/ui/VaultSettingsPopover.tsx` | 271 | **error** — client catch (could be user-visible toast instead) |
| `src/app/api/ingest-link/route.ts` | 260, 426, 436 | **error** — server (keep) |
| `src/store/diffStore.ts` | 151–290 | **error** — client/store (mix of **debug-style** and **operational**; consider reducing noise) |
| `src/app/api/embed/route.ts` | 51, 74, 84, 98, 108 | **warn/error** — missing key / API issues (keep) |
| `src/lib/vaults/resolveVaultId.ts` | 50 | **error** — edge case (keep) |
| `src/app/api/memory-assistant/route.ts` | 93 | **error** — server (keep) |
| `src/app/api/extract-nodes/route.ts` | 46 | **error** — server (keep) |
| `src/app/api/search/route.ts` | 130, 174, 189, 292, 309, 326, 336 | **error** — server (keep) |
| `src/app/api/admin/users/route.ts` | 70 | **error** — server (keep) |
| `src/components/graph/ui/NodeDetailSheet.tsx` | 1259 | **error** — client (keep or toast) |
| `src/components/diff/useDiff.ts` | 111–132 | **error** — **debug-heavy** (remove or gate on `NODE_ENV`) |
| `src/proxy.ts` | 21 | **error** — misconfiguration (keep) |
| `src/app/api/admin/activity/route.ts` | 18 | **error** — server (keep) |
| `src/components/graph/ui/ChatGraphBuilder.tsx` | 582, 638, 723 | **error** — client (keep) |
| `src/app/api/admin/revenue/route.ts` | 14 | **error** — server (keep) |
| `src/app/api/admin/analytics/feature-usage/route.ts` | 36 | **error** — server (keep) |
| `src/lib/envCheck.ts` | 32 | **warn** — startup (keep) |
| `src/app/(auth)/login/page.tsx` | 25 | **error** — OAuth failure (keep) |
| `src/app/api/vaults/set-active/route.ts` | 67, 73 | **error** — server (keep) |
| `src/app/api/stripe/webhook/route.ts` | 127, 193, 199 | **error** — server (keep) |
| `src/app/api/billing/summary/route.ts` | 65 | **error** — server (keep) |
| `src/app/api/stripe/portal/route.ts` | 50 | **error** — server (keep) |
| `src/app/api/stripe/checkout/route.ts` | 74 | **error** — server (keep) |
| `src/app/api/profile/onboarding/route.ts` | 50, 59 | **error** — server (keep) |
| `src/app/global-error.tsx` | 14 | **error** — **error boundary logging** (keep) |
| `src/components/ErrorBoundary.tsx` | 23 | **error** — **error boundary logging** (keep) |
| `src/components/graph/canvas/fileNode.ts` | 39 | **warn** — image load (keep) |

### 1d. Unused imports / variables

**Method:** ESLint output from §1b — only explicit unused-vars:  

```16:16:memorey/src/lib/security/urlValidation.ts
  // ... _c and _d reported as unused by @typescript-eslint/no-unused-vars
```

(Full line context omitted; file uses `_c`/`_d` placeholders — **fix:** prefix with eslint-disable or remove parameters.)

**No other** unused-vars reported by ESLint in the current config (many rules may not flag all unused imports).

### 1e. Circular dependencies

**Command:** `npx madge --circular --extensions ts,tsx src` (cwd: `memorey`)  

**Result:** `✔ No circular dependency found!`

### 1f. `tsconfig.json`

```6:7:memorey/tsconfig.json
    "skipLibCheck": true,
    "strict": true,
```

- **`strict`: true** — yes.
- **Permissive:** `skipLibCheck: true` skips type checking of `.d.ts` dependencies (common for Next.js; slightly weaker than full strict on deps).
- **`allowJs: true`** — allows JS files to be part of compile (no `checkJs` — JS not strictly checked).

### 1g. `package.json` dependencies

**Dependencies (production):** listed in `package.json` lines 11–38.

**Imports check (rg `from \"<pkg>\"` / `from '<pkg>'` in `src/`):**

| Package | Used in `src/`? |
|---------|-----------------|
| `@anthropic-ai/sdk` | Yes (API routes) |
| `@base-ui/react` | Yes (`components/ui/*`) |
| `@dnd-kit/core` | Yes (Kanban) |
| `@dnd-kit/utilities` | Yes (`KanbanCard.tsx` — `CSS`) |
| `@supabase/ssr` | Yes |
| `@supabase/supabase-js` | Yes |
| `cheerio` | Yes (`ingest-link`) |
| `class-variance-authority` | Yes |
| `clsx` | Yes |
| `cmdk` | Yes (`command.tsx`) |
| `date-fns` | Yes |
| `graphology` | Yes (`graphStore`) |
| `immer` | Yes (stores) |
| `isomorphic-dompurify` | Yes (landing chat HTML) |
| `lucide-react` | Yes |
| `next` | Yes |
| `openai` | Yes |
| `react` / `react-dom` | Yes |
| `react-force-graph-2d` | Yes |
| `recharts` | Yes (admin charts) |
| `sonner` | Yes |
| `stripe` | Yes |
| `tailwind-merge` | Yes |
| `tw-animate-css` | Yes (`globals.css` `@import`) |
| `zod` | Yes |
| `zustand` | Yes |

**No dependency in `dependencies` appeared unused** under this import scan.

**devDependencies:** `eslint`, `eslint-config-next`, `typescript`, `tailwindcss`, `@tailwindcss/postcss`, `@types/*`, `shadcn` — appropriate as dev tooling; **no misclassification found** that would break production install of runtime deps.

---

## SECTION 2 — Database Schema & Data Integrity (MCP + migrations)

### 2a. Public schema tables (authoritative: MCP `list_tables` verbose)

Tables returned: **`profiles`**, **`category_vaults`**, **`memory_nodes`**, **`node_edges`**, **`node_history`**, **`subscriptions`**, **`user_monthly_usage`**, **`pending_proposals`**, **`node_attachments`**, **`canvases`**, **`canvas_vaults`**, **`user_events`**.  

Full column definitions, PKs, and FKs match the MCP JSON (omitted here for length; **verification:** `list_tables` with `verbose: true` on schema `public`).

**Application alignment:** Client/server code references these tables consistently; no references to non-existent tables were found in `rg '\\.from\\(' memorey/src` for table names outside this set.

### 2b. Supabase queries vs schema

**RPC calls (rg `\\.rpc\\('`):** `increment_usage`, `admin_active_user_counts`, `admin_funnel_metrics`, `admin_memory_node_counts_by_canvas`, `admin_memory_node_counts_by_vault`, `search_nodes`, `seed_default_vaults`, `seed_canvas_vaults`. All exist in DB (`execute_sql` on `pg_proc`).

**Issue — generated types vs DB:**

- **`increment_usage`** is deployed and granted to `service_role` only (`036_atomic_usage_increment.sql`), and **is called from** `usage.ts`, but **TypeScript types omit it** → **build failure** (§1a).

**`get_connected_nodes`:** Defined in DB and in `database.types.ts`, but **no call sites in `src/`** (`rg get_connected_nodes` → only `database.types.ts`). **Orphaned from application** (potential dead feature or future use).

**Notable constraint risks (by design / code paths):**

- `memory_nodes` CHECK on `title`/`value` length — API routes using Zod (`memory/create`) align; client-side inserts must also respect DB limits.
- `increment_usage` only increments when `p_field` matches — other values are no-ops (no SQL error).

### 2c. RLS policies (MCP `pg_policies`)

**`public`:**

| Table | Policy | Cmd | Expression summary |
|-------|--------|-----|---------------------|
| `canvas_vaults` | `own_canvas_vaults` | ALL | Canvas owned by `auth.uid()` |
| `canvases` | `own_canvases` | ALL | `user_id = auth.uid()` |
| `category_vaults` | `users_own_vaults` | ALL | `user_id = auth.uid()` |
| `memory_nodes` | `users_own_nodes` | ALL | `user_id = auth.uid()` |
| `node_attachments` | `own_attachments` | ALL | `user_id = auth.uid()` |
| `node_edges` | `users_own_edges` | ALL | `user_id = auth.uid()` |
| `node_history` | `users_own_history` | ALL | `user_id = auth.uid()` |
| `pending_proposals` | `users_*_own_pending_proposals` | SELECT/INSERT/UPDATE/DELETE | `user_id = auth.uid()` |
| `profiles` | `profiles_select_own` | SELECT | `id = auth.uid()` |
| `profiles` | `profiles_update_own` | UPDATE | `id = auth.uid()` |
| `subscriptions` | `subscriptions_select_own` | SELECT | `user_id = auth.uid()` |
| `user_monthly_usage` | `usage_select_own` | SELECT | `user_id = auth.uid()` |
| `user_events` | `no_client_access` | ALL | **`false`** — clients cannot read/write |

**`storage.objects`:**

- `Users access own attachments` — ALL on `node-attachments` where folder[1] = `auth.uid()::text`
- `Users read own attachments` — SELECT (same predicate)

**Missing RLS on public tables:** None in MCP output — all listed tables have `rls_enabled: true` in `list_tables`.

**Overly permissive:** None at row level for app tables; **`user_events`** is correctly locked down for direct client access (writes go through service role in API routes).

### 2d. Functions & triggers

**Public functions (MCP):** `admin_active_user_counts`, `admin_funnel_metrics`, `admin_memory_node_counts_by_canvas`, `admin_memory_node_counts_by_vault`, `get_connected_nodes`, `handle_new_user`, `increment_usage`, `protect_admin_flag`, `search_nodes`, `seed_canvas_vaults`, `seed_default_vaults`, `seed_default_vaults_internal`, `update_updated_at`.

- **`handle_new_user`**, **`protect_admin_flag`**, **`update_updated_at`** — wired in migrations (triggers); not called from TS directly — **expected**.

- **`get_connected_nodes`** — **not used in app code** (see §2b).

### 2e. Indexes (MCP `pg_indexes`)

Indexes exist on foreign keys, `user_events (event_name, created_at)`, `memory_nodes` ivfflat on `embedding`, partial indexes for kanban/kind, etc.  

**Possible redundancy:** `idx_memory_nodes_user_active` vs composite usage — low risk; **missing index:** none critical flagged for primary filters (`user_id` appears on major indexes).

### 2f. Migrations order

**Files:** `001` … `036` — **continuous numbering, no gaps** (36 files under `supabase/migrations/`).

**Conflict check:** Remote DB schema (MCP) matches presence of `increment_usage`, `user_events`, `is_super_admin`, etc., consistent with late migrations.

---

## SECTION 3 — Authentication & Authorization

### 3a. Auth paths

1. **Login:** `src/app/(auth)/login/page.tsx` — `signInWithOAuth({ provider: "google", redirectTo: ... })` (client).
2. **Callback:** `src/app/auth/callback/route.ts` — `exchangeCodeForSession(code)`, then optional `user_events` insert `signup_completed`, redirect by `onboarding_completed`.
3. **Session:** `@supabase/ssr` in `src/lib/supabase/server.ts` (not fully quoted here) + **`src/proxy.ts`** refreshes cookies via `createServerClient` + `getUser()`.
4. **Logout:** Settings page `signOut()` (client).

**Gap:** `proxy.ts` does not validate Google tokens beyond Supabase; **expected** for Supabase OAuth.

### 3b. Routes & middleware

**Network middleware:** `src/proxy.ts` — matcher covers `/dashboard`, `/graph`, `/settings`, `/login`, `/admin` (see `config.matcher`).

```57:66:memorey/src/proxy.ts
  const isAdminRoute = path.startsWith("/admin");
  const isProtectedRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/graph") ||
    path.startsWith("/settings") ||
    isAdminRoute;

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
```

- **`/api/*` is NOT in the matcher** — API routes **must** authenticate themselves (they generally do via Bearer or `createClient()` cookies).

**Public (no login):** `/`, marketing/landing (not in protected matcher), `/login`, `/auth/callback` (callback allowed through before env check completes — special case first lines).

**Authenticated:** `/dashboard`, `/graph`, `/settings`, `/admin` (requires login only at edge — **not** super-admin at edge).

**Super admin:** Enforced in **API** via `assertAdmin()` and **client gate** in `AdminLayoutClient` (below).

**Direct request to protected API without auth:** Routes using `createClient()` + `getUser()` return **401**; Bearer routes return **401** without token.

### 3c. IDOR

- **`/api/memory/create`:** Validates `body.userId === user.id` (file read during audit) — **manual check** + RLS on user client.
- **`/api/attachments`:** Loads `memory_nodes` with `.eq("user_id", user.id)` — **verified** (§attachments snippet).
- **`/api/search`:** Requires `userId === user.id` — **verified** in read file.
- **Admin routes:** Operate on arbitrary user IDs but **`assertAdmin()`** first — **non-IDOR** for normal users (403).

### 3d. `assertAdmin`

```13:40:memorey/src/lib/admin/assertAdmin.ts
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

**Bypass:** Not without a valid session + `is_super_admin` in DB. **Service role** could set the flag — **DB trigger `protect_admin_flag`** restricts changes to `is_super_admin` unless `service_role` (see MCP function definition).

**Edge cases:** Null profile → `!profile?.is_super_admin` → **403**. Deleted user → typically no session. Race: between check and action — acceptable for admin UI.

### 3e. Admin UI flash

```62:77:memorey/src/app/(admin)/admin/AdminLayoutClient.tsx
  if (gate === "loading") {
    return (
      <div className="flex min-h-screen bg-[var(--bg)]">
        <aside className="w-[var(--sidebar-w-collapsed)] shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] lg:w-[var(--sidebar-w)]" />
        ...
```

**Children (admin metrics) are not rendered until `gate === "ok"`** after `/api/admin/stats` returns 200. **No admin data in `{children}`** during loading — **good**. Slow network: user sees skeleton, not numbers.

---

## SECTION 4 — Security

### 4a. XSS

**`dangerouslySetInnerHTML`:**

1. `src/app/layout.tsx` ~97 — **static theme boot script** (controlled string in source).
2. `src/components/landing/LandingPage.tsx` ~2134 — **`DOMPurify.sanitize(msg.html)`** before inject — **sanitized**.

**Other patterns:** No `document.write` found in `src/` (`rg document.write` — none). Template literals into `innerHTML` not systematically used outside DOMPurify path.

### 4b. API key columns (`anthropic_api_key_enc`, `openai_api_key_enc`)

**Grep:** `rg 'anthropic_api_key_enc|openai_api_key_enc' memorey/src` → **only** `database.types.ts` (schema mirror).

**Conclusion:** **No application read/write** of these fields in TS. **No encryption implementation** in repo — column names are **misleading** if interpreted as “encrypted at rest by app”; actual encryption would be KMS/DB/pgcrypto **not visible in src**.

### 4c. Service role exposure

**Files referencing `SUPABASE_SERVICE_ROLE_KEY` or `createAdminClient`:** (from `rg` during audit)

- `lib/supabase/admin.ts` — defines `createAdminClient`
- **Only under `src/app/api/`**, `src/lib/admin/assertAdmin.ts`, `src/lib/billing/usage.ts`, `src/lib/envCheck.ts`, `src/app/auth/callback/route.ts`

**Client bundle:** These modules are not imported from `"use client"` files except **indirect risk** — `usage.ts` is **server-imported** from API routes only. **Verification:** `createAdminClient` throws if env missing; Next.js tree-shakes server routes from client bundles when not imported.

**`search/route.ts`** uses `createClient(url, serviceKey)` **inline** — still **server-only** (route handler).

### 4d. Storage

**MCP `list_storage_buckets`:** `node-attachments`, **private** (`public: false`), 50MB limit, MIME allowlist.

**RLS:** First path segment must equal `auth.uid()` — **users cannot read/write others’ prefixes** without service role.

**Predictability:** Paths are `{userId}/{filename}` — **not secret URLs**; access controlled by **signed URL or session** when using Supabase client (private bucket).

### 4e. CSRF

Cookie-authenticated POST routes (e.g. `billing`, `stripe`, `profile`, `vaults`, `delete-all-data`) rely on **SameSite cookies** + browser CORS — **no CSRF tokens**. **Risk:** classic CSRF against cookie-auth POST if an attacker induces a cross-site form (mitigated by SameSite=Lax/Strict on modern setups — **verify** Supabase cookie flags in deployment).

### 4f. Rate limiting

**Implementation:** `src/lib/rateLimit.ts` — **in-memory Map**, **not** distributed.

**Routes with `checkRateLimit`:** memory/create, delete-all-data, vaults/create, attachments, kanban/complete, export*, landing-chat, extract-meta, graph-builder, ingest-link, embed, memory-assistant, extract-nodes, search, track.

**Routes without (from grep):** e.g. **`billing/summary`**, **`stripe/checkout`**, **`stripe/portal`**, **`profile/onboarding`**, **`vaults/set-active`**, **all `admin/*`** except indirect — **lower abuse surface** for some, but **LLM-heavy routes are generally rate-limited**; **admin** relies on **assertAdmin** only.

### 4g. Input validation

- **Zod:** `memory/create`, `profile/onboarding`, and others per `lib/validation/schemas.ts` (not fully enumerated here — **grep** `safeParse` / `Schema` in `src/app/api`).
- **Manual:** Many routes trim strings and check types inline (e.g. `track`, `attachments`).

### 4h. `api/user/delete-all-data`

Covered in §2b + file read: deletes from **`user_events`, `pending_proposals`, `node_attachments`, `node_history`, `node_edges`, `memory_nodes`, `canvas_vaults`, `canvases`, `category_vaults`**, **`user_monthly_usage`**, storage **`node-attachments`**, re-seeds vaults. **Does not delete** `profiles`, `subscriptions`, `auth.users` — documented in file header.

### 4i. SQL injection

**No raw string-built SQL in app code**; Supabase client + RPC with typed args. **`increment_usage`** uses parameters — safe.

### 4j. Secrets in repo

**Grep:** no hardcoded `sk_live`, `sk_test`, literal API keys in `src/` (pattern scan in audit). **`.env.local`** is gitignored (`.gitignore` lines 33–36).

---

## SECTION 5 — API Routes (table)

| Route | Methods | Auth | Validation | Supabase client | Error handling | Rate limit | Issues |
|-------|---------|------|------------|-----------------|----------------|------------|--------|
| `/api/memory/create` | POST | Bearer + `getUser(token)` | Zod | User bearer + admin for events | try/catch + logs | 60/min | OK |
| `/api/user/delete-all-data` | POST | Cookie | `confirm === "DELETE"` | Admin | try/catch | 3/min | OK |
| `/api/vaults/create` | POST | Cookie | Manual + DB | Server + admin | try/catch | 20/min | OK |
| `/api/attachments` | POST | Bearer | Manual | User bearer | try/catch | 30/min | OK |
| `/api/kanban/complete` | POST | Cookie | Manual | Admin | try/catch | 20/min | OK |
| `/api/export/strip-pii` | POST | Cookie | Manual | — | try/catch | 10/min | OK |
| `/api/export/share` | POST | Cookie | Manual | Service key for URL | try/catch | 10/min | OK |
| `/api/export` | POST | Bearer/cookie hybrid in implementation | Manual | Service | try/catch | 10/min | OK |
| `/api/nodes/create-file` | POST | Cookie | Manual | Admin | try/catch | (see route) | OK |
| `/api/admin/stats` | GET | `assertAdmin` | N/A | Admin | implicit | No | OK |
| `/api/admin/analytics/funnel` | GET | `assertAdmin` | Query days | Admin | errors returned | No | Funnel semantics (§7e) |
| `/api/landing-chat` | POST | None (IP rate limit) | Manual | — | try/catch | 5/min | Public LLM cost |
| `/api/attachments/extract-meta` | POST | Cookie | Manual | — | try/catch | 10/min | OK |
| `/api/graph-builder` | POST | Cookie | Manual | — | try/catch | 10/min | OK |
| `/api/ingest-link` | POST | Cookie | Manual | Admin | try/catch | 10/min | OK |
| `/api/embed` | POST | Cookie | Manual | Admin | try/catch | 30/min | OK |
| `/api/admin/users/[id]` | GET | `assertAdmin` | N/A | Admin | errors | No | OK |
| `/api/memory-assistant` | POST | Cookie | Manual | — | try/catch | 20/min | OK |
| `/api/extract-nodes` | POST | Cookie | Manual | — | try/catch | 20/min | OK |
| `/api/search` | POST | Bearer | Manual | Admin for RPC | try/catch | 30/min | Heavy LLM + DB |
| `/api/track` | POST | Cookie (optional) | Loose | Admin | swallow errors | 60/min | Silent fail |
| `/api/admin/users` | GET | `assertAdmin` | Query | Admin | errors | No | OK |
| `/api/admin/activity` | GET | `assertAdmin` | N/A | Admin | errors | No | OK |
| `/api/admin/revenue` | GET | `assertAdmin` | N/A | Admin | errors | No | OK |
| `/api/admin/analytics/feature-usage` | GET | `assertAdmin` | N/A | Admin | errors | No | OK |
| `/api/admin/analytics/overview` | GET | `assertAdmin` | N/A | Admin | errors | No | OK |
| `/api/vaults/set-active` | POST | Cookie | Manual JSON | Admin | try/catch | **No** | Add rate limit |
| `/api/stripe/webhook` | POST | Stripe signature | N/A | Admin | try/catch | No (Stripe) | OK |
| `/api/billing/summary` | GET | Cookie | N/A | Admin | try/catch | **No** | OK |
| `/api/stripe/portal` | POST | Cookie | N/A | Admin | try/catch | **No** | OK |
| `/api/stripe/checkout` | POST | Cookie | N/A | Admin | try/catch | **No** | OK |
| `/api/profile/onboarding` | PATCH | Cookie | Zod | Server | try/catch | **No** | OK |

**Notes:** `/api/track` swallows all errors and returns 200 — **by design** but can hide DB failures.

---

## SECTION 6 — Frontend

### 6a. SSR safety

**Method:** `rg` for `window`, `document`, `localStorage` in `src` (see audit log). Many usages are in **`"use client"`** components or guarded (`typeof window`, `typeof document`).  

**Notable:** `src/lib/theme.ts` guards `window`/`document`. **`src/lib/parseCssColor.ts`** uses `document.createElement` only after `typeof document === "undefined"` check — **safe**.

**Potential SSR hazard if misused:** `parseCssColorToHex6` returns `null` for named colors on server — callers must handle.

### 6b. `useEffect`

**Count:** `rg 'useEffect\\(' memorey/src` → **~60 hooks** across files (see grep output list).  

**ESLint exhaustive-deps warnings:** `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx` — **stale closure / missing dep risk**.

**Cleanup:** Many listeners register `window.addEventListener` with cleanup; **verify individually** for any missing teardown — spot-check: `LandingHomeClient`, `useKeyboardShortcuts`, `DashboardShell` include cleanup.

### 6c. Zustand stores

| Store | Notes |
|-------|--------|
| `graphStore` | Immer + graphology; comment warns about draft leakage — **race** possible with rapid updates. |
| `vaultStore` | Immer; async vault load — **race** if user switches account without remount (edge). |
| `canvasStore` | RPC `seed_canvas_vaults`; **race** with concurrent canvas create — low frequency. |
| `diffStore` | Complex async; **multiple `console.error` paths** — error UX uneven. |
| `exportPanelStore` | Trivial boolean — **no issue**. |
| `vaultManagerOverlayStore` | Trivial boolean — **no issue**. |

### 6d. Client `fetch`

**Pattern:** Most use `res.ok` checks + toast on error; **network down** → often **silent failure** unless `catch` shows toast — **inconsistent**.

### 6e. Error boundaries

- **`ErrorBoundary`:** Catches **render errors** in children of root layout; logs to console.
- **`global-error.tsx`:** Next.js **root error UI** for critical failures; **does not** catch all errors inside nested server components (Next.js semantics).

**Missed:** Event handlers, async errors, server-side errors (not in client tree).

### 6f–6h. Loading / empty / forms

**Loading:** Several routes provide `loading.tsx` (kanban, capture, search). Admin pages use client-side fetch skeletons. **Blank states:** Graph and landing are complex — **not fully verified** for every sub-view.

**Forms:** Onboarding uses Zod via API; node forms rely on client constraints + DB checks — **full matrix omitted** — **spot-check:** `profile/onboarding` PATCH uses **Zod** (`onboardingProfilePatchSchema`).

---

## SECTION 7 — Admin Dashboard

### 7a–7b. Queries

- **`admin/stats`:** Multiple count queries + `admin_active_user_counts` RPC — **O(n)** table scans on large tables for `count(*)` — **will slow** at scale.
- **`admin_funnel_metrics`:** Mixed **global** counts vs **`p_since`** window — see §7e.

### 7c. Frontend completeness

**AdminLayoutClient** provides loading skeleton and error paths via redirect/toast. Individual pages (users, analytics, revenue) use client-side data fetching — **verify each** for empty states — **partially verified** during file reads.

### 7d. Access control

Covered §3e — **skeleton gate** prevents data flash.

### 7e. Data accuracy / funnel

**From SQL (MCP) `admin_funnel_metrics`:**

- `total_signups` = **COUNT(\*) from profiles** — **not filtered by `p_since`**.
- `completed_onboarding` — **not filtered by `p_since`**.
- `created_at_least_one_node` — **distinct users with active nodes** — **not time-windowed in SQL**.
- `used_search` / `used_capture` — **use `p_since`** on `user_events`.
- `active_last_7_days_rolling` — **explicitly not filtered by `p_since`** (comment in SQL).
- `upgraded_to_pro` — `COUNT(*)` from `subscriptions` where `plan <> 'free'` — **not time-windowed**.

**The API accepts `days` but several columns ignore the window — document or fix to avoid misinterpretation.**

---

## SECTION 8 — Analytics

### 8a. Pipeline

`useTrack` → `fetch("/api/track")` → **admin insert** `user_events` + **dedup** last 2s.

**Loss:** Fire-and-forget fetch can drop if tab killed; **duplication** mitigated by client 1s debounce + server 2s dedup.

### 8b. Event coverage

**Labels in** `src/lib/admin/eventLabels.ts` vs **fires:**

- **`node_created`**, **`vault_created`**, **`canvas_created`**, **`export_triggered`**, **`signup_completed`** — fired from API/server (`memory/create`, `vaults/create`, `canvasStore`, `ExportPanel`, `auth/callback`).
- **Client `track`:** `edge_created`, `kanban_status_changed`, `onboarding_*`, `page_view`, `node_edited`, `attachment_*`, `capture_*`, `search_performed` — grep `track("` in `src/`.

**Mismatch:** Labels include **`signup_completed`** as “Completed signup” but event is fired at **OAuth callback** — naming may imply **onboarding** completion incorrectly.

### 8c. Rate limit

`track` — **60/min per user** — sufficient for normal use; **spam** still inserts until limit; **in-memory** limiter **not** global across instances.

### 8d. Privacy

**Delete-all-data** removes **`user_events`** for user — **verified** in route. **Account deletion** (auth user) **not** implemented in delete-all — **documented in route header**.

---

## SECTION 9 — Performance & Scalability

### 9a. Expensive queries

1. Admin global `count(*)` on `memory_nodes`, `node_edges`, `profiles`.
2. `search_nodes` vector + optional Claude follow-up.
3. Full graph load client-side — **no virtualization** in graph (product constraint).

### 9b. Bundle

**Heavy:** `react-force-graph-2d`, `recharts`, `lucide-react` — consider **dynamic import** for admin and graph.

### 9c. Canvas / graph

No virtualization — **node limit** depends on device; **estimate:** low thousands degrades UX.

### 9d. Serverless timeouts

LLM routes (`search`, `ingest-link`, `graph-builder`, `kanban/complete`) may approach limits on cold start + long model calls.

### 9e. DB connections

Each request creates short-lived clients — **Supabase pool** handles; under burst, **serverless concurrency** matters.

### 9f. Storage growth

**50MB/file** cap; per-user folder — growth **linear** in uploads.

---

## SECTION 10 — Edge Cases & Reliability

### 10a. External dependency down

- **Supabase down:** Auth and data fail — errors surface in UI.
- **Anthropic/OpenAI down:** API routes return 5xx or structured errors — user sees toast/error.
- **Stripe down:** Checkout/portal fail — user sees error toast.

### 10b. Concurrency

Two tabs editing same node — **last write wins** at DB level; **no OT**.

### 10c. Session expiry

Supabase client refresh — if fails, **401** on API; UX depends on caller.

### 10d. Browser compatibility

**Target ES2017** (`tsconfig`); modern CSS variables — **legacy IE unsupported** (expected).

### 10e. Plan limits

Enforced in **`memory/create`**, **`search`**, billing summary display — users **see** limits in settings.

---

## SECTION 11 — Accessibility

**Method:** Spot-check + grep for `aria-` — not exhaustive for every control.

- **Gaps:** Graph/canvas **mouse-first**; some icon-only buttons may lack **`aria-label`** — **full audit not completed** (would require per-component review).

### 11b. Keyboard

**Many** shortcuts in `useKeyboardShortcuts`; **graph drag** is pointer-centric.

### 11c. Contrast

Dark theme + vault colors — **not systematically measured**; **risk** on custom vault colors.

### 11d. Screen reader

Dynamic graph updates — **limited live regions**; **not fully audited**.

---

## SECTION 12 — Mobile Responsiveness

**Method:** Code review of Tailwind breakpoints (`sm:`, `md:`, `lg:`) in key pages — **not** device-tested in this audit.

- **Landing / dashboard / graph:** Responsive classes present in many components; **graph** on **375px** likely **cramped** — **high risk** for primary UX.

---

## SECTION 13 — Summary & Fix Priority

### Table 1 — Critical

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| **Production build fails** — `increment_usage` missing from generated `Database` types | `src/lib/billing/usage.ts:50,61` + `database.types.ts` | Regenerate Supabase types **or** add `increment_usage` to `Functions` manually; run `tsc`/`build` | **Small** |
| **Same** — blocks CI/CD | `npm run build` | Same | **Small** |

### Table 2 — High

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Funnel metrics **`days`** parameter misleading — several columns ignore time window | `admin_funnel_metrics` SQL + `src/app/api/admin/analytics/funnel/route.ts` | Align SQL with API contract or document | **Medium** |
| BYOK columns **`_enc`** with **no app encryption** | DB schema + `database.types.ts` | Remove columns, implement real crypto, or rename | **Medium** |
| **Rate limiter** is in-process only | `src/lib/rateLimit.ts` | Redis or edge limiter for production | **Large** |
| **`as never` bridges** around `mapNodeRow` | Multiple graph files | Improve `MemoryNode`/`Row` types | **Medium** |

### Table 3 — Medium

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Orphaned RPC **`get_connected_nodes`** | DB vs `src/` | Remove or wire up graph feature | **Small** |
| **`/api/vaults/set-active`** no rate limit | route file | Add `checkRateLimit` | **Small** |
| ESLint **exhaustive-deps** warnings | `MemoryGraph.tsx`, etc. | Fix deps or refactor | **Medium** |
| **`@next/next/no-img-element`** warnings | AttachPanel, etc. | `next/image` where appropriate | **Small** |

### Table 4 — Low

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Unused placeholder params | `urlValidation.ts:16` | Remove or eslint ignore | **Small** |
| Console noise in **`diffStore` / useDiff** | various | Gate logs | **Small** |

---

## Production readiness

**Is this codebase ready to deploy for real users, assuming critical and high issues are addressed first?**

**NO** — as of this audit, **`npx tsc --noEmit` and `npm run build` fail** on `increment_usage` typing (§1a). After fixing generated types and confirming a green build, reassess.

---

*End of FINAL_AUDIT_6.md*
