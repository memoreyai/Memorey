import type { CategoryVault, ProposedNode } from "@/types/memorey";
import { parseVaultColorOverrides } from "@/lib/vaultThemeResolve";

/** Map a category_vaults row (snake_case) to CategoryVault */
export function mapCategoryVaultRow(r: {
  id: string;
  user_id: string;
  name: string;
  color?: string | null;
  is_custom?: boolean | null;
  is_active?: boolean | null;
  display_order?: number | null;
  default_card_accent?: string | null;
  default_card_bg?: string | null;
  default_card_text?: string | null;
  pill_fill_bg?: string | null;
  pill_border_color?: string | null;
  pill_text_color?: string | null;
  icon_key?: string | null;
  color_overrides?: unknown;
}): CategoryVault {
  return {
    id: r.id,
    userId: r.user_id,
    name: r.name,
    color: r.color ?? "#5DCAA5",
    isCustom: Boolean(r.is_custom),
    isActive: r.is_active !== false,
    displayOrder: r.display_order ?? 0,
    defaultCardAccent: r.default_card_accent ?? null,
    defaultCardBg: r.default_card_bg ?? null,
    defaultCardText: r.default_card_text ?? null,
    pillFillBg: r.pill_fill_bg ?? null,
    pillBorderColor: r.pill_border_color ?? null,
    pillTextColor: r.pill_text_color ?? null,
    iconKey: r.icon_key ?? null,
    colorOverrides: parseVaultColorOverrides(r.color_overrides),
  };
}

/**
 * Resolves which vault to use for a proposed node. Never throws.
 * Returns null only when vaults is empty.
 */
export function resolveVaultId(
  vaults: CategoryVault[],
  node: ProposedNode
): string | null {
  if (vaults.length === 0) {
    console.error("VAULT RESOLUTION FAILED — no vaults exist for user");
    return null;
  }

  const directId =
    (node as { vaultId?: string }).vaultId ??
    (node as { vault_id?: string }).vault_id;
  if (
    directId &&
    typeof directId === "string" &&
    directId.trim().length > 10
  ) {
    const exists = vaults.find((v) => v.id === directId.trim());
    if (exists) {
      return exists.id;
    }
  }

  const rawCategory =
    node.category ??
    (node as { vault?: string }).vault ??
    (node as { vaultName?: string }).vaultName ??
    (node as { vault_name?: string }).vault_name ??
    "";

  const needle = String(rawCategory).toLowerCase().trim();

  if (needle) {
    const exact = vaults.find(
      (v) => v.name.toLowerCase().trim() === needle
    );
    if (exact) {
      return exact.id;
    }

    const partial = vaults.find(
      (v) =>
        v.name.toLowerCase().includes(needle) ||
        needle.includes(v.name.toLowerCase())
    );
    if (partial) {
      return partial.id;
    }

    const keywordMap: Record<string, string[]> = {
      work: [
        "work",
        "job",
        "career",
        "project",
        "tech",
        "stack",
        "professional",
        "coding",
        "developer",
        "startup",
        "saas",
        "product",
        "engineering",
      ],
      goals: [
        "goal",
        "target",
        "plan",
        "ambition",
        "objective",
        "milestone",
        "vision",
        "launch",
        "mrr",
        "revenue",
      ],
      personal: [
        "personal",
        "identity",
        "bio",
        "self",
        "life",
        "about",
        "background",
        "location",
        "based",
        "city",
      ],
      health: [
        "health",
        "fitness",
        "diet",
        "wellness",
        "medical",
        "exercise",
        "mental",
        "sleep",
        "nutrition",
      ],
      finance: [
        "finance",
        "money",
        "budget",
        "saving",
        "investment",
        "income",
        "salary",
        "cost",
        "price",
        "revenue",
      ],
      study: [
        "study",
        "learn",
        "education",
        "book",
        "course",
        "knowledge",
        "reading",
        "research",
        "skill",
      ],
      relationships: [
        "relationship",
        "family",
        "friend",
        "social",
        "people",
        "network",
        "team",
        "colleague",
        "mentor",
      ],
      preferences: [
        "preference",
        "like",
        "dislike",
        "habit",
        "lifestyle",
        "style",
        "taste",
        "tool",
        "prefer",
        "favourite",
        "favorite",
      ],
    };

    for (const [key, words] of Object.entries(keywordMap)) {
      const vaultMatch = vaults.find((v) =>
        v.name.toLowerCase().includes(key)
      );
      if (vaultMatch && words.some((w) => needle.includes(w))) {
        return vaultMatch.id;
      }
    }
  }

  const personal = vaults.find(
    (v) => v.name.toLowerCase() === "personal"
  );
  if (personal) {
    return personal.id;
  }

  const first = vaults[0];
  return first.id;
}
