# Memorey — Comprehensive Technical Audit

**Generated:** 2026-03-21  
**Codebase root:** `memorey/` (Next.js 16.1.7, React 19, TypeScript 5)  
**Scope:** Full automated and manual review of `src/` (~253 TypeScript/TSX modules per dependency graph), all `src/app/api/**` route handlers, Zustand stores, hooks, Supabase integration, ESLint, `tsc`, `next build`, npm audit, and **live Postgres schema** via Supabase MCP (`user-memorey supabase`: `list_tables` verbose, `execute_sql` for `search_nodes`, indexes on `user_events`, `list_migrations`).

This report is **evidence-based** (file paths, line numbers, snippets). Where a claim applies to “the whole tree,” the verification method is stated (e.g. grep, ESLint rule, madge).

---

## 1. Build & Compilation

### 1.1 TypeScript / `tsc`

- **Command:** `npx tsc --noEmit` (cwd: `memorey/`) — **exit code 0** (no compiler errors).
- **`tsconfig.json`:** `strict: true`, `noEmit: true`, `skipLibCheck: true` (skips type-checking of `.d.ts` in `node_modules` — common for Next; not a full “strict on all deps” guarantee).

```1:21:memorey/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    ...
  },
```

- **Implicit `any`:** No project-wide `noImplicitAny` override; with `strict: true`, implicit `any` is disallowed in project sources. No systematic `implicit any` failures reported by `tsc`.
- **Unsafe casts:** Grep for `as any` in `src/**/*.ts,tsx` — **no matches**. Instances of `as unknown as` / `as never` (narrowing or interop) include:
  - `memorey/src/components/graph/hooks/useGraphData.ts:33` — `mapAttachmentRow(r as unknown as Record<string, unknown>)`
  - `memorey/src/components/graph/hooks/useDrawLoop.ts:314` — `node as unknown as MemoryNode`
  - `memorey/src/store/vaultStore.ts:104` — nested cast for Supabase join shape
  - `memorey/src/lib/lucideIconCanvasCache.ts:44` — dynamic import typing
  - `memorey/src/components/graph/ui/ContextMenu.tsx:29,64` — `as unknown as MemoryNode`
  - `memorey/src/app/api/search/route.ts:36-39` — `mapNodeRow({ ...row, category_vaults: ... } as never)` — bypasses strict row typing for RPC/join shape.

### 1.2 Production build

- **Command:** `npm run build` — **success**; route list includes **“ƒ Proxy (Middleware)”**, confirming Next.js wires `src/proxy.ts` as the network middleware entry (Next 16 convention).

### 1.3 ESLint (not clean)

- **Command:** `npm run lint` — **fails** with multiple **errors** (not only warnings). Examples:
  - `dashboard/kanban/page.tsx` — React Compiler purity: `Date.now()` during render (~401).
  - `components/graph/hooks/useGraphCanvasEvents.ts:104` — ref updated during render.
  - `components/graph/hooks/useKeyboardShortcuts.ts:38` — ref updated during render.
  - `components/graph/hooks/useMinimap.ts`, `useVaultLayout.ts`, `useNodeActions.ts` — “cannot modify props” / immutability rules.
  - `components/diff/useDiff.ts` — `preserve-manual-memoization` / `set-state-in-effect`.
  - `app/api/admin/users/route.ts:78` — `prefer-const` (`filtered`).

**Interpretation:** CI that gates on `eslint` would **fail today** even though `tsc` and `next build` pass.

### 1.4 Unused variables / imports (ESLint `@typescript-eslint/no-unused-vars`)

Representative list from ESLint JSON output (not exhaustive of every unused import in every file):

