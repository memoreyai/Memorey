# Memorey AI - Honest Technical Assessment

**Date:** April 9, 2026
**Prepared by:** Lead Developer
**For:** Founder

---

## What Has Been Built and What It Actually Does

Memorey is a personal knowledge graph application. The core idea: users capture knowledge from their AI conversations (ChatGPT, Claude, Gemini, Perplexity) and organize it into a visual graph of interconnected memory nodes, grouped by category vaults (Work, Goals, Personal, Health, etc.).

The system has three parts:

1. **A Next.js web application** (the main product) - dashboard with graph visualization, search, kanban board, share link capture, export, settings, admin panel, onboarding, and a landing page.

2. **A Chrome extension** - injects user's memory context into AI chat interfaces so Claude/ChatGPT can reference what the user already knows. Also detects share links for import.

3. **An MCP server** (Model Context Protocol) - a standalone Express server that lets Claude Desktop or other MCP-compatible tools query and update a user's memory graph via API.

**The full end-to-end flow:** User signs up with Google OAuth, completes onboarding, creates a canvas (workspace), captures memories either manually, via AI chat extraction, or by pasting share links from AI platforms. Memories are organized into vaults, visualized as an interactive graph, and can be searched semantically. The Chrome extension then injects relevant memories back into AI conversations as context.

---

## What Is Working and Can Be Used Today

### Core Authentication
- Google OAuth sign-in via Supabase works end-to-end
- Auth callback properly exchanges codes for sessions
- New user signup triggers automatic profile creation, subscription row, and 8 default vaults via database trigger
- Login page properly handles errors and loading states

### Onboarding Flow
- 5-step onboarding works: segment selection, AI tool selection, memory goals, use case, first canvas creation
- Progress tracking persists between steps
- Creates default canvas and seeds vault associations on completion
- Properly redirects returning users away from onboarding

### Dashboard and Navigation
- Sidebar with canvas navigation, collapsible, responsive on mobile
- Multi-canvas support: create, rename, add emoji/icon, switch between canvases
- Master view aggregating all canvases
- Theme toggle (dark/light) with localStorage persistence

### Memory Graph Visualization
- Full interactive canvas-based graph rendering using HTML5 Canvas API
- Nodes displayed in vault-grouped columns with color coding
- Click to select, drag to move, scroll to zoom, right-click context menu
- Node creation via double-click, keyboard shortcut (N), or add button
- Edge creation between nodes (connect mode)
- Bulk selection and bulk actions
- Multiple view modes: graph, plain text list, tree view
- Minimap for navigation
- Node position persistence (saves x/y coordinates to database)
- File drag-and-drop onto canvas (creates file-type nodes with vault picker)
- Keyboard shortcuts throughout (documented in help modal)
- Node detail sheet for editing title, value, vault assignment
- Edge styling (curved, straight, dashed) with color customization

### Vault Management
- 8 default vaults seeded on signup
- Custom vault creation with name, color, icon
- Per-vault card styling (accent, background, text colors)
- Light/dark mode color overrides via JSONB
- Vault activation/deactivation (free plan limited to 3 active)
- Vault display order management
- Canvas-specific vault visibility toggles

### Share Link Capture
- Paste share links from ChatGPT, Claude.ai, Gemini, Perplexity
- URL validation for whitelisted domains
- Server fetches page content, parses HTML, extracts conversation
- AI (Claude) extracts structured memory nodes from conversation
- PII stripping before sending to Claude
- Diff modal shows proposed nodes for user review before saving
- Canvas picker for destination workspace
- Free plan: 5 imports per month enforced

### Kanban Board
- Drag-and-drop card movement between columns
- Default columns (To Do, In Progress, Done) seeded per canvas
- Custom column creation with name and color
- Column reorder, rename, delete
- Master kanban view across all canvases
- Search within kanban
- AI-suggested updates when marking tasks complete

### Search
- Natural language search queries
- Semantic search using OpenAI embeddings + pgvector similarity
- AI-generated answers using Claude with memory context
- 1-hop neighbor node inclusion for richer context
- Results displayed with vault coloring and canvas badges
- Free plan: 10 queries per month

