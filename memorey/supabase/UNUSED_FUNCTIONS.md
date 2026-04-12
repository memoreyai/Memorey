# Unused database functions (reserved)

These Postgres functions exist in the deployed schema and migrations but are **not called** from the application code at launch. They are kept in the database intentionally; do not drop them without a deliberate decision.

## `public.get_connected_nodes`

- **Purpose:** Recursive graph traversal over `node_edges` from a starting node, up to `p_max_depth` (default 3), returning reachable `node_id` values with hop depth.
- **Parameters:** `p_user_id`, `p_node_id`, optional `p_max_depth`.
- **Security:** `SECURITY DEFINER`; allows `service_role` or callers whose `auth.uid()` matches `p_user_id`.
- **Defined in:** `supabase/migrations/007_secure_search_and_graph_rpcs.sql` (supersedes earlier definition in `001_memorey_schema.sql`).
- **Status:** Reserved for future graph UI or exploration features (e.g. neighborhood / connected-component views). Safe to leave deployed; unused RPCs incur negligible cost.

When you implement a feature that needs neighborhood traversal, call this RPC from the client or server instead of reintroducing ad hoc SQL.
