# Memorey — Comprehensive Technical Audit & Project Report

**Generated:** 2026-03-21  
**Codebase root:** `memorey/` (Next.js application)  
**Database:** Queried live via Supabase MCP **"memorey supabase"** (Postgres). Schema sections below are from actual queries, not inferred from code alone.

---

## 1. Project overview

### 1.1 Product

**Memorey** is a **personal knowledge / memory graph** web application. Users organize information as **memory nodes** inside **category vaults**, connect them with **edges**, optionally scope work to **canvases** (multi-workspace), use a **Kanban** view for tasks, **semantic search** over embeddings, **AI-assisted capture** (chat, link ingestion, graph builder), and **export** flows. Marketing copy on the login page: *“Your memory. For every AI you use.”*

### 1.2 Problem solved

- Centralized, structured memory with **visual graph** navigation and **vault** theming.  
- **OAuth**-based sign-in with **Row Level Security** so users only see their own data.  
- **Pro/billing** via Stripe; usage metering for share-link and chat query limits (server-side).

### 1.3 Target user

Individuals (founders, developers, researchers, etc.—reflected in onboarding `segment` options) who want a **private, persistent memory layer** with optional AI features (Anthropic/OpenAI keys or server keys).

### 1.4 Tech stack

| Layer | Technology |
|--------|------------|
| **Frontend** | Next.js **16.1.7** (App Router), React **19.2.3**, TypeScript **5** |
| **Backend** | Next.js **Route Handlers** (`src/app/api/**/route.ts`) — no separate Node server |
| **Database** | **Supabase** (PostgreSQL) |
| **Auth** | **Supabase Auth** + `@supabase/ssr` (cookies); **Google OAuth** in UI |
| **File storage** | **Supabase Storage** (`node-attachments` bucket) |
| **AI** | **Anthropic** (Claude) primary in API routes; **OpenAI** for embeddings in some routes |
| **Payments** | **Stripe** (Checkout, Customer Portal, Webhooks) |
| **Hosting** | Not defined in-repo; README mentions **Vercel** as typical for Next.js |

### 1.5 Frameworks, libraries, and package versions (from `memorey/package.json`)

**Dependencies (production):**

- `@anthropic-ai/sdk` ^0.79.0  
- `@base-ui/react` ^1.3.0  
- `@dnd-kit/core` ^6.3.1, `@dnd-kit/sortable` ^10.0.0, `@dnd-kit/utilities` ^3.2.2  
- `@stripe/stripe-js` ^8.10.0 *(declared; no `import` in `src` — see §7)*  
- `@supabase/ssr` ^0.9.0, `@supabase/supabase-js` ^2.99.2  
- `cheerio` ^1.2.0  
- `class-variance-authority` ^0.7.1, `clsx` ^2.1.1  
- `cmdk` ^1.1.1  
- `date-fns` ^4.1.0  
- `graphology` ^0.26.0, `graphology-layout-forceatlas2` ^0.10.1, `graphology-shortest-path` ^2.1.0  
- `immer` ^11.1.4  
- `lucide-react` ^0.577.0  
- `next` 16.1.7  
- `next-themes` ^0.4.6  
- `openai` ^6.32.0  
- `react` / `react-dom` 19.2.3  
- `react-force-graph-2d` ^1.29.1 *(landing demos)*  
- `resend` ^6.9.4 *(no usage in `src` — see §7)*  
- `shadcn` ^4.0.8  
- `sonner` ^2.0.7  
- `stripe` ^20.4.1  
- `tailwind-merge` ^3.5.0  
- `tw-animate-css` ^1.4.0  
- `zustand` ^5.0.12  

**DevDependencies:** `@tailwindcss/postcss` ^4, `tailwindcss` ^4, `eslint` ^9, `eslint-config-next` 16.1.7, `@types/node` ^20, `@types/react` ^19, `typescript` ^5  

### 1.6 Folder / file structure (`memorey/`)

**Root**

| Path | Purpose |
|------|---------|
| `package.json` | Dependencies and npm scripts (`dev`, `build`, `start`, `lint`) |
| `package-lock.json` | Lockfile |
| `next.config.ts` | Minimal Next config (empty options object) |
| `tsconfig.json` | TypeScript project config |
| `components.json` | shadcn/ui configuration |
| `README.md` | Generic create-next-app readme + export bucket note |
| `.env.local.example` | Documented environment variable names |
| `next-env.d.ts` | Next.js TypeScript references |

**`src/app/` — App Router**

| Path | Purpose |
|------|---------|
| `layout.tsx` | Root layout: fonts (Syne, Inter, JetBrains Mono), theme boot script, `TooltipProvider`, `DiffModal`, `sonner` `Toaster` |
| `page.tsx` | Home → re-exports `LandingPage` |
| `globals.css` | Tailwind v4 imports + Memorey design tokens (`--bg`, `--orange`, sidebar widths, etc.) |
| `(auth)/login/page.tsx` | Google OAuth login UI |
| `(dashboard)/dashboard/layout.tsx` | Dashboard shell wrapper, loads user profile/subscription |
| `(dashboard)/dashboard/page.tsx` | Main graph entry under `/dashboard` |
| `(dashboard)/dashboard/capture/page.tsx` | Capture UI |
| `(dashboard)/dashboard/kanban/page.tsx` | Kanban board |
| `(dashboard)/dashboard/search/page.tsx` | Search page |
| `(dashboard)/dashboard/settings/page.tsx` | Settings (billing, API keys, MCP URL, data deletion) |
| `(dashboard)/dashboard/onboarding/page.tsx` | Onboarding wizard |
| `(dashboard)/graph/page.tsx` | Full-height graph at `/graph` |
| `(dashboard)/settings/page.tsx` | **Stub** settings at `/settings` (title only) |
| `auth/callback/route.ts` | OAuth code exchange + redirect by onboarding state |
| `api/**/route.ts` | Server API routes (see §5) |

