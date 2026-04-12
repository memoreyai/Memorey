-- Supabase Advisor:
-- 1) PERFORMANCE auth_rls_initplan: use (select auth.uid()) so auth.* is not re-evaluated per row.
-- 2) SECURITY extension_in_public: move pgvector out of public (matches uuid-ossp / other extensions).

-- ---------------------------------------------------------------------------
-- Move vector extension from public -> extensions (idempotent)
-- ---------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS extensions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON e.extnamespace = n.oid
    WHERE e.extname = 'vector' AND n.nspname = 'public'
  ) THEN
    EXECUTE 'ALTER EXTENSION vector SET SCHEMA extensions';
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- RLS: category_vaults, memory_nodes, node_edges, node_history
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "users_own_vaults" ON public.category_vaults;
CREATE POLICY "users_own_vaults" ON public.category_vaults
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_own_nodes" ON public.memory_nodes;
CREATE POLICY "users_own_nodes" ON public.memory_nodes
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_own_edges" ON public.node_edges;
CREATE POLICY "users_own_edges" ON public.node_edges
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_own_history" ON public.node_history;
CREATE POLICY "users_own_history" ON public.node_history
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- RLS: user_monthly_usage, pending_proposals
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "usage_select_own" ON public.user_monthly_usage;
CREATE POLICY "usage_select_own" ON public.user_monthly_usage
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_read_own_pending_proposals" ON public.pending_proposals;
CREATE POLICY "users_read_own_pending_proposals" ON public.pending_proposals
  FOR SELECT
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_delete_own_pending_proposals" ON public.pending_proposals;
CREATE POLICY "users_delete_own_pending_proposals" ON public.pending_proposals
  FOR DELETE
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_update_own_pending_proposals" ON public.pending_proposals;
CREATE POLICY "users_update_own_pending_proposals" ON public.pending_proposals
  FOR UPDATE
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "users_insert_own_pending_proposals" ON public.pending_proposals;
CREATE POLICY "users_insert_own_pending_proposals" ON public.pending_proposals
  FOR INSERT
  WITH CHECK ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- RLS: node_attachments, canvases, canvas_vaults
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "own_attachments" ON public.node_attachments;
CREATE POLICY "own_attachments" ON public.node_attachments
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "own_canvases" ON public.canvases;
CREATE POLICY "own_canvases" ON public.canvases
  FOR ALL
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "own_canvas_vaults" ON public.canvas_vaults;
CREATE POLICY "own_canvas_vaults" ON public.canvas_vaults
  FOR ALL
  USING (
    EXISTS (
      SELECT 1
      FROM public.canvases cv
      WHERE cv.id = canvas_vaults.canvas_id
        AND cv.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.canvases cv
      WHERE cv.id = canvas_vaults.canvas_id
        AND cv.user_id = (select auth.uid())
    )
  );

-- ---------------------------------------------------------------------------
-- RLS: profiles, subscriptions
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT
  USING ((select auth.uid()) = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE
  USING ((select auth.uid()) = id)
  WITH CHECK ((select auth.uid()) = id);

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT
  USING ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- Storage: same initplan fix for node-attachments policies
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Users access own attachments" ON storage.objects;
CREATE POLICY "Users access own attachments" ON storage.objects
  FOR ALL
  USING (
    bucket_id = 'node-attachments'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  )
  WITH CHECK (
    bucket_id = 'node-attachments'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users read own attachments" ON storage.objects;
CREATE POLICY "Users read own attachments" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'node-attachments'
    AND (select auth.uid())::text = (storage.foldername(name))[1]
  );
