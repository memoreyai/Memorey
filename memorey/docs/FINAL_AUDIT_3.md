# Memorey — Final Technical Audit (FINAL_AUDIT_3)

**Scope:** Fresh audit of the Memorey codebase as of the audit date. Evidence-based: issues cite file paths, line numbers, and snippets. Supabase **live project** schema, RLS, indexes, and functions were verified via the **Memorey Supabase MCP** (`list_tables` verbose, `execute_sql`). Local verification: `npx tsc --noEmit`, `npx eslint .`, `npx madge --circular`, `npm run build`.

**Repository root configs reviewed:** `package.json`, `package-lock.json`, `tsconfig.json`, `next.config.ts`, `eslint.config.mjs`, `.gitignore`, `.env.local.example` (`.env.local` is gitignored per `.gitignore` — not assumed committed).

---

## SECTION 1 — Build, Compilation & Code Quality

### 1a. TypeScript (`npx tsc --noEmit`)

**Result:** Exit code **0** — no type errors reported.

**Verification:** Command run in `/memorey`: `npx tsc --noEmit` (2025-03-21).

**Unsafe / narrowing assertions found** (grep: `as any`, `as unknown as`, `as never` in `src/`):

| File | Line | Snippet | Assessment |
|------|------|---------|------------|
| `src/store/diffStore.ts` | 257, 298 | `rowToMemoryNode(data as never, ...)` | **Workaround** — bridges Supabase row shape to `mapNodeRow`; risk if DB shape drifts. |
| `src/app/api/admin/users/[id]/route.ts` | 168 | `plan: planFromRow(profile as never)` | **Workaround** — nested join typing. |
| `src/app/api/search/route.ts` | 40 | `} as never);` in `mapNodeRow` wrapper | **Workaround** — same pattern. |
| `src/app/api/admin/users/route.ts` | 79, 148 | `planFromRow(p as never)` | **Workaround**. |
| `src/components/graph/hooks/useNodeActions.ts` | 185 | `mapNodeRow(data as never)` | **Workaround**. |
| `src/components/graph/MemoryGraph.tsx` | 325, 370 | `mapNodeRow(savedRow as never)` | **Workaround**. |
| `src/components/graph/hooks/useMemoryGraphChromeProps.ts` | 141 | `mapNodeRow(saved as never)` | **Workaround**. |
| `src/components/graph/hooks/useGraphData.ts` | 33 | `mapAttachmentRow(r as unknown as Record<string, unknown>)` | **Workaround**. |
| `src/components/graph/hooks/useDrawLoop.ts` | 314 | `node as unknown as MemoryNode` | **Justified** — canvas draw path narrows union. |
| `src/store/vaultStore.ts` | 104 | `(data ?? []) as unknown as { category_vaults?: ... }[]` | **Workaround** — nested query typing. |
| `src/lib/lucideIconCanvasCache.ts` | 44 | `(await import("lucide-react")) as unknown as Record<...>` | **Workaround** — dynamic import typing. |
| `src/components/graph/ui/ContextMenu.tsx` | 29, 64 | `as unknown as MemoryNode` | **Workaround** — menu node typing. |

**Implicit `any`:** None found by `tsc` under `strict: true` (see 1f).

### 1b. ESLint

**Result:** **0 errors**, **17 warnings** (all warnings, no errors).

**Verification:** `npx eslint . --max-warnings 999999` in `/memorey`.

Warnings include `@next/next/no-img-element`, `react-hooks/exhaustive-deps`, and `@typescript-eslint/no-unused-vars` in `src/lib/security/urlValidation.ts` (unused parameters `c`, `d` on line 16).

### 1c. `console.*` in `src/`

**Verification:** `rg 'console\.(log|warn|error|debug|info)' src/` (ripgrep).

