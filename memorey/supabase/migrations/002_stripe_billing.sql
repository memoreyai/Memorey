-- Stripe billing: subscriptions row per user, monthly usage counters, vault cap backfill for free users.

CREATE TABLE IF NOT EXISTS public.subscriptions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles (id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  stripe_customer_id text UNIQUE,
  stripe_subscription_id text,
  current_period_end timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

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

INSERT INTO public.subscriptions (user_id, plan)
SELECT id, 'free' FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

-- Free plan: only 3 vaults active per user (skip if category_vaults missing)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'category_vaults'
  ) THEN
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
    WHERE cv.user_id IN (SELECT id FROM public.profiles WHERE plan = 'free');
  END IF;
END $$;
