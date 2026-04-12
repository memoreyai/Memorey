"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CategoryVault, KanbanStatus } from "@/types/memorey";
import type { KanbanColumnRow } from "@/store/kanbanStore";
import { toast } from "sonner";

export type KanbanNodeRowSnake = {
  id: string;
  user_id: string;
  vault_id: string;
  canvas_id: string | null;
  title: string;
  value: string;
  kanban_status: KanbanStatus | null;
  kanban_column_id: string | null;
  kanban_order: number | null;
  created_at: string;
};

function statusForColumn(column: KanbanColumnRow | null): KanbanStatus | null {
  if (!column) return null;
  const n = column.name;
  if (n === "Done") return "done";
  if (n === "In Progress") return "doing";
  if (n === "To Do") return "todo";
  return "todo";
}

export function KanbanAddCardColumnFooter({
  userId,
  canvasId,
  column,
  vaults,
  getKanbanOrder,
  onCreated,
}: {
  userId: string;
  canvasId: string;
  column: KanbanColumnRow | null;
  vaults: CategoryVault[];
  getKanbanOrder: () => number;
  onCreated: (row: KanbanNodeRowSnake) => void;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [vaultId, setVaultId] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (vaults.length && !vaultId) {
      setVaultId(vaults[0]!.id);
    }
  }, [vaults, vaultId]);

  const reset = useCallback(() => {
    setTitle("");
    setValue("");
    setVaultId(vaults[0]?.id ?? "");
    setOpen(false);
  }, [vaults]);

  const submit = useCallback(async () => {
    const t = title.trim();
    if (!t || t.length > 100) {
      toast.error("Title is required (max 100 characters)");
      return;
    }
    const v = value.trim();
    if (v.length > 600) {
      toast.error("Description must be at most 600 characters");
      return;
    }
    if (!vaultId) {
      toast.error("Select a vault");
      return;
    }
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast.error("Sign in required");
      return;
    }

    setSaving(true);
    try {
      const columnId = column?.id ?? null;
      const ks = statusForColumn(column);
      const kanbanOrder = getKanbanOrder();
      const res = await fetch("/api/memory/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          userId,
          vaultId,
          title: t,
          value: v,
          confidence: 1,
          source: "manual",
          canvasId,
          kanbanColumnId: columnId,
          kanbanOrder,
          kanbanStatus: columnId ? ks : null,
          analyticsSource: "kanban_quick_add",
        }),
      });
      const data = (await res.json()) as {
        node?: KanbanNodeRowSnake;
        error?: string;
      };
      if (!res.ok || !data.node) {
        toast.error(data.error ?? "Could not create card");
        return;
      }
      onCreated(data.node);
      reset();
      toast.success("Card added");
    } finally {
      setSaving(false);
    }
  }, [
    title,
    value,
    vaultId,
    userId,
    canvasId,
    column,
    getKanbanOrder,
    onCreated,
    reset,
  ]);

  if (vaults.length === 0) {
    return (
      <p
        className="px-2 py-2 text-[10px]"
        style={{ color: "var(--text2)" }}
      >
        Add a vault to this canvas to create cards.
      </p>
    );
  }

  return (
    <div
      className="shrink-0 border-t px-2 py-2"
      style={{ borderColor: "var(--border)" }}
    >
      {!open ? (
        <button
          type="button"
          className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed py-2 text-xs font-medium transition-colors"
          style={{
            borderColor: "var(--border2)",
            color: "var(--text2)",
            background: "transparent",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background =
              "color-mix(in oklab, var(--bg3) 70%, transparent)";
            e.currentTarget.style.color = "var(--text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = "transparent";
            e.currentTarget.style.color = "var(--text2)";
          }}
          onClick={() => setOpen(true)}
        >
          <Plus className="size-3.5 shrink-0" strokeWidth={2} />
          Add card
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <Input
            placeholder="Title"
            value={title}
            maxLength={100}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
            }}
            autoFocus
          />
          <textarea
            placeholder="Description (optional)"
            value={value}
            maxLength={600}
            rows={3}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-[72px] resize-y rounded-md border px-2 py-1.5 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
              color: "var(--text)",
            }}
          />
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text2)]">
              Vault
            </span>
            <select
              value={vaultId}
              onChange={(e) => setVaultId(e.target.value)}
              className="h-8 rounded-md border px-2 text-sm"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg)",
                color: "var(--text)",
              }}
            >
              {vaults.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7"
              disabled={saving}
              onClick={() => void submit()}
            >
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-7"
              disabled={saving}
              onClick={reset}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
