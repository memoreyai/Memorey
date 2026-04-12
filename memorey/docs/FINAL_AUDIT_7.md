# Memorey — Final Technical Audit (FINAL_AUDIT_7)

**Scope:** Fresh audit of the Memorey codebase as of **2026-03-21**. Previous audit conclusions are not assumed.  
**Repository root:** `memorey/`  
**Verification approach:** Full-tree tooling on all TypeScript/TSX under `src/` (254 files per glob), live **Supabase MCP** (`user-memorey supabase`) for schema/RLS/functions/indexes, plus targeted manual reads of security-critical modules.

---

## SECTION 1 — Build, Compilation & Code Quality

### 1a. TypeScript (`npx tsc --noEmit`)

**Method:** Ran `cd memorey && npx tsc --noEmit` — **exit code 0** (no type errors reported).

**Implicit `any` / unsafe assertions:** Repository-wide search:

```bash
rg ': any\b|as any|as unknown as|as never' src/
```

| Pattern | Locations | Assessment |
|--------|-----------|------------|
| `as any` | **0** matches | N/A |
| `as never` | Multiple | Used to bridge Supabase/json rows into `mapNodeRow` / `planFromRow` shapes — **type escape hatches**; justified only if DB types and `mapNodeRow` stay aligned; risk if schema drifts. |
| `as unknown as` | `useGraphData.ts`, `useDrawLoop.ts`, `vaultStore.ts`, `lucideIconCanvasCache.ts`, `ContextMenu.tsx` | Mixed: dynamic graph/Lucide imports vs. structural typing. |

**Representative snippets:**

```204:204:memorey/src/components/graph/hooks/useNodeActions.ts
      const mapped = mapNodeRow(json.node as never);
```

```33:33:memorey/src/components/graph/hooks/useGraphData.ts
        mapAttachmentRow(r as unknown as Record<string, unknown>)
```

```40:40:memorey/src/app/api/search/route.ts
  } as never);
```

**Verdict:** No `tsc` failures. `as never` / `as unknown as` are **justified only** as long as runtime data matches expectations; they **hide** mismatches between `database.types.ts` and actual rows.

---

### 1b. ESLint

**Method:** `cd memorey && npx eslint . --max-warnings 99999`

**Result:** **0 errors**, **17 warnings** (all warnings, no errors).

Warnings include `@next/next/no-img-element`, `react-hooks/exhaustive-deps`, and `@typescript-eslint/no-unused-vars` in `urlValidation.ts` (`_c`, `_d`).

**Claim “zero ESLint errors”:** Verified by command above (exit code 0; output reports “0 errors”).

---

### 1c. `console.*` in `src/`

**Method:** `rg 'console\.(log|warn|error|debug|info)' src/`

