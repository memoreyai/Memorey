-- Persisted graph coordinates for canvas layout (world space).
ALTER TABLE public.memory_nodes
  ADD COLUMN IF NOT EXISTS pos_x double precision DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS pos_y double precision DEFAULT NULL;

COMMENT ON COLUMN public.memory_nodes.pos_x IS 'Last saved graph X position (world coordinates)';
COMMENT ON COLUMN public.memory_nodes.pos_y IS 'Last saved graph Y position (world coordinates)';
