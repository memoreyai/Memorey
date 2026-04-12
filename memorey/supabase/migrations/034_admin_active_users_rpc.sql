CREATE OR REPLACE FUNCTION public.admin_active_user_counts()
RETURNS TABLE(active_7d bigint, active_30d bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT
    (SELECT COUNT(DISTINCT user_id) FROM public.user_events WHERE created_at >= now() - interval '7 days') AS active_7d,
    (SELECT COUNT(DISTINCT user_id) FROM public.user_events WHERE created_at >= now() - interval '30 days') AS active_30d;
$$;

REVOKE EXECUTE ON FUNCTION public.admin_active_user_counts() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_active_user_counts() TO service_role;