| File | Line | Kind |
|------|------|------|
| `src/app/api/user/delete-all-data/route.ts` | 69, 143, 151, 168, 182, 192, 207, 215 | **Keep** — operational / error logging for destructive op |
| `src/app/api/landing-chat/route.ts` | 110 | **Keep** — route error |
| `src/app/api/graph-builder/route.ts` | 65, 122 | **Keep** — config / error |
| `src/components/graph/ui/VaultSettingsPopover.tsx` | 271 | **Debug leftover** — client `console.error(e)` on failure; consider user toast only |
| `src/app/api/ingest-link/route.ts` | 260, 426, 436 | **Keep** — billing / usage / route errors |
| `src/store/diffStore.ts` | 151, 162, 199, 208, 244, 253, 270, 290 | **Mixed** — mostly **debug-style** error logs in client store; consider removing or gating `NODE_ENV` |
| `src/app/api/embed/route.ts` | 51, 74, 84, 98, 108 | **Keep** — warn/error for embedding pipeline |
| `src/lib/vaults/resolveVaultId.ts` | 50 | **Debug leftover** — noisy for production |
| `src/app/api/memory-assistant/route.ts` | 93 | **Keep** |
| `src/app/api/extract-nodes/route.ts` | 46 | **Keep** |
| `src/app/api/search/route.ts` | 130, 174, 189, 292, 309, 326, 336 | **Keep** |
| `src/app/(dashboard)/dashboard/kanban/page.tsx` | 161 | **Debug leftover** |
| `src/components/graph/ui/NodeDetailSheet.tsx` | 1259 | **Keep** — catch path (could add toast) |
| `src/app/api/admin/users/route.ts` | 70 | **Keep** |
| `src/components/diff/useDiff.ts` | 111–112, 131–132 | **Debug leftover** — logs user id + error |
| `src/proxy.ts` | 21 | **Keep** — misconfiguration |
| `src/app/api/admin/activity/route.ts` | 18 | **Keep** |
| `src/components/graph/ui/ChatGraphBuilder.tsx` | 582, 638, 723 | **Mixed** — **debug leftover** unless you want server-like logging in client |
| `src/app/api/vaults/create/route.ts` | 93, 114 | **Keep** |
| `src/app/api/nodes/create-file/route.ts` | 111 | **Keep** |
| `src/app/api/memory/create/route.ts` | 144, 165 | **Keep** |
| `src/app/api/admin/revenue/route.ts` | 14 | **Keep** |
| `src/app/api/admin/analytics/feature-usage/route.ts` | 36 | **Keep** |
| `src/lib/envCheck.ts` | 32 | **Keep** — startup warning |
| `src/app/(auth)/login/page.tsx` | 25 | **Keep** — OAuth error |
| `src/app/api/vaults/set-active/route.ts` | 67, 73 | **Keep** |
| `src/app/api/export/strip-pii/route.ts` | 123 | **Keep** |
| `src/app/api/export/share/route.ts` | 160 | **Keep** |
| `src/app/api/stripe/webhook/route.ts` | 127, 193, 199 | **Keep** |
| `src/app/api/export/route.ts` | 102 | **Keep** |
| `src/app/api/billing/summary/route.ts` | 65 | **Keep** |
| `src/app/api/stripe/portal/route.ts` | 50 | **Keep** |
| `src/app/api/stripe/checkout/route.ts` | 74 | **Keep** |
| `src/app/api/kanban/complete/route.ts` | 114, 140 | **Keep** |
| `src/app/api/profile/onboarding/route.ts` | 50, 59 | **Keep** |
| `src/app/global-error.tsx` | 14 | **Keep** — error boundary logging |
| `src/components/ErrorBoundary.tsx` | 23 | **Keep** — error boundary |
| `src/components/graph/canvas/fileNode.ts` | 39 | **Keep** — image load |
| `src/app/api/attachments/route.ts` | 162, 173 | **Keep** |

**No `console.log` in `src/`** for production debug traces was found; **`console.error` / `console.warn` dominate.**

### 1d. Unused imports / variables

**ESLint** reported unused vars only in:

```16:16:memorey/src/lib/security/urlValidation.ts
// ... destructuring includes `c` and `d` reported unused — see ESLint output line 16:51–62
```

**Verification:** `eslint` output listing `urlValidation.ts` warnings.

Full-project unused-import analysis without `eslint --fix` or IDE: **not automated beyond ESLint**; no `noUnusedLocals` in `tsconfig.json`, so **tsc does not fail** on unused locals.

### 1e. Circular dependencies

**Tool:** `npx madge --circular --extensions ts,tsx src`  
**Result:** `✔ No circular dependency found!`

### 1f. `tsconfig.json`

```7:8:memorey/tsconfig.json
    "strict": true,
```

**Permissive overrides:** `skipLibCheck: true`, `allowJs: true` — common for Next.js; weakens checking of `.js` and `node_modules` types only, not app TS.

### 1g. `package.json` dependencies vs `src/`

**Dependencies with no `src/` import found** (grep `from "package"` / `from 'package'`):

- **`next-themes`** — listed in `package.json` but **no** `import` in `src/` (verification: ripgrep `next-themes` across repo → only `package.json` / lockfile).

**Other listed dependencies** (`@anthropic-ai/sdk`, `@base-ui/react`, `@dnd-kit/*`, `@supabase/*`, `cheerio`, `class-variance-authority`, `clsx`, `cmdk`, `date-fns`, `graphology`, `immer`, `isomorphic-dompurify`, `lucide-react`, `next`, `openai`, `react*`, `react-force-graph-2d`, `recharts`, `sonner`, `stripe`, `tailwind-merge`, `tw-animate-css`, `zod`, `zustand`) — **used** in `src/` or `globals.css` (`tw-animate-css`).