**`src/components/`**

| Area | Purpose |
|------|---------|
| `graph/` | Canvas-based memory graph: `MemoryGraph.tsx`, `canvas/` rendering, `hooks/`, `ui/` overlays, `layout/`, `interaction/` |
| `graph-legacy/MemoryGraphImpl.tsx` | Deprecated re-export to `MemoryGraph` |
| `landing/` | Marketing landing and force-graph demos |
| `layout/` | `DashboardShell`, `CanvasSwitcher`, `sidebar-context` |
| `capture/` | `InAppChat`, `ShareLinkInput` |
| `kanban/` | `KanbanCard` |
| `export/` | `ExportPanel` |
| `diff/` | Proposal diff UI (`DiffModal`, `DiffNodeCard`, `useDiff`) |
| `attachments/` | `AttachPanel` |
| `dashboard/` | `PendingProposalsBell` |
| `memorey/` | `MemoreyLogo` |
| `ui/` | shadcn-style primitives (`button`, `dialog`, `tabs`, …) |

**`src/store/`**

| File | Purpose |
|------|---------|
| `graphStore.ts` | Graphology graph + node/edge state |
| `vaultStore.ts` | Vaults + subscription tier checks |
| `canvasStore.ts` | Canvases and active canvas |
| `diffStore.ts` | MCP/diff proposal flow |
| `exportPanelStore.ts` | Export panel open state |
| `vaultManagerOverlayStore.ts` | Vault manager overlay |

**`src/lib/`**

| Area | Purpose |
|------|---------|
| `supabase/` | Browser client, server client, admin client, mappers; `types.ts` is stub `Database = Record<string, never>` |
| `ai/` | Embeddings / extract / search helpers |
| `billing/` | Plan limits + usage (service role) |
| `export/` | Export execution and formatting |
| `vaults/` | Vault fetch + retry + RPC seed |
| Various utilities | `theme.ts`, `uploadAttachment.ts`, `parseCssColor.ts`, etc. |

**`supabase/`**

| File | Purpose |
|------|---------|
| `MIGRATION_ORDER.md`, `README.md` | Migration documentation |

---

## 2. Frontend audit

### 2.1 Pages / routes (from `next build` route table)

| Route | Role |
|-------|------|
| `/` | Landing (client component export) |
| `/login` | Google OAuth |
| `/dashboard` | Primary app “Graph” view inside dashboard chrome |
| `/dashboard/capture` | Capture |
| `/dashboard/kanban` | Kanban |
| `/dashboard/search` | Search UI |
| `/dashboard/settings` | Full settings |
| `/dashboard/onboarding` | Onboarding (no `DashboardShell` chrome) |
| `/graph` | Standalone graph + export panel (dark background wrapper) |
| `/settings` | **Placeholder** — only heading “Settings” |
| `/auth/callback` | OAuth handler (dynamic) |
| `/api/*` | API routes (dynamic) |

**Note:** `/settings` and `/dashboard/settings` both exist; navigation in `DashboardShell` uses `/dashboard/settings`. Middleware protects `/settings` and redirects unauthenticated users.

### 2.2 Components — inventory, props, usage

The app has **70+** React/TSX files under `src/components/`. Below: **exported UI components** with explicit `*Props` interfaces or major exported types, plus **where they are referenced** (primary parent or route).

**Graph UI (`src/components/graph/ui/`)**

| Component | Props (summary) | Used by |
|-----------|-----------------|--------|
| `VaultManager` | `isOpen`, `userId`, `onClose` | `DashboardShell` |
| `VaultSettingsPopover` | Large interface (vault, callbacks, theme state) | `MemoryGraphChrome` |
| `FlexibleColorInput` | Color field + callbacks | `VaultSettingsPopover`, `VaultManager` |
| `MemoryGraphChrome` | `MemoryGraphChromeProps` (refs, canvas handlers, search, bulk actions, vaults, nodes, …) | `MemoryGraph` |
| `LucideIconPicker` | Picker props | `VaultManager`, `VaultSettingsPopover` |
| `SearchBar` | Search UI props | `MemoryGraphChrome` |
| `NodeDetailSheet` | Node detail + attachments + history | `MemoryGraphChrome` |
| `LegendPanel` | Legend toggles | `MemoryGraphChrome` |
| `Toolbar` | Toolbar actions | `MemoryGraphChrome` |
| `KeyboardShortcutsModal` | Open/close | `MemoryGraphChrome` |
| `PlainEnglishView` | Plain-english view props | `MemoryGraphChrome` |
| `ContextMenu` | Context menu state | `MemoryGraphChrome` |
| `ExportModal` | `ExportModalProps` | `MemoryGraphChrome` |
| `ConnectModeBar` | Connect mode UI | `MemoryGraphChrome` |
| `ChatGraphBuilder` | Chat builder props | `MemoryGraphChrome` |
| `BulkMoveModal` | Bulk move | `MemoryGraphChrome` |
| `MasterNodeEditor` | Master node editing | `MemoryGraphChrome` |
| `QuickCreateForm` | Quick create | `MemoryGraphChrome` |
| `AddMemoryModal` | Add memory | `MemoryGraphChrome` |
| `EdgeStylePicker` | Edge style | `MemoryGraphChrome` |
| `BulkActionBar` | Bulk selection actions | `MemoryGraphChrome` |
| `EdgeContextMenu` | Edge context menu | `MemoryGraphChrome` |
| `PinModal` | Vault PIN | `VaultSettingsPopover` |
| `NodePeekAnchored` | Peek popover | `MemoryGraphChrome` |
| `DropVaultPickerModal` | Vault picker | `MemoryGraph` / chrome |
| `VaultManager` | See above | `DashboardShell` |

