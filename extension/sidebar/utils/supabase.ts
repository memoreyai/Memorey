import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Public values injected at build time via esbuild define.
// Anon key is designed for client-side use; RLS protects data.
declare const __SUPABASE_URL__: string;
declare const __SUPABASE_ANON_KEY__: string;

export const SUPABASE_URL: string =
  typeof __SUPABASE_URL__ !== "undefined" ? __SUPABASE_URL__ : "";
export const SUPABASE_ANON_KEY: string =
  typeof __SUPABASE_ANON_KEY__ !== "undefined" ? __SUPABASE_ANON_KEY__ : "";

export function createSupabaseClient(
  accessToken?: string
): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: {
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  });
}
