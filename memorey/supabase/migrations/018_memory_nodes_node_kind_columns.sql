-- Optional columns for graph node typing; the app infers `nodeKindV2: 'file'` from `file_url`
-- when these are unset (see mapNodeRow in graphStore).
ALTER TABLE public.memory_nodes
  ADD COLUMN IF NOT EXISTS node_kind TEXT;

ALTER TABLE public.memory_nodes
  ADD COLUMN IF NOT EXISTS node_kind_v2 TEXT;
