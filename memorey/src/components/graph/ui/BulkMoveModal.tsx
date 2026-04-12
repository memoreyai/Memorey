"use client";

import type { CategoryVault } from "@/types/memorey";

interface BulkMoveModalProps {
  isOpen: boolean;
  selectedCount: number;
  vaults: CategoryVault[];
  onMove: (vaultId: string) => void;
  onClose: () => void;
}

export function BulkMoveModal({
  isOpen,
  selectedCount,
  vaults,
  onMove,
  onClose,
}: BulkMoveModalProps) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[70vh] w-full max-w-sm overflow-y-auto rounded-xl border p-4"
        style={{
          backgroundColor: "var(--bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-2 font-semibold">
          Move {selectedCount} to vault
        </h2>
        <ul className="space-y-1">
          {vaults.map((v) => (
            <li key={v.id}>
              <button
                type="button"
                className="w-full rounded-md px-2 py-2 text-left text-sm"
                style={{
                  backgroundColor: "var(--surface)",
                  color: "var(--text)",
                }}
                onClick={() => {
                  onMove(v.id);
                  onClose();
                }}
              >
                {v.name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
