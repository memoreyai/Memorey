import type { Vault } from "../graph/types.js";

export interface BriefingConfig {
  maxTokens: number;
  format: "system_prompt" | "markdown" | "structured_json";
  includeVaults: Vault[];
  excludeVaults: Vault[];
  taskContext?: string;
  recencyBias: number;
  includeRelationships: boolean;
  includeChangeHistory: boolean;
  platform?: string;
  onlyApproved: boolean;
}

export interface Briefing {
  content: string;
  factsIncluded: number;
  factsExcluded: number;
  vaultBreakdown: Record<string, number>;
  estimatedTokens: number;
  generatedAt: string;
}

export const DEFAULT_BRIEFING_CONFIG: BriefingConfig = {
  maxTokens: 1500,
  format: "system_prompt",
  includeVaults: [],
  excludeVaults: [],
  recencyBias: 0.6,
  includeRelationships: true,
  includeChangeHistory: false,
  onlyApproved: true,
};