**Graph core**

| Component | Notes |
|-----------|--------|
| `MemoryGraph` | Orchestrates canvas engine, stores, chrome; no simple props interface (self-contained) |

**Layout**

| Component | Props | Used by |
|-----------|-------|---------|
| `DashboardShell` | `user: DashboardShellUser`, `children` | `dashboard/layout.tsx` |
| `CanvasSwitcher` | Canvas switching (internal + store) | `DashboardShell` |
| `SidebarProvider` / `useSidebar` | Collapsed sidebar state | `DashboardShell` |

**Landing**

| Component | Notes |
|-----------|--------|
| `LandingPage` | Composes landing sections |
| `HeroGraph`, `LandingGraphDemo`, `MemoreyLandingGraph`, etc. | Force-graph demos; various internal props |

**Other**

| Component | Props | Used by |
|-----------|-------|---------|
| `DiffModal` | `DiffModalProps` | `app/layout.tsx` (global) |
| `DiffNodeCard` | `DiffNodeCardProps` | `DiffModal` |
| `ExportPanel` | Store-driven | `DashboardShell`, `/graph` page |
| `PendingProposalsBell` | — | `DashboardShell` |
| `AttachPanel` | Attachment UI | `NodeDetailSheet` |
| `KanbanCard` | Card UI | `kanban/page.tsx` |
| `MemoreyLogo` | `size`, `className` | Login, shell, marketing |
| `UpgradeBanner` | Billing CTA | `dashboard/page.tsx` (if imported) — verify in file |
| `ThemeToggle` | Theme control | Settings / UI |

**shadcn-style `src/components/ui/`** — `button`, `card`, `dialog`, `input`, `tabs`, `tooltip`, etc.: typically `React.ComponentProps<typeof Primitive>` pattern; used across graph and settings.

### 2.3 State management

- **Zustand** stores: `graphStore`, `vaultStore`, `canvasStore`, `diffStore`, `exportPanelStore`, `vaultManagerOverlayStore`.  
- **React Context:** `sidebar-context.tsx` for sidebar UI.  
- **No Redux / React Query / SWR** in dependencies.

### 2.4 Styling

- **Tailwind CSS v4** with `@import "tailwindcss"`, `tw-animate-css`, `shadcn/tailwind.css`.  
- **Custom CSS variables** in `globals.css` for Memorey tokens: `--bg`, `--text`, `--orange`, `--sidebar-w`, radii, shadows; separate light theme block (`[data-theme="light"]`).  
- **Theme persistence:** `localStorage` key `memorey-theme` + inline boot script in `layout.tsx` (class `dark` on `<html>`).  
- **Fonts:** Next `next/font/google` — Syne (display), Inter (body), JetBrains Mono.

### 2.5 Custom hooks (`src/hooks/` + `src/components/graph/hooks/`)

| Hook | Purpose |
|------|---------|
| `useIsDarkTheme` | Derives dark/light from DOM/data-theme for vault theming |
| `useMcpInbox` | Loads/updates `pending_proposals` for MCP inbox |
| `useGraphData` | Loads graph data from Supabase + session |
| `useGraphCanvasEvents` | Pointer/canvas events |
| `useMemoryGraphEngine` | Main render/engine loop |
| `useMemoryGraphLifecycle` | Mount/effect lifecycle |
| `useMemoryGraphRefs` | Ref wiring |
| `useMemoryGraphUiState` | UI state slice |
| `useMemoryGraphChromeProps` | Builds props for `MemoryGraphChrome` |
| `useCanvasSetup` | Canvas sizing/devicePixelRatio |
| `useDrawLoop` | Animation frame loop |
| `useVaultLayout` | Vault column layout |
| `useSearch` | Search + semantic search orchestration |
| `useNodeActions` | CRUD operations on nodes/edges |
| `useKeyboardShortcuts` | Keyboard handling |
| `useEdgeStyle` | Edge style persistence (profile/canvases) |
| `useConnectMode` | Edge creation mode |
| `useMinimap` | Minimap |
| `useDiff` (`components/diff/useDiff.ts`) | Diff modal logic |

### 2.6 Forms & validation

- **Onboarding / settings:** controlled inputs; segment and profile fields updated via Supabase `.update()` — validation is mostly **HTML/UI** (length limits enforced in DB).  
- **Node create/edit:** title/value length enforced in DB (`char_length` checks).  
- **API routes:** manual checks (e.g. auth header, body parsing); no Zod in `package.json`.

