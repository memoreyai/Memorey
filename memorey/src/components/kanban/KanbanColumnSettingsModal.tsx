"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { KanbanColumnRow } from "@/store/kanbanStore";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const KANBAN_COLUMN_PRESET_COLORS = [
  "#6B7280",
  "#EF4444",
  "#F59E0B",
  "#10B981",
  "#3B82F6",
  "#8B5CF6",
  "#EC4899",
  "#14B8A6",
  "#F97316",
  "#84CC16",
  "#06B6D4",
  "#A855F7",
] as const;

function normalizeHex(hex: string | null | undefined): string {
  if (!hex) return "#5DCAA5";
  let h = hex.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h.slice(0, 7).toUpperCase();
}

export function KanbanColumnSettingsModal({
  open,
  onOpenChange,
  column,
  onUpdateName,
  onUpdateColor,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  column: KanbanColumnRow | null;
  onUpdateName: (name: string) => Promise<void>;
  onUpdateColor: (color: string) => Promise<void>;
  onDelete: () => Promise<boolean>;
}) {
  const [name, setName] = useState("");
  const [deleteArmed, setDeleteArmed] = useState(false);

  useEffect(() => {
    if (open && column) {
      setName(column.name);
      setDeleteArmed(false);
    }
  }, [open, column?.id, column?.name]);

  useEffect(() => {
    if (!deleteArmed) return;
    const t = window.setTimeout(() => setDeleteArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [deleteArmed]);

  const commitName = useCallback(async () => {
    if (!column) return;
    const next = name.trim();
    if (!next || next === column.name) return;
    await onUpdateName(next);
  }, [column, name, onUpdateName]);

  const handleColorPick = useCallback(
    async (hex: string) => {
      const n = normalizeHex(hex);
      if (!column || normalizeHex(column.color) === n) return;
      await onUpdateColor(n);
    },
    [column, onUpdateColor]
  );

  const handleDeleteClick = useCallback(async () => {
    if (!column || column.is_default) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    const ok = await onDelete();
    setDeleteArmed(false);
    if (ok) onOpenChange(false);
  }, [column, deleteArmed, onDelete, onOpenChange]);

  const currentHex = normalizeHex(column?.color);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "max-w-[340px] gap-4 border-[var(--border)] bg-[var(--card-bg)] p-4 text-[var(--text)]",
          "sm:max-w-[340px]"
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-base font-semibold text-[var(--text)]">
            Column Settings
          </DialogTitle>
        </DialogHeader>

        {column ? (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text2)]">
                Column name
              </span>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => void commitName()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitName();
                  }
                }}
                maxLength={120}
                className="h-9 text-sm"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text2)]">
                Column color
              </span>
              <div className="grid grid-cols-6 gap-2">
                {KANBAN_COLUMN_PRESET_COLORS.map((preset) => {
                  const selected = currentHex === normalizeHex(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      title={preset}
                      className={cn(
                        "relative flex size-9 items-center justify-center rounded-lg border-2 transition-[box-shadow,transform] hover:scale-[1.03]",
                        selected
                          ? "border-[var(--text)] ring-2 ring-[var(--text)]/25"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: preset }}
                      onClick={() => void handleColorPick(preset)}
                    >
                      {selected ? (
                        <Check
                          className="size-4 text-white drop-shadow-md"
                          strokeWidth={2.5}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-[var(--border)] pt-3">
              {column.is_default ? (
                <Tooltip>
                  <TooltipTrigger
                    type="button"
                    className={cn(
                      buttonVariants({ variant: "destructive", size: "default" }),
                      "w-full cursor-not-allowed opacity-60"
                    )}
                    aria-disabled
                    onClick={(e) => e.preventDefault()}
                  >
                    Delete column
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    Default columns cannot be deleted
                  </TooltipContent>
                </Tooltip>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  className={cn(
                    "w-full",
                    deleteArmed &&
                      "font-semibold text-destructive ring-2 ring-destructive/40"
                  )}
                  onClick={() => void handleDeleteClick()}
                >
                  {deleteArmed ? "Click again to confirm" : "Delete column"}
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
