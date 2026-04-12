-- Align DB with Next.js app: profile fields, usage tracking, MCP proposals.
-- Apply after 001_memorey_schema (replaces overlapping 001_profiles / 002 / 003 for greenfield).

-- ---- profiles: app columns ----
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS full_name text,
  ADD COLUMN IF NOT EXISTS ai_use_cases text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_step int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

UPDATE public.profiles
SET full_name = COALESCE(full_name, display_name);

-- Legacy DBs only: 001_memorey_schema used onboarding_complete before rename; copy then drop.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'onboarding_complete'
  ) THEN
    UPDATE public.profiles
    SET onboarding_completed = COALESCE(onboarding_complete, onboarding_completed, false);
    ALTER TABLE public.profiles DROP COLUMN onboarding_complete;
  END IF;
END $$;

-- ---- signup trigger: populate new fields ----
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
  PERFORM public.seed_default_vaults(NEW.id);
  RETURN NEW;
END;
$$;

-- ---- monthly usage (imports / search limits) ----
CREATE TABLE IF NOT EXISTS public.user_monthly_usage (
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  year_month text NOT NULL,
  share_link_count int NOT NULL DEFAULT 0,
  chat_query_count int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, year_month)
);

ALTER TABLE public.user_monthly_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "usage_select_own" ON public.user_monthly_usage;
CREATE POLICY "usage_select_own"
  ON public.user_monthly_usage FOR SELECT
  USING (auth.uid() = user_id);

-- ---- MCP / external proposals ----
CREATE TABLE IF NOT EXISTS public.pending_proposals (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.profiles (id) ON DELETE CASCADE,
  category text NOT NULL,
  title text NOT NULL CHECK (char_length(title) <= 100),
  value text NOT NULL CHECK (char_length(value) <= 600),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pending_proposals_user_status
  ON public.pending_proposals (user_id, status);
CREATE INDEX IF NOT EXISTS idx_pending_proposals_created
  ON public.pending_proposals (user_id, created_at DESC);

ALTER TABLE public.pending_proposals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_pending_proposals" ON public.pending_proposals;
DROP POLICY IF EXISTS "users_delete_own_pending_proposals" ON public.pending_proposals;
DROP POLICY IF EXISTS "users_update_own_pending_proposals" ON public.pending_proposals;

CREATE POLICY "users_read_own_pending_proposals"
  ON public.pending_proposals FOR SELECT
  USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_pending_proposals"
  ON public.pending_proposals FOR DELETE
  USING (auth.uid() = user_id);
CREATE POLICY "users_update_own_pending_proposals"
  ON public.pending_proposals FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- Free tier: only first 3 vaults active (use subscriptions.plan) ----
UPDATE public.category_vaults cv
SET is_active = EXISTS (
  SELECT 1
  FROM (
    SELECT
      c2.id,
      ROW_NUMBER() OVER (
        PARTITION BY c2.user_id
        ORDER BY c2.display_order NULLS LAST, c2.created_at
      ) AS rn
    FROM public.category_vaults c2
    WHERE c2.user_id = cv.user_id
  ) ranked
  WHERE ranked.id = cv.id AND ranked.rn <= 3
)
WHERE cv.user_id IN (
  SELECT s.user_id FROM public.subscriptions s WHERE s.plan = 'free'
);
