CREATE OR REPLACE FUNCTION public.increment_usage(
  p_user_id uuid,
  p_year_month text,
  p_field text -- 'share_link_count' or 'chat_query_count'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_monthly_usage (user_id, year_month, share_link_count, chat_query_count)
  VALUES (
    p_user_id,
    p_year_month,
    CASE WHEN p_field = 'share_link_count' THEN 1 ELSE 0 END,
    CASE WHEN p_field = 'chat_query_count' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, year_month) DO UPDATE SET
    share_link_count = CASE
      WHEN p_field = 'share_link_count' THEN user_monthly_usage.share_link_count + 1
      ELSE user_monthly_usage.share_link_count
    END,
    chat_query_count = CASE
      WHEN p_field = 'chat_query_count' THEN user_monthly_usage.chat_query_count + 1
      ELSE user_monthly_usage.chat_query_count
    END,
    updated_at = now();
END;
$$;

REVOKE EXECUTE ON FUNCTION public.increment_usage(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_usage(uuid, text, text) TO service_role;
