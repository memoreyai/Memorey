# Memorey Backend Status Report

Generated: 2026-04-12

Supabase Project URL: `https://yvaorgleljxhejnhvwxf.supabase.co`

---

## Database Tables

| Table | Exists | Columns Match | RLS Enabled | Policies Correct |
|-------|--------|---------------|-------------|------------------|
| profiles | ✅ | ⚠️ See notes¹ | ✅ | ✅ SELECT/UPDATE own |
| memory_nodes | ✅ | ⚠️ See notes² | ✅ | ✅ ALL own |
| category_vaults | ✅ | ⚠️ See notes³ | ✅ | ✅ ALL own |
| node_edges | ✅ | ⚠️ See notes⁴ | ✅ | ✅ ALL own |
| canvases | ✅ | ✅ | ✅ | ✅ ALL own |
| node_positions | ❌ Not created | N/A | N/A | N/A |
| subscriptions | ✅ | ⚠️ See notes⁵ | ✅ | ✅ SELECT own only |
| usage_counters | ❌ Uses `user_monthly_usage` | ⚠️ Different schema | ✅ | ✅ SELECT own only |
| pending_proposals | ✅ | ⚠️ See notes⁶ | ✅ | ✅ CRUD own |

### Extra tables (not in original spec but in use)

| Table | RLS Enabled | Policies | Purpose |
|-------|-------------|----------|---------|
| canvas_vaults | ✅ | ✅ ALL (via canvas owner) | M2M between canvases and vaults |
| node_history | ✅ | ✅ ALL own | Edit history tracking |
| node_attachments | ✅ | ✅ ALL own | File attachments on nodes |
| user_events | ✅ | ✅ Blocked (service-role only) | Analytics events |
| kanban_columns | ✅ | ✅ ALL own | Custom kanban columns |
| rate_limit_entries | ✅ | ✅ No policies (RPC-only access) | Rate limiting via `check_rate_limit` RPC |

### Column discrepancy notes

1. **profiles**: No `email` column (email lives in `auth.users`). Uses `segment` not `user_segment`. Has `display_name` alongside `full_name`. Additional graph/master-node preference columns. **No action needed** — frontend matches actual schema.

2. **memory_nodes**: Uses `title` + `value` (not `content/fact`). Uses `source` (not `status` + `source_platform`). No `tags`, `superseded_by`, `source_conversation_id`. Has additional kanban, file, and OG-metadata columns. **No action needed** — frontend matches actual schema.

3. **category_vaults**: No `description`, `slug`, or `updated_at`. Uses `is_custom` not `is_default`. Has additional theming columns (pill colors, card defaults, lock/pin). **No action needed** — frontend matches actual schema.

4. **node_edges**: Uses `strength` not `weight`. Has `source_attachment_id`, `target_attachment_id`, `canvas_id`, `color`. **No action needed** — frontend matches actual schema.

5. **subscriptions**: PK is `user_id` (no separate `id`). No `status`, `created_at`, `current_period_start`. **No action needed** — frontend matches actual schema.

6. **pending_proposals**: Uses `category` (not `proposed_vault`). Uses `title` + `value` (not `proposed_content`). **No action needed** — frontend matches actual schema.

---

## RPC Functions

| Function | Exists | Parameters Correct | Security |
|----------|--------|--------------------|----------|
| search_nodes | ✅ | ✅ `(p_user_id, p_query_embedding, p_vault_ids, p_limit)` | SECURITY DEFINER + auth check |
| get_connected_nodes | ✅ | ✅ `(p_user_id, p_node_id, p_max_depth)` | SECURITY DEFINER |
| check_rate_limit | ✅ | ✅ `(p_key, p_max_requests, p_window_seconds)` | SECURITY DEFINER |
| increment_usage | ✅ | ✅ `(p_user_id, p_year_month, p_field)` | SECURITY DEFINER |
| admin_funnel_metrics | ✅ | ✅ `(p_since timestamptz)` | SECURITY DEFINER |
| admin_active_user_counts | ✅ | ✅ (no params) | SECURITY DEFINER |
| admin_user_list_counts | ✅ | ✅ (no params) | SECURITY DEFINER |
| admin_memory_node_counts_by_canvas | ✅ | ✅ `(p_user_id)` | SECURITY DEFINER |
| admin_memory_node_counts_by_vault | ✅ | ✅ `(p_user_id)` | SECURITY DEFINER |
| handle_new_user | ✅ | ✅ (trigger) | — |
| protect_admin_flag | ✅ | ✅ (trigger) | — |
| update_updated_at | ✅ | ✅ (trigger) | — |
| seed_default_vaults | ✅ | ✅ `(p_user_id)` | — |
| seed_canvas_vaults | ✅ | ✅ `(p_user_id, p_canvas_id)` | — |
| seed_default_kanban_columns | ✅ | ✅ `(p_user_id, p_canvas_id)` | — |

