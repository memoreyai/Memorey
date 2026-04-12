-- Fix Supabase linter warnings for mutable search_path
ALTER FUNCTION public.update_updated_at() SET search_path = 'public';
ALTER FUNCTION public.seed_canvas_vaults(uuid, uuid) SET search_path = 'public';
