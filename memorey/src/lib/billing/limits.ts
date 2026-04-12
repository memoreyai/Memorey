/** Free-tier caps (Pro = unlimited for these). */
export const FREE_MEMORY_NODE_MAX = 100;
export const FREE_SHARE_LINKS_PER_MONTH = 5;
export const FREE_CHAT_QUERIES_PER_MONTH = 10;
export const FREE_AI_CALLS_PER_MONTH = 20;
export const FREE_ACTIVE_VAULTS_MAX = 3;

export function currentYearMonth(): string {
  const d = new Date();
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function isProPlan(plan: string | null | undefined): boolean {
  return plan === "pro" || plan === "enterprise";
}