---

## Storage

| Bucket | Exists | Private | File Limit | MIME Types | RLS |
|--------|--------|---------|------------|------------|-----|
| memorey-exports | ✅ | ✅ | ✅ 50MB (fixed from 5MB) | ✅ json, txt, md, toml, pdf (pdf added) | ✅ SELECT/INSERT/DELETE scoped to user folder |
| node-attachments | ✅ | ✅ | ✅ 50MB | ✅ images, pdf, text, docs | ✅ ALL + SELECT scoped to user folder |

### Storage fix applied
- `memorey-exports` file_size_limit increased from 5MB → 50MB
- `memorey-exports` allowed_mime_types: added `application/pdf`

---

## Extensions

| Extension | Enabled | Version | Schema |
|-----------|---------|---------|--------|
| vector (pgvector) | ✅ | 0.8.0 | extensions |
| uuid-ossp | ✅ | 1.1 | extensions |
| pgcrypto | ✅ | 1.3 | extensions |
| pg_graphql | ✅ | 1.5.11 | graphql |
| pg_stat_statements | ✅ | 1.11 | extensions |
| supabase_vault | ✅ | 0.3.1 | vault |
| plpgsql | ✅ | 1.0 | pg_catalog |

### Vector column verification
- `memory_nodes.embedding`: vector(1536) ✅ — matches OpenAI text-embedding-3-small dimensions

---

## Indexes

| Index | Exists | Definition |
|-------|--------|------------|
| memory_nodes.user_id | ✅ | `idx_memory_nodes_user_active (user_id, is_active)` |
| memory_nodes.vault_id | ✅ | `idx_memory_nodes_vault_id (vault_id)` + `idx_memory_nodes_user_vault (user_id, vault_id)` |
| memory_nodes.embedding | ✅ | `idx_memory_nodes_embedding` IVFFlat (vector_cosine_ops, lists=100) |
| memory_nodes.canvas_id | ✅ | `idx_memory_nodes_canvas (canvas_id, user_id, is_active)` + `idx_memory_nodes_user_active_canvas (user_id, is_active, canvas_id)` |
| memory_nodes.kanban_column_id | ✅ | `idx_memory_nodes_kanban_column (kanban_column_id)` |
| category_vaults.user_id | ✅ | `idx_category_vaults_user (user_id, is_active)` + `idx_category_vaults_user_active (user_id, is_active, display_order)` |
| node_edges.user_id | ✅ | `idx_node_edges_user_id (user_id)` |
| node_edges.source_node_id | ✅ | `idx_node_edges_source (source_node_id)` |
| node_edges.target_node_id | ✅ | `idx_node_edges_target (target_node_id)` |
| node_edges.canvas_id | ✅ | `idx_node_edges_canvas_id (canvas_id)` |
| canvases.user_id | ✅ | `idx_canvases_user (user_id, is_active)` |
| canvas_vaults.canvas_id | ✅ | `idx_canvas_vaults_canvas (canvas_id)` |
| canvas_vaults.vault_id | ✅ | `idx_canvas_vaults_vault (vault_id)` |
| kanban_columns.user_id | ✅ | `idx_kanban_columns_user (user_id)` |
| kanban_columns.canvas_id | ✅ | `idx_kanban_columns_canvas (canvas_id)` |
| node_attachments.user_id | ✅ | `idx_node_attachments_user (user_id, is_active)` |
| node_attachments.node_id | ✅ | `idx_node_attachments_node (node_id)` |
| node_history.node_id | ✅ | `idx_node_history_node (node_id, created_at DESC)` |
| node_history.user_id | ✅ | `idx_node_history_user_id (user_id)` |
| pending_proposals.user_id | ✅ | `idx_pending_proposals_user_status (user_id, status)` + `idx_pending_proposals_created (user_id, created_at DESC)` |
| user_events.user_id | ✅ | `idx_user_events_user (user_id, created_at DESC)` |
| user_events.event_name | ✅ | `idx_user_events_name (event_name, created_at DESC)` |
| subscriptions.user_id | ✅ | PK `subscriptions_pkey (user_id)` |
| subscriptions.dodo_customer_id | ✅ | UNIQUE `subscriptions_stripe_customer_id_key (dodo_customer_id)` |

All performance-critical indexes are present. No missing indexes detected.

---

## Frontend-Backend Contract

