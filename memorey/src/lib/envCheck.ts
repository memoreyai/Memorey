/**
 * Runs once per Node process. Logs warnings for missing critical env vars.
 * Intended to be invoked from the root layout server component on boot.
 */
const CRITICAL_ENV_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
] as const;

let hasRun = false;

function isUnset(value: string | undefined): boolean {
  return value === undefined || value.trim() === "";
}

export function runEnvCheck(): void {
  if (hasRun) return;
  hasRun = true;

  const missing: string[] = [];
  for (const key of CRITICAL_ENV_KEYS) {
    if (isUnset(process.env[key])) {
      missing.push(key);
    }
  }

  if (missing.length === 0) return;

  console.warn(
    "[memorey] Missing critical environment variables — some features will not work:",
    missing.join(", "),
  );
}