**devDependencies:** `eslint`, `typescript`, `tailwindcss`, `@tailwindcss/postcss`, `shadcn`, `@types/*` — appropriate as dev tooling. **`shadcn`** is a CLI; correctly dev-only.

---

## SECTION 2 — Database Schema & Data Integrity (Supabase MCP)

### 2a. Public tables (live DB)

**Verification:** `list_tables` with `verbose: true` for schema `public`.

| Table | RLS | Notes |
|-------|-----|--------|
| `profiles` | on | PK `id` → `auth.users`; includes `is_super_admin`, `anthropic_api_key_enc`, `openai_api_key_enc`, onboarding, theme prefs |
| `category_vaults` | on | FK `user_id` → `profiles` |
| `memory_nodes` | on | Embeddings, file columns, kanban, canvas FK |
| `node_edges` | on | |
| `node_history` | on | |
| `subscriptions` | on | PK `user_id` |
| `user_monthly_usage` | on | Composite PK `(user_id, year_month)` |
| `pending_proposals` | on | |
| `node_attachments` | on | |
| `canvases` | on | |
| `canvas_vaults` | on | |
| `user_events` | on | Analytics |

**App alignment:** `src/lib/supabase/database.types.ts` matches these tables; queries reviewed in §2b use existing columns.

### 2b. Queries vs schema

**Method:** `rg '\\.from\\(|\\.rpc\\(' src/` and cross-check against MCP schema.

**Findings:**

1. **`get_connected_nodes` RPC** — defined in DB (see §2d) but **not called** from application `src/` (only in `database.types.ts`). **Orphaned from app perspective** — not a breakage.

2. **`admin_funnel_metrics`** — `active_last_7_days` subquery uses **fixed 7-day window**, not the `p_since` parameter used for search/capture metrics. **Semantic inconsistency** when `days` query param ≠ 7.

3. **`002_stripe_billing.sql` migration** attempts to replace subscription policy but **drops the wrong policy name** — see §2c / critical issues.

No queries referenced non-existent tables/columns in `src/` for current schema.

### 2c. RLS policies (live DB)

**Verification:** `execute_sql` on `pg_policies` for `public` and `storage`.

**`public.profiles` — `users_own_profile`:** `FOR ALL`, `USING (auth.uid() = id)`, `WITH CHECK (auth.uid() = id)`.

**`public.subscriptions` — `users_own_subscription`:** `FOR ALL`, `USING (auth.uid() = user_id)`, `WITH CHECK (auth.uid() = user_id)`.

**`public.user_monthly_usage` — `usage_select_own`:** `SELECT` only (writes via service role in app).

**`public.user_events` — `no_client_access`:** `ALL` with `USING false` — clients cannot read/write; **server service role** inserts (e.g. `/api/track`, auth callback).

**`storage.objects`:** Two policies for `node-attachments` — folder first segment must equal `auth.uid()::text`.

**Critical:** See Section 4 / Summary — **`profiles` and `subscriptions` policies are overly permissive for UPDATE** (privilege escalation / billing bypass).

### 2d. Functions & triggers

**Application-relevant functions:** `search_nodes`, `seed_default_vaults`, `seed_canvas_vaults`, `handle_new_user`, `admin_*` RPCs, `update_updated_at` (if attached).

**Orphaned / unused by app code:** `get_connected_nodes` (not referenced in `src/`).

**`admin_funnel_metrics`:** `SECURITY DEFINER`; execute restricted to `service_role` per migration `026_lock_down_rpc_privileges.sql`.

### 2e. Indexes

**Verification:** `execute_sql` on `pg_indexes` for `public`.

Indexes exist on `memory_nodes` (user, vault, canvas, embedding ivfflat, kanban partial), `user_events` (name, user, created_at), `node_edges` (source/target), etc.

**Possible redundancy:** `idx_category_vaults_user` and `idx_category_vaults_user_active` overlap partially — **low priority** review.

**Missing (scale):** Admin routes that `count(*)` on large tables without time filters may scan heavily — see §7b / §9a.

### 2f. Migrations order

**Verification:** `ls memorey/supabase/migrations/*.sql` → files `001`–`029` **sequential, no numeric gaps**.

**Conflict note:** `002_stripe_billing.sql` uses `DROP POLICY IF EXISTS "subscriptions_select_own"` but **`001_memorey_schema.sql` creates `users_own_subscription`**, so the SELECT-only policy from `002` may **not** replace the `FOR ALL` policy — consistent with live DB still showing `users_own_subscription` **ALL**.

---

## SECTION 3 — Authentication & Authorization

### 3a. Auth paths

