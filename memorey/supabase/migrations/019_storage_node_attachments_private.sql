-- Align remote: private bucket (signed URLs only)
UPDATE storage.buckets SET public = false WHERE id = 'node-attachments';