### Export
- Export memories in Markdown, JSON, TOML, or plain text
- PII stripping option before export
- Full JSON backup of all data
- Shareable export links (15-minute expiry via signed Supabase Storage URLs)
- Copy to clipboard, download as file

### Settings
- Account management (sign out)
- Plan and usage display (current plan, node count, limits)
- MCP integration section with Bearer token display
- Active vault management
- Delete all data (GDPR-style reset with confirmation)

### Admin Panel
- Protected by `is_super_admin` flag on profiles (trigger-protected)
- Dashboard overview: user count, pro users, signups, active users, nodes, edges
- User management: list, search, filter by plan, sort, pagination
- Individual user detail: stats, vaults, canvases, usage history, event timeline
- Activity log: last 100 events across all users
- Analytics: DAU/WAU/MAU charts, signup trends, feature usage, conversion funnel
- Revenue estimates (placeholder math, not connected to Stripe)

### Landing Page
- Marketing page with animated graph demos
- Interactive graph playground
- Feature showcase sections
- Pricing information
- Demo chat (falls back to mock if no Anthropic key)

### Analytics/Event Tracking
- Client-side event tracking via `/api/track`
- Events: page_view, node_created, capture_link_ingested, search_performed, canvas_created, vault_created, etc.
- Deduplication within 2 seconds
- Used in admin analytics dashboards

### Database
- Supabase (PostgreSQL) with 12 tables, all with RLS enabled
- pgvector extension for semantic search embeddings
- Proper foreign key relationships and cascade deletes
- Indexes on all query-hot columns
- 42 migrations applied successfully
- Currently has: 1 user, 8 vaults, 1 canvas, 3 nodes, 2 edges, 12 events

---

## What Is Partially Built But Not Complete

### 1. Middleware / Route Protection
**The problem:** A fully-written `proxy.ts` file exists at `src/proxy.ts` with proper auth checks, onboarding enforcement, and route matching. However, it is **not wired up as Next.js middleware.** There is no `middleware.ts` file at the project root. The `proxy` function is exported but never called by the framework.

**What this means:** Right now, if someone navigates directly to `/dashboard` without being logged in, the app will render the dashboard layout. It will show an infinite loading skeleton (because the user data fetch returns nothing), but it won't redirect to `/login`. The auth protection exists only as client-side checks inside individual components.

**Impact:** Low-severity security issue for a pre-launch app, but must be fixed before real users.

### 2. Chrome Extension - Missing Backend Routes
The extension code references three API endpoints that **do not exist** in the web app:
- `POST /api/mcp/get_context` - fetches memory context for injection (no `/api/mcp/` directory exists)
- `POST /api/auth/refresh` - refreshes JWT tokens (no refresh endpoint exists)
- `/extension-auth` - OAuth callback for extension authentication (no route exists)

**What this means:** The extension is fully coded on the client side (popup, content script, background worker, auth flow, context injection). But it cannot authenticate or fetch data because the server endpoints it depends on don't exist. The extension is **non-functional** until these 3 routes are created.

### 3. Chrome Extension - Sidebar Feature
The content script has a "Phase 2" sidebar stub that shows a placeholder panel on AI chat pages. The UI scaffolding and CSS exist but the sidebar does nothing.

### 4. MCP Server - Partially Deployed
The MCP server (Express) is fully coded and has a Dockerfile + Railway config for deployment. It has 3 working tools: `get_context`, `get_graph_summary`, `propose_node_update`. However:
- It's unclear if it has actually been deployed to Railway
- CORS is set to `origin: true` (allows any origin) which is too permissive for production
- The `.env.example` exists but no `.env` file is present

### 5. Stripe Billing Integration
The Stripe checkout, portal, and webhook endpoints are fully coded and structurally correct. However:
- All Stripe environment variables are placeholders (`your_stripe_secret`, `your_webhook_secret`, etc.)
- `STRIPE_PRO_PRICE_ID` is not set, so the checkout button will fail
- Admin revenue page shows hardcoded estimates ($10/pro, $50/enterprise) not connected to real Stripe data
- The webhook handler logic (upgrade/downgrade/cancel) is complete but untestable without real keys

