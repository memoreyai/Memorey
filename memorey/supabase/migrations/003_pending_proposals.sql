-- MCP / external AI proposals — human must confirm in Memorey before graph write
CREATE TABLE pending_proposals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) <= 100),
  value TEXT NOT NULL CHECK (char_length(value) <= 600),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pending_proposals_user_status ON pending_proposals(user_id, status);
CREATE INDEX idx_pending_proposals_created ON pending_proposals(user_id, created_at DESC);

ALTER TABLE pending_proposals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_pending_proposals"
  ON pending_proposals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "users_delete_own_pending_proposals"
  ON pending_proposals FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "users_update_own_pending_proposals"
  ON pending_proposals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Inserts come from MCP service role (bypasses RLS); clients do not insert directly
