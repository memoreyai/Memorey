"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryVault, MemoryNode } from "@/types/memorey";
import { memoryNodeCreateBodySchema } from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
import { toast } from "sonner";

interface AddMemoryModalProps {
  isOpen: boolean;
  parentNodeId: string | null;
  vaults: CategoryVault[];
  onSaved: (node: MemoryNode) => void;
  onClose: () => void;
  userId: string;
  canvasId: string | null;
}

export function AddMemoryModal({
  isOpen,
  vaults,
  onSaved,
  onClose,
  userId,
  canvasId,
}: AddMemoryModalProps) {
  const [vaultId, setVaultId] = useState(vaults[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [confidence, setConfidence] = useState(0.9);
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && vaults[0]) {
      const id = vaults[0].id;
      queueMicrotask(() => setVaultId(id));
    }
  }, [isOpen, vaults]);

  if (!isOpen) return null;

  const save = async () => {
    setFieldError(null);
    const parsed = memoryNodeCreateBodySchema.safeParse({
      userId,
      vaultId,
      title,
      value,
      confidence,
      source: "manual",
      canvasId: canvasId ?? null,
    });
    if (!parsed.success) {
      setFieldError(formatZodError(parsed.error));
      return;
    }
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch("/api/memory/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(parsed.data),
    });
    const json = (await res.json()) as { node?: Record<string, unknown>; error?: string };
    if (!res.ok || !json.node) {
      toast.error(json.error ?? "Could not save memory");
      return;
    }
    const row = json.node;
    const v = vaults.find((x) => x.id === vaultId);
    const node: MemoryNode = {
      id: row.id as string,
      userId: row.user_id as string,
      vaultId: row.vault_id as string,
      vaultName: (v?.name ?? "Personal") as MemoryNode["vaultName"],
      title: row.title as string,
      value: row.value as string,
      confidence: (row.confidence as number) ?? confidence,
      source: "manual",
      isActive: true,
      createdAt: row.created_at as string,
      updatedAt: row.updated_at as string,
      canvasId: (row.canvas_id as string | null) ?? undefined,
    };
    void fetch("/api/embed", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        nodeId: node.id,
        userId,
        text: `${node.title}\n${node.value}`,
      }),
    });
    onSaved(node);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl border p-4"
        style={{
          backgroundColor: "var(--bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-3 font-semibold">Add memory</h2>
        {fieldError ? (
          <p className="mb-2 text-xs" style={{ color: "var(--destructive, #e05c5c)" }}>
            {fieldError}
          </p>
        ) : null}
        <div className="mb-2 max-h-32 space-y-1 overflow-y-auto">
          {vaults.map((v) => (
            <button
              key={v.id}
              type="button"
              className="mr-2 rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor:
                  vaultId === v.id ? "var(--orange-dim)" : "var(--surface)",
              }}
              onClick={() => setVaultId(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="mb-2 w-full rounded border px-2 py-1.5 text-sm"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
          }}
          placeholder="Title"
        />
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mb-2 w-full rounded border px-2 py-1.5 text-sm"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--surface)",
            color: "var(--text)",
          }}
          placeholder="Value"
          rows={4}
        />
        <label className="mb-3 flex items-center gap-2 text-xs">
          Confidence {Math.round(confidence * 100)}%
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={confidence}
            onChange={(e) => setConfidence(Number(e.target.value))}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} style={{ color: "var(--muted)" }}>
            Cancel
          </button>
          <button
            type="button"
            style={{ backgroundColor: "var(--orange)", color: "var(--bg)" }}
            className="rounded px-3 py-1 text-sm"
            onClick={() => void save()}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
