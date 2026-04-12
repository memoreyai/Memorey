-- Rename Stripe billing columns to Dodo Payments columns in subscriptions table.
-- Preserves existing data (any existing stripe_customer_id values carry over).

ALTER TABLE public.subscriptions
  RENAME COLUMN stripe_customer_id TO dodo_customer_id;

ALTER TABLE public.subscriptions
  RENAME COLUMN stripe_subscription_id TO dodo_subscription_id;