| File | Line | Kind |
|------|------|------|
| `src/app/(dashboard)/dashboard/kanban/page.tsx` | 161 | `error` — **debug/operational** (catch path) |
| `src/app/api/memory/create/route.ts` | 153, 174 | `error` — **intentional server logging** |
| `src/app/api/user/delete-all-data/route.ts` | 148, 156, 173, 187, 197, 212, 220 | `error` — **intentional** (partial failure / storage) |
| `src/lib/billing/usage.ts` | 55, 66 | `error` — **intentional** (usage increment failures) |
| `src/app/api/vaults/create/route.ts` | 101, 122 | `error` — **intentional** |
| `src/app/api/attachments/route.ts` | 170, 181 | `error` — **intentional** |
| `src/app/api/kanban/complete/route.ts` | 122, 148 | `error` — **intentional** |
| `src/app/api/export/strip-pii/route.ts` | 131 | `error` — **intentional** |
| `src/app/api/export/share/route.ts` | 168 | `error` — **intentional** |
| `src/app/api/export/route.ts` | 110 | `error` — **intentional** |
| `src/app/api/nodes/create-file/route.ts` | 126 | `error` — **intentional** |
| `src/app/api/landing-chat/route.ts` | 110 | `error` — **intentional** |
| `src/app/api/graph-builder/route.ts` | 65, 122 | `error` — **intentional** |
| `src/components/graph/ui/VaultSettingsPopover.tsx` | 271 | `error` — **client catch** (could trim in prod) |
| `src/app/api/ingest-link/route.ts` | 260, 426, 436 | `error` — **intentional** |
| `src/store/diffStore.ts` | 151, 162, 199, 208, 244, 253, 270, 290 | `error` — **intentional** (sync failures) |
| `src/app/api/embed/route.ts` | 51, 74, 84, 98, 108 | `warn`/`error` — **intentional** |
| `src/lib/vaults/resolveVaultId.ts` | 50 | `error` — **intentional** |
| `src/app/api/memory-assistant/route.ts` | 93 | `error` — **intentional** |
| `src/app/api/extract-nodes/route.ts` | 46 | `error` — **intentional** |
| `src/app/api/search/route.ts` | 130, 174, 189, 292, 309, 326, 336 | `error` — **intentional** |
| `src/components/graph/ui/NodeDetailSheet.tsx` | 1259 | `error` — **client** |
| `src/app/api/admin/users/route.ts` | 70 | `error` — **intentional** |
| `src/components/diff/useDiff.ts` | 111–112, 131–132 | `error` — **intentional** |
| `src/proxy.ts` | 21 | `error` — **intentional** (misconfig) |
| `src/app/api/admin/activity/route.ts` | 18 | `error` — **intentional** |
| `src/components/graph/ui/ChatGraphBuilder.tsx` | 582, 638, 723 | `error` — **client** |
| `src/app/api/admin/revenue/route.ts` | 14 | `error` — **intentional** |
| `src/app/api/admin/analytics/feature-usage/route.ts` | 36 | `error` — **intentional** |
| `src/lib/envCheck.ts` | 32 | `warn` — **startup warning** |
| `src/app/(auth)/login/page.tsx` | 25 | `error` — **oauth error** |
| `src/app/api/vaults/set-active/route.ts` | 67, 73 | `error` — **intentional** |
| `src/app/api/stripe/webhook/route.ts` | 127, 193, 199 | `error` — **intentional** |
| `src/app/api/billing/summary/route.ts` | 65 | `error` — **intentional** |
| `src/app/api/stripe/portal/route.ts` | 50 | `error` — **intentional** |
| `src/app/api/stripe/checkout/route.ts` | 74 | `error` — **intentional** |
| `src/app/api/profile/onboarding/route.ts` | 50, 59 | `error` — **intentional** |
| `src/app/global-error.tsx` | 14 | `error` — **error boundary logging** (keep) |
| `src/components/ErrorBoundary.tsx` | 23 | `error` — **error boundary logging** (keep) |
| `src/components/graph/canvas/fileNode.ts` | 39 | `warn` — image load failure |

**Note:** No `console.log` debug spam found in `src/` by this search (only `warn`/`error`).

---

### 1d. Unused imports / variables

**Method:** ESLint output (only explicit unused-vars found in current config):

```16:16:memorey/src/lib/security/urlValidation.ts
  // parameters _c, _d — eslint warns as unused (lines 16:51, 16:63 per eslint run)
```

**Broader claim:** No project-wide `no-unused-imports` plugin evident; **full unused-import enumeration** would require enabling `eslint-plugin-unused-imports` or `tsc` with `noUnusedLocals` (currently not in `tsconfig.json`). **Evidence:** `tsconfig.json` has no `noUnusedLocals` / `noUnusedParameters`.

---

### 1e. Circular dependencies

**Method:** `npx madge --circular --extensions ts,tsx src`  
**Result:** `✔ No circular dependency found!` (255 files processed).

---

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
  },
