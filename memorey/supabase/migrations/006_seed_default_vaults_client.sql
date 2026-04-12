-- Idempotent vault seeding + secure client RPC (anon cannot seed arbitrary users).
-- Internal: used by signup trigger only (no JWT).

CREATE OR REPLACE FUNCTION public.seed_default_vaults_internal(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.category_vaults WHERE user_id = p_user_id LIMIT 1
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.category_vaults (user_id, name, color, display_order) VALUES
    (p_user_id, 'Work',          '#378ADD', 1),
    (p_user_id, 'Goals',         '#7F77DD', 2),
    (p_user_id, 'Personal',      '#5DCAA5', 3),
    (p_user_id, 'Health',        '#E05C5C', 4),
    (p_user_id, 'Finance',       '#EF9F27', 5),
    (p_user_id, 'Study',         '#D4537E', 6),
    (p_user_id, 'Relationships', '#38BDF8', 7),
    (p_user_id, 'Preferences',   '#888780', 8);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_vaults_internal(UUID) FROM PUBLIC;

-- Signup trigger: seed via internal (no JWT in trigger context)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_name text;
BEGIN
  v_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name');
  INSERT INTO public.profiles (
    id, display_name, avatar_url, full_name,
    ai_use_cases, onboarding_step, onboarding_completed
  )
  VALUES (
    NEW.id, v_name, NEW.raw_user_meta_data->>'avatar_url', v_name,
    '{}', 0, false
  );
  INSERT INTO public.subscriptions (user_id, plan) VALUES (NEW.id, 'free');
  PERFORM public.seed_default_vaults_internal(NEW.id);
  RETURN NEW;
END;
$$;

-- Client-callable: must be logged in as that user
CREATE OR REPLACE FUNCTION public.seed_default_vaults(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'forbidden'
      USING ERRCODE = '42501',
            MESSAGE = 'Not allowed to seed vaults for this user';
  END IF;
  PERFORM public.seed_default_vaults_internal(p_user_id);
END;
$$;

REVOKE ALL ON FUNCTION public.seed_default_vaults(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.seed_default_vaults(UUID) TO authenticated;
