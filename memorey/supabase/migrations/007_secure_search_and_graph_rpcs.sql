-- Prevent IDOR: only service_role (server) or matching auth.uid() may query other users' data.

CREATE OR REPLACE FUNCTION public.search_nodes(
  p_user_id UUID,
  p_query_embedding VECTOR(1536),
  p_vault_ids UUID[],
  p_limit INTEGER DEFAULT 15
)
RETURNS TABLE (
  id UUID,
  vault_id UUID,
  title TEXT,
  value TEXT,
  confidence FLOAT,
  similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden'
        USING ERRCODE = '42501',
              MESSAGE = 'search_nodes: not authorized';
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    mn.id,
    mn.vault_id,
    mn.title,
    mn.value,
    mn.confidence,
    (1 - (mn.embedding <=> p_query_embedding))::FLOAT AS similarity
  FROM public.memory_nodes mn
  WHERE mn.user_id = p_user_id
    AND mn.vault_id = ANY(p_vault_ids)
    AND mn.is_active = true
    AND mn.embedding IS NOT NULL
  ORDER BY mn.embedding <=> p_query_embedding
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_connected_nodes(
  p_user_id UUID,
  p_node_id UUID,
  p_max_depth INTEGER DEFAULT 3
)
RETURNS TABLE (node_id UUID, depth INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(current_setting('request.jwt.claim.role', true), '') IS DISTINCT FROM 'service_role' THEN
    IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
      RAISE EXCEPTION 'forbidden'
        USING ERRCODE = '42501',
              MESSAGE = 'get_connected_nodes: not authorized';
    END IF;
  END IF;

  RETURN QUERY
  WITH RECURSIVE connected AS (
    SELECT ne.target_node_id AS node_id, 1 AS depth
    FROM public.node_edges ne
    WHERE ne.source_node_id = p_node_id AND ne.user_id = p_user_id
    UNION ALL
    SELECT ne.target_node_id, c.depth + 1
    FROM public.node_edges ne
    JOIN connected c ON ne.source_node_id = c.node_id
    WHERE c.depth < p_max_depth AND ne.user_id = p_user_id
  )
  SELECT DISTINCT node_id, MIN(depth)::INTEGER AS depth
  FROM connected
  GROUP BY node_id;
END;
$$;
