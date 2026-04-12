# Supabase Security / Performance Advisor — remediation notes

## Fixed in repo + applied via migration

- **`auth_rls_initplan` (Performance):** RLS policies now use `(select auth.uid())` instead of bare `auth.uid()` so the auth call is evaluated once per statement (see [RLS: call functions with `select`](https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select)).
- **`extension_in_public` (Security):** The `vector` extension is moved to the `extensions` schema (same pattern as `uuid-ossp` on Supabase).

Migration file: `supabase/migrations/035_supabase_advisor_rls_initplan_and_vector.sql`.

## Hosted Auth only: leaked password protection

**Advisor:** `auth_leaked_password_protection` — *Leaked Password Protection Disabled*

This checks **Supabase Auth service config**, not Postgres. **No migration or app code can turn it on.** The warning stays until the hosted project has leaked-password protection enabled (or you dismiss it as not applicable).

### Option A — Dashboard (usual)

1. Open your project, then [**Authentication → Sign In / Providers → Email**](https://supabase.com/dashboard/project/_/auth/providers?provider=Email) (same destination as [Auth settings for Email](https://supabase.com/dashboard/project/_/auth/providers?provider=Email) in the [password security](https://supabase.com/docs/guides/auth/password-security) docs).
2. In the **Email** provider section, find password / strength options and enable **leaked password protection** / **prevent use of leaked passwords** (HaveIBeenPwned).

Per Supabase docs, **this feature is available on Pro and above**. On **Free tier** the control is often missing or inert; the advisor can remain **WARN** until you upgrade or you **dismiss** the finding in Security Advisor as accepted risk.

### Option B — Management API

If you automate config, use a [personal access token](https://supabase.com/dashboard/account/tokens) and your **project ref** (`Settings → General`):

```bash
curl -X PATCH "https://api.supabase.com/v1/projects/$SUPABASE_PROJECT_REF/config/auth" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"password_hibp_enabled": true}'
```

See [`PATCH /v1/projects/{ref}/config/auth`](https://supabase.com/docs/reference/api/v1-update-auth-service-config) — the field is **`password_hibp_enabled`**.

If the API returns **403** or the value does not stick, the org/project likely does not include this feature on the current plan.

### When the warning is expected to remain

| Situation | What to do |
|-----------|------------|
| **Free tier** | Upgrade to Pro+ to enable, or **Dismiss** the advisor item after documenting risk. |
| **OAuth only** (Google/GitHub, no email/password) | Low impact; you can **Dismiss** as not applicable. |
| **Toggle enabled but advisor still WARN** | Wait for advisor refresh, or confirm with GET `.../config/auth` that `password_hibp_enabled` is true; re-run advisors from the dashboard. |
