-- Expand the segment check constraint to allow new role values.
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_segment_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_segment_check
  CHECK (segment = ANY (ARRAY[
    'founder'::text, 'developer'::text, 'consultant'::text,
    'researcher'::text, 'student'::text, 'designer'::text, 'other'::text
  ]));
