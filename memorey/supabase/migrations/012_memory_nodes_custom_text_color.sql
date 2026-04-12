-- Add custom text color for memory node cards (graph + detail sheet)
ALTER TABLE memory_nodes
  ADD COLUMN IF NOT EXISTS custom_text_color TEXT DEFAULT NULL;
