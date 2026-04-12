-- Fix kanban_columns RLS to use subselect for auth.uid() (avoids per-row re-evaluation).
DROP POLICY IF EXISTS "users_own_kanban_columns" ON public.kanban_columns;

CREATE POLICY "users_own_kanban_columns"
  ON public.kanban_columns
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- Add indexes for unindexed foreign keys.
CREATE INDEX IF NOT EXISTS idx_memory_nodes_vault_id ON public.memory_nodes (vault_id);
CREATE INDEX IF NOT EXISTS idx_node_edges_user_id ON public.node_edges (user_id);
CREATE INDEX IF NOT EXISTS idx_node_edges_canvas_id ON public.node_edges (canvas_id);
CREATE INDEX IF NOT EXISTS idx_node_history_user_id ON public.node_history (user_id);

-- Composite index for the dominant query pattern: user + active + canvas
CREATE INDEX IF NOT EXISTS idx_memory_nodes_user_active_canvas
  ON public.memory_nodes (user_id, is_active, canvas_id);
