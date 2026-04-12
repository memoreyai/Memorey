CREATE TABLE public.user_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  event_name text NOT NULL,
  event_data jsonb DEFAULT '{}',
  page_path text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "no_client_access" ON user_events FOR ALL USING (false);
CREATE INDEX idx_user_events_created ON user_events (created_at DESC);
CREATE INDEX idx_user_events_user ON user_events (user_id, created_at DESC);
CREATE INDEX idx_user_events_name ON user_events (event_name, created_at DESC);
