-- Canvas sidebar accent + optional Lucide icon (mutually exclusive display with emoji in UI when icon_key set)
ALTER TABLE public.canvases
  ADD COLUMN IF NOT EXISTS color text DEFAULT '#5DCAA5';

ALTER TABLE public.canvases
  ADD COLUMN IF NOT EXISTS icon_key text DEFAULT NULL;

COMMENT ON COLUMN public.canvases.color IS 'Sidebar list accent color (hex)';
COMMENT ON COLUMN public.canvases.icon_key IS 'Lucide icon component name; UI prefers icon over emoji when set';
