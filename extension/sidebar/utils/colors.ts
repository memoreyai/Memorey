export const MEMOREY_COLORS = {
  orange: "#FF6600",
  orangeHover: "#E65C00",
  orangeLight: "rgba(255, 102, 0, 0.12)",

  // Light mode
  light: {
    bg: "#FFFFFF",
    text: "#111111",
    textSecondary: "#666666",
    surface: "#F5F5F5",
    border: "#E0E0E0",
  },

  // Dark mode
  dark: {
    bg: "#1A1A1A",
    text: "#F0F0F0",
    textSecondary: "#999999",
    surface: "#2A2A2A",
    border: "#3A3A3A",
  },

  // Semantic
  success: "#22C55E",
  warning: "#F59E0B",
  error: "#EF4444",
} as const;

export const STATUS_COLORS: Record<string, string> = {
  approved: MEMOREY_COLORS.success,
  auto_approved: "#3B82F6",
  pending: MEMOREY_COLORS.warning,
  rejected: MEMOREY_COLORS.error,
};

export const PLATFORM_ABBREV: Record<string, string> = {
  chatgpt: "GP",
  claude: "CL",
  gemini: "GE",
  perplexity: "PX",
  other: "OT",
};