### 2.7 Error handling (frontend)

- **`sonner` toasts** for user-visible errors (e.g. vault operations).  
- **Global `DiffModal`** for proposal review.  
- **Login** shows query param errors (`oauth_failed`).  
- **No React error boundary** component found in `layout.tsx` beyond default Next behavior.

### 2.8 Animations, loading, transitions

- **`tw-animate-css`** imported globally.  
- **Landing:** force-graph animations; hero canvases.  
- **Dashboard layout:** “Loading…” placeholder until `user` is set.  
- **Login:** Suspense fallback with logo.  
- **Search:** `semanticLoading` passed through chrome for search UI.

### 2.9 Responsive design

- Tailwind utility classes; sidebar collapse (`--sidebar-w-collapsed`).  
- **No explicit breakpoint token file** — standard Tailwind breakpoints (`sm`, `md`, …) used ad hoc.  
- Graph is **canvas-heavy**; mobile experience not separately documented in code.

---

## 3. Backend & database audit (live Supabase)

### 3.1 Extensions (installed, relevant)

From MCP `list_extensions` (selected): **`vector`** (public, 0.8.0), **`uuid-ossp`**, **`pgcrypto`**, **`pg_graphql`**, **`pg_stat_statements`**, **`supabase_vault`**, etc.

### 3.2 Public schema tables — columns, constraints, relationships

All **11** public tables are **BASE TABLE** (no views in `information_schema` for `public`).

#### `profiles`

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|--------|
| `id` | uuid | NO | — | PK, **FK → `auth.users.id`** |
| `display_name` | text | YES | — | |
| `avatar_url` | text | YES | — | |
| `segment` | text | YES | — | CHECK: `founder`, `developer`, `consultant`, `researcher`, `other` |
| `created_at` | timestamptz | YES | `now()` | |
| `updated_at` | timestamptz | YES | `now()` | |
| `full_name` | text | YES | — | |
| `ai_use_cases` | text[] | NO | `{}` | |
| `onboarding_step` | int4 | NO | `0` | |
| `onboarding_completed` | bool | NO | `false` | |
| `graph_edge_style` | text | YES | `orthogonal-dashed` | CHECK: orthogonal/curved × dashed/dotted |
| `master_node_bio` | text | YES | — | |
| `master_node_color` | text | YES | `#FF6600` | |
| `memory_goals` | text[] | YES | `{}` | |
| `primary_use_case` | text | YES | — | |
| `anthropic_api_key_enc` | text | YES | — | **Sensitive** |
| `openai_api_key_enc` | text | YES | — | **Sensitive** |
| `active_canvas_id` | uuid | YES | — | **FK → `canvases.id`** |
| `graph_edge_color` | text | YES | — | |
| `master_line_style` | text | YES | — | |
| `master_line_color` | text | YES | — | |

**RLS:** enabled.

#### `category_vaults`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK, default `uuid_generate_v4()` |
| `user_id` | uuid | FK → `profiles.id` |
| `name` | text | |
| `color` | text | default `#5DCAA5` |
| `is_custom` | bool | default `false` |
| `is_active` | bool | default `true` |
| `display_order` | int4 | default `0` |
| `created_at` | timestamptz | default `now()` |
| `icon` | text | nullable |
| `is_visible` | bool | default `true` |
| `is_exportable` | bool | default `true` |
| `pin_hash` | text | nullable |
| `is_locked` | bool | default `false` |
| `default_card_accent`, `default_card_bg`, `default_card_text` | text | nullable |
| `pill_fill_bg`, `pill_border_color`, `pill_text_color` | text | nullable |
| `icon_key` | text | nullable |
| `color_overrides` | jsonb | nullable, comment: light/dark slices |

#### `memory_nodes`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles.id` |
| `vault_id` | uuid | FK → `category_vaults.id` |
| `title` | text | CHECK `char_length <= 100` |
| `value` | text | CHECK `char_length <= 600` |
| `confidence` | float8 | default `1.0`, CHECK 0–1 |
| `source` | text | default `manual`; CHECK: chat, share_link, manual, import, extension, canvas-drop |
| `embedding` | **vector** | nullable (embedding extension) |
| `is_active` | bool | default `true` |
| `created_at`, `updated_at` | timestamptz | default `now()` |
| `kanban_status` | text | CHECK todo/doing/done/null |
| `kanban_order` | float8 | default `0` |
| `custom_bg_color`, `custom_accent_color`, `custom_text_color` | text | nullable |
| `node_type` | text | default `memory`; CHECK memory/sticky |
| `canvas_id` | uuid | FK → `canvases.id` |
| `node_kind_v2` | text | default `memory` |
| `file_url`, `file_name`, `file_type`, `storage_path`, `thumbnail_url` | various | file nodes |
| `file_size` | int4 | nullable |
| `og_title`, `og_description`, `og_image`, `og_site_name` | text | nullable |

#### `node_edges`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles.id` |
| `source_node_id`, `target_node_id` | uuid | FK → `memory_nodes.id` |
| `strength` | float8 | default `0.5`, 0–1 |
| `label` | text | nullable |
| `created_at` | timestamptz | default `now()` |
| `source_attachment_id`, `target_attachment_id` | uuid | FK → `node_attachments.id` |
| `canvas_id` | uuid | FK → `canvases.id` |
| `color` | text | nullable |