| Step | Location | Notes |
|------|----------|--------|
| OAuth | `src/app/(auth)/login/page.tsx` | `signInWithOAuth`, `redirectTo: ${window.location.origin}/auth/callback` |
| Callback | `src/app/auth/callback/route.ts` | `exchangeCodeForSession`, optional `user_events` insert `signup_completed`, redirect by `onboarding_completed` |
| Session | `src/lib/supabase/server.ts`, `src/lib/supabase/client.ts` | Cookie / browser clients |
| Middleware | `src/proxy.ts` | See 3b |
| Logout | Settings page `signOut` | Client |

**Gap:** Session expiry UX — see §10c.

### 3b. Routes & middleware

**Verification:** `npm run build` lists **`ƒ Proxy (Middleware)`** — Next.js 16 wires `src/proxy.ts`.

**Matcher** (`src/proxy.ts` 103–114): `/dashboard/*`, `/graph/*`, `/settings/*`, `/login`, `/admin/*`.

| Area | Auth |
|------|------|
| `/`, marketing | **Public** (not in matcher) |
| `/dashboard`, `/graph`, `/settings` | **Requires login** — unauthenticated → `/login` |
| `/login` | Logged-in → onboarding or dashboard |
| `/admin` | **Requires login only at edge** — **not** `is_super_admin` check in `proxy.ts` |

**API routes:** **Not** matched by `proxy.ts` — each handler must authenticate. Most user APIs use **Bearer** token or **cookie** `createClient()`.

### 3c. IDOR

