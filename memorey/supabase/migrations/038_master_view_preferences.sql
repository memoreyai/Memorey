-- Which canvases are hidden in master (graph + kanban aggregate) views
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS master_hidden_canvas_ids uuid[] NOT NULL DEFAULT '{}';
