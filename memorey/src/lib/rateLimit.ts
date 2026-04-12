/**
 * Supabase-backed rate limiter with in-memory fallback.
 *
 * Uses an atomic Postgres RPC (`check_rate_limit`) that works across serverless
 * instances. Falls back to in-memory check if the DB call fails so that a
 * Supabase outage doesn't disable rate limiting entirely.
 */

import { createAdminClient } from "@/lib/supabase/admin";

const buckets = new Map<string, number[]>();

function checkInMemory(
  key: string,
  maxRequests: number,
  windowSeconds: number
): boolean {
  const now = Date.now();
  const cutoff = now - windowSeconds * 1000;
  const prev = buckets.get(key) ?? [];
  const recent = prev.filter((t) => t > cutoff);
  if (recent.length >= maxRequests) {
    buckets.set(key, recent);
    return false;
  }
  recent.push(now);
  buckets.set(key, recent);
  return true;
}

/**
 * @param key - Composite key (e.g. user id + route name)
 * @param maxRequests - Max requests allowed within the window
 * @param windowSeconds - Sliding window length in seconds
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowSeconds: number
): Promise<{ allowed: boolean }> {
  try {
    const admin = createAdminClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (admin as any).rpc("check_rate_limit", {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    });
    if (!error && typeof data === "boolean") {
      return { allowed: data };
    }
    // Fallback to in-memory on RPC error
    console.error("[rateLimit] RPC fallback:", error?.message);
  } catch {
    // Fallback to in-memory if admin client fails
  }
  return { allowed: checkInMemory(key, maxRequests, windowSeconds) };
}