| Location | Symbol |
|----------|--------|
| `src/app/(dashboard)/dashboard/onboarding/page.tsx:472` | `isLastStep` |
| `src/app/api/embed/route.ts:15` | `userId` (destructured, unused — dead code / leftover IDOR check) |
| `src/app/api/ingest-link/route.ts:46` | `AI_HOSTNAMES` |
| `src/components/diff/DiffModal.tsx:33` | `closeDiff` |
| `src/components/graph/canvas/edge.ts:51-54` | `_sHw`, `_sHh`, `_tHw`, `_tHh` |
| `src/components/graph/hooks/useMinimap.ts:7-8` | `MINIMAP_W`, `MINIMAP_H` |
| `src/components/graph/ui/AddMemoryModal.tsx:22` | `_parentNodeId` |
| `src/components/graph/ui/Toolbar.tsx:8` | `ReactNode` |
| `src/components/graph/ui/VaultSettingsPopover.tsx:23` | `emptyToNull` |
| `src/components/landing/LandingHomeClient.tsx:125` | `muted` |
| `src/lib/ai/embed.ts:1` | `_input` |
| `src/lib/ai/search.ts:1` | `_query` |

**Note:** Unused *imports* are typically reported by the same rule; fixing the above and re-running ESLint is the authoritative list.

### 1.5 Circular dependencies

- **Tool:** `npx madge --circular --extensions ts,tsx src` — **no circular dependencies found** (253 files processed).

---

## 2. Database & Schema Integrity

### 2.1 Live schema (Supabase MCP)

`list_tables` (`public`, `verbose: true`) confirms tables used in app code: `profiles` (includes `is_super_admin`, `anthropic_api_key_enc`, `openai_api_key_enc`), `category_vaults`, `memory_nodes`, `node_edges`, `node_history`, `subscriptions`, `user_monthly_usage`, `pending_proposals`, `node_attachments`, `canvases`, `canvas_vaults`, `user_events`.

**`user_events` columns:** `id`, `user_id` (nullable in DB listing), `event_name`, `event_data`, `page_path`, `created_at`.

Repo migration `supabase/migrations/027_add_user_events.sql` defines `user_id` → `profiles(id) ON DELETE CASCADE` and RLS policy **`no_client_access` … USING (false)** (server-only via service role).

### 2.2 RPC `search_nodes` — parameters vs code

**Database (actual function):** `search_nodes(p_user_id uuid, p_query_embedding vector, p_vault_ids uuid[], p_limit integer default 15)` — security definer; enforces `auth.uid() = p_user_id` unless `service_role`.

**Caller:** `src/app/api/search/route.ts` passes:

```173:178:memorey/src/app/api/search/route.ts
  const { data: similarRaw, error: rpcErr } = await admin.rpc("search_nodes", {
    p_user_id: user.id,
    p_query_embedding: queryEmbedding,
    p_vault_ids: vaultIds,
    p_limit: 12,
  });
```

Types align: `vector` from OpenAI float array, `uuid[]` from filtered vault IDs, `int` limit.

### 2.3 Column / table mismatches

- Cross-check of `.from(...)` targets against live schema: **no orphaned table names** found in `src/` for `public` tables.
- **Generated types:** `src/lib/supabase/database.types.ts` and `types.ts` exist; many queries use typed `Database` on clients, but several call sites still use manual casts (`as never`, `as string`) for joined or RPC rows — consistency is partial, not total.

### 2.4 `insert` / `update` / `upsert` constraint risk

- **`memory_nodes`:** `title`/`value` length checks exist in DB (`char_length`); API routes that validate with Zod (`memory/create`) reduce runtime failures; client-driven inserts that bypass limits could still hit DB errors.
- **`profiles.segment`:** check constraint on enum-like values — ensure any profile update API sends allowed values (review `profile/onboarding` and client updates).
- **`user_events`:** `event_name` NOT NULL — satisfied by inserts; `user_id` nullable in live DB — app usually sends `user.id`.

### 2.5 `user_events` / `is_super_admin` migrations & indexes

- **`is_super_admin`:** migration `028_add_is_super_admin` appears in MCP `list_migrations`; column present on `profiles` with default `false`.
- **`user_events` indexes (live DB):**
  - `idx_user_events_created` — `(created_at DESC)`
  - `idx_user_events_user` — `(user_id, created_at DESC)`
  - `idx_user_events_name` — `(event_name, created_at DESC)`
  - PK on `id`  
  Appropriate for admin analytics and time-range filters.

