-- Fixes billing bypass: 001 created "users_own_subscription" FOR ALL on public.subscriptions,
-- allowing authenticated users to UPDATE plan and Stripe columns without paying.
-- Migration 002 attempted to restrict to SELECT-only by dropping "subscriptions_select_own",
-- but the policy from 001 was named "users_own_subscription", so that DROP was a no-op and
-- the permissive FOR ALL policy remained. This migration drops the real policy and enforces
-- SELECT-only for authenticated users; INSERT/UPDATE/DELETE go through service_role (API routes).

-- 1. Drop the overly permissive ALL policy
DROP POLICY IF EXISTS "users_own_subscription" ON public.subscriptions;

-- 2. Also drop the one that 002 migration tried to recreate (may or may not exist)
DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;

-- 3. Users can only READ their subscription
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- 4. Only service_role can insert/update/delete subscriptions (no INSERT/UPDATE/DELETE policies
-- for authenticated — those operations are denied by default when RLS is enabled).
