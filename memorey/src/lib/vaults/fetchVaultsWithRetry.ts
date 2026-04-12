import type { SupabaseClient } from "@supabase/supabase-js";

/** Row shape from category_vaults (client select). */
export type CategoryVaultRow = {
  id: string;
  user_id: string;
  name: string;
  color: string | null;
  is_custom: boolean | null;
  is_active: boolean | null;
  display_order: number | null;
  pin_hash: string | null;
  is_locked: boolean | null;
  is_exportable: boolean | null;
  default_card_accent?: string | null;
  default_card_bg?: string | null;
  default_card_text?: string | null;
  pill_fill_bg?: string | null;
  pill_border_color?: string | null;
  pill_text_color?: string | null;
  icon_key?: string | null;
  color_overrides?: unknown;
  show_empty_in_master?: boolean | null;
};

/**
 * Use `*` so requests work before and after migration 041 (`show_empty_in_master`).
 * Listing unknown columns causes PostgREST 400 if the migration is not applied yet.
 */
const VAULT_SELECT = "*" as const;

/**
 * Fetches vaults with retries while signup trigger may still be creating rows,
 * then falls back to seed_default_vaults RPC if still empty.
 */
export async function fetchVaultsWithRetry(
  supabase: SupabaseClient,
  userId: string,
  maxRetries = 3
): Promise<CategoryVaultRow[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const { data, error } = await supabase
      .from("category_vaults")
      .select(VAULT_SELECT)
      .eq("user_id", userId)
      .eq("is_active", true)
      .order("display_order", { ascending: true });

    if (error) throw error;

    if (data && data.length > 0) {
      return data as CategoryVaultRow[];
    }

    if (attempt < maxRetries - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, 800 * (attempt + 1))
      );
    }
  }

  const { error: seedError } = await supabase.rpc("seed_default_vaults", {
    p_user_id: userId,
  });

  if (seedError) {
    throw new Error(
      `Could not create default vaults: ${seedError.message}`
    );
  }

  const { data: finalData, error: finalError } = await supabase
    .from("category_vaults")
    .select(VAULT_SELECT)
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("display_order", { ascending: true });

  if (finalError) throw finalError;
  if (!finalData || finalData.length === 0) {
    throw new Error(
      "Could not load vaults. Please refresh and try again."
    );
  }

  return finalData as CategoryVaultRow[];
}