**Unique index:** `(source_node_id, target_node_id)`.

#### `node_history`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `node_id` | uuid | FK → `memory_nodes.id` |
| `user_id` | uuid | FK → `profiles.id` |
| `old_title`, `new_title` | text | |
| `old_value`, `new_value` | text | |
| `change_summary` | text | nullable |
| `triggered_by` | text | default `user`; CHECK user/ai_extract/import |
| `created_at` | timestamptz | default `now()` |

#### `subscriptions`

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | uuid | PK, FK → `profiles.id` |
| `plan` | text | default `free`; CHECK free/pro/enterprise |
| `stripe_customer_id` | text | nullable, UNIQUE |
| `stripe_subscription_id` | text | nullable |
| `current_period_end` | timestamptz | nullable |
| `updated_at` | timestamptz | default `now()` |

#### `user_monthly_usage`

| Column | Type | Notes |
|--------|------|--------|
| `user_id` | uuid | PK (composite) |
| `year_month` | text | PK (composite) |
| `share_link_count` | int4 | default `0` |
| `chat_query_count` | int4 | default `0` |
| `updated_at` | timestamptz | default `now()` |

#### `pending_proposals`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles.id` |
| `category` | text | |
| `title` | text | length ≤ 100 |
| `value` | text | length ≤ 600 |
| `status` | text | default `pending`; CHECK pending/accepted/rejected |
| `created_at` | timestamptz | default `now()` |

#### `node_attachments`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles.id` |
| `node_id` | uuid | nullable FK → `memory_nodes.id` |
| `file_url`, `file_name` | text | |
| `file_type` | text | CHECK image/video/pdf/doc/… |
| `mime_type` | text | nullable |
| `thumbnail_url` | text | nullable |
| `source` | text | CHECK url/googledrive/dropbox/onedrive |
| `source_file_id` | text | nullable |
| `file_size_bytes` | int8 | nullable |
| `title`, `description` | text | nullable |
| `is_active` | bool | default `true` |
| `created_at` | timestamptz | default `now()` |
| `storage_path`, `file_size` | | nullable |
| `og_*` | text | nullable |

#### `canvases`

| Column | Type | Notes |
|--------|------|--------|
| `id` | uuid | PK |
| `user_id` | uuid | FK → `profiles.id` |
| `name` | text | default `My Canvas` |
| `description` | text | nullable |
| `master_node_bio` | text | nullable |
| `master_node_color` | text | default `#FF6600` |
| `emoji` | text | default `🧠` |
| `is_active` | bool | default `true` |
| `display_order` | int4 | default `1` |
| `created_at`, `updated_at` | timestamptz | default `now()` |
| `master_line_style`, `master_line_color` | text | nullable |

#### `canvas_vaults`

| Column | Type | Notes |
|--------|------|--------|
| `canvas_id` | uuid | PK (composite), FK → `canvases.id` |
| `vault_id` | uuid | PK (composite), FK → `category_vaults.id` |
| `display_order` | int4 | default `1` |
| `created_at` | timestamptz | default `now()` |

### 3.3 Row Level Security — exact policies (live query)

**`public` schema**

| Table | Policy name | Command | Roles | USING (`qual`) | WITH CHECK |
|-------|-------------|---------|-------|----------------|------------|
| `canvas_vaults` | `own_canvas_vaults` | ALL | public | `EXISTS (SELECT 1 FROM canvases WHERE canvases.id = canvas_vaults.canvas_id AND canvases.user_id = auth.uid())` | — |
| `canvases` | `own_canvases` | ALL | public | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `category_vaults` | `users_own_vaults` | ALL | public | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `memory_nodes` | `users_own_nodes` | ALL | public | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `node_attachments` | `own_attachments` | ALL | public | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `node_edges` | `users_own_edges` | ALL | public | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `node_history` | `users_own_history` | ALL | public | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `pending_proposals` | `users_read_own_pending_proposals` | SELECT | public | `auth.uid() = user_id` | — |
| `pending_proposals` | `users_insert_own_pending_proposals` | INSERT | public | — | `auth.uid() = user_id` |
| `pending_proposals` | `users_update_own_pending_proposals` | UPDATE | public | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `pending_proposals` | `users_delete_own_pending_proposals` | DELETE | public | `auth.uid() = user_id` | — |
| `profiles` | `users_own_profile` | ALL | public | `auth.uid() = id` | `auth.uid() = id` |
| `subscriptions` | `users_own_subscription` | ALL | public | `auth.uid() = user_id` | `auth.uid() = user_id` |
| `user_monthly_usage` | `usage_select_own` | SELECT | public | `auth.uid() = user_id` | — |

**Observation:** `user_monthly_usage` has **only SELECT** for `authenticated` via `public` role policies. **INSERT/UPDATE** from the browser would be denied; the app correctly uses **service role** in `lib/billing/usage.ts` for upserts.

**`storage.objects`**

| Policy name | Command | USING | WITH CHECK |
|-------------|---------|-------|------------|
| `Public read node-attachments` | SELECT | `bucket_id = 'node-attachments'` | — |
| `Users access own attachments` | ALL | `bucket_id = 'node-attachments' AND auth.uid()::text = (storage.foldername(name))[1]` | same |

### 3.4 Database functions (app-relevant, public schema)