**What this means:** The upgrade flow exists in code but will error if a user clicks "Upgrade to Pro." The billing summary page will show free plan data correctly but can't process any payments.

### 6. AI Features Without API Keys
- `ANTHROPIC_API_KEY` is set to `your_anthropic_key` (placeholder)
- `OPENAI_API_KEY` is set to `your_openai_key` (placeholder)

**What this means with no keys:**
- Memory Assistant (chat-based extraction): Will return 500 errors
- Search: Will fail on both embedding and answer generation
- Share link capture: Extraction step will fail
- Landing page chat: Will fall back to mock/canned responses (graceful)
- Embeddings: Silently skipped (nodes created but not searchable)
- Kanban AI suggestions: Gracefully returns empty suggestions
- Graph builder chat: Will fail

### 7. In-App Chat Component
`src/components/capture/InAppChat.tsx` returns `null`. This is a stub for a future feature where users could chat directly in the app to extract memories. Currently, users must use the Share Link Capture or the Graph Builder chat panel instead.

### 8. Extract Nodes API
`/api/extract-nodes` contains a comment: "Replace with LLM extraction when OPENAI_API_KEY is set." Currently uses simple regex-based sentence splitting instead of AI extraction. This is the endpoint called during onboarding to process initial text input.

---

## What Is Missing That Was Clearly Intended But Not Started

### 1. Extension Auth Route (`/extension-auth`)
The extension expects a page that handles OAuth and passes tokens back to the extension via URL hash fragment. This page does not exist anywhere in the codebase.

### 2. MCP Context API (`/api/mcp/get_context`)
The extension and MCP server both reference this endpoint. The MCP server implements it internally, but the main web app has no `/api/mcp/` routes at all. The extension points to the main web app URL, not the MCP server.

### 3. Token Refresh Endpoint (`/api/auth/refresh`)
The extension's background worker calls this to refresh expired JWTs. No such endpoint exists.

### 4. Memory Detail Page
No `/dashboard/memory/[id]` page exists. When you view a node in the graph, you can only see it via the side sheet or peek popup. There's no dedicated full-page view for a memory node.

### 5. Profile Page
No `/dashboard/profile` page exists. User name and avatar come from Google OAuth and are displayed in the sidebar but there's no page to edit profile information.

### 6. Notification System
The MCP server creates `pending_proposals` in the database and the sidebar shows a badge count, but there's no real notification system - no email, no push, no in-app notification panel beyond the badge number.

---

## Bugs and Broken Flows

### Critical Bugs

**1. Middleware not wired up**
`src/proxy.ts` exports a `proxy` function and a `config` object, but Next.js requires a file named `middleware.ts` at the project root (or `src/middleware.ts`) that exports a default function named `middleware`. The proxy is dead code. Unauthenticated users can reach `/dashboard` and see a broken loading state.

**2. All AI features fail without API keys**
With placeholder keys, the memory assistant, search, share link capture extraction, and graph builder will all return 500 errors when users try them. The app doesn't show helpful error messages for most of these - users will see generic "something went wrong" toasts.

### Medium Bugs

**3. Rate limiter is in-memory only**
The rate limiter uses a JavaScript Map. On Vercel (serverless), each function invocation gets a fresh memory space. The rate limiter will never actually limit anything in production because the counter resets on every cold start. The code has a comment acknowledging this: "Use Redis for production."

**4. Settings page has duplicate backup section**
The backup/export UI appears twice in the settings page code (around lines 527-567), showing the same buttons duplicated.

**5. Kanban legacy migration runs every page load**
The `ensureKanbanMigrated` function queries the database on every kanban page visit to check if nodes need migrating from `kanban_status` to `kanban_column_id`. This is unnecessary overhead for users who have already been migrated.

**6. Dashboard layout never redirects unauthenticated users**
`src/app/(dashboard)/dashboard/layout.tsx` shows a skeleton while loading user data but has no fallback redirect if the user turns out to be unauthenticated. Without middleware, this means an infinite skeleton.

