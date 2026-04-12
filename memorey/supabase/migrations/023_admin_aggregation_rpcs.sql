-- Admin dashboard: aggregated counts (service_role only) to avoid N+1 and full-table scans.

CREATE OR REPLACE FUNCTION public.admin_memory_node_counts_by_canvas(p_user_id uuid)
RETURNS TABLE (canvas_id uuid, node_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mn.canvas_id,
    COUNT(*)::bigint AS node_count
  FROM public.memory_nodes mn
  WHERE mn.user_id = p_user_id
    AND mn.canvas_id IS NOT NULL
    AND mn.is_active = true
  GROUP BY mn.canvas_id;
$$;

CREATE OR REPLACE FUNCTION public.admin_memory_node_counts_by_vault(p_user_id uuid)
RETURNS TABLE (vault_id uuid, node_count bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    mn.vault_id,
    COUNT(*)::bigint AS node_count
  FROM public.memory_nodes mn
  WHERE mn.user_id = p_user_id
    AND mn.is_active = true
  GROUP BY mn.vault_id;
$$;

CREATE OR REPLACE FUNCTION public.admin_funnel_metrics()
RETURNS TABLE (
  total_signups bigint,
  completed_onboarding bigint,
  created_at_least_one_node bigint,
  created_five_plus_nodes bigint,
  used_search bigint,
  used_capture bigint,
  active_last_7_days bigint,
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
    ),
    (
      SELECT COUNT(DISTINCT ue.user_id)::bigint
      FROM public.user_events ue
      WHERE ue.event_name IN ('capture_chat_sent', 'capture_link_ingested')
    ),
    (
      SELECT COUNT(DISTINCT ue.user_id)::bigint
      FROM public.user_events ue
      WHERE ue.created_at >= (now() - interval '7 days')
    ),
    (SELECT COUNT(*)::bigint FROM public.subscriptions s WHERE s.plan <> 'free');
$$;

REVOKE ALL ON FUNCTION public.admin_memory_node_counts_by_canvas(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_memory_node_counts_by_vault(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_funnel_metrics() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_memory_node_counts_by_canvas(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_memory_node_counts_by_vault(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_funnel_metrics() TO service_role;
