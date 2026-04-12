-- Per-vault: show column in master graph even when no memories on that canvas
ALTER TABLE public.category_vaults
  ADD COLUMN IF NOT EXISTS show_empty_in_master boolean NOT NULL DEFAULT false;

-- Per canvas+vault: show column on this canvas even when no memories
ALTER TABLE public.canvas_vaults
  ADD COLUMN IF NOT EXISTS show_empty_on_canvas boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.category_vaults.show_empty_in_master IS
  'When true, master view allocates a vault column on each linked canvas even with zero memories.';
COMMENT ON COLUMN public.canvas_vaults.show_empty_on_canvas IS
  'When true, this canvas shows the vault column even with zero memories.';
