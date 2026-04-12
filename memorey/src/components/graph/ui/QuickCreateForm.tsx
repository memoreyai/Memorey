"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CategoryVault, MemoryNode } from "@/types/memorey";
import { memoryNodeCreateBodySchema } from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
import { toast } from "sonner";

interface QuickCreateFormProps {
  isOpen: boolean;
  pos: { x: number; y: number };
  defaultVaultId: string;
  vaults: CategoryVault[];
  canvasW: number;
  canvasH: number;
  onSaved: (node: MemoryNode) => void;
  onClose: () => void;
  userId: string;
  canvasId: string | null;
  /** Master graph: list of canvases for target picker */
  masterCanvasOptions?: { id: string; emoji: string; name: string }[];
}

export function QuickCreateForm({
  isOpen,
  pos,
  defaultVaultId,
  vaults,
  canvasW,
  canvasH,
  onSaved,
  onClose,
  userId,
  canvasId,
  masterCanvasOptions,
}: QuickCreateFormProps) {
  const [title, setTitle] = useState("");
  const [value, setValue] = useState("");
  const [vaultId, setVaultId] = useState(defaultVaultId);
  const [targetCanvasId, setTargetCanvasId] = useState(canvasId ?? "");
  const [fieldError, setFieldError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      queueMicrotask(() => {
        setTitle("");
        setValue("");
        setVaultId(defaultVaultId);
        const first = masterCanvasOptions?.[0]?.id;
        setTargetCanvasId(
          canvasId ?? first ?? ""
        );
      });
    }
  }, [isOpen, defaultVaultId, canvasId, masterCanvasOptions]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const left = Math.min(Math.max(8, pos.x), canvasW - 280);
  const top = Math.min(Math.max(8, pos.y), canvasH - 220);

  const save = async () => {
    setFieldError(null);
    const effectiveCanvasId =
      masterCanvasOptions?.length && targetCanvasId
        ? targetCanvasId
        : canvasId ?? null;
    const parsed = memoryNodeCreateBodySchema.safeParse({
      userId,
      vaultId,
      title,
      value,
      confidence: 1,
      source: "manual",
      canvasId: effectiveCanvasId,
    });
    if (!parsed.success) {
      setFieldError(formatZodError(parsed.error));
      return;
    }

    const v = vaults.find((x) => x.id === vaultId);
    const now = new Date().toISOString();
    const tempId = `temp-${crypto.randomUUID()}`;
    const optimisticNode: MemoryNode = {
      id: tempId,
      userId,
      vaultId,
      vaultName: (v?.name ?? "Personal") as MemoryNode["vaultName"],
      title,
      value,
      confidence: 1,
      source: "manual",
      isActive: true,
      createdAt: now,
      updatedAt: now,
      canvasId: effectiveCanvasId ?? undefined,
    };

    onSaved(optimisticNode);
    onClose();

    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    try {
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
      void fetch("/api/embed", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          nodeId: json.node.id as string,
          userId,
          text: `${title}\n${value}`,
        }),
      });
    } catch {
      toast.error("Could not save memory. Check your connection.");
    }
  };

  return (
    <div
      className="fixed z-50 w-72 rounded-xl border p-3 shadow-xl"
      style={{
        left,
        top,
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      {fieldError ? (
        <p className="mb-2 text-xs" style={{ color: "var(--destructive, #e05c5c)" }}>
          {fieldError}
        </p>
      ) : null}
      {masterCanvasOptions && masterCanvasOptions.length > 0 ? (
        <label className="mb-2 block text-[11px]" style={{ color: "var(--text2)" }}>
          Canvas
          <select
            value={targetCanvasId}
            onChange={(e) => setTargetCanvasId(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1 text-sm"
            style={{
              borderColor: "var(--border)",
              backgroundColor: "var(--bg)",
              color: "var(--text)",
            }}
          >
            {masterCanvasOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Title"
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg)",
          color: "var(--text)",
        }}
      />
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Description"
        rows={3}
        className="mb-2 w-full rounded border px-2 py-1 text-sm"
        style={{
          borderColor: "var(--border)",
          backgroundColor: "var(--bg)",
          color: "var(--text)",
        }}
      />
      {vaults.length <= 5 ? (
        <div className="mb-2 flex flex-wrap gap-1">
          {vaults.map((v) => (
            <button
              key={v.id}
              type="button"
              className="rounded-full px-2 py-0.5 text-xs"
              style={{
                backgroundColor:
                  vaultId === v.id ? "var(--orange-dim)" : "var(--bg)",
                color: "var(--text)",
              }}
              onClick={() => setVaultId(v.id)}
            >
              {v.name}
            </button>
          ))}
        </div>
      ) : (
        <select
          value={vaultId}
          onChange={(e) => setVaultId(e.target.value)}
          className="mb-2 w-full rounded border px-2 py-1 text-sm"
          style={{
            borderColor: "var(--border)",
            backgroundColor: "var(--bg)",
            color: "var(--text)",
          }}
        >
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="text-xs" style={{ color: "var(--muted)" }} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="rounded px-3 py-1 text-xs font-medium"
          style={{ backgroundColor: "var(--orange)", color: "var(--bg)" }}
          onClick={() => void save()}
        >
          Save
        </button>
      </div>
    </div>
  );
}
