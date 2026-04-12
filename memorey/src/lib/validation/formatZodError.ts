import type { ZodError } from "zod";

/** First human-readable message from a Zod error (for API 400 responses). */
export function formatZodError(err: ZodError): string {
  const first = err.issues[0];
  return first?.message ?? "Invalid request";
}
