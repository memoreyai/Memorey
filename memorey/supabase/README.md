# Memorey + Supabase

## Schema order (canonical)

1. **`migrations/001_memorey_schema.sql`** — Core graph schema (profiles, vaults, nodes, edges, subscriptions, triggers, `search_nodes`, etc.).
2. **`migrations/004_app_backend_alignment.sql`** — App fields on `profiles` (`full_name`, `onboarding_completed`, `ai_use_cases`, …), `user_monthly_usage`, `pending_proposals`, updated `handle_new_user`.

Do **not** run `029_profiles.sql` if you already applied `001_memorey_schema` (conflicting `profiles` + trigger). Older drafts `002_stripe_billing.sql` / `003_pending_proposals.sql` are largely superseded by `004` for this stack; `004` uses `subscriptions.plan` for the free vault cap.

3. **`005_custom_vaults.sql`** — `category_vaults.name` / `color` as `TEXT`, optional `icon`, index `idx_category_vaults_user_active`.
4. **`006_seed_default_vaults_client.sql`** — `seed_default_vaults_internal` (idempotent, trigger-only), `handle_new_user` calls internal, public `seed_default_vaults` only for **authenticated** users seeding **their own** vaults (onboarding retry). Revokes anon access.
5. **`007_secure_search_and_graph_rpcs.sql`** — `search_nodes` / `get_connected_nodes` require `service_role` (API) or `auth.uid() = p_user_id` (client).
6. **`008_pending_proposals_insert_policy.sql`** — `INSERT` on `pending_proposals` for own `user_id`.
7. **`009_kanban_status.sql`** — `memory_nodes.kanban_status` (`todo` / `doing` / `done` / null), `kanban_order`, partial index for Kanban queries.

### Backend checklist (vs app)

| Need | Table / RPC |
|------|----------------|
| Auth + onboarding | `profiles`, `handle_new_user` → profile + `subscriptions` + vaults |
| Vaults / memories | `category_vaults`, `memory_nodes`, `node_edges`, `node_history`, `node_attachments` |
| Search | `search_nodes` (+ `vector` extension), embeddings on `memory_nodes` |
| Graph UI | `get_connected_nodes` |
| Billing / limits | `subscriptions`, `user_monthly_usage` (writes via service role) |
| MCP proposals | `pending_proposals` (read/update/delete/insert own rows) |
| Onboarding fix | RPC `seed_default_vaults` (authenticated, own user only) |

## Google OAuth

1. Apply migrations above (or use Supabase MCP / CLI).
2. **Authentication → Providers → Google**: enable and add OAuth client ID/secret.
3. **Authentication → URL configuration**:
   - Site URL: your app origin (e.g. `http://localhost:3000`)
   - Redirect URLs: `http://localhost:3000/auth/callback` (and production)

After sign-in, users are sent to `/dashboard/onboarding` until `profiles.onboarding_completed` is true.

## Billing (Stripe)

1. Subscriptions are stored in **`subscriptions`** (`plan`, Stripe IDs). No `plan` column on `profiles`.
2. In Stripe: product **Memorey Pro**, price **$19/month** → `STRIPE_PRO_PRICE_ID` in `.env.local`.
3. **Webhooks**: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` → `STRIPE_WEBHOOK_SECRET`.
