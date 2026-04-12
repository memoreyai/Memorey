-- Mirrors remote migration: storage bucket, RLS, columns for attachments & master line prefs

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'node-attachments',
  'node-attachments',
  false,
  52428800,
  ARRAY[
    'image/jpeg','image/png','image/gif','image/webp','image/svg+xml',
    'application/pdf',
    'text/plain','text/markdown',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users access own attachments" ON storage.objects;
CREATE POLICY "Users access own attachments"
ON storage.objects FOR ALL
USING (
  bucket_id = 'node-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
)
WITH CHECK (
  bucket_id = 'node-attachments'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

ALTER TABLE node_attachments
  ADD COLUMN IF NOT EXISTS storage_path TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS file_size INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS og_title TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS og_description TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS og_image TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS og_site_name TEXT DEFAULT NULL;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS master_line_style TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS master_line_color TEXT DEFAULT NULL;

ALTER TABLE canvases
  ADD COLUMN IF NOT EXISTS master_line_style TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS master_line_color TEXT DEFAULT NULL;
