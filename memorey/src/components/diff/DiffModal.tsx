"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { format } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DiffNodeCard, vaultColorForCategory } from "@/components/diff/DiffNodeCard";
import { useDiff } from "@/components/diff/useDiff";
import { useDiffStore } from "@/store/diffStore";
import { useVaultStore } from "@/store/vaultStore";
import { Check } from "lucide-react";
import { diffModalListeners } from "@/lib/diffModalListeners";
import { cn } from "@/lib/utils";

export interface DiffModalProps {
  /** Called after a successful confirm with the number of nodes saved. */
  onConfirmed?: (count: number) => void;
  /** Called when the user rejects all or dismisses without confirming (Esc, overlay, close). */
  onRejected?: () => void;
}

export function DiffModal({ onConfirmed, onRejected }: DiffModalProps) {
  const vaults = useVaultStore((s) => s.vaults);
  const {
    isOpen,
    queue,
    isConfirming,
    visibleProposals,
    selectedIds,
    selectedCount,
    toggleSelected,
    valueEdits,
    setNodeValueEdit,
    handleConfirm,
    maxNodes,
  } = useDiff();

  const suppressRejectOnClose = useRef(false);
  const skipDuplicateRejectNotify = useRef(false);

  const vaultHexByName = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vaults) {
      m.set(v.name.trim().toLowerCase(), v.color);
    }
    return m;
  }, [vaults]);

  const resolveVaultLabel = useCallback(
    (category: string) => {
      const c = category.trim().toLowerCase();
      const exact = vaults.find((v) => v.name.toLowerCase() === c);
      if (exact) return exact.name;
      const partial = vaults.find(
        (v) =>
          v.name.toLowerCase().includes(c) || c.includes(v.name.toLowerCase())
      );
      return partial?.name ?? category;
    },
    [vaults]
  );

  const onConfirmClick = useCallback(async () => {
    suppressRejectOnClose.current = true;
    try {
      const n = await handleConfirm();
      if (n > 0) {
        onConfirmed?.(n);
        diffModalListeners.onConfirmed?.(n);
      } else suppressRejectOnClose.current = false;
    } catch {
      suppressRejectOnClose.current = false;
    }
  }, [handleConfirm, onConfirmed]);

  const handleUserReject = useCallback(() => {
    skipDuplicateRejectNotify.current = true;
    useDiffStore.getState().rejectAll();
    onRejected?.();
    diffModalListeners.onRejected?.();
  }, [onRejected]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (
        t.isContentEditable ||
        t.tagName === "INPUT" ||
        t.tagName === "TEXTAREA"
      ) {
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        handleUserReject();
      }
      if (e.key === "Enter" && !e.shiftKey && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        if (selectedCount > 0 && !isConfirming) void onConfirmClick();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, selectedCount, isConfirming, handleUserReject, onConfirmClick]);

  const deletedLabel = queue?.deletedAt
    ? (() => {
        try {
          return format(new Date(queue.deletedAt!), "MMM d, h:mm a");
        } catch {
          return queue.deletedAt;
        }
      })()
    : null;

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(next) => {
        if (!next) {
          if (suppressRejectOnClose.current) {
            suppressRejectOnClose.current = false;
            return;
          }
          if (skipDuplicateRejectNotify.current) {
            skipDuplicateRejectNotify.current = false;
            return;
          }
          useDiffStore.getState().rejectAll();
          onRejected?.();
          diffModalListeners.onRejected?.();
        }
      }}
    >
      <DialogContent
        showCloseButton
        className={cn(
          "gap-0 overflow-hidden border-[#2A2A2D] bg-[#121214] p-0 text-[#F5F4F0] shadow-2xl",
          "max-sm:fixed max-sm:inset-0 max-sm:flex max-sm:h-[100dvh] max-sm:max-h-[100dvh] max-sm:w-full max-sm:max-w-full max-sm:translate-x-0 max-sm:translate-y-0 max-sm:rounded-none",
          "sm:max-w-2xl sm:rounded-xl"
        )}
      >
        <div className="flex max-h-[100dvh] min-h-0 flex-1 flex-col sm:max-h-[min(720px,90vh)]">
          <DialogHeader className="shrink-0 space-y-2 border-b border-[#2A2A2D] px-4 py-3 sm:px-5 sm:py-4">
            <DialogTitle
              className="font-sans text-lg font-semibold tracking-tight text-[#F5F4F0] sm:text-xl"
              style={{
                fontFamily:
                  'var(--font-inter, "Inter", ui-sans-serif), system-ui, sans-serif',
              }}
            >
              {queue?.proposals.some((p) => p.pendingProposalId)
                ? "Review MCP memory proposals"
                : "Review memory update"}
            </DialogTitle>
            <p className="text-sm leading-snug text-[#F5F4F0]/55">
              {queue?.summary?.trim() ||
                "Review extracted changes before they are saved to your graph."}
            </p>
            {queue?.fromShareLink && deletedLabel && (
              <div className="flex items-center gap-1.5 rounded-md border border-[#1f4d38] bg-[#0f1f18] px-2.5 py-1.5 text-xs font-medium text-[#7EE0B8]">
                <Check className="size-3.5 shrink-0 text-[#5DCAA5]" strokeWidth={2.5} />
                Link deleted at {deletedLabel}
              </div>
            )}
            {queue &&
              (queue.totalExtracted ?? queue.proposals.length) > maxNodes && (
                <p className="text-[11px] text-[#F5F4F0]/40">
                  Showing {maxNodes} of{" "}
                  {queue.totalExtracted ?? queue.proposals.length} extracted
                  nodes
                </p>
              )}
          </DialogHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
            {visibleProposals.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#F5F4F0]/45">
                No structured memories were extracted. Add a bit more detail
                and try again.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {visibleProposals.map((node) => (
                  <li key={node.tempId}>
                    <DiffNodeCard
                      node={node}
                      vaultColor={vaultColorForCategory(
                        node.category,
                        vaultHexByName
                      )}
                      vaultLabel={resolveVaultLabel(node.category)}
                      selected={selectedIds.has(node.tempId)}
                      onToggleSelect={() => toggleSelected(node.tempId)}
                      displayValue={valueEdits[node.tempId] ?? node.newValue}
                      onValueChange={(v) => setNodeValueEdit(node.tempId, v)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="shrink-0 border-t border-[#2A2A2D] bg-[#0E0E10] px-4 py-3 sm:px-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="inline-flex w-fit items-center rounded-md border border-[#2A2A2D] bg-[#141416] px-2 py-1 text-xs font-medium tabular-nums text-[#F5F4F0]/70">
                {selectedCount} node{selectedCount === 1 ? "" : "s"} selected
              </span>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-[#F5F4F0]/55 hover:bg-[#2A2A2D]/50 hover:text-[#F5F4F0]"
                  onClick={handleUserReject}
                  disabled={isConfirming}
                >
                  Reject all
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={selectedCount === 0 || isConfirming}
                  className="bg-[#5DCAA5] text-[#0A0A0B] hover:bg-[#4BB894] disabled:opacity-40"
                  onClick={() => void onConfirmClick()}
                >
                  {isConfirming ? "Saving…" : "Confirm selected"}
                </Button>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] tracking-wide text-[#F5F4F0]/35 sm:text-left">
              ↵ confirm · esc reject
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
