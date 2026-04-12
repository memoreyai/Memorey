-- User-defined Kanban columns per canvas; memory_nodes.kanban_column_id links to them.

CREATE TABLE public.kanban_columns (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  canvas_id uuid REFERENCES canvases(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text DEFAULT '#5DCAA5',
  display_order int4 NOT NULL DEFAULT 0,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE kanban_columns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_kanban_columns" ON kanban_columns
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_kanban_columns_user ON kanban_columns (user_id);
CREATE INDEX idx_kanban_columns_canvas ON kanban_columns (canvas_id);

ALTER TABLE public.memory_nodes ADD COLUMN kanban_column_id uuid REFERENCES kanban_columns(id) ON DELETE SET NULL;

CREATE INDEX idx_memory_nodes_kanban_column ON memory_nodes (kanban_column_id);

CREATE OR REPLACE FUNCTION public.seed_default_kanban_columns(p_user_id uuid, p_canvas_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  INSERT INTO kanban_columns (user_id, canvas_id, name, color, display_order, is_default)
  SELECT p_user_id, p_canvas_id, 'To Do', '#6B7280', 0, true
  WHERE NOT EXISTS (
    SELECT 1 FROM kanban_columns c
    WHERE c.user_id = p_user_id AND c.canvas_id = p_canvas_id AND c.name = 'To Do'
  );

  INSERT INTO kanban_columns (user_id, canvas_id, name, color, display_order, is_default)
  SELECT p_user_id, p_canvas_id, 'In Progress', '#F59E0B', 1, true
  WHERE NOT EXISTS (
    SELECT 1 FROM kanban_columns c
    WHERE c.user_id = p_user_id AND c.canvas_id = p_canvas_id AND c.name = 'In Progress'
  );

  INSERT INTO kanban_columns (user_id, canvas_id, name, color, display_order, is_default)
  SELECT p_user_id, p_canvas_id, 'Done', '#10B981', 2, true
  WHERE NOT EXISTS (
    SELECT 1 FROM kanban_columns c
    WHERE c.user_id = p_user_id AND c.canvas_id = p_canvas_id AND c.name = 'Done'
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.seed_default_kanban_columns(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.seed_default_kanban_columns(uuid, uuid) TO authenticated, service_role;