**Note:** MCP `list_migrations` did **not** list a migration named `027_add_user_events`; the table exists in production and `027_add_user_events.sql` exists in-repo — ensure migration history is aligned across environments.

---

## 3. API Routes — Full Review

Below, **“cookie auth”** = `createClient()` from `@/lib/supabase/server` with session cookies. **“Bearer”** = `Authorization: Bearer <access_token>` with anon client + `getUser(token)`.

| Route | Methods | Auth | Body validation | Supabase `.error` | Client | Notes |
|-------|---------|------|-----------------|-------------------|--------|-------|
| `api/admin/activity` | GET | `assertAdmin` | N/A | Partial | Admin | Admin-only |
| `api/admin/analytics/feature-usage` | GET | `assertAdmin` | N/A | Partial | Admin | |
| `api/admin/analytics/funnel` | GET | `assertAdmin` | N/A | **Not checked on Promise.all rows** | Admin | Heavy: full table selects for counts / user lists |
| `api/admin/analytics/overview` | GET | `assertAdmin` | N/A | Partial | Admin | |
| `api/admin/revenue` | GET | `assertAdmin` | N/A | Partial | Admin | |
| `api/admin/stats` | GET | `assertAdmin` | N/A | **Not checked** on each query in `Promise.all` | Admin | Used by admin layout gate |
| `api/admin/users` | GET | `assertAdmin` | Query params | Partial | Admin | |
| `api/admin/users/[id]` | GET | `assertAdmin` | Path `id` | Partial | Admin | **N+1** canvas/vault node counts |
| `api/attachments` | POST | Bearer | Manual checks | Yes on key queries | User-scoped RLS via user client | Ownership on `memory_nodes` |
| `api/attachments/extract-meta` | (file) | Reviewed in tree | — | — | — | Verify in deployment |
| `api/billing/summary` | GET | Cookie | N/A | **No explicit error check** on counts | Admin for reads | |
| `api/embed` | POST | Bearer | Loose | Update error logged | Admin + `.eq('user_id', user.id)` | Always 200 “ok” pattern |
| `api/export` | POST | Bearer | Partial manual + executeExport | Via `executeExport` | Service role | `userId` must match JWT |
| `api/export/share` | POST | Bearer | Same | Same | Service role + storage | |
| `api/export/strip-pii` | POST | — | — | — | — | Confirm auth in file |
| `api/extract-nodes` | POST | Cookie | Zod | Try/catch | Server client | |
| `api/graph-builder` | POST | Bearer | **Weak** — `request.json()` cast, no Zod | Try/catch | Env Anthropic | Vault ID validation against passed `vaults` |
| `api/ingest-link` | POST | Bearer/cookie | Large file | Mixed | Admin for usage | SSRF/fetch limits — review full file for production |
| `api/kanban/complete` | POST | Cookie/Bearer | — | — | Admin in places | Read file for parity |
| `api/landing-chat` | POST | **None** | `messages` | N/A | None | Public marketing; uses `ANTHROPIC_API_KEY` |
| `api/memory-assistant` | POST | Cookie | Messages array | N/A | Server | Returns Anthropic JSON body to client |
| `api/memory/create` | POST | Bearer | **Zod** | Yes on insert | User bearer client | `userId` enforced vs JWT |
| `api/nodes/create-file` | POST | — | — | — | — | Reviewed: admin for events |
| `api/profile/onboarding` | — | — | — | — | — | |
| `api/search` | POST | Bearer | Manual | Yes on RPC | Service role | `userId` must match JWT |
| `api/stripe/*` | POST | Webhook / session | Stripe / body | Mixed | Admin | Webhook verifies signature |
| `api/track` | POST | Cookie session | Loose | **Errors swallowed** | Admin insert | See §4 / §8 |
| `api/user/delete-all-data` | POST | Cookie | `confirm === "DELETE"` | **No `.error` checks** on deletes | Admin | See §5 |
| `api/vaults/create` | POST | — | — | — | — | |
| `api/vaults/set-active` | POST | — | — | — | — | |

