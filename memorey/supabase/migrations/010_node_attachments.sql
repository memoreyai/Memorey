-- File attachments: references only (zero file bytes on Memorey servers)

CREATE TABLE IF NOT EXISTS node_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  node_id UUID REFERENCES memory_nodes(id) ON DELETE SET NULL,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL
    CHECK (file_type IN (
      'image', 'video', 'pdf', 'doc', 'spreadsheet',
      'presentation', 'audio', 'link', 'other'
    )),
  mime_type TEXT,
  thumbnail_url TEXT,
  source TEXT NOT NULL
    CHECK (source IN ('url', 'googledrive', 'dropbox', 'onedrive')),
  source_file_id TEXT,
  file_size_bytes BIGINT,
  title TEXT,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE node_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own_attachments" ON node_attachments
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

ALTER TABLE node_edges
  ADD COLUMN IF NOT EXISTS source_attachment_id UUID
    REFERENCES node_attachments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS target_attachment_id UUID
    REFERENCES node_attachments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_node_attachments_user
  ON node_attachments(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_node_attachments_node
  ON node_attachments(node_id);