**Custom / business logic (non-vector boilerplate):**

```sql
-- Trigger helper: sets NEW.updated_at on memory_nodes UPDATE
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- On new auth user: insert profile, subscription, seed vaults
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger ... -- inserts profiles, subscriptions, PERFORM seed_default_vaults_internal(NEW.id)

CREATE OR REPLACE FUNCTION public.seed_default_vaults_internal(p_user_id uuid) RETURNS void ...;
CREATE OR REPLACE FUNCTION public.seed_default_vaults(p_user_id uuid) RETURNS void ...; -- auth.uid() check
CREATE OR REPLACE FUNCTION public.seed_canvas_vaults(p_user_id uuid, p_canvas_id uuid) RETURNS void ...;

CREATE OR REPLACE FUNCTION public.search_nodes(
  p_user_id uuid, p_query_embedding vector, p_vault_ids uuid[], p_limit int DEFAULT 15
) RETURNS TABLE(...) ... SECURITY DEFINER; -- JWT must match p_user_id unless service_role

CREATE OR REPLACE FUNCTION public.get_connected_nodes(
  p_user_id uuid, p_node_id uuid, p_max_depth int DEFAULT 3
) RETURNS TABLE(node_id uuid, depth int) ... SECURITY DEFINER;
```

**Note:** `get_connected_nodes` **exists in DB** but **no references** in `src/` (potential future RPC or dead feature).

Remaining `public` functions are overwhelmingly **`pgvector`** operators (`vector_*`, distance functions, etc.).

### 3.5 Triggers (live)

| Schema | Table | Trigger | Timing | Function |
|--------|-------|---------|--------|----------|
| `auth` | `users` | `on_auth_user_created` | AFTER INSERT | `handle_new_user()` |
| `public` | `memory_nodes` | `memory_nodes_updated_at` | BEFORE UPDATE | `update_updated_at()` |

### 3.6 Indexes (non-PK), public

Listed by live query (excluding `*_pkey`):

- `canvas_vaults`: `idx_canvas_vaults_canvas`, `idx_canvas_vaults_vault`  
- `canvases`: `idx_canvases_user`  
- `category_vaults`: `idx_category_vaults_user`, `idx_category_vaults_user_active`  
- `memory_nodes`: `idx_memory_nodes_canvas`, `idx_memory_nodes_embedding` (**ivfflat** `vector_cosine_ops`, lists=100), `idx_memory_nodes_kanban`, `idx_memory_nodes_kind_v2`, `idx_memory_nodes_user_active`, `idx_memory_nodes_user_vault`  
- `node_attachments`: `idx_node_attachments_node`, `idx_node_attachments_user`  
- `node_edges`: `idx_node_edges_source`, `idx_node_edges_target`, **UNIQUE** `(source_node_id, target_node_id)`  
- `node_history`: `idx_node_history_node`  
- `pending_proposals`: `idx_pending_proposals_created`, `idx_pending_proposals_user_status`  
- `subscriptions`: **UNIQUE** `stripe_customer_id`  

### 3.7 Views / materialized views

**None** in `public` (`information_schema.tables` shows only `BASE TABLE`).

### 3.8 Enums / custom types

App data uses **text + CHECK** constraints (not Postgres ENUM types for domains like `plan`).  
**pgvector** supplies types: `vector`, `halfvec`, `sparsevec` in `public`.

### 3.9 Storage buckets (live)

| Bucket | Public | Size limit | MIME allowlist |
|--------|--------|------------|----------------|
| `node-attachments` | **true** | 52428800 (50MB) | images, pdf, docx, md, txt, etc. |

### 3.10 Edge Functions

MCP `list_edge_functions` returned **`[]`** — **no Edge Functions deployed** on this project (or none visible to the integration).

### 3.11 Data flow — sign up (Google OAuth)

1. User hits `/login` → `signInWithOAuth({ provider: 'google', redirectTo: .../auth/callback })`.  
2. Supabase Auth creates or links user in **`auth.users`**.  
3. **Trigger `on_auth_user_created`** → **`handle_new_user()`**:  
   - **`INSERT` into `profiles`**  
   - **`INSERT` into `subscriptions`** (`plan = 'free'`)  
   - **`PERFORM seed_default_vaults_internal(user_id)`** (8 default vaults if none exist)  
4. Client completes **`/auth/callback`** → `exchangeCodeForSession` → reads **`profiles.onboarding_completed`** → redirects to `/dashboard` or `/dashboard/onboarding`.  
5. **Middleware** enforces onboarding completion for protected routes.

**RLS:** All subsequent reads/writes use **`auth.uid()`**-scoped policies on app tables.

---

## 4. Authentication & authorization

### 4.1 End-to-end auth

- **Login:** Google OAuth only (no email/password UI in codebase).  
- **Session:** Supabase session in **HTTP-only cookies** via `@supabase/ssr` (`middleware`, `auth/callback`, server client).  
- **User resolution:** `supabase.auth.getUser()` in middleware; client uses `createClient()` from `@/lib/supabase/client`.  
- **Logout:** Not grep-highlighted in snippet; typically `supabase.auth.signOut()` from settings (confirm in `settings/page.tsx` if present).

### 4.2 Roles / permission levels

