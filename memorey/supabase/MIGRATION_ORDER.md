# Supabase migration order

Apply SQL in this order in the **Supabase SQL Editor** (or via your migration runner). Do **not** run deprecated files.

Migration files use sequential numeric prefixes (`001_` … `029_`) with no duplicates.

## Apply in order (paste order)

| # | File | Purpose |
|---|------|---------|
| 1 | `migrations/001_memorey_schema.sql` | Core schema: `profiles`, vaults, memory nodes, RLS, `handle_new_user`, search/graph helpers |
| 2 | `migrations/002_stripe_billing.sql` | Stripe-related DDL |
| 3 | `migrations/003_pending_proposals.sql` | MCP proposals tables (if not fully superseded by 004; run per project needs) |
| 4 | `migrations/004_app_backend_alignment.sql` | App alignment: extra profile columns, `user_monthly_usage`, `pending_proposals` RLS/indexes, updated `handle_new_user` |
| 5 | `migrations/005_custom_vaults.sql` | Custom vaults: `category_vaults` columns, indexes |
| 6 | `migrations/006_seed_default_vaults_client.sql` | Seed RPCs / `handle_new_user` integration for default vaults |
| 7 | `migrations/007_secure_search_and_graph_rpcs.sql` | Secure `search_nodes` / `get_connected_nodes` |
| 8 | `migrations/008_pending_proposals_insert_policy.sql` | `INSERT` policy on `pending_proposals` |
| 9 | `migrations/009_kanban_status.sql` | Kanban columns on `memory_nodes` |
| 10 | `migrations/010_node_attachments.sql` | Node attachments |
| 11 | `migrations/011_onboarding_memory_goals.sql` | Onboarding memory goals |
| 12 | `migrations/012_memory_nodes_custom_text_color.sql` | Custom text color on memory nodes |
| 13 | `migrations/013_node_edges_color.sql` | Edge color |
| 14 | `migrations/014_vault_card_default_colors.sql` | Vault card default colors |
| 15 | `migrations/015_profiles_graph_edge_color.sql` | Profile graph edge color |
| 16 | `migrations/016_storage_node_attachments_master_line.sql` | Storage / master line for node attachments |
| 17 | `migrations/017_memory_nodes_source_canvas_drop.sql` | Source canvas drop metadata |
| 18 | `migrations/018_memory_nodes_node_kind_columns.sql` | Node kind columns |
| 19 | `migrations/019_storage_node_attachments_private.sql` | Private storage for node attachments |
| 20 | `migrations/020_vault_pill_theme.sql` | Vault pill theme |
| 21 | `migrations/021_vault_icon_key.sql` | Vault icon key |
| 22 | `migrations/022_vault_color_overrides.sql` | Vault color overrides |
| 23 | `migrations/023_admin_aggregation_rpcs.sql` | Admin aggregation RPCs |
| 24 | `migrations/024_fix_storage_rls.sql` | Storage RLS fixes |
| 25 | `migrations/025_fix_funnel_metrics.sql` | Funnel metrics fixes |
| 26 | `migrations/026_lock_down_rpc_privileges.sql` | RPC privilege lockdown |
| 27 | `migrations/027_add_user_events.sql` | User events table |
| 28 | `migrations/028_add_is_super_admin.sql` | `is_super_admin` on profiles |
| 29 | `migrations/029_profiles.sql` | *(Deprecated — see below)* |

**Supabase SQL editor paste order** — run each file **once**, top to bottom, in this sequence:

1. `001_memorey_schema.sql`
2. `002_stripe_billing.sql`
3. `003_pending_proposals.sql`
4. `004_app_backend_alignment.sql`
5. `005_custom_vaults.sql`
6. `006_seed_default_vaults_client.sql`
7. `007_secure_search_and_graph_rpcs.sql`
8. `008_pending_proposals_insert_policy.sql`
9. `009_kanban_status.sql`
10. `010_node_attachments.sql`
11. `011_onboarding_memory_goals.sql`
12. `012_memory_nodes_custom_text_color.sql`
13. `013_node_edges_color.sql`
14. `014_vault_card_default_colors.sql`
15. `015_profiles_graph_edge_color.sql`
16. `016_storage_node_attachments_master_line.sql`
17. `017_memory_nodes_source_canvas_drop.sql`
18. `018_memory_nodes_node_kind_columns.sql`
19. `019_storage_node_attachments_private.sql`
20. `020_vault_pill_theme.sql`
21. `021_vault_icon_key.sql`
22. `022_vault_color_overrides.sql`
23. `023_admin_aggregation_rpcs.sql`
24. `024_fix_storage_rls.sql`
25. `025_fix_funnel_metrics.sql`
26. `026_lock_down_rpc_privileges.sql`
27. `027_add_user_events.sql`
28. `028_add_is_super_admin.sql`

## Deprecated — do **not** apply

| File | Reason |
|------|--------|
| `migrations/029_profiles.sql` | Early draft; conflicts with `001_memorey_schema.sql` (duplicate `profiles` / `handle_new_user` / `on_auth_user_created`). Superseded by `001_memorey_schema.sql` + `004_app_backend_alignment.sql`. |

If `029_profiles.sql` was ever applied, resolve conflicts manually (single `profiles` definition, single trigger on `auth.users`) before relying on the order above.

## Fresh project checklist

- [ ] Run migrations `001` through `028` in order (see table above)
- [ ] Skip `029_profiles.sql`