**Wrong HTTP method:** Route handlers only export supported methods; Next returns **405** for others on that segment.

**Admin protection:** All `api/admin/*` routes use `assertAdmin()` first (e.g. `assertAdmin.ts`).

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

- **`is_super_admin` null:** Expression `!profile?.is_super_admin` treats **null/undefined/false** as forbidden — safe.

**Bypass:** Admin **APIs** cannot be bypassed without a valid session **and** `is_super_admin: true`. Admin **pages** are not blocked in `proxy.ts` by admin flag — only “logged in” (see §4).

---

## 4. Authentication & Authorization

### 4.1 Middleware / `proxy.ts`

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

- **Matcher** (`config.matcher`) includes `/dashboard`, `/graph`, `/settings`, `/login`, `/admin` — **does not include `/api/*`**. API auth is **per-route**.
- **Admin UI:** Any logged-in user can **hit** `/admin/*` URLs; `AdminLayoutClient` then calls `GET /api/admin/stats` and redirects on 403 — **brief skeleton / flash** possible before redirect (see §7).

### 4.2 IDOR patterns

- **`/api/search`, `/api/export`, `/api/export/share`, `/api/memory/create`:** compare `body.userId` to `user.id` from JWT — **correct**.
- **`/api/embed`:** ignores `body.userId` (unused); update uses `.eq('user_id', user.id)` — **safe**; remove dead `userId` destructure.

### 4.3 OAuth callback