- **Database:** No custom Postgres roles exposed to the app; **RLS** uses `auth.uid()`.  
- **Product:** `subscriptions.plan`: **`free` | `pro` | `enterprise`** (CHECK constraint).  
- **Admin API:** `SUPABASE_SERVICE_ROLE_KEY` in Route Handlers bypasses RLS for billing, search RPC, export, delete-all-data.

### 4.3 Protected routes

- **`src/middleware.ts`:** Protects `/dashboard/*`, `/graph`, `/settings/*`, `/login`.  
- Unauthenticated → redirect `/login`.  
- Authenticated + incomplete onboarding → force `/dashboard/onboarding` except that path.  
- Completed onboarding cannot access onboarding page (redirect to `/dashboard`).

### 4.4 Auth state persistence

- **Cookie-based** Supabase session (SSR-compatible).  
- **Client** `onAuthStateChange` in dashboard layout reloads profile/subscription.

---

## 5. API & data layer

### 5.1 Supabase table/RPC usage by area (cross-reference)

| Table / RPC | Operations | Representative files |
|-------------|------------|----------------------|
| `profiles` | select/update | `middleware.ts`, `dashboard/layout.tsx`, `onboarding/page.tsx`, `useGraphData.ts`, `useEdgeStyle.ts`, `auth/callback`, `settings`, `ExportModal`, `stripe/webhook` |
| `category_vaults` | CRUD | `VaultManager`, `VaultSettingsPopover`, `vaultStore`, `settings`, `api/vaults/*`, `diffStore`, `stripe/webhook` (visibility) |
| `memory_nodes` | CRUD | `graphStore`, `NodeDetailSheet`, `useNodeActions`, `api/memory/create`, `api/search`, `api/embed`, `kanban`, `export` |
| `node_edges` | CRUD | `graphStore`, `NodeDetailSheet`, `useConnectMode`, `EdgeContextMenu`, `api/search`, `api/kanban/complete` |
| `node_attachments` | CRUD | `NodeDetailSheet`, `api/attachments`, `uploadAttachment` |
| `node_history` | insert/select | `NodeDetailSheet` |
| `canvases`, `canvas_vaults` | CRUD | `canvasStore`, `useEdgeStyle`, `VaultManager` |
| `subscriptions` | select/update | `vaultStore`, `dashboard/layout`, Stripe routes, `billing/summary` |
| `pending_proposals` | CRUD | `PendingProposalsBell`, `useMcpInbox`, `diffStore`, `api/user/delete-all-data` |
| `user_monthly_usage` | read/write | **`lib/billing/usage.ts` (service role only)** |
| **RPC** `seed_default_vaults` | call | `onboarding/page.tsx`, `diffStore.ts`, `fetchVaultsWithRetry.ts` |
| **RPC** `seed_canvas_vaults` | call | `canvasStore.ts` |
| **RPC** `search_nodes` | call | `api/search/route.ts` (admin client) |
| Storage `node-attachments` | upload/get | `uploadAttachment.ts`, `NodeDetailSheet` |

### 5.2 External APIs

| Integration | Purpose | Key management |
|-------------|---------|----------------|
| **Anthropic** | Chat, extraction, memory assistant, landing chat, export strip PII | `ANTHROPIC_API_KEY`, optional `ANTHROPIC_MODEL` |
| **OpenAI** | Embeddings (`api/embed`, parts of search) | `OPENAI_API_KEY` |
| **Stripe** | Checkout, portal, webhooks | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (publishable for client if used) |

### 5.3 Data fetching pattern

- **No React Query:** fetching via **`useEffect` + Supabase client**, or **server Route Handlers** with `fetch` from client.  
- **Search API** uses **service role** + **`search_nodes` RPC** for vector search.

### 5.4 Caching

- No explicit HTTP cache layers in code review; Next **static** prerender for many routes.

### 5.5 Environment variables (names only — from `.env.local.example` + grep)

| Variable | Role |
|----------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (browser + server) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (API routes, admin) |
| `ANTHROPIC_API_KEY` | Claude API |
| `ANTHROPIC_MODEL` | Claude model id override |
| `OPENAI_API_KEY` | OpenAI embeddings/API |
| `STRIPE_SECRET_KEY` | Stripe server |
| `STRIPE_WEBHOOK_SECRET` | Webhook verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable |
| `STRIPE_PRO_PRICE_ID` | Pro subscription price |
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (OAuth, Stripe return) |
| `NEXT_PUBLIC_MCP_SERVER_URL` | Display-only MCP server URL in settings |
| `SUPABASE_EXPORT_BUCKET` | Export share bucket name (default `memorey-exports`) |

---

## 6. Features — detailed breakdown