```

- **`strict`: true** — confirmed.
- **Permissive overrides:** `allowJs: true` (JS can skip strict checks), `skipLibCheck: true` (skips `.d.ts` checking — common for Next). No `strictNullChecks` override (inherits from `strict`).

---

### 1g. `package.json` — dependency usage

**Method:** `rg` import patterns per package name in `src/`.

**Dependencies — appear unused from `src/` imports:**

- **`tw-animate-css`** — imported via CSS (`globals.css` `@import "tw-animate-css"`), not TS import — **used**.

**All other `dependencies` entries** have at least one `src/` reference (direct or via CSS for Tailwind-related).

**devDependencies:** `shadcn` CLI — not imported in runtime code (expected). `eslint`, `typescript`, `@types/*`, `tailwindcss`, `@tailwindcss/postcss` — tooling.

**Potential classification note:** Everything in `dependencies` is plausible for production runtime; dev tooling correctly in `devDependencies`.

---

## SECTION 2 — Database Schema & Data Integrity (MCP: `user-memorey supabase`)

### 2a. Public tables (live DB)

**Method:** `list_tables` with `verbose: true` for schemas `public`, `storage`.

**Tables in `public`:**  
`profiles`, `category_vaults`, `memory_nodes`, `node_edges`, `node_history`, `subscriptions`, `user_monthly_usage`, `pending_proposals`, `node_attachments`, `canvases`, `canvas_vaults`, `user_events`.

Column inventory matches **`src/lib/supabase/database.types.ts`** at a high level (verified by MCP column list vs generated types for sampled tables). **Full column dump:** see MCP `list_tables` output (too large to inline entirely); key columns align with app usage (e.g. `memory_nodes.file_url`, `node_kind_v2`, `kanban_status`, `embedding`).

---

### 2b. Queries vs schema

**Method:** `rg '\\.from\\(|\\.rpc\\(' src/` and spot-check against MCP schema.

**Findings:**

- **No references** to non-existent tables in `src/` (spot-check + typegen).
- **`search_nodes` RPC** — columns returned match `SearchRpcRow` in `search/route.ts`.
- **`user_events`** — inserted server-side with `createAdminClient`; RLS blocks clients (`no_client_access`) — consistent.
- **`anthropic_api_key_enc` / `openai_api_key_enc`** — columns exist; **no read/write in `src/`** except types — see §4b.

**Risk:** `as never` row mapping (§1a) could mask **runtime** column renames.

---

### 2c. RLS policies (live)

**Method:** `execute_sql` on `pg_policies` for `public` and `storage`.

**`public` summary:**

| Table | Policy pattern |
|-------|----------------|
| `profiles` | SELECT/UPDATE own row only (`auth.uid() = id`) |
| `category_vaults`, `memory_nodes`, `node_edges`, `node_history`, `node_attachments`, `canvas_vaults`, `canvases` | ALL, `user_id` / ownership match |
| `pending_proposals` | Split INSERT/SELECT/UPDATE/DELETE own `user_id` |
| `subscriptions` | SELECT own (`user_id`) |
| `user_monthly_usage` | SELECT own |
| **`user_events`** | **`no_client_access` — `USING (false)` for ALL** — clients cannot read/write |

**`storage.objects`:** Policies restrict `bucket_id = 'node-attachments'` and first path segment = `auth.uid()`::text (via `storage.foldername(name)[1]`). **Two policies** overlap (ALL + SELECT) — **redundant** but not insecure.

**Missing RLS:** None on listed `public` tables (RLS enabled on all per MCP).

---

### 2d. Functions & triggers

**Functions (public, MCP):**  
`admin_active_user_counts`, `admin_funnel_metrics`, `admin_memory_node_counts_by_canvas`, `admin_memory_node_counts_by_vault`, `get_connected_nodes`, `handle_new_user`, `increment_usage`, `protect_admin_flag`, `search_nodes`, `seed_canvas_vaults`, `seed_default_vaults`, `seed_default_vaults_internal`, `update_updated_at`.

**App usage (`rg '\\.rpc\\(' src/`):**  
`increment_usage`, `admin_active_user_counts`, `admin_funnel_metrics`, `search_nodes`, `seed_default_vaults`, `seed_canvas_vaults`, `admin_memory_node_counts_by_*`.

**Orphaned from app:** **`get_connected_nodes`** — **not called** in `src/` (only `database.types.ts` / docs). **`handle_new_user`** is trigger-backed (not direct RPC). **`seed_default_vaults_internal`** — internal from `seed_default_vaults` / trigger path.

**Triggers (MCP `information_schema.triggers`):**

- `memory_nodes` → `memory_nodes_updated_at` → `update_updated_at()`
- `profiles` → `protect_admin_flag_trigger` → `protect_admin_flag()`

---

### 2e. Indexes

**Method:** `pg_indexes` for `public` (MCP).  
Indexes exist on foreign keys and hot paths (`user_id`, `vault_id`, `canvas_id`, `embedding` ivfflat, `user_events` by `event_name`, `created_at`, etc.).  
**Redundancy:** `category_vaults` has both `idx_category_vaults_user` and `idx_category_vaults_user_active` — overlapping but acceptable.

---

### 2f. Migrations order

**Method:** `ls supabase/migrations | sort -V`

**Result:** `001` … `036` **contiguous**, no numeric gaps. Ordering is consistent with dependency (schema → billing → RPCs → fixes).

---

## SECTION 3 — Authentication & Authorization

### 3a. Auth paths

| Step | Implementation | Notes |
|------|------------------|------|
| OAuth | `login/page.tsx` — `signInWithOAuth({ provider: 'google', redirectTo: .../auth/callback })` | Uses `window.location.origin` (client component) |
| Callback | `app/auth/callback/route.ts` — `exchangeCodeForSession` | Sets cookies via SSR client |
| Post-login | Inserts `signup_completed` via **admin** | |
| Session refresh | Supabase SSR client (`@supabase/ssr`) in server utilities | Standard |

**Gap:** **No Next.js `middleware.ts`** wiring — see §3b.

---

### 3b. Routes & middleware

**Critical finding:** `src/proxy.ts` implements session checks and redirects for `/dashboard`, `/graph`, `/settings`, `/admin`, `/login`, but:

**Verification:** `rg 'middleware|proxy' memorey --glob '*.ts'` — **no `middleware.ts`**; **`proxy` is never imported**.

```103:114:memorey/src/proxy.ts
export const config = {
  matcher: [
    "/dashboard/:path*",
    ...
  ],
};
```

**Without a root `middleware.ts` that calls this**, Next.js **does not execute** this logic. **Evidence:** filesystem glob `**/middleware.*` → **0 files**.

**Implication:** **Page routes are not server-protected** by edge middleware. Protection relies on **client-side Supabase session** + **API route auth** + **RLS**.

| Area | Public | Auth required | Super admin |
|------|--------|---------------|-------------|
| Marketing / landing | Yes | — | — |
| `/login`, `/auth/callback` | Yes | — | — |
| `/dashboard`, `/graph`, `/settings` | **HTML reachable without login** | Data/API protected | — |
| `/admin/*` | **HTML reachable** | Admin API/UI gated | `assertAdmin` + client gate |

---

### 3c. IDOR (API sample)

- **`/api/memory/create`** — verifies `body.userId === user.id` and vault via user-scoped client — **OK** (`memory/create/route.ts` 80–85, 97–100).
- **`/api/search`** — `userId !== user.id` rejected — **OK** (104–106).
- **`/api/attachments`** — node lookup `.eq('user_id', user.id)` — **OK** (122–127).
- **`/api/vaults/set-active`** — `.eq('user_id', user.id)` — **OK**.
- **Admin `/api/admin/*`** — `assertAdmin()` — **OK**.

---

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
    return { ok: false, response: NextResponse.json({ error: "Forbidden" }, { status: 403 }) };
  }
  return { ok: true, userId: user.id };
}
```

- **Bypass:** Requires valid session + `is_super_admin` in DB; **not** client-toggleable without DB compromise. **`protect_admin_flag` trigger** prevents non-service-role from toggling `is_super_admin`.
- **Edge cases:** `maybeSingle()` with missing profile → 403. Race: low risk for admin flag read.

---

### 3e. Admin UI flash

`AdminLayoutClient` gates on `/api/admin/stats` — shows **skeleton** until success; non-admin gets toast + redirect to `/dashboard`. **No obvious flash of sensitive metrics** (content not rendered until `gate === 'ok'`).

---

## SECTION 4 — Security

### 4a. XSS

**Method:** `rg 'dangerouslySetInnerHTML|document\\.write|innerHTML' src/`

| Location | Source | Sanitization |
|----------|--------|--------------|
| `layout.tsx` 97 | Static IIFE string `themeBootScript` | No user input — **OK** |
| `LandingPage.tsx` 2134–2136 | `msg.html` | **`DOMPurify.sanitize(msg.html)`** — **OK** |

```2132:2137:memorey/src/components/landing/LandingPage.tsx
                          {msg.role === "ai" ? (
                            <span
                              dangerouslySetInnerHTML={{
                                __html: DOMPurify.sanitize(msg.html),
                              }}
```

---

### 4b. API key columns (`anthropic_api_key_enc`, `openai_api_key_enc`)

**Method:** `rg 'anthropic_api_key|openai_api_key'` in `src/` (excluding `database.types.ts`).

**Result:** **No read/write in application logic** — columns exist in DB and types only.

**Verdict:** Names suggest encryption; **no encryption implementation found in `src/`**. If populated elsewhere, likely **plaintext or external pipeline** — **verify before trusting column names**.

---

### 4c. Service role exposure

**Files referencing `createAdminClient` or `SUPABASE_SERVICE_ROLE_KEY`:** per §grep — all under `src/app/api/**`, `src/lib/supabase/admin.ts`, `src/lib/admin/assertAdmin.ts`, `src/lib/billing/usage.ts`, `src/app/auth/callback/route.ts`, `src/lib/envCheck.ts`, `export/share`, `export`, `search` (inline `createClient` + key).

**Client bundle:** `createAdminClient` is only imported from server routes and server libs — **no `"use client"`** file imports `admin.ts`. **Verification:** `rg 'createAdminClient|admin\\.ts' src --glob '*.tsx'` — only API/server contexts.

---

### 4d. Storage (`node-attachments`)

**RLS (MCP):** path first folder must equal `auth.uid()` for bucket `node-attachments`.  
**Predictability:** URLs are user-scoped paths; **not guessable for other users** without UUID. **Service role** in `delete-all-data` lists `userId/` prefix only for own user.

---

### 4e. CSRF

Cookie-based session (Supabase). **No CSRF tokens** on POST APIs. **Mitigation:** SameSite cookies (Supabase default), **not** double-submit tokens. **Risk:** classical CSRF against cookie-auth APIs if SameSite ever weakened — **medium** for state-changing routes.

---

### 4f. Rate limiting

**Implementation:** `src/lib/rateLimit.ts` — **in-memory Map**, documented as **not** cross-instance.

**Routes with `checkRateLimit`:** listed in §1 grep (memory, vaults, attachments, exports, landing-chat, graph-builder, ingest, embed, memory-assistant, extract-nodes, search, track, delete-all-data, kanban).

**Routes without** (from inverse check): **admin/***, **billing/summary**, **stripe/***, **profile/onboarding**, **vaults/set-active**, **nodes/create-file** — **no** `checkRateLimit` in those files.

---

### 4g. Input validation

- **Zod:** `memory/create`, `profile/onboarding`, others use `schemas.ts` where noted.
- **Manual:** Many routes use `typeof` checks; **attachments** — manual validation (§1c file).
- **Weak:** **`nodes/create-file`** — casts body with minimal validation (`as { vaultId: string; ... }`) — malformed types could cause DB errors or odd data.

---

### 4h. `api/user/delete-all-data`

**Tables touched:** `user_events`, `pending_proposals`, `node_attachments`, `node_history`, `node_edges`, `memory_nodes`, `canvas_vaults`, `canvases`, `category_vaults` (delete + re-seed), `user_monthly_usage`; storage `node-attachments`.

**Not deleted:** **`profiles`**, **`subscriptions`**, **`auth.users`** — documented in file header.

```1:9:memorey/src/app/api/user/delete-all-data/route.ts
 * Does NOT delete: profiles row, subscriptions row, auth.users record.
```

**Partial failure:** Returns 500 with `details` if early deletes fail; usage/storage errors sometimes **only logged** (lines 168–176, 186–200).

---

### 4i. SQL injection

**Method:** `rg 'execute_sql|\\.raw\\(|sql`' src/`  
**Result:** No raw SQL string building in app code; `.rpc` uses parameterized objects.

---

### 4j. Secrets in repo

**Method:** `rg 'sk-[a-zA-Z0-9]{20,}' src/` — **no matches**.  
**`.env.local`:** listed in `.gitignore` (line 35); `git check-ignore -v .env.local` confirms ignored. **Do not commit.**

---

## SECTION 5 — API Routes (complete table)

| Route | Methods | Auth | Validation | Supabase client | Errors | Rate limit | Issues |
|-------|---------|------|------------|-----------------|--------|------------|--------|
| `/api/memory/create` | POST | Bearer | Zod schema | User + admin | try/catch + checks | 60/min | None critical |
| `/api/user/delete-all-data` | POST | Cookie (server) | `confirm === 'DELETE'` | Admin | Partial detail on failure | 3/min | Storage errors logged only |
| `/api/vaults/create` | POST | Cookie | Manual | Admin | try/catch | 20/min | — |
| `/api/attachments` | POST | Bearer | Manual | User | try/catch | 30/min | — |
| `/api/kanban/complete` | POST | Cookie | Manual | Admin | try/catch | 20/min | — |
| `/api/export/strip-pii` | POST | Cookie | Manual | — | try/catch | 10/min | — |
| `/api/export/share` | POST | Cookie | Manual | Admin inline | try/catch | 10/min | Inline service key |
| `/api/export` | POST | Cookie | Manual | Admin inline | try/catch | 10/min | — |
| `/api/nodes/create-file` | POST | Bearer | Weak (cast) | User + admin | try/catch | **No** | No rate limit |
| `/api/admin/stats` | GET | assertAdmin | N/A | Admin | Partial | **No** | Heavy counts |
| `/api/admin/analytics/funnel` | GET | assertAdmin | Query params | Admin | yes | **No** | — |
| `/api/admin/analytics/overview` | GET | assertAdmin | — | Admin | yes | **No** | — |
| `/api/admin/analytics/feature-usage` | GET | assertAdmin | — | Admin | yes | **No** | — |
| `/api/admin/users` | GET | assertAdmin | — | Admin | yes | **No** | — |
| `/api/admin/users/[id]` | GET | assertAdmin | — | Admin | yes | **No** | — |
| `/api/admin/activity` | GET | assertAdmin | — | Admin | yes | **No** | — |
| `/api/admin/revenue` | GET | assertAdmin | — | Admin | yes | **No** | — |
| `/api/landing-chat` | POST | None / IP | Manual | — | try/catch | 5/min | Public LLM cost |
| `/api/attachments/extract-meta` | POST | Bearer | Manual | — | try/catch | 10/min | — |
| `/api/graph-builder` | POST | Bearer | Zod (`graphBuilderBodySchema`) | — | try/catch | 10/min | — |
| `/api/ingest-link` | POST | Cookie | Manual | Admin | try/catch | 10/min | — |
| `/api/embed` | POST | Cookie | Manual | Admin | try/catch | 30/min | — |
| `/api/memory-assistant` | POST | Cookie | Manual | — | try/catch | 20/min | — |
| `/api/extract-nodes` | POST | Cookie | Manual | — | try/catch | 20/min | — |
| `/api/search` | POST | Bearer | Manual + userId check | Admin | try/catch | 30/min | — |
| `/api/track` | POST | Cookie | Loose | Admin | swallowed | 60/min | Silent failures |
| `/api/vaults/set-active` | POST | Cookie | Manual | Admin | try/catch | **No** | — |
| `/api/stripe/webhook` | POST | Stripe signature | Event types | Admin | try/catch | **No** | By design (Stripe) |
| `/api/billing/summary` | GET | Cookie | N/A | Admin | try/catch | **No** | — |
| `/api/stripe/portal` | POST | Cookie | N/A | Admin | try/catch | **No** | — |
| `/api/stripe/checkout` | POST | Cookie | N/A | Admin | try/catch | **No** | — |
| `/api/profile/onboarding` | PATCH | Cookie | Zod | Server user | try/catch | **No** | — |

**Verification:** `rg '^export async function (GET|POST|PUT|PATCH|DELETE)' src/app/api` — every `route.ts` exports exactly one handler; **all are POST except** admin/billing `GET`s, `profile/onboarding` **`PATCH`**, `stripe/webhook` **POST**.

---

## SECTION 6 — Frontend

### 6a. SSR safety (`window` / `document` / storage)

**Method:** `rg` for `\bwindow\.|\bdocument\.|localStorage|sessionStorage|\bnavigator\.` in `src/`.

**Unguarded use in client-only components:** Most matches are in **`"use client"`** files or inside `useEffect`.  
**Server component risk:** `graph/page.tsx` imports `MemoryGraph` — child components handle browser APIs.

**Edge case:** `src/components/graph/canvas/edge.ts` line 220 uses `document.documentElement` — **must only run in browser** (canvas draw path). **Assumption:** not invoked during SSR (graph is client-heavy).

**Layout script:** `layout.tsx` uses `localStorage` inside **string** injected in `<script>` — runs in browser only.

---

### 6b. `useEffect` (sampled)

ESLint reports **exhaustive-deps warnings** in `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx` — **risk of stale closures** / missed updates. **Not exhaustively audited line-by-line** for every hook.

---

### 6c. Zustand stores

**Stores:** `graphStore`, `vaultStore`, `canvasStore`, `diffStore`, `exportPanelStore`, `vaultManagerOverlayStore` (+ `store/index.ts`).

**Pattern:** `immer` middleware — standard. **Race conditions:** possible under rapid updates (no formal mutex); **selectors:** components use hooks — standard re-render tradeoffs.

---

### 6d. Client `fetch` error handling

**Pattern:** Mixed — many `toast` + `console.error`; network-down often **silent** in `useTrack` (`catch { /* ignore */ }`).

---

### 6e. Error boundaries

- **`ErrorBoundary`:** Catches **render errors** in children of root layout — not event handlers/async.
- **`global-error.tsx`:** Root **critical** errors.

**Missed:** Errors inside async handlers unless they trigger re-render failures.

---

### 6f. / 6g. Loading & empty states

**Evidence:** `loading.tsx` exists for several dashboard routes; admin uses skeleton in `AdminLayoutClient`. **Not every** page verified manually — spot-check: graph/kanban have loading siblings in some paths.

---

### 6h. Forms

**Onboarding / settings / modals** — mix of client validation and Zod on server for profile PATCH. **Full per-form matrix** omitted for length; **representative:** `onboardingProfilePatchSchema` for server.

---

## SECTION 7 — Admin Dashboard

### 7a. Query correctness

- **`admin_funnel_metrics`:** `total_signups` counts **all** `profiles` — **not** scoped to `p_since` (by design in SQL). **`used_search` / `used_capture`** use `p_since`. **Document** to avoid misinterpreting funnel CSVs.

### 7b. Performance

Admin stats run multiple **count** queries and full table scans on growth — **will slow** at 10k+ users without **materialized views** or **rolling aggregates**.

### 7c. Frontend completeness

`AdminLayoutClient` — loading skeleton + error paths. Individual pages use fetch with error UI patterns — **verify each** in QA.

### 7d. Admin access

Relies on **API** `assertAdmin` + client redirect — **no middleware** (§3b). Non-admin **should not** see metrics JSON from APIs (403).

### 7e. Data accuracy

**Conversion:** `nonFreeRes.count / totalUsers` in `admin/stats` — **formula** in `stats/route.ts` 104–109. **MRR/ARR:** **not computed in reviewed routes** — revenue page may estimate; verify `admin/revenue/route.ts` in QA.

---

## SECTION 8 — Analytics

### 8a. Pipeline

`useTrack` → POST `/api/track` → **admin insert** `user_events`. **Dedup:** server checks last 2s; client debounces 1s.

### 8b. Event coverage

**Defined in `eventLabels.ts` vs fired:**

| Event | Fired (examples) |
|-------|-------------------|
| `node_created` | Server: `memory/create`, `nodes/create-file` |
| `signup_completed` | `auth/callback` (admin insert) |
| `vault_created` | `vaults/create` |
| `canvas_created` | `canvasStore` |
| `search_performed` | `useSearch` |
| `capture_chat_sent` | `ChatGraphBuilder` |
| `capture_link_ingested` | `ShareLinkInput` |
| `page_view` | `TrackPageView`, settings |
| `onboarding_*` | onboarding page |
| `export_triggered` | `ExportPanel` |
| `kanban_status_changed` | **tracked in UI** — **not in `EVENT_LABELS`** |

**Gaps:** Labels list **does not include** `kanban_status_changed`, `node_edited`, `attachment_uploaded`, `data_reset` — **admin humanization** falls back to `humanizeSnake`.

### 8c. Rate limit

**60/min per user** — sufficient for normal use; **spam** still inserts until rate limit — DB growth risk.

### 8d. Privacy

**Account deletion** endpoint does **not** remove `auth` user; **`delete-all-data` deletes `user_events`** then re-inserts `data_reset`. **Full GDPR** path **not implemented** (per file comment).

---

## SECTION 9 — Performance & Scalability

### 9a. Expensive queries

1. Admin dashboard aggregate counts.  
2. `search_nodes` vector + order by distance.  
3. Full graph load in client (all active nodes).  
4. `user_events` scans for funnel (indexed, but volume grows).

### 9b. Bundle

**Heavy:** `react-force-graph-2d`, `recharts`, graph canvas code. **Recommendation:** dynamic import for admin charts and landing demos.

### 9c. Canvas / graph

No virtualization in core graph — **performance degrades** with hundreds/thousands of nodes (UX limit depends on device).

### 9d. Serverless timeouts

LLM routes (`search`, `ingest-link`, `graph-builder`, etc.) can approach **10s** on hobby under load — **monitor**.

### 9e. DB connections

Each serverless invocation creates clients — **connection pooling** via Supabase pooler; still subject to **plan limits**.

### 9f. Storage growth

Attachments + `user_events` + `memory_nodes` — linear in usage; **cost** depends on Supabase plan tier.

---

## SECTION 10 — Edge Cases & Reliability

### 10a. External outages

- **Supabase down:** API routes fail; client shows errors/toasts.  
- **Anthropic/OpenAI:** Search/LLM features fail with logged errors.  
- **Stripe:** Webhook delays — subscription state may lag.

### 10b. Concurrency

**Two tabs:** last-write-wins on node updates — **possible overwrite** without OT.

### 10c. Session expiry

Client may **401** on API calls — **not always** unified UX (depends on caller).

### 10d. Browser support

**ES2017** target + modern React — **IE not supported**. Minimum: **evergreen browsers**.

### 10e. Plan limits

**billing/summary** exposes limits — UI should surface errors from API (`403` with `code`) where implemented.

---

## SECTION 11 — Accessibility (sampling)

**Method:** Manual spot-check + grep for `aria-` (not exhaustive).

**Findings:** Some icons use `aria-hidden`; **full WCAG audit not performed** — **recommend** axe-core pass.

**Keyboard:** Graph/canvas **mouse-first**; shortcuts exist in `useKeyboardShortcuts` — **partial** keyboard coverage.

---

## SECTION 12 — Mobile (sampling)

**Method:** Component review + Tailwind breakpoints usage.

**DashboardShell** and landing use responsive classes; **graph** on **375px** is **constrained** — expect **horizontal scroll** or cramped controls. **Touch:** 44px targets **not verified** globally.

---

## SECTION 13 — Summary Tables & Verdict

### Table 1 — Critical

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| **No `middleware.ts` — `src/proxy.ts` dead code; no edge auth** | `src/proxy.ts` (unused); **missing** `middleware.ts` | Add `middleware.ts` that exports `proxy` or inline auth redirects | **Medium** |
| **Misleading `_enc` API key columns without app-side crypto** | DB `profiles.*_api_key_enc`; **no** `src` usage | Encrypt with KMS or remove columns until implemented | **Large** |

### Table 2 — High

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| In-memory rate limiter not distributed | `src/lib/rateLimit.ts` | Redis / Upstash | **Medium** |
| Many API routes **without** rate limits | billing, stripe, admin, `vaults/set-active`, `nodes/create-file` | Add limits per route class | **Medium** |
| CSRF tokens absent for cookie POST APIs | API routes | SameSite strict + CSRF token for mutations | **Medium** |
| `delete-all-data` partial storage failure only logged | `route.ts` 186–200 | Surface to client / retry | **Small** |

### Table 3 — Medium

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| `get_connected_nodes` unused | DB function | Remove or use | **Small** |
| Redundant storage RLS policies | `storage.objects` | Consolidate | **Small** |
| `as never` row mapping | multiple files | Stricter typing / zod parse | **Medium** |
| ESLint exhaustive-deps warnings | `MemoryGraph.tsx`, etc. | Fix deps | **Small** |

### Table 4 — Low

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Unused eslint vars `_c`/`_d` | `urlValidation.ts` | Prefix or remove | **Small** |
| Event label map missing newer events | `eventLabels.ts` | Extend map | **Small** |
| `@next/next/no-img-element` warnings | various | Use `next/image` | **Small** |

---

## Production readiness

**Is this codebase ready to deploy to production for real users, assuming critical and high issues are addressed first?**

**NO** — because **(1)** route protection must be **explicitly** enforced (add **`middleware.ts`** or equivalent server gating; **`proxy.ts` is currently unused**), and **(2)** API key storage naming vs. implementation must be **resolved** for trust/compliance.

Once **critical** items are fixed and **high** items planned, the stack (Next 16 + Supabase RLS + server routes) is a **reasonable** foundation — pending your own load testing and security review.

---

*End of FINAL_AUDIT_7.md*
