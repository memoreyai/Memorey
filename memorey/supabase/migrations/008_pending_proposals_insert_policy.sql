-- Allow authenticated users to create their own pending proposals (e.g. MCP / future flows).
DROP POLICY IF EXISTS "users_insert_own_pending_proposals" ON public.pending_proposals;
CREATE POLICY "users_insert_own_pending_proposals"
  ON public.pending_proposals FOR INSERT
  WITH CHECK (auth.uid() = user_id);
