-- Default all vaults to show when empty. Users can toggle individual vaults off.
-- The prior default (false) prevented vaults from appearing on the canvas when
-- they had no memory nodes, which was unintuitive for new and existing users.

UPDATE public.category_vaults SET show_empty_in_master = true;
ALTER TABLE public.category_vaults ALTER COLUMN show_empty_in_master SET DEFAULT true;

UPDATE public.canvas_vaults SET show_empty_on_canvas = true;
ALTER TABLE public.canvas_vaults ALTER COLUMN show_empty_on_canvas SET DEFAULT true;
