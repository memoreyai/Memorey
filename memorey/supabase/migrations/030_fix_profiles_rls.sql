-- 1. Drop the overly permissive ALL policy on profiles
DROP POLICY IF EXISTS "users_own_profile" ON public.profiles;

-- 2. Users can read their own profile
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- 3. Users can update their own profile BUT not is_super_admin
--    We enforce this with a trigger since RLS can't do column-level restrictions
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 4. Trigger to block is_super_admin changes from non-service-role
CREATE OR REPLACE FUNCTION public.protect_admin_flag()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- If is_super_admin is being changed and the caller is not service_role
  IF NEW.is_super_admin IS DISTINCT FROM OLD.is_super_admin THEN
    IF current_setting('role', true) != 'service_role' THEN
      NEW.is_super_admin := OLD.is_super_admin; -- silently revert the change
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_admin_flag_trigger ON public.profiles;
CREATE TRIGGER protect_admin_flag_trigger
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_admin_flag();
