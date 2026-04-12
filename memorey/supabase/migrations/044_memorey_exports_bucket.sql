-- Create the memorey-exports storage bucket for temporary share links.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memorey-exports',
  'memorey-exports',
  false,
  5242880,
  ARRAY['application/json', 'text/plain', 'text/markdown', 'application/toml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies: owner-scoped access (files stored as {user_id}/filename)
CREATE POLICY "exports_select_own"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'memorey-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "exports_insert_own"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'memorey-exports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "exports_delete_own"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'memorey-exports' AND (storage.foldername(name))[1] = auth.uid()::text);
