-- Custom vaults: longer names, optional icon, color as TEXT, index
-- (Run after base schema; idempotent with IF NOT EXISTS where applicable)

ALTER TABLE public.category_vaults
  ALTER COLUMN name TYPE TEXT;

ALTER TABLE public.category_vaults
  ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT NULL;

ALTER TABLE public.category_vaults
  ALTER COLUMN color TYPE TEXT;

CREATE INDEX IF NOT EXISTS idx_category_vaults_user_active
  ON public.category_vaults(user_id, is_active, display_order);
