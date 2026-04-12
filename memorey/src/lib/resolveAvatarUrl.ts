/**
 * Normalize profile avatar values: full URLs, Supabase storage paths, or relative keys.
 */
export function resolveAvatarUrl(
  raw: string | null | undefined,
  supabaseUrl?: string | null
): string | null {
  if (!raw?.trim()) return null;
  const t = raw.trim();
  if (
    t.startsWith("http://") ||
    t.startsWith("https://") ||
    t.startsWith("data:")
  ) {
    return t;
  }
  const base = (supabaseUrl ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(
    /\/$/,
    ""
  );
  if (!base) return null;
  if (t.startsWith("/storage/v1/")) return `${base}${t}`;
  return `${base}/storage/v1/object/public/${t.replace(/^\/+/, "")}`;
}
