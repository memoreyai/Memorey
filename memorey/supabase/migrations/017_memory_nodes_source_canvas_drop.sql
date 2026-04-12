-- Allow memory_nodes.source = 'canvas-drop' (file nodes from canvas drag-and-drop).
-- Base schema only allowed chat, share_link, manual, import, extension.
-- Remote DB uses CHECK (source = ANY (ARRAY[...])), not source IN (...).

ALTER TABLE public.memory_nodes DROP CONSTRAINT IF EXISTS memory_nodes_source_check;

ALTER TABLE public.memory_nodes
  ADD CONSTRAINT memory_nodes_source_check
  CHECK (
    source = ANY (
      ARRAY[
        'chat',
        'share_link',
        'manual',
        'import',
        'extension',
        'canvas-drop'
      ]::text[]
    )
  );