- **`/api/memory/create`**, **`/api/search`**, **`/api/export`**, **`/api/attachments`:** Bearer auth + **`userId` / `vaultIds` compared to `user.id`** or vault ownership queries — **OK** when handlers enforce (e.g. `memory/create` lines 72–77, `export` 52–55).
- **Supabase client from browser:** RLS **`auth.uid()`** on `memory_nodes`, `category_vaults`, etc. — **defense in depth**.
- **Service-role routes:** Must not trust client `userId` without `getUser()` match — **reviewed**: export/search/memory attach pattern is consistent.

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
```

**Bypass:** If an attacker can set `is_super_admin` on their **`profiles` row via PostgREST** (RLS allows UPDATE on own row — **see Critical**), **admin API checks become meaningless**. **assertAdmin itself is sound**; **RLS is not**.

**Edge cases:** Deleted user → no session → 401. Race: rare; profile read is single query.

### 3e. Admin UI

**`AdminLayoutClient`** (`src/app/(admin)/admin/AdminLayoutClient.tsx`): Fetches `/api/admin/stats`; on 401 → `/login`; 403 → toast + `/dashboard`. **While loading**, skeleton UI — **no admin metrics text**.

**Residual risk:** Non-admin user **is allowed into `/admin` HTML shell** by `proxy.ts` (logged in only). **Data** should not load without 403 from API — **OK** for API-driven pages. **Critical RLS issue** would still allow self-promotion — see Summary.

---

## SECTION 4 — Security

### 4a. XSS

| Location | Snippet | Source |
|----------|---------|--------|
| `src/components/landing/LandingPage.tsx` | `dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.html) }}` | **Sanitized** with `isomorphic-dompurify` |
| `src/app/layout.tsx` | `dangerouslySetInnerHTML={{ __html: themeBootScript }}` | **Static** inline script string in source — no user input |

**Other patterns:** No `document.write` in `src/`. `innerHTML` not used directly for user HTML in grep results.

### 4b. API keys (`anthropic_api_key_enc` / `openai_api_key_enc`)

**Verification:** `rg` in `src/` for these columns — **only** `database.types.ts`.

**Conclusion:** Columns exist in DB and types but **no application code reads/writes BYOK keys** in `src/`. **No encryption implementation** in repo — names are **misleading** if ever used without real encryption. **Server LLM calls use `process.env.ANTHROPIC_API_KEY` / `OPENAI_API_KEY`**, not profile columns.

### 4c. Service role / `SUPABASE_SERVICE_ROLE_KEY`

**Files referencing `createAdminClient` or env `SUPABASE_SERVICE_ROLE_KEY`:**  
(user/delete-all-data, admin/*, ingest-link, embed, vaults/*, memory/create, nodes/create-file, auth/callback, stripe/*, billing, kanban/complete, track, assertAdmin, export route, search route, share route, `lib/supabase/admin.ts`, `lib/billing/usage.ts`, `lib/envCheck.ts`)

**Verification:** All are **server-only** modules (`route.ts`, `lib/*` not `"use client"`). **Next.js does not bundle** server route modules into client. **`npm run build`** succeeds — no accidental client import detected.

### 4d. Storage

- **Bucket:** `node-attachments` — RLS on `storage.objects` restricts path prefix to user id (MCP policies).
- **Upload:** `src/lib/uploadAttachment.ts` uses user-scoped paths.
- **Predictability:** Paths include user id — **not** secret URLs; **signed URLs** depend on Supabase config (not fully auditable in repo alone).

### 4e. CSRF

Cookie-authenticated POSTs (`createClient()` from cookies): e.g. `/api/user/delete-all-data`, `/api/vaults/set-active`, `/api/profile/onboarding`, `/api/stripe/*` (session).

**Protection:** SameSite cookies (Supabase SSR defaults) + **no CORS wildcard** for API in audit scope. **No CSRF tokens.** Risk **medium** for cookie-based mutating routes if a malicious site triggers cross-origin requests — **mitigated** by SameSite=Lax/Strict in typical Supabase setups; **confirm** cookie options in production.

### 4f. Rate limiting

**Implementation:** `src/lib/rateLimit.ts` — in-memory; **not** distributed.

**Routes using `checkRateLimit`:** `landing-chat`, `attachments/extract-meta`, `graph-builder`, `ingest-link`, `embed`, `memory-assistant`, `extract-nodes`, `search`, `track`.

**Many routes unprotected:** `memory/create`, `export`, `vaults/create`, `attachments` POST, `stripe` (webhook uses signature), `delete-all-data`, etc. **LLM-heavy** routes partially covered; **gap** on some expensive endpoints.

### 4g. Input validation

- **Zod:** `memory/create`, `profile/onboarding`, schemas in `src/lib/validation/schemas.ts`.
- **Manual:** Many routes (attachments, vaults, search body).
- **Weak / public:** `landing-chat` — JSON parse + array length; **no auth**.

### 4h. Data deletion — `/api/user/delete-all-data`

**Documented in source:**

```1:9:memorey/src/app/api/user/delete-all-data/route.ts
/**
 * Deletes all user-generated content: events, proposals, attachments,
 * history, edges, nodes, canvas_vaults, canvases, vaults (then re-seeds defaults),
 * monthly usage, and storage files.
 *
 * Does NOT delete: profiles row, subscriptions row, auth.users record.
```

**Tables touched:** `user_events`, `pending_proposals`, `node_attachments`, `node_history`, `node_edges`, `memory_nodes`, `canvas_vaults`, `canvases`, `category_vaults` (reseed), `user_monthly_usage`, storage `node-attachments`. **Then** inserts `user_events` row `data_reset`.

**Gap:** **`subscriptions` not deleted** (by design). **Analytics** prior rows deleted with `user_events` delete at start.

### 4i. SQL injection

**Pattern:** Supabase JS + RPCs — **no raw string SQL** in app. **No** `execute_sql` from app code.

### 4j. Secrets in repo

**Verification:** `rg` for key-like patterns in `src/` — **only** env-based usage. **`.env*`:** `.gitignore` excludes `.env` and `.env.local`; **`.env.local` must not be committed** — verify with `git check-ignore` locally.

---

## SECTION 5 — API Routes (Complete Table)

**Legend:** Auth: **Cookie** = `createClient()` SSR cookies; **Bearer** = `Authorization: Bearer`; **None** = no session; **Webhook** = Stripe signature.

| Route | Methods | Auth | Validation | Supabase client | Errors | Rate limit | Issues |
|-------|---------|------|-------------|-----------------|--------|------------|--------|
| `/api/user/delete-all-data` | POST | Cookie | Manual `confirm` | Server + admin | try/catch + errors | No | Destructive op unrate-limited |
| `/api/admin/analytics/funnel` | GET | assertAdmin | Query params manual | Admin | RPC error check | No | `active_last_7_days` ignores funnel `days` in SQL RPC |
| `/api/landing-chat` | POST | None | Partial | None | try/catch | Yes (IP) | No auth — abuse / cost if API key set |
| `/api/attachments/extract-meta` | POST | Cookie | URL checks | Server | try/catch | Yes | — |
| `/api/graph-builder` | POST | Bearer | Manual | — | try/catch | Yes | — |
| `/api/ingest-link` | POST | Bearer | Manual | Admin for billing | try/catch | Yes | — |
| `/api/embed` | POST | Bearer | Manual | Admin | try/catch | Yes | — |
| `/api/admin/stats` | GET | assertAdmin | — | Admin | Promise handling | No | Heavy counts at scale |
| `/api/admin/users/[id]` | GET | assertAdmin | — | Admin | checks | No | `as never` casts |
| `/api/memory-assistant` | POST | Bearer | Manual | — | try/catch | Yes | — |
| `/api/extract-nodes` | POST | Bearer | Manual | — | try/catch | Yes | — |
| `/api/search` | POST | Bearer | Manual + Zod-ish | Anon + admin for RPC | try/catch | Yes | Service key in process |
| `/api/track` | POST | Cookie (optional) | Loose | Admin | Swallows errors | Yes | Always 200 — silent fail |
| `/api/admin/users` | GET | assertAdmin | Query | Admin | checks | No | — |
| `/api/admin/activity` | GET | assertAdmin | — | Admin | checks | No | — |
| `/api/vaults/create` | POST | Cookie | Manual | Server + admin | try/catch | No | — |
| `/api/nodes/create-file` | POST | Cookie | Manual | Server + admin | try/catch | No | — |
| `/api/memory/create` | POST | Bearer | **Zod** | User-scoped | try/catch | No | High traffic possible |
| `/api/admin/revenue` | GET | assertAdmin | — | Admin | checks | No | — |
| `/api/admin/analytics/feature-usage` | GET | assertAdmin | Query | Admin | checks | No | — |
| `/api/admin/analytics/overview` | GET | assertAdmin | Query | Admin | checks | No | — |
| `/api/vaults/set-active` | POST | Cookie | Manual | Server + admin | try/catch | No | — |
| `/api/export/strip-pii` | POST | Bearer | Manual | — | try/catch | No | — |
| `/api/export/share` | POST | Cookie + Bearer internal | Manual | Admin + storage | try/catch | No | — |
| `/api/stripe/webhook` | POST | Webhook | Stripe | Admin | try/catch | No (sig) | — |
| `/api/export` | POST | Bearer | Manual | Admin via supabase-js | try/catch | No | — |
| `/api/billing/summary` | GET | Cookie | — | Admin | try/catch | No | — |
| `/api/stripe/portal` | POST | Cookie | — | Admin | try/catch | No | — |
| `/api/stripe/checkout` | POST | Cookie | — | Admin | try/catch | No | — |
| `/api/kanban/complete` | POST | Cookie | Manual | Admin | try/catch | No | LLM |
| `/api/profile/onboarding` | PATCH | Cookie | **Zod** | Server RLS | try/catch | No | **RLS** must block privilege fields |
| `/api/attachments` | POST | Bearer | Manual | User | try/catch | No | — |

**Notes:** Critical issues are **RLS on `profiles` / `subscriptions`** (Section 4 summary), not individual handler bugs.

---

## SECTION 6 — Frontend

### 6a. SSR safety

**Verification:** `rg` for `window|document|localStorage|sessionStorage|navigator` in `src/**/*.tsx` / `ts`.

- **Most** browser API usage is in **`"use client"`** files or inside **`useEffect`** (e.g. onboarding theme `useEffect` lines 306–314).
- **`src/lib/theme.ts`:** uses `localStorage` / `document` — **client-only** usage expected; grep shows no server import path without `"use client"` in those entrypoints.
- **`src/lib/parseCssColor.ts`:** `typeof document === "undefined"` guard before `document.createElement` (lines 69–71).

### 6b. `useEffect` (sample)

**ESLint** flags missing deps in `MemoryGraph.tsx`, `useDrawLoop.ts`, `NodeDetailSheet.tsx`, `VaultSettingsPopover.tsx` — **stale closure / re-run risk**.

**Cleanup:** Many listeners correctly remove on unmount (`LandingHomeClient`, `useKeyboardShortcuts`, `DashboardShell`, etc.).

### 6c. Zustand stores

| Store | Notes |
|-------|--------|
| `graphStore` | Immer; comment on ForceGraph clone — **race** possible on rapid updates — mitigated by patterns in hooks |
| `vaultStore` | Immer; canvas/vault upserts |
| `canvasStore` | Async Supabase; **race** if rapid switch without await discipline |
| `diffStore` | Heavy async; **console.error** noise |
| `exportPanelStore` | Trivial flags — **no issue** |
| `vaultManagerOverlayStore` | (verify in file) — typically UI-only |

### 6d. Client `fetch`

**Pattern:** Many components use `fetch` + `res.ok` check + toast on error. **Network down:** often **silent** or generic toast — **acceptable** but not universal.

### 6e. Error boundaries

- **`ErrorBoundary`** (`src/components/ErrorBoundary.tsx`): Catches **render errors** in subtree; logs `componentDidCatch`.
- **`global-error.tsx`:** Next **root** error UI.
- **Misses:** Event handlers, async errors outside React — **not caught**.

### 6f. Loading states

**Verification:** `loading.tsx` exists for dashboard subroutes (`kanban`, `capture`, `search`). Admin uses skeletons in `AdminLayoutClient`.

### 6g. Empty states

Graph/kanban/search have UI for empty data in various components — **not exhaustively re-verified** every branch; spot-check: `MemoryGraph` / kanban pages show content or instructions.

### 6h. Forms

Onboarding → **API + Zod**. Memory create → **Zod** + DB constraints. Vault create → server + client validation partial. **Document in** `src/lib/validation/schemas.ts`.

---

## SECTION 7 — Admin Dashboard

### 7a. SQL / API correctness

- **`/api/admin/stats`:** Counts and distinct `user_id` from `user_events` — **logically consistent**; **signup “today”** uses UTC start — **document** timezone assumption.
- **Funnel RPC:** Search/capture use `p_since`; **active_last_7_days** in function body uses **rolling 7 days** independent of `p_since` — **documentation / product bug**.

### 7b. Performance

**At 100k users:** `select('*', { count: 'exact', head: true })` on `profiles` / `memory_nodes` **full table scans** — **will degrade**. **Mitigation:** materialized views, approximate counts, or rolling aggregates.

### 7c. Frontend

Admin pages use **loading skeletons**, **toast errors**, **charts** — responsive classes present (`md:`, `lg:`).

### 7d. Admin access UX

Non-admin hitting `/admin`: **skeleton** → API **403** → redirect **dashboard**. **Worst case slow network:** long skeleton — **no numeric admin data** observed in client code before gate.

### 7e. Formulas

- **Conversion rate** in stats: `(non-free count) / total users * 100` — **defined** in `admin/stats/route.ts` lines 119–124.
- **MRR/ARR:** Revenue page — verify Stripe price × subscribers (read `admin/revenue` implementation for exact formula) — **not re-derived** in this audit beyond spot-check.

---

## SECTION 8 — Analytics

### 8a. Pipeline

`useTrack` → `fetch('/api/track')` → **service role** insert `user_events`. **Dedup:** 2s window + client 1s debounce.

**Loss:** Fire-and-forget — **no retry**. **Dup:** Mitigated, not impossible under races.

### 8b. Event coverage

**Labels:** `src/lib/admin/eventLabels.ts`.

**Tracked in code:** `page_view`, onboarding, `search_performed`, `capture_*`, `node_created`, `edge_created`, `share_link_created`, `kanban_status_changed`, `attachment_*`, `node_edited`, etc.

**Coverage nuance:** `export_triggered` is **not** fired via `useTrack`; it is sent with a raw `fetch("/api/track", …)` in `src/components/export/ExportPanel.tsx` (approx. lines 296–308). **`canvas_created`** uses the same raw `fetch` pattern in `src/store/canvasStore.ts` (approx. lines 131–143). **`vault_created`** is inserted **server-side** in `src/app/api/vaults/create/route.ts` (admin client `user_events` insert). **`useTrack` hook** does not wrap these paths — **no double-count** from the hook’s 1s debounce, but **inconsistent** pipeline (three patterns: hook, raw fetch, server insert).

### 8c. Rate limit

`/api/track`: **60/min per user** — **adequate** for normal use; **attack** still inserts until limit — DB growth.

### 8d. Privacy

**Delete-all** removes **`user_events`** for user. **Account deletion** (auth user) — **not** implemented in delete-all endpoint — **document** for GDPR.

---

## SECTION 9 — Performance & Scalability

### 9a. Expensive queries

1. Admin full-table counts.  
2. `search_nodes` vector search — indexed (ivfflat).  
3. `user_events` aggregates without time bounds in some admin queries — **add bounds**.  
4. Graph data load — multiple joins client-side.  
5–10. **Similar** — batch size limits in export (`maxNodes`).

### 9b. Bundle

**Heavy:** `recharts`, `react-force-graph-2d`, `lucide-react` — **lazy-load** where possible (admin-only charts already route-split by page).

### 9c. Canvas / graph

**No virtualization** for large graphs — **performance degrades** with node count (estimated low thousands depending on device).

### 9d. Serverless timeouts

LLM routes (`ingest-link`, `search`, `kanban/complete`) may approach **10s** on hobby — **risk** under load.

### 9e. DB connections

Each serverless invocation creates short-lived clients — **typical**; watch **connection churn** vs Supabase limits.

### 9f. Storage growth

Attachments + `user_events` — **linear** in usage; **monitor** Supabase storage + DB size.

---

## SECTION 10 — Edge Cases & Reliability

### 10a. External dependency down

- **Supabase:** App errors / blank data.  
- **Anthropic/OpenAI:** Search/ingest fail with API errors — **user sees** toast or error JSON.  
- **Stripe:** Webhook failures — billing drift until retry.

### 10b. Concurrency

Two tabs editing same node: **last write wins** — **no OT**. Rapid clicks — **possible duplicate** requests (partially mitigated by UI).

### 10c. Session expiry

Bearer-based client fetches return **401** — user may need **refresh**; **no global 401 handler** observed.

### 10d. Browser compatibility

**ES2017** target; modern CSS. **Minimum:** recent evergreen browsers.

### 10e. Plan limits

Enforced in API (`memory/create`, billing) — **users hitting limits** get error responses — **verify** all entrypoints show toast.

---

## SECTION 11 — Accessibility

### 11a–d.

**Spot-check:** Many icon-only controls rely on **`title`** / **`aria-hidden`** on decorative icons. **Full interactive audit** not automated — **gaps likely** for `aria-label` on graph canvas controls.

**Keyboard:** Graph is **pointer-heavy** — **limited** keyboard alternatives for spatial interactions.

**Contrast:** Dark theme + vault colors — **not** systematically measured; **risk** on custom vault colors.

**Screen reader:** Dynamic graph updates — **limited** live regions.

---

## SECTION 12 — Mobile Responsiveness

**Verification:** Tailwind breakpoints used (`md:`, `lg:`) across dashboard and admin.

**Graph/canvas:** Touch pan/zoom **device-dependent**; **small screens** — toolbar and side panels may **crowd** — spot-check `DashboardShell` / graph chrome.

---

## SECTION 13 — Summary & Fix Priority

### Table 1 — Critical (must fix before launch)

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| **Privilege escalation:** RLS allows authenticated users to **UPDATE** `profiles` including **`is_super_admin`** | Policy `users_own_profile` on `public.profiles` (MCP `pg_policies`); columns from MCP `list_tables` | **Split policies** or **`BEFORE UPDATE` trigger** to block changes to `is_super_admin` unless `service_role`; or **column-level privileges** | **Medium** |
| **Billing bypass:** RLS **`users_own_subscription` FOR ALL** lets users **UPDATE** `plan` / Stripe columns | Live DB policy (MCP); root cause: `002_stripe_billing.sql` drops wrong policy name | **DROP** `users_own_subscription`; **CREATE SELECT-only** + **service_role-only** updates (matches intent of `002`) | **Medium** |
| Migration **002** does not remove **`users_own_subscription`** | `supabase/migrations/002_stripe_billing.sql` lines 14–17 | Fix migration / add new migration to align prod | **Small** |

**Evidence for migration bug:**

```14:17:memorey/supabase/migrations/002_stripe_billing.sql
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);
```

`001_memorey_schema.sql` creates policy name **`users_own_subscription`**, not `subscriptions_select_own` — DROP **no-ops** for default name.

### Table 2 — High

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| Public **`/api/landing-chat`** with env API key | `src/app/api/landing-chat/route.ts` | Cap tokens, add auth or separate demo key, monitor | **Medium** |
| **Unrate-limited** expensive routes (`memory/create`, `export`, `delete-all-data`) | respective `route.ts` | Redis / edge limits | **Medium** |
| **CSRF** hardening for cookie POSTs | API routes | CSRF token or strict SameSite + origin checks | **Medium** |
| Admin **full table scans** | `admin/stats` | Precompute / approximate counts | **Large** |

### Table 3 — Medium

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| `admin_funnel_metrics` **active_last_7_days** ignores `p_since` | SQL function (MCP) | Align window with param or rename metric | **Small** |
| **`get_connected_nodes` unused** | DB function | Remove or wire up | **Small** |
| Client **`console.error`** noise | `diffStore`, etc. | Remove or gate | **Small** |
| In-memory **rate limit** | `rateLimit.ts` | Redis for multi-instance | **Large** |

### Table 4 — Low

| Issue | Location | Fix | Effort |
|-------|----------|-----|--------|
| **`next-themes`** unused dep | `package.json` | Remove | **Small** |
| ESLint **exhaustive-deps** warnings | multiple | Fix deps | **Medium** |
| Duplicate storage policy names **SELECT** vs **ALL** on `storage.objects` | MCP `pg_policies` | Consolidate policies | **Small** |

---

## Production readiness

**Is this codebase ready to deploy for real users if critical and high issues are addressed first?**

**NO** — not until **Critical** issues are fixed: **privilege escalation (`is_super_admin`)** and **subscription row tampering** via RLS are **production blockers** for any multi-tenant SaaS. After **RLS/trigger/migration** fixes and targeted **rate limits / landing-chat** hardening, the stack is **closer** to production-ready; remaining items are **reliability and scale**.

---

## Verification index (no issues claimed without method)

| Claim | Method |
|-------|--------|
| TS clean | `npx tsc --noEmit` exit 0 |
| ESLint errors = 0 | `npx eslint .` |
| No circular deps | `npx madge --circular` |
| Tables/policies | Supabase MCP `list_tables`, `execute_sql` |
| `console.*` list | `rg` |
| `next-themes` unused | `rg next-themes` in repo |
| Middleware wired | `npm run build` → `ƒ Proxy (Middleware)` |
| Migrations ordered | `ls supabase/migrations` |

---

*End of FINAL_AUDIT_3.md*
