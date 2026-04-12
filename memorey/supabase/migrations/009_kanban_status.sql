-- Kanban columns on memory_nodes (006_* already used in repo)
ALTER TABLE public.memory_nodes
  ADD COLUMN IF NOT EXISTS kanban_status TEXT DEFAULT NULL
    CHECK (kanban_status IS NULL OR kanban_status IN ('todo', 'doing', 'done'));

ALTER TABLE public.memory_nodes
  ADD COLUMN IF NOT EXISTS kanban_order DOUBLE PRECISION DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_memory_nodes_kanban
  ON public.memory_nodes(user_id, kanban_status)
  WHERE kanban_status IS NOT NULL;
