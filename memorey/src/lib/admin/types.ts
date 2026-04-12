/** Response types for admin API routes (service role only). */

export interface AdminStatsResponse {
  /** Null when the underlying query failed (other fields may still be present). */
  totalUsers: number | null;
  usersByPlan: { free: number; pro: number; enterprise: number } | null;
  newSignups: {
    today: number | null;
    last7Days: number | null;
    last30Days: number | null;
  };
  totals: {
    memoryNodes: number | null;
    edges: number | null;
    vaults: number | null;
  };
  activeUsers: { last7Days: number | null; last30Days: number | null };
  averageNodesPerUser: number | null;
  onboardingCompletionRatePercent: number | null;
  conversionRatePercent: number | null;
}

export interface AdminUserListItem {
  id: string;
  display_name: string | null;
  full_name: string | null;
  avatar_url: string | null;
  segment: string | null;
  created_at: string | null;
  onboarding_completed: boolean;
  plan: string | null;
  node_count: number;
  edge_count: number;
  vault_count: number;
  last_active: string | null;
}

export interface AdminUsersResponse {
  users: AdminUserListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AdminUserCanvasDetail {
  id: string;
  name: string;
  emoji: string | null;
  node_count: number;
}

export interface AdminUserVaultDetail {
  id: string;
  name: string;
  color: string | null;
  node_count: number;
}

export interface AdminUserMonthlyUsageRow {
  year_month: string;
  share_link_count: number;
  chat_query_count: number;
  updated_at: string;
}

export interface AdminUserEventTimelineItem {
  id: string;
  event_name: string;
  event_data: Record<string, unknown>;
  page_path: string | null;
  created_at: string;
}

export interface AdminUserDetailResponse extends AdminUserListItem {
  canvases: AdminUserCanvasDetail[];
  vaults: AdminUserVaultDetail[];
  usage_last_3_months: AdminUserMonthlyUsageRow[];
  pending_proposal_count: number;
  attachment_count: number;
  recent_events: AdminUserEventTimelineItem[];
}

export interface AdminActivityItem {
  id: string;
  user: {
    id: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  event_name: string;
  event_data: Record<string, unknown>;
  page_path: string | null;
  created_at: string;
}

export interface AdminActivityResponse {
  events: AdminActivityItem[];
}

export interface AdminAnalyticsOverviewResponse {
  days: number;
  dailyActiveUsers: { date: string; count: number }[];
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  newSignupsPerDay: { date: string; count: number }[];
  totalEventsByName: Record<string, number>;
}

export interface AdminFeatureUsageResponse {
  days: number;
  counts: { event_name: string; count: number }[];
}

export interface AdminFunnelResponse {
  total_signups: number;
  completed_onboarding: number;
  created_at_least_one_node: number;
  created_five_plus_nodes: number;
  used_search: number;
  used_capture: number;
  active_last_7_days_rolling: number;
  upgraded_to_pro: number;
}

export interface AdminRevenueResponse {
  users_by_plan: { free: number; pro: number; enterprise: number };
  mrr_estimate_usd: number;
  arr_estimate_usd: number;
  billing_connected: false;
  churn_rate: null;
  ltv: null;
  notes: string;
}
