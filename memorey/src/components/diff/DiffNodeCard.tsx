"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ProposedNode, VaultCategory } from "@/types/memorey";
import { VAULT_COLORS } from "@/types/memorey";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ArrowRight } from "lucide-react";

function vaultColorForCategory(
  category: string,
  vaultHexByName: Map<string, string>
): string {
  const c = category.trim();
  const fromDb = vaultHexByName.get(c.toLowerCase());
  if (fromDb) return fromDb;
  const key = c as VaultCategory;
  if (key in VAULT_COLORS) return VAULT_COLORS[key];
  return "#888780";
}

export interface DiffNodeCardProps {
  node: ProposedNode;
  vaultColor: string;
  vaultLabel: string;
  selected: boolean;
  onToggleSelect: () => void;
  displayValue: string;
  onValueChange: (value: string) => void;
  className?: string;
}

export function DiffNodeCard({
  node,
  vaultColor,
  vaultLabel,
  selected,
  onToggleSelect,
  displayValue,
  onValueChange,
  className,
}: DiffNodeCardProps) {
  const [editing, setEditing] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editing && editRef.current) {
      editRef.current.textContent = displayValue;
      editRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(editRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [editing, displayValue]);

  const endEdit = useCallback(() => {
    if (!editRef.current) {
      setEditing(false);
      return;
    }
    const text = editRef.current.innerText.replace(/\n/g, " ").trim();
    onValueChange(text || displayValue);
    setEditing(false);
  }, [displayValue, onValueChange]);

  const titleChanged =
    !node.isNew &&
    node.oldTitle != null &&
    node.oldTitle.trim() !== node.title.trim();

  return (
    <div
      className={cn(
        "flex gap-2.5 rounded-lg border border-[#2A2A2D] bg-[#141416] p-0.5 pl-0 transition-colors",
        "hover:border-[#3D3D42]",
        selected ? "opacity-100" : "opacity-55",
        className
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: vaultColor }}
    >
      <label className="flex cursor-pointer items-start pt-2.5 pl-2">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          className="size-3.5 shrink-0 rounded border-[#3D3D42] bg-[#0A0A0B] text-[#5DCAA5] accent-[#5DCAA5] focus:ring-[#5DCAA5]/30"
        />
      </label>
      <div className="min-w-0 flex-1 py-2 pr-2.5">
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className="inline-flex max-w-[55%] truncate rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wide uppercase"
            style={{
              backgroundColor: `${vaultColor}22`,
              color: vaultColor,
              border: `1px solid ${vaultColor}44`,
            }}
          >
            {vaultLabel}
          </span>
          <div className="ml-auto flex h-1 w-16 shrink-0 overflow-hidden rounded-full bg-[#2A2A2D]">
            <div
              className="h-full rounded-full bg-[#F5F4F0]/35"
              style={{ width: `${Math.min(100, node.confidence * 100)}%` }}
            />
          </div>
        </div>

        {node.isNew ? (
          <div className="rounded-md border border-[#1a3d2e] bg-[#0f1f18] px-2 py-1.5">
            <div className="mb-1 flex items-center gap-2">
              <Badge className="border-0 bg-[#1f4d38] px-1.5 py-0 text-[10px] font-medium text-[#7EE0B8]">
                New
              </Badge>
              <span className="truncate text-xs font-medium text-[#7EE0B8]">
                {node.title}
              </span>
            </div>
            {editing ? (
              <div
                ref={editRef}
                role="textbox"
                contentEditable
                suppressContentEditableWarning
                onBlur={endEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    endEdit();
                  }
                  if (e.key === "Escape") {
                    if (editRef.current)
                      editRef.current.textContent = displayValue;
                    setEditing(false);
                  }
                }}
                className="min-h-[2rem] whitespace-pre-wrap break-words text-sm leading-snug text-[#9AE8C4] outline-none ring-0 focus:outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-full text-left text-sm leading-snug text-[#9AE8C4] hover:text-[#B8F0D0]"
              >
                {displayValue}
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-1.5 text-xs leading-tight">
              <span
                className={cn(
                  "max-w-[42%] truncate text-[#E85C5C]/90",
                  titleChanged && "line-through decoration-[#E85C5C]/70"
                )}
              >
                {node.oldTitle ?? "—"}
              </span>
              <ArrowRight className="size-3 shrink-0 text-[#F5F4F0]/25" />
              <span className="max-w-[42%] truncate font-medium text-[#5DCAA5]">
                {node.title}
              </span>
            </div>
            <div className="h-px bg-[#2A2A2D]" />
            <p className="text-[11px] leading-snug text-[#E85C5C]/85 line-through decoration-[#E85C5C]/50">
              {node.oldValue ?? "—"}
            </p>
            {editing ? (
              <div
                ref={editRef}
                role="textbox"
                contentEditable
                suppressContentEditableWarning
                onBlur={endEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    endEdit();
                  }
                  if (e.key === "Escape") {
                    if (editRef.current)
                      editRef.current.textContent = displayValue;
                    setEditing(false);
                  }
                }}
                className="min-h-[2.25rem] whitespace-pre-wrap break-words text-sm leading-snug text-[#5DCAA5] outline-none"
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="w-full text-left text-sm leading-snug text-[#5DCAA5] hover:text-[#7EE0B8]"
              >
                {displayValue}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export { vaultColorForCategory };
