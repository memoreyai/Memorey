-- Revoke public access to admin aggregate functions
REVOKE EXECUTE ON FUNCTION public.admin_funnel_metrics(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_funnel_metrics(timestamptz) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_memory_node_counts_by_canvas(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_memory_node_counts_by_canvas(uuid) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_memory_node_counts_by_vault(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_memory_node_counts_by_vault(uuid) TO service_role;

-- Add auth check inside seed_canvas_vaults
CREATE OR REPLACE FUNCTION public.seed_canvas_vaults(p_user_id uuid, p_canvas_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify the caller owns this data (unless service_role which bypasses RLS)
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: user mismatch';
  END IF;

  INSERT INTO public.canvas_vaults (canvas_id, vault_id, display_order)
  SELECT p_canvas_id, cv.id, cv.display_order
  FROM public.category_vaults cv
  WHERE cv.user_id = p_user_id
    AND cv.is_active = true
  ON CONFLICT DO NOTHING;
END;
$$;

-- Restrict seed_canvas_vaults to authenticated + service_role only
REVOKE EXECUTE ON FUNCTION public.seed_canvas_vaults(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_canvas_vaults(uuid, uuid) TO authenticated, service_role;