| Feature | Description | UI / components | DB | Status |
|---------|-------------|-------------------|-----|--------|
| Landing | Marketing home | `LandingPage`, hero graphs | — | Complete |
| Google login | OAuth | `login/page`, `auth/callback` | `auth.users`, trigger → `profiles`, `subscriptions`, vaults | Complete |
| Onboarding | Profile/segment/goals | `dashboard/onboarding/page.tsx` | `profiles`, `category_vaults`, RPC | Complete |
| Memory graph | Canvas graph of nodes/edges | `MemoryGraph`, canvas engine, chrome | `memory_nodes`, `node_edges`, vaults, canvases | Complete |
| Vault manager | Create/edit vaults, themes | `VaultManager`, `VaultSettingsPopover` | `category_vaults`, `canvas_vaults` | Complete |
| Kanban | Todo/doing/done | `dashboard/kanban`, `KanbanCard` | `memory_nodes.kanban_*`, `api/kanban/complete` | Complete |
| Semantic search | Vector + keyword paths | `dashboard/search`, `api/search` | `search_nodes` RPC, `memory_nodes.embedding` | Complete (depends on keys) |
| Capture | Chat + share link | `capture/page`, `InAppChat`, `ShareLinkInput` | nodes, usage | Complete |
| Export | Data export + share links | `ExportPanel`, `api/export`, `api/export/share` | reads nodes/vaults; storage bucket for exports | Complete (optional bucket) |
| Billing | Stripe Pro | `settings`, `UpgradeBanner`, `api/stripe/*` | `subscriptions` | Complete (needs Stripe config) |
| MCP proposals | Inbox + diff accept/reject | `PendingProposalsBell`, `DiffModal`, `useMcpInbox` | `pending_proposals` | Complete |
| Attachments | Files on nodes | `AttachPanel`, `api/attachments` | `node_attachments`, storage | Complete |
| Account deletion | Wipe user data | `api/user/delete-all-data` | all user tables via admin | Complete |
| `/settings` stub | Placeholder route | `settings/page.tsx` | — | **Incomplete / duplicate** |

---

## 7. Bugs, issues & technical debt

### 7.1 Known / inferred issues

- **`/settings`** is a **stub** while **`/dashboard/settings`** is full settings — confusing if users bookmark `/settings`.  
- **`get_connected_nodes` RPC** exists in DB but **unused** in app — dead DB surface or future feature.  
- **`src/lib/supabase/types.ts`:** `Database` type is **empty** — no generated types; higher typo/contract risk.  
- **Unused npm packages:** `resend` (no imports); `@stripe/stripe-js` (no imports).  
- **Public storage bucket `node-attachments`:** Bucket is **public** with a policy allowing **SELECT** for entire bucket id; combined with path policy, **objects are world-readable if URL is known** — intentional for thumbnails/links but worth security review.  
- **Middleware deprecation:** Build warns: *middleware file convention is deprecated; use proxy* (Next 16).

### 7.2 TODO / FIXME / HACK

- **Grep in `src`:** **no** `TODO`/`FIXME`/`HACK` matches.

### 7.3 Dead / legacy code

- `graph-legacy/MemoryGraphImpl.tsx` — re-export only; consumers can import `MemoryGraph` directly.

### 7.4 Security notes

- **Service role** must never reach the client — only used in `route.ts` and `admin.ts` (verify deployment env).  
- **User API keys** stored in `profiles` (`*_enc` columns) — encryption semantics depend on app code (audit encrypt/decrypt paths separately).  
- **RLS** is consistently **own-row** for core tables; **`user_monthly_usage`** correctly not client-writable.

### 7.5 Performance notes

- Large **`MemoryGraph`** bundle; canvas work is main cost.  
- **IVFFlat** index on embeddings — tuning depends on data size.  
- **No code-split** report generated beyond Next defaults.

---

## 8. Deployment & DevOps

### 8.1 Deployment

- **Not pinned** in repository. README suggests **Vercel** for Next.js. Environment variables must be set in host.

### 8.2 CI/CD

- **No** `.github/workflows` or similar in the provided file tree — **no in-repo CI** discovered.

### 8.3 Build scripts

- `npm run dev` — Next dev  
- `npm run build` — `next build`  
- `npm run start` — `next start`  
- `npm run lint` — `eslint`

### 8.4 Current build status (executed locally)

- **`next build`:** **Succeeded** (Next 16.1.7 Turbopack).  
- **Warning:** Middleware → proxy migration message.  
- **TypeScript:** Passed.  
- **Static generation:** 36 pages.

---

## 9. What’s missing or incomplete

### 9.1 Gaps

- **`/settings`** placeholder vs real settings.  
- **Supabase generated types** not integrated.  
- **Edge Functions:** none listed.  
- **`get_connected_nodes`:** unused.  
- **Email/password, magic link:** not implemented in UI (Auth could still enable them in dashboard).

### 9.2 Recommended next steps

1. **Remove or redirect** `/settings` → `/dashboard/settings`.  
2. **Run `supabase gen types`** and replace `Database` stub.  
3. **Remove or use** `resend` and `@stripe/stripe-js`.  
4. **Document** deployment (Vercel/env checklist).  
5. **Decide** on `get_connected_nodes` — wire up or drop from DB.  
6. **Add CI** (lint + build on PR).

### 9.3 Architectural notes

- **Monolithic Next app** with heavy client graph is appropriate for MVP; if graph grows, consider **worker offload** for layout or **WASM**.  
- **Vector search** correctly isolated in **RPC + service role** to avoid exposing raw embedding scans under overly broad RLS patterns.

---

## Appendix A — Code vs database mismatches

| Topic | Code expectation | Database reality |
|-------|------------------|------------------|
| Export bucket | `SUPABASE_EXPORT_BUCKET` default `memorey-exports` | MCP listed only `node-attachments` — **export bucket may be absent until created** (README warns) |
| Types | `src/lib/supabase/types.ts` empty | Rich schema exists — **regenerate types** |
| RPC usage | `search_nodes`, `seed_*` used | `get_connected_nodes` **not** used in codebase |

---

*End of report.*