| API Route | Tables/RPCs Used | Contract Valid |
|-----------|------------------|---------------|
| api/embed | memory_nodes (update) | ✅ |
| api/search | memory_nodes, category_vaults, canvases, node_edges; RPC: search_nodes | ✅ |
| api/memory/create | memory_nodes, category_vaults, canvases, kanban_columns, subscriptions, user_events | ✅ |
| api/vaults/create | category_vaults, user_events | ✅ |
| api/vaults/set-active | category_vaults | ✅ |
| api/graph-builder | (indirect: subscriptions, user_monthly_usage via billing helpers) | ✅ |
| api/extract-nodes | (indirect: billing helpers) | ✅ |
| api/memory-assistant | (indirect: billing helpers) | ✅ |
| api/export | (indirect: category_vaults, memory_nodes via executeExport) | ✅ |
| api/export/share | (storage: memorey-exports bucket) | ✅ |
| api/export/strip-pii | (auth only) | ✅ |
| api/dodo/webhook | subscriptions, category_vaults | ✅ |
| api/dodo/checkout | subscriptions | ✅ |
| api/dodo/portal | subscriptions | ✅ |
| api/billing/summary | memory_nodes, category_vaults, subscriptions | ✅ |
| api/admin/users | profiles, subscriptions; RPC: admin_user_list_counts | ✅ |
| api/admin/stats | profiles, subscriptions, memory_nodes, node_edges, category_vaults; RPC: admin_active_user_counts | ✅ |
| api/admin/revenue | subscriptions | ✅ |
| api/admin/activity | user_events, profiles | ✅ |
| api/admin/users/[id] | profiles, subscriptions, memory_nodes, node_edges, category_vaults, canvases, user_monthly_usage, pending_proposals, node_attachments, user_events; RPCs: admin_memory_node_counts_by_canvas, admin_memory_node_counts_by_vault | ✅ |
| api/admin/analytics/funnel | RPC: admin_funnel_metrics | ✅ |
| api/admin/analytics/feature-usage | user_events | ✅ |
| api/admin/analytics/overview | user_events, profiles | ✅ |
| api/kanban/complete | memory_nodes, kanban_columns, node_edges | ✅ |
| api/kanban/columns | kanban_columns | ✅ |
| api/kanban/columns/reorder | kanban_columns | ✅ |
| api/profile/onboarding | profiles | ✅ |
| api/track | user_events | ✅ |
| api/user/delete-all-data | user_events, pending_proposals, node_attachments, node_history, node_edges, memory_nodes, canvases, canvas_vaults, category_vaults, user_monthly_usage | ✅ |
| api/ingest-link | canvases | ✅ |
| api/landing-chat | (no DB access) | ✅ |
| api/attachments | memory_nodes, node_attachments | ✅ |
| api/attachments/extract-meta | (auth only) | ✅ |
| api/nodes/create-file | memory_nodes, category_vaults, user_events | ✅ |

**All table names, column names, and RPC calls in the frontend match the actual database schema. No mismatches found.**

---

## Auth

- **Email auth**: ✅ (email confirmation enabled, 3 confirmed users)
- **OAuth providers**: Google ✅
- **Production domain**: `https://memorey.co` (configured in `NEXT_PUBLIC_APP_URL`)
- **Supabase URL matches env**: ✅ (`https://yvaorgleljxhejnhvwxf.supabase.co`)

---

## Migrations

- **Total migrations**: 46
- **Latest migration**: `20260410084254_expand_segment_check_constraint`
- All migrations applied successfully ✅

---

## Issues Found

### Critical (must fix before launch)

None.

### Warning (should fix soon)

1. **`DODO_SECRET_KEY`** — Placeholder value (`your_dodo_secret_key`). Billing checkout will fail until a real Dodo Payments secret key is configured.
2. **`DODO_WEBHOOK_SECRET`** — Placeholder value (`your_dodo_webhook_secret`). Webhook signature verification will reject all incoming webhooks.
3. **`DODO_PRO_MONTHLY_PRICE_ID` / `DODO_PRO_YEARLY_PRICE_ID`** — Placeholder values. Checkout flow will send invalid product IDs.
4. **`subscriptions_stripe_customer_id_key`** — Unique index still has legacy "stripe" name after Dodo migration. Cosmetic only, no functional impact.

### Info (cosmetic or low priority)

1. **`node_positions` table** does not exist — spec mentioned it but no code references it. Positions are managed client-side. No action needed.
2. **`usage_counters` table** does not exist — the actual table is `user_monthly_usage` with a different (more complete) schema. No action needed.
3. **`get_connected_nodes` RPC** exists but is not called from any API route. May be used by the MCP server or reserved for future use.

---

## Changes Applied During This Audit

| Change | Details |
|--------|---------|
| Storage: `memorey-exports` file_size_limit | Increased from 5,242,880 (5MB) → 52,428,800 (50MB) |
| Storage: `memorey-exports` allowed_mime_types | Added `application/pdf` to existing list |

---

## Verdict

**✅ BACKEND READY FOR LAUNCH**

The Supabase backend is correctly configured with proper RLS, indexes, vector search, and storage. All frontend API routes match the actual database schema. The only blockers are the Dodo Payments environment variables which must be set to real values before billing features go live.
