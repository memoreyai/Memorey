-- Drop the overly permissive read policy
DROP POLICY IF EXISTS "Public read node-attachments" ON storage.objects;

-- Create a properly scoped read policy that only allows users to read their own files
CREATE POLICY "Users read own attachments" ON storage.objects
  FOR SELECT
  USING (
    bucket_id = 'node-attachments'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
