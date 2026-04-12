-- Per-connection stroke colour override (optional)
ALTER TABLE public.node_edges
  ADD COLUMN IF NOT EXISTS color TEXT DEFAULT NULL;
