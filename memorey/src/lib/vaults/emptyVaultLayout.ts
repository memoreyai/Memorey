import { useVaultStore } from "@/store/vaultStore";
import { useGraphStore } from "@/store/graphStore";

/**
 * Vault columns to include in structured layout even when the canvas has no
 * memory nodes in that vault — driven by canvas_vaults + category_vaults flags.
 *
 * On the first dashboard load (no nodes on this canvas yet), all active vaults
 * are included so the user sees the vault structure immediately after onboarding.
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

  if (out.size === 0) {
    const nodes = useGraphStore.getState().graphData.nodes;
    const hasNodesOnCanvas = nodes.some(
      (n) => n.canvasId === canvasId && n.nodeKind !== "category" && n.nodeKind !== "person"
    );
    if (!hasNodesOnCanvas) {
      for (const v of vaults) {
        if (v.isActive) out.add(v.id);
      }
    }
  }

  return out;
}