### Minor Bugs

**7. `pos_x`/`pos_y` columns referenced in code but migrations show them as `DOUBLE PRECISION`**
The code and schema align, but there's no validation that positions are reasonable numbers. A NaN or Infinity could theoretically be stored and break graph rendering.

**8. Node attachments table has both `file_size` (INT) and `file_size_bytes` (BIGINT)**
Two columns for the same purpose. Application code may write to one and read from the other inconsistently.

**9. Soft-deleted nodes still visible in some queries**
`is_active = false` is used for soft deletes but RLS policies don't filter by `is_active`. Application code must remember to add the filter on every query. Some queries may miss it.

---

## Database Schema Summary

**12 tables, all with Row Level Security enabled:**

| Table | Rows | Purpose |
|-------|------|---------|
| `profiles` | 1 | User identity, onboarding state, preferences, admin flag |
| `category_vaults` | 8 | Memory categories (Work, Goals, Personal, Health, Finance, Study, Relationships, Preferences) |
| `memory_nodes` | 3 | The actual memories - title, value, vault, canvas, embedding, position, kanban state |
| `node_edges` | 2 | Connections between memory nodes with strength and optional labels |
| `node_history` | 0 | Immutable audit trail of node edits |
| `subscriptions` | 1 | Billing plan (free/pro/enterprise), Stripe IDs |
| `user_monthly_usage` | 0 | Monthly rate limiting counters (share links, chat queries) |
| `pending_proposals` | 0 | MCP/extension proposed nodes awaiting user review |
| `node_attachments` | 0 | File metadata linked to nodes (URLs, OG data, storage paths) |
| `canvases` | 1 | Workspaces containing grouped memories |
| `canvas_vaults` | 8 | Which vaults appear on which canvas |
| `user_events` | 12 | Analytics event log |
| `kanban_columns` | 0 | Custom kanban board columns per canvas |

**Key relationships:**
- Every table links back to `profiles` via `user_id`
- Memory nodes belong to both a vault and optionally a canvas
- Edges connect two memory nodes
- Canvases have vault associations via the junction table `canvas_vaults`
- Vector embeddings (1536-dimensional, OpenAI format) stored directly on memory_nodes for semantic search via pgvector with IVFFlat index

---

## Third-Party Services Connected and Configured

| Service | Status | Purpose |
|---------|--------|---------|
| **Supabase** (PostgreSQL + Auth + Storage) | Connected with real credentials | Database, authentication, file storage |
| **Google OAuth** (via Supabase) | Configured and working | User sign-in |
| **Anthropic (Claude)** | Placeholder key - NOT working | Memory extraction, search answers, PII stripping, share link parsing, kanban suggestions |
| **OpenAI** | Placeholder key - NOT working | Text embeddings for semantic search |
| **Stripe** | Placeholder keys - NOT working | Subscription billing (checkout, portal, webhooks) |
| **Railway** | Deployment config exists, deployment status unknown | MCP server hosting |
| **Vercel** | .vercel in gitignore, metadata in layout suggests Vercel deployment | Web app hosting |

---

## Environment Variables

| Variable | Status | Required For |
|----------|--------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Set (real) | Everything |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Set (real) | Everything |
| `SUPABASE_SERVICE_ROLE_KEY` | Set (real) | Admin operations, search, webhooks |
| `ANTHROPIC_API_KEY` | Placeholder | Memory extraction, search, capture, PII strip |
| `ANTHROPIC_MODEL` | Set (`claude-sonnet-4-6`) | Model selection |
| `OPENAI_API_KEY` | Placeholder | Embeddings, semantic search |
| `STRIPE_SECRET_KEY` | Placeholder | Checkout, portal, webhooks |
| `STRIPE_WEBHOOK_SECRET` | Placeholder | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Placeholder | Client-side Stripe initialization |
| `STRIPE_PRO_PRICE_ID` | Placeholder | Checkout session creation |
| `NEXT_PUBLIC_APP_URL` | Set (`http://localhost:3000`) | Redirects, share links |