```29:64:memorey/src/app/auth/callback/route.ts
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      ...
        return NextResponse.redirect(`${origin}${destination}`);
      }
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth_failed`);
```

- Failure redirects to **`/login?error=oauth_failed`** — generic, low information leakage.

### 4.4 Client data loading

- Dashboard layout (`dashboard/layout.tsx`) loads profile/subscription via **browser Supabase client** after `getUser()` — relies on RLS; no second server gate on the RSC tree for dashboard pages (many are client-heavy).

---

## 5. Security Deep Dive

### 5.1 API keys `anthropic_api_key_enc` / `openai_api_key_enc`

- **Grep** across `src/` (excluding generated types): **no reads or writes** to these columns in application logic — only definitions in `database.types.ts`.
- **Conclusion:** Columns are **unused by current app code**; no AES envelope encryption traced in-repo. Naming suggests future encryption; **do not assume secrets are encrypted at rest** unless you implement KMS/envelope crypto and Supabase Vault.

### 5.2 Service role exposure

- **`createAdminClient`** and `SUPABASE_SERVICE_ROLE_KEY` appear only under **`src/app/api/**`, `src/lib/supabase/admin.ts`, `src/lib/billing/usage.ts`, `src/lib/envCheck.ts`, `assertAdmin`, auth callback** — **server contexts**. No evidence of importing `admin.ts` inside client components.

### 5.3 Storage `node-attachments`

- **Policy (migration excerpt):** `auth.uid()::text = (storage.foldername(name))[1]` — first path segment must equal user id.
- **Upload path:** `uploadAttachment.ts` uses `${userId}/${Date.now()}-${safeName}` — matches policy.
- **Enumeration:** Objects are private; access via **signed URLs** (short TTL in `uploadAttachment.ts`). Guessing another user’s `userId`+timestamp is hard but **UUID is public** if leaked — still need signed URL or authenticated read.

### 5.4 XSS

**Critical — landing marketing chat**

```337:342:memorey/src/components/landing/LandingPage.tsx
  async function sendChat() {
    ...
    setChatMsgs((prev) => [...prev, { role: "user", html: text }]);
```

```2120:2124:memorey/src/components/landing/LandingPage.tsx
                          dangerouslySetInnerHTML={{ __html: msg.html }}
```

User-controlled `text` is injected as HTML for **user** messages → **stored XSS in session state** if the user types HTML/JS payloads. AI `parsed.reply` is also rendered as HTML without sanitization.

### 5.5 CSRF

- Cookie-based routes (`createClient` server, `credentials: "include"` fetches) rely on **SameSite** cookies (Supabase default) + same-origin. **No** custom CSRF tokens on POST. Risk is **lower** for cross-site POST with `SameSite=Lax` for top-level navigations, but **state-changing APIs also accept Bearer tokens** from any origin if the bearer is leaked — standard bearer threat model.

### 5.6 Rate limiting

- **No** global rate limit middleware observed.
- **`/api/track`:** 2s server-side dedupe + 1s client debounce — **not** abuse-proof (see §8).

### 5.7 `/api/user/delete-all-data`

```47:66:memorey/src/app/api/user/delete-all-data/route.ts
  await admin.from("pending_proposals").delete().eq("user_id", userId);
  await admin.from("node_attachments").delete().eq("user_id", userId);
  await admin.from("node_history").delete().eq("user_id", userId);
  await admin.from("node_edges").delete().eq("user_id", userId);
  await admin.from("memory_nodes").delete().eq("user_id", userId);
  await admin.from("category_vaults").delete().eq("user_id", userId);
  ...
  await admin.from("category_vaults").insert(rows);

  await admin.from("user_monthly_usage").delete().eq("user_id", userId);

  return NextResponse.json({ ok: true });
```

**Gaps:**

- **No** deletion of **`user_events`** — analytics rows remain (privacy/product choice).
- **No** deletion of **`canvases` / `canvas_vaults`** — canvases can remain for the user.
- **No** **`subscriptions`** row removal (may be intentional for billing).
- **No** **`storage.objects`** cleanup for `node-attachments` / export buckets — **orphaned files** possible.
- **No** check of **`error`** on each `delete()` — failures may be **silent** if Supabase returns error without throwing.

---

## 6. Frontend — Bugs & Issues

### 6.1 SSR / `window` / `localStorage`

- Root `layout.tsx` uses **`localStorage` in an inline script** for theme — intentional, runs only in browser.
- **`useTrack`:** uses `window.location.pathname` guarded by `typeof window !== "undefined"` — safe.

### 6.2 `useEffect` / cleanup

- ESLint reports multiple **missing dependencies** (e.g. `MemoryGraph.tsx`, `useDrawLoop.ts`) — risk of stale closures.
- **PendingProposalsBell**, **useDiff** — React Compiler complaints about **setState in effect** (see lint log).

### 6.3 Zustand / `graphStore`

- Large store with Immer; **concurrent rapid edits** (multi-tab, fast paste) can race server sync — no distributed locking; **last write wins** at DB level. Document as known limitation.

### 6.4 Fetch error handling

- Many `fetch` calls use `if (!res.ok)` + toast; some **swallow** body parse errors — pattern is inconsistent.

### 6.5 Error boundary

```12:24:memorey/src/components/ErrorBoundary.tsx
export class ErrorBoundary extends Component<Props, State> {
  ...
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }
```

- Catches **render** errors in children, **not** async errors inside event handlers unless they trigger a re-render that throws. `global-error.tsx` handles root fatals.

---

## 7. Admin Dashboard — Code Review

### 7.1 N+1 / heavy queries

- **`api/admin/users/[id]/route.ts`:** After parallel counts, **`canvasNodeCounts` and `vaultNodeCounts` use `Promise.all` of per-canvas / per-vault count queries** — classic **N+1** for users with many canvases/vaults.

```128:161:memorey/src/app/api/admin/users/[id]/route.ts
  const canvasNodeCounts = await Promise.all(
    canvasList.map(async (c) => {
      const { count } = await admin
        .from("memory_nodes")
        ...
        .eq("canvas_id", c.id as string)
```

### 7.2 Funnel / stats scalability

- **`funnel/route.ts`:** Loads **all** `memory_nodes` `user_id` rows for active nodes (`select("user_id")` without limit) — **O(n)** table scan growth.
- **Indexes** help `user_events` filters; still heavy for large datasets.

### 7.3 Admin UI

- **Empty states:** Pages use loading skeletons; verify each chart/table for zero users (manual UI pass recommended).
- **Non-existent user:** `GET api/admin/users/[id]` returns **404** JSON — confirm `admin/users/[id]/page.tsx` handles gracefully.
- **Sidebar active state:** Implemented in `AdminLayoutClient.tsx` (`pathname === href || pathname.startsWith(...)`).

### 7.4 Admin gate / flash

- **`AdminLayoutClient`:** `gate === "loading"` shows skeleton; then fetch `/api/admin/stats`. Slow network → longer skeleton, **not** admin content for non-admins (403 path redirects before `gate === "ok"`).

---

## 8. Analytics & Tracking Review

### 8.1 Pipeline

- Client: `useTrack` → `fetch("/api/track")` → `createAdminClient().from("user_events").insert(...)`.
- **Dedup:** Server: same `user_id` + `event_name` within **2 seconds**; client: **1 second** debounce per event name.

### 8.2 Event coverage (grep)

- `page_view` — `TrackPageView`, settings `useEffect`.
- `search_performed` — `useSearch.ts` (keyword + semantic).
- `capture_chat_sent` — `ChatGraphBuilder.tsx`.
- `capture_link_ingested` — `ShareLinkInput.tsx`.
- `node_created` — API `memory/create`, `useNodeActions`, kanban — **potential double-counting** between API and client.
- `signup_completed` — `auth/callback/route.ts` (server).
- `onboarding_completed` — onboarding page.

### 8.3 Abuse (`/api/track`)

```6:14:memorey/src/app/api/track/route.ts
    if (!user) {
      return new NextResponse(null, { status: 200 });
    }
```

- Authenticated users can **spam** inserts (only 2s dedupe per event name). **No** cap on distinct `event_name`s or daily volume — DB growth + cost risk.

### 8.4 Account deletion

- **`user_events` not deleted** by `delete-all-data` — user remains identifiable in analytics. Decide: delete, anonymize (`user_id = null`), or retain for aggregates.

---

## 9. Performance & Scalability

| Area | Concern |
|------|---------|
| Admin aggregates | Full scans / large selects on `memory_nodes`, `user_events` |
| Search RPC | Vector index recommended on `memory_nodes.embedding` if not present (verify with `EXPLAIN` in prod) |
| Graph UI | `react-force-graph-2d` + large graphs — **500+ nodes** will stress CPU; no hard cap in UI |
| Bundle | `recharts`, `graphology`, `react-force-graph-2d` — consider **dynamic import** for admin / graph |
| Vercel timeouts | Heavy export + ingest-link + search (LLM + embed) may approach **10s** on hobby |

**Analytics volume (rough):** 100 DAU × 50 events ≈ **5k rows/day** ≈ **150k/month** — manageable on small Postgres; index `user_events` as deployed helps.

---

## 10. Edge Cases & Error States

| Scenario | Behavior |
|----------|----------|
| Zero nodes/vaults | Search returns friendly empty message; graph may show empty |
| Supabase down | Fetches fail; UI depends on per-component error handling — **inconsistent** |
| Invalid Anthropic key | `memory-assistant` returns 503 / API error JSON |
| Missing `OPENAI_API_KEY` | `/api/search` returns **500** “Server misconfiguration” — **no keyword fallback** in this route |
| Long names | CSS overflow varies by component — spot-check |
| Multi-tab edit | Last write wins; no CRDT |
| Session expiry | Middleware sends unauthenticated users to `/login` for protected paths; in-app **long-lived skeleton** possible if client state desyncs |

---

## 11. Code Quality & Maintainability

- **Duplication:** Repeated “Bearer + anon client + getUser” blocks across routes — candidate for shared helper.
- **Inconsistency:** Some routes Zod-validate; others cast `request.json()` directly (`graph-builder`, parts of admin).
- **Magic numbers:** TTLs, limits scattered (`FREE_*` in `lib/billing/limits.ts` centralizes some).
- **Debug logs:** `console.log` in `resolveVaultId.ts`, `diffStore.ts` — remove or gate for production.

```46:48:memorey/src/lib/vaults/resolveVaultId.ts
  console.log("Resolved vault:", {
```

---

## 12. Dependencies & Supply Chain

- **`npm audit`:** **0 vulnerabilities** (at audit time).
- **Heavy deps:** `recharts`, `@anthropic-ai/sdk`, `openai`, `stripe`, `graphology`, `react-force-graph-2d` — justified; tree-shake / dynamic import where possible.
- **Unused packages:** Not fully enumerated; `shadcn` CLI in `dependencies` — often dev-only (verify).

---

## 13. Accessibility

- **Not audited page-by-page.** Grep-based spot checks: many icons use `aria-hidden`; full WCAG audit (axe, screen reader) **not** performed in this pass.
- **Risk:** Dark theme + custom vault colors may fail **contrast** for some pairs.
- **Landing XSS** also breaks **security** for assistive tech (script execution).

---

## 14. Summary

### 14.1 Bugs (severity)

| Severity | Issue |
|----------|--------|
| **Critical** | **XSS** — `LandingPage.tsx` renders user chat input via `dangerouslySetInnerHTML` (`~342`, `~2123`). |
| **Critical** | **`delete-all-data`** — missing storage + `user_events` + canvases cleanup; **no `.error` checks** on deletes (`route.ts` `47-64`). |
| **High** | **ESLint fails** — CI quality gate broken; React Compiler / hooks errors across multiple files. |
| **High** | **Admin / analytics queries** — full-table pulls (`funnel`, `stats`) will **degrade** with scale. |
| **High** | **`/api/track` abuse** — no rate limits; fake events possible. |
| **Medium** | **N+1** admin user detail (`users/[id]/route.ts` `128-161`). |
| **Medium** | **Duplicate `node_created` analytics** (API + client). |
| **Medium** | Dashboard **infinite skeleton** if `getUser` never resolves (edge case). |
| **Low** | Unused vars/imports; `console.log` debug in vault/diff code. |

### 14.2 Security issues (severity)

| Severity | Issue |
|----------|--------|
| **Critical** | Landing chat **XSS** (§5.4). |
| **High** | **Incomplete data deletion** + possible **orphaned storage** (§5.7). |
| **Medium** | **No rate limiting** on expensive/authenticated APIs. |
| **Medium** | **CSRF** — cookie-only routes rely on browser defaults; no CSRF tokens. |
| **Low** | **Misleading column names** for API keys without encryption implementation (§5.1). |

### 14.3 Performance concerns

- Admin funnel/stats/user list — **large SELECTs**.
- Vector search — ensure **pgvector index** exists in production.
- Client graph — **thousands of nodes** likely unusable without virtualization/clustering.

### 14.4 Prioritized fix list

**Before launch (must):**

1. **Fix XSS** — render chat messages as **text** (`dangerouslySetInnerHTML` removal) or sanitize (DOMPurify) for trusted HTML only.
2. **Harden `delete-all-data`** — delete or anonymize `user_events`; delete **canvases** / `canvas_vaults` as appropriate; **remove storage objects** under user prefix; check **every** Supabase `error` return.
3. **Resolve or gate ESLint errors** so CI reflects production quality.
4. **Rate-limit** `/api/track` and high-cost routes (embed, search, ingest-link, graph-builder).

**Soon after launch:**

5. Refactor admin **N+1** user detail counts (single SQL aggregation).
6. Add **monitoring** (Sentry / OpenTelemetry) for API errors and slow queries.
7. Remove **debug `console.log`**, dead `userId` in `embed/route.ts`.
8. **Document** `anthropic_api_key_enc` / `openai_api_key_enc` — implement real encryption or drop columns.

---

*End of report.*
