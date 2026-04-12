-- Clarify that "active" in the funnel is always a rolling last-7-days count from now(),
-- not tied to p_since (the window used for search/capture and defaulted from the admin funnel API).

DROP FUNCTION IF EXISTS public.admin_funnel_metrics(timestamptz);

CREATE OR REPLACE FUNCTION public.admin_funnel_metrics(p_since timestamptz DEFAULT now() - interval '30 days')
RETURNS TABLE (
  total_signups bigint,
  completed_onboarding bigint,
  created_at_least_one_node bigint,
  created_five_plus_nodes bigint,
  used_search bigint,
  used_capture bigint,
  active_last_7_days_rolling bigint,
  upgraded_to_pro bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (SELECT COUNT(*)::bigint FROM public.profiles),
    (SELECT COUNT(*)::bigint FROM public.profiles WHERE onboarding_completed = true),
    (SELECT COUNT(DISTINCT mn.user_id)::bigint FROM public.memory_nodes mn WHERE mn.is_active = true),
    (
      SELECT COUNT(*)::bigint
      FROM (
        SELECT mn.user_id
        FROM public.memory_nodes mn
        WHERE mn.is_active = true
        GROUP BY mn.user_id
        HAVING COUNT(*) >= 5
      ) s
    ),
    (
      SELECT COUNT(DISTINCT ue.user_id)::bigint
      FROM public.user_events ue
      WHERE ue.event_name = 'search_performed'
        AND ue.created_at >= p_since
    ),
    (
      SELECT COUNT(DISTINCT ue.user_id)::bigint
      FROM public.user_events ue
      WHERE ue.event_name IN ('capture_chat_sent', 'capture_link_ingested')
        AND ue.created_at >= p_since
    ),
    (
      -- Intentionally NOT filtered by p_since: rolling activity window only.
      SELECT COUNT(DISTINCT ue.user_id)::bigint
      FROM public.user_events ue
      WHERE ue.created_at >= now() - interval '7 days'
    ),
    (SELECT COUNT(*)::bigint FROM public.subscriptions s WHERE s.plan <> 'free');
$$;

REVOKE ALL ON FUNCTION public.admin_funnel_metrics(timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_funnel_metrics(timestamptz) TO service_role;
