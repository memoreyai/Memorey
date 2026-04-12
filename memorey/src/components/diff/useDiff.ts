"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useDiffStore } from "@/store/diffStore";
import { useVaultStore } from "@/store/vaultStore";
import type { DiffProposal, ProposedNode } from "@/types/memorey";

const DEFAULT_MAX_NODES = 8;

/** Open the memory diff modal from anywhere (no hook required). */
export function openDiff(proposal: DiffProposal): void {
  useDiffStore.getState().openDiff(proposal);
}

export function useDiff() {
  const router = useRouter();
  const isOpen = useDiffStore((s) => s.isOpen);
  const queue = useDiffStore((s) => s.queue);
  const isConfirming = useDiffStore((s) => s.isConfirming);
  const openDiffStore = useDiffStore((s) => s.openDiff);
  const closeDiff = useDiffStore((s) => s.closeDiff);
  const rejectAll = useDiffStore((s) => s.rejectAll);
  const confirmNodes = useDiffStore((s) => s.confirmNodes);

  const maxNodes = queue?.maxVisibleNodes ?? DEFAULT_MAX_NODES;

  const visibleKey = useMemo(() => {
    if (!queue?.proposals.length) return "";
    return queue.proposals
      .slice(0, queue?.maxVisibleNodes ?? DEFAULT_MAX_NODES)
      .map((p) => p.tempId)
      .join("\0");
  }, [queue]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [valueEdits, setValueEdits] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen || !queue) return;
    const ids = new Set(
      queue.proposals.slice(0, maxNodes).map((p) => p.tempId)
    );
    queueMicrotask(() => {
      setSelectedIds(ids);
      setValueEdits({});
    });
  }, [isOpen, visibleKey, queue, maxNodes]);

  const visibleProposals = useMemo(
    () => queue?.proposals.slice(0, maxNodes) ?? [],
    [queue, maxNodes]
  );

  const toggleSelected = useCallback((tempId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) next.delete(tempId);
      else next.add(tempId);
      return next;
    });
  }, []);

  const setNodeValueEdit = useCallback((tempId: string, value: string) => {
    setValueEdits((prev) => ({ ...prev, [tempId]: value }));
  }, []);

  const selectedCount = useMemo(() => {
    let n = 0;
    for (const p of visibleProposals) {
      if (selectedIds.has(p.tempId)) n += 1;
    }
    return n;
  }, [visibleProposals, selectedIds]);

  const buildMergedSelected = useCallback((): ProposedNode[] => {
    if (!queue) return [];
    return visibleProposals
      .filter((p) => selectedIds.has(p.tempId))
      .map((p) => ({
        ...p,
        newValue: valueEdits[p.tempId] ?? p.newValue,
      }));
  }, [queue, visibleProposals, selectedIds, valueEdits]);

  const handleReject = useCallback(() => {
    rejectAll();
  }, [rejectAll]);

  const handleConfirm = useCallback(async (): Promise<number> => {
    const merged = buildMergedSelected();
    if (merged.length === 0) return 0;

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      toast.error("Sign in to save memories.");
      return 0;
    }
    const userId = user.id;

    const { fetchVaults } = useVaultStore.getState();
    if (useVaultStore.getState().vaults.length === 0) {
      try {
        await fetchVaults(userId);
      } catch (error) {
        console.error("Vault fetch failed:", error);
        // Don't block the confirm flow: `confirmNodes` will re-check auth,
        // seed missing vaults if needed, and then proceed.
      }
    }

    try {
      const n = await confirmNodes(merged, userId, {
        memorySource: queue?.memorySource,
        canvasId: queue?.canvasId,
      });
      if (n > 0) {
        toast.success(`${n} ${n === 1 ? "memory" : "memories"} updated`);
      }
      return n;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown error";

      if (/vault/i.test(message)) {
        console.error("Vault fetch failed:", error);
        console.error("User ID at time of failure:", userId);
        toast.error(
          "Could not load your memory categories. Try refreshing the page.",
          {
            action: {
              label: "Refresh",
              onClick: () => window.location.reload(),
            },
          }
        );
      } else if (
        /authenticated|sign in|session|not signed/i.test(message)
      ) {
        toast.error("Session expired. Please sign in again.");
        router.push("/login");
      } else {
        toast.error(`Could not save memories: ${message}`);
      }
      throw error;
    }
  }, [buildMergedSelected, confirmNodes, queue, router]);

  return {
    isOpen,
    queue,
    isConfirming,
    openDiff: openDiffStore,
    closeDiff,
    rejectAll,
    visibleProposals,
    totalExtracted: queue?.totalExtracted ?? queue?.proposals.length ?? 0,
    selectedIds,
    selectedCount,
    toggleSelected,
    valueEdits,
    setNodeValueEdit,
    handleConfirm,
    handleReject,
    maxNodes,
  };
}
