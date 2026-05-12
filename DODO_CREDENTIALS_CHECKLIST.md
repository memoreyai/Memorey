# Dodo Payments — credentials and configuration checklist

This document lists environment variables and related configuration needed to run the Memorey **Dodo Payments** integration end to end. It is derived from the current codebase (`memorey/` Next.js app).

---

## Quick reference

| Variable | Sensitive? | Used by |
|----------|--------------|---------|
| `DODO_SECRET_KEY` | **Server only** | `POST /api/dodo/checkout`, `POST /api/dodo/portal` |
| `DODO_WEBHOOK_SECRET` | **Server only** | `POST /api/dodo/webhook` (HMAC signature verification) |
| `DODO_PRO_MONTHLY_PRICE_ID` | **Server only** | `POST /api/dodo/checkout` (monthly `product_cart`) |
| `DODO_PRO_YEARLY_PRICE_ID` | **Server only** | `POST /api/dodo/checkout` (yearly `product_cart`) |
| `NEXT_PUBLIC_APP_URL` | **Public** (safe to expose; not a secret) | Checkout `return_url` and portal context; defaults to `https://memorey.co` if unset |

---

## 1. `DODO_SECRET_KEY`

- **What it is:** Dodo API secret key (Bearer token). The app selects **test** vs **live** mode by prefix: keys starting with `sk_test_` use `test_mode`, otherwise `live_mode` (see `checkout/route.ts` and `portal/route.ts`).
- **Where to find it:** [Dodo Payments Dashboard](https://app.dodopayments.com/) → **Developer** → **API Keys** → create or copy an API key with the permissions your integration needs (checkout and customer portal require appropriate write access per Dodo’s docs).
- **Sensitivity:** **Server only.** Never expose in client bundles, logs, or repos. Set in Vercel/hosting env and local `.env.local` only.

---

## 2. `DODO_WEBHOOK_SECRET`

- **What it is:** Signing secret for [Standard Webhooks](https://www.standardwebhooks.com/)-style verification (`webhook-id`, `webhook-timestamp`, `webhook-signature`). The handler supports secrets with or without a `whsec_` prefix and base64-decodes the key material.
- **Where to find it:** Dashboard → **Developer** → **Webhooks** → select your endpoint → copy the **Secret Key** (or equivalent signing secret shown for that endpoint). See also [Dodo webhooks documentation](https://docs.dodopayments.com/developer-resources/webhooks).
- **Sensitivity:** **Server only.**

---

## 3. `DODO_PRO_MONTHLY_PRICE_ID`

- **What it is:** Dodo **product** ID for the Pro monthly plan, passed as `product_cart[].product_id` in `payments.create`.
- **Where to find it:** Dashboard → **Products** (or your catalog area) → open the monthly Pro product → copy the **Product ID** (naming in UI may vary; match the ID Dodo expects in checkout APIs).
- **Sensitivity:** **Server only.** Not as sensitive as API keys, but keep server-side to avoid leaking catalog structure.

---

## 4. `DODO_PRO_YEARLY_PRICE_ID`

- **What it is:** Same as monthly, for the yearly Pro product.
- **Where to find it:** Same as `DODO_PRO_MONTHLY_PRICE_ID`, for the yearly product.
- **Sensitivity:** **Server only.**

---

## 5. `NEXT_PUBLIC_APP_URL` (recommended for production billing)

- **What it is:** Public site base URL used for `return_url` after checkout (`{appUrl}/dashboard?upgraded=true`).
- **Where to find it:** Not from Dodo — set to your deployed origin (e.g. `https://memorey.co` or `http://localhost:3000` for local dev).
- **Sensitivity:** **Public** — `NEXT_*` vars are exposed to the browser; this is a URL, not a credential.

---

## Dashboard and hosting steps (not env vars)

Complete the loop beyond env vars:

1. **Webhook endpoint URL:** Register `https://<your-domain>/api/dodo/webhook` (or local tunnel URL for testing) in **Developer → Webhooks**.
2. **Subscribe to events** the handler implements (others are ignored or only logged):
   - `subscription.active`
   - `subscription.renewed`
   - `subscription.plan_changed`
   - `subscription.cancelled`, `subscription.expired`, `subscription.failed`
   - `subscription.on_hold`
   - Optionally `payment.succeeded`, `payment.failed`, `payment.cancelled` (currently **logging only** in code)
3. **Supabase service role:** `POST /api/dodo/webhook` uses the Supabase **admin** client to update `subscriptions` (and `category_vaults` on downgrade). **`SUPABASE_SERVICE_ROLE_KEY`** must be configured wherever the app runs — it is not Dodo-specific but is **required** for webhooks to persist subscription state.

---

## Copy-paste checklist

- [ ] `DODO_SECRET_KEY` — Developer → API Keys  
- [ ] `DODO_WEBHOOK_SECRET` — Developer → Webhooks → endpoint signing secret  
- [ ] `DODO_PRO_MONTHLY_PRICE_ID` — Products → monthly Pro product ID  
- [ ] `DODO_PRO_YEARLY_PRICE_ID` — Products → yearly Pro product ID  
- [ ] `NEXT_PUBLIC_APP_URL` — your app’s public origin (recommended)  
- [ ] Webhook URL registered in Dodo → `.../api/dodo/webhook`  
- [ ] Webhook events selected to match handler cases  
- [ ] `SUPABASE_SERVICE_ROLE_KEY` (and other Supabase env) set on the same deployment  

---

## Audit summary (codebase, for context)

- **Package:** `dodopayments` **^0.20.0** in `memorey/package.json` (resolved to 0.20.1 in lockfile). Other workspace packages (`extension`, `mcp-server`, `memorey-core`) do **not** depend on Dodo.
- **Routes:** Real implementations — not stubs — for checkout (`dodopayments` `payments.create` with `payment_link: true`), customer portal (`customerPortal.create`), and webhook (custom HMAC verification + Supabase updates).
- **UI:** Settings billing buttons are **commented out** (“Pro plan upgrade coming soon”); `UpgradeBanner` returns `null`. APIs exist; primary billing UX is gated until you uncomment/ship UI after keys are live.