**Note:** `.env.local` is properly gitignored. The Supabase credentials in .env.local are real but not committed to git.

---

## What a User Can Do Today Without Anything Breaking

1. Visit the landing page and see the marketing site with animated graph demos
2. Sign in with Google (OAuth works)
3. Complete the 5-step onboarding flow (except the final text extraction step will use basic regex splitting, not AI)
4. See the dashboard with their memory graph canvas
5. Manually create memory nodes (title + value) and assign them to vaults
6. Drag, zoom, and pan the graph visualization
7. Create edges between nodes
8. Change node colors, vault colors, and edge styles
9. Create multiple canvases and switch between them
10. Use master view to see all canvases together
11. Manage vaults (create, rename, recolor, reorder, add icons)
12. Switch between graph view, plain text view, and tree view
13. Use keyboard shortcuts for navigation and node management
14. Drag and drop files onto the canvas to create file-type nodes
15. Open the kanban board (columns need to be seeded first via the kanban page)
16. Drag kanban cards between columns
17. Export memories as Markdown, JSON, TOML, or plain text (copy or download)
18. Do a full JSON backup of all data
19. Delete all data (with confirmation)
20. Sign out
21. Toggle dark/light theme
22. View settings page with plan info (will show free plan correctly)

## What Will Break If a User Tries It

1. **Search** - Will fail with 500 error (no OpenAI key for embeddings, no Anthropic key for answers)
2. **Share link capture** - Link fetching may work but extraction will fail (no Anthropic key)
3. **Memory Assistant chat** - Will fail with 500 error (no Anthropic key)
4. **Graph Builder chat** - Will fail with 500 error (no Anthropic key)
5. **"Upgrade to Pro" button** - Will fail (no Stripe keys or price ID)
6. **"Manage Subscription" link** - Will fail (no Stripe customer)
7. **Chrome extension** - Cannot authenticate or fetch context (server endpoints don't exist)
8. **Shareable export links** - Will fail with 503 if `memorey-exports` storage bucket doesn't exist in Supabase
9. **PII stripping before export** - Will fail (no Anthropic key)
10. **Navigating directly to /dashboard while logged out** - Infinite loading skeleton instead of redirect to login
11. **Landing page demo chat** - Will show canned mock responses instead of real AI (graceful degradation, not a crash)
12. **Admin revenue page** - Shows placeholder estimates, not real Stripe data

---

## Three Most Important Things to Fix Before Showing to Real Users

### 1. Wire up the middleware
Rename `src/proxy.ts` to `src/middleware.ts` and rename the exported `proxy` function to `middleware`. This gives you route protection, login redirects, and onboarding enforcement in one move. The code is already written and correct - it just needs to be in the right file with the right export name.

### 2. Add real API keys (Anthropic + OpenAI)
Without these, the three headline features of the product don't work: AI memory extraction, semantic search, and share link capture. These are the features that differentiate Memorey from a simple note-taking app. Set `ANTHROPIC_API_KEY` and `OPENAI_API_KEY` in `.env.local` with real keys. Everything else will start working immediately - the code is all there.

### 3. Set up Stripe (or hide the upgrade UI)
Either add real Stripe credentials (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRO_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`) and create the Pro plan price in Stripe dashboard, **or** temporarily hide/disable the upgrade buttons and billing UI so users don't hit errors. Showing a broken payment flow is worse than not showing one at all.

---

## Bottom Line

The architecture is solid. The database schema is well-designed with proper RLS, indexes, and cascade deletes. The graph visualization engine is genuinely impressive - custom Canvas API rendering with force-directed layout, drag-and-drop, connect mode, multiple view types, and keyboard shortcuts. The component structure is clean, the state management (Zustand + Immer) is appropriate, and the API routes have proper rate limiting, input validation, and error handling.

What's missing is mostly configuration, not code. The biggest gap is the Chrome extension backend (3 API routes that don't exist yet). After that, it's really just API keys and the middleware rename.

This is a real product with real functionality. With the three fixes above, the core web app is ready for early users to try.
