import { useVaultStore } from "@/store/vaultStore";

/**
 * Vault columns to include in structured layout even when the canvas has no
 * memory nodes in that vault — driven by canvas_vaults + category_vaults flags.
 */
export function getExtraEmptyVaultIdsForCanvas(
  canvasId: string,
  isMasterView: boolean
): Set<string> {
  const vaults = useVaultStore.getState().vaults;
  const links = useVaultStore
    .getState()
    .canvasVaultLinks.filter((l) => l.canvas_id === canvasId);

  const out = new Set<string>();
  for (const link of links) {
    const v = vaults.find((x) => x.id === link.vault_id);
    if (!v?.isActive) continue;
    if (link.showEmptyOnCanvas) out.add(link.vault_id);
    if (isMasterView && v.showEmptyInMaster) out.add(link.vault_id);
  }
  return out;
}
