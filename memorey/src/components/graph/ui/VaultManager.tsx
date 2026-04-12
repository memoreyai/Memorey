"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapVaultRow, useVaultStore } from "@/store/vaultStore";
import { useGraphStore } from "@/store/graphStore";
import { X, Plus, Trash2, Pencil, Check, Eye, EyeOff } from "lucide-react";
import type { CategoryVault } from "@/types/memorey";
import { LucideIconPicker } from "./LucideIconPicker";
import { toast } from "sonner";
import { useCanvasStore } from "@/store/canvasStore";
import { useIsDarkTheme } from "@/hooks/useIsDarkTheme";
import { parseVaultColorOverrides } from "@/lib/vaultThemeResolve";
import type { Json } from "@/lib/supabase/types";
import { vaultCreateBodySchema } from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
import { fetchVaultsWithRetry } from "@/lib/vaults/fetchVaultsWithRetry";

const COLOR_PALETTE = [
  "#378ADD",
  "#F5C542",
  "#FF6600",
  "#FF5B8A",
  "#C792EA",
  "#A8E063",
  "#4FC1E9",
  "#888780",
  "#E05C5C",
  "#5DCAA5",
  "#F0A500",
  "#7C6FF0",
  "#FF8C42",
  "#4CAF82",
  "#E91E8C",
  "#00BCD4",
];

const BG_PRESETS = [
  "#171410",
  "#1D1A13",
  "#242018",
  "#0F0F0E",
  "#FFFFFF",
  "#F8F6F2",
  "#F0EDE6",
  "#FFF8F0",
];

const TEXT_PRESETS = ["#F2F0EB", "#0F0F0F", "#FF6600", "#5DCAA5"];

interface VaultManagerProps {
  isOpen: boolean;
  userId: string | null;
  onClose: () => void;
}

export function VaultManager({ isOpen, userId, onClose }: VaultManagerProps) {
  const canvasVaultLinks = useVaultStore((s) => s.canvasVaultLinks);
  const setCanvasVaultShowEmpty = useVaultStore((s) => s.setCanvasVaultShowEmpty);
  const setVaultShowEmptyInMaster = useVaultStore(
    (s) => s.setVaultShowEmptyInMaster
  );
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const isMasterView = useCanvasStore((s) => s.isMasterView);

  const showCanvasVisibilityToggles = Boolean(activeCanvasId && !isMasterView);
  const [managerVaults, setManagerVaults] = useState<CategoryVault[]>([]);
  const [loadingManagerVaults, setLoadingManagerVaults] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingColor, setEditingColor] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(COLOR_PALETTE[0]);
  const [newIconKey, setNewIconKey] = useState<string | null>(null);
  const [editingIconKey, setEditingIconKey] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  /** One palette for vault pill + default card colours (same DB row, six mirrored columns). */
  const [editingVaultFill, setEditingVaultFill] = useState<string | null>(null);
  const [editingVaultBorder, setEditingVaultBorder] = useState<string | null>(
    null
  );
  const [editingVaultText, setEditingVaultText] = useState<string | null>(null);
  const [applyToExisting, setApplyToExisting] = useState(false);
  const isDark = useIsDarkTheme();

  const listVaults = useMemo(
    () =>
      managerVaults
        .filter((v) => v.isActive)
        .sort((a, b) => a.displayOrder - b.displayOrder),
    [managerVaults]
  );

  /**
   * Single-canvas view: only vaults linked to this canvas, plus a separate “add” list.
   * Master view: all active vaults (workspace-wide).
   */
  const vaultListSections = useMemo(() => {
    const base = listVaults;
    if (!showCanvasVisibilityToggles || !activeCanvasId) {
      return [{ key: "all" as const, label: null as string | null, vaults: base }];
    }
    const linkedIds = new Set(
      canvasVaultLinks
        .filter((l) => l.canvas_id === activeCanvasId)
        .map((l) => l.vault_id)
    );
    const onCanvas = base.filter((v) => linkedIds.has(v.id));
    const canAdd = base.filter((v) => !linkedIds.has(v.id));
    const sections: {
      key: string;
      label: string | null;
      vaults: CategoryVault[];
    }[] = [];
    if (onCanvas.length > 0) {
      sections.push({
        key: "on-canvas",
        label: "Vaults on this canvas",
        vaults: onCanvas,
      });
    }
    if (canAdd.length > 0) {
      sections.push({
        key: "add",
        label: "Add vault to this canvas",
        vaults: canAdd,
      });
    }
    if (sections.length === 0) {
      return [{ key: "empty", label: null, vaults: [] as CategoryVault[] }];
    }
    return sections;
  }, [
    listVaults,
    showCanvasVisibilityToggles,
    activeCanvasId,
    canvasVaultLinks,
  ]);

  const vaultSummaryLine = useMemo(() => {
    if (loadingManagerVaults) return "Loading…";
    if (!showCanvasVisibilityToggles || !activeCanvasId) {
      return `${listVaults.length} vault${listVaults.length !== 1 ? "s" : ""}`;
    }
    const linkedIds = new Set(
      canvasVaultLinks
        .filter((l) => l.canvas_id === activeCanvasId)
        .map((l) => l.vault_id)
    );
    const on = listVaults.filter((v) => linkedIds.has(v.id)).length;
    const add = listVaults.filter((v) => !linkedIds.has(v.id)).length;
    if (add > 0) return `${on} on canvas · ${add} available to add`;
    return `${on} on canvas`;
  }, [
    loadingManagerVaults,
    listVaults,
    showCanvasVisibilityToggles,
    activeCanvasId,
    canvasVaultLinks,
  ]);

  const refreshManagerVaults = useCallback(async () => {
    if (!userId) return;
    const supabase = createClient();
    const rows = await fetchVaultsWithRetry(supabase, userId);
    setManagerVaults(
      rows.map((r) => mapVaultRow(r as Parameters<typeof mapVaultRow>[0]))
    );
  }, [userId]);

  useEffect(() => {
    if (!isOpen || !userId) return;
    let cancelled = false;
    setLoadingManagerVaults(true);
    void (async () => {
      try {
        const supabase = createClient();
        const rows = await fetchVaultsWithRetry(supabase, userId);
        if (cancelled) return;
        setManagerVaults(
          rows.map((r) =>
            mapVaultRow(r as Parameters<typeof mapVaultRow>[0])
          )
        );
      } catch {
        if (!cancelled) toast.error("Could not load vaults");
      } finally {
        if (!cancelled) setLoadingManagerVaults(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, userId]);

  useEffect(() => {
    if (!isOpen || !activeCanvasId || isMasterView) return;
    void useVaultStore.getState().fetchCanvasVaultLinks([activeCanvasId]);
  }, [isOpen, activeCanvasId, isMasterView]);

  function isVaultOnActiveCanvas(vaultId: string): boolean {
    if (!activeCanvasId || isMasterView) return false;
    return canvasVaultLinks.some(
      (l) => l.canvas_id === activeCanvasId && l.vault_id === vaultId
    );
  }

  function showEmptyOnActiveCanvas(vaultId: string): boolean {
    if (!activeCanvasId) return false;
    const link = canvasVaultLinks.find(
      (l) => l.canvas_id === activeCanvasId && l.vault_id === vaultId
    );
    return link?.showEmptyOnCanvas === true;
  }

  const toggleShowEmptyInMaster = useCallback(
    async (vault: CategoryVault, show: boolean) => {
      if (!userId) return;
      setSaving(true);
      try {
        await setVaultShowEmptyInMaster(userId, vault.id, show);
        setManagerVaults((prev) =>
          prev.map((v) =>
            v.id === vault.id ? { ...v, showEmptyInMaster: show } : v
          )
        );
        toast.success(
          show
            ? `"${vault.name}" will show when empty in master view`
            : `"${vault.name}" hidden when empty in master view`
        );
      } catch {
        toast.error("Could not update master vault display");
      } finally {
        setSaving(false);
      }
    },
    [userId, setVaultShowEmptyInMaster]
  );

  const toggleShowEmptyOnCanvas = useCallback(
    async (vault: CategoryVault, show: boolean) => {
      if (!activeCanvasId || !userId || isMasterView) return;
      setSaving(true);
      try {
        await setCanvasVaultShowEmpty(activeCanvasId, vault.id, show);
        toast.success(
          show
            ? `"${vault.name}" will show when empty on this canvas`
            : `"${vault.name}" hidden when empty on this canvas`
        );
      } catch {
        toast.error("Could not update canvas vault display");
      } finally {
        setSaving(false);
      }
    },
    [activeCanvasId, userId, isMasterView, setCanvasVaultShowEmpty]
  );

  const toggleCanvasVisibility = useCallback(
    async (vault: CategoryVault) => {
      if (!activeCanvasId || !userId || isMasterView) return;
      const linked = useVaultStore
        .getState()
        .canvasVaultLinks.some(
          (l) =>
            l.canvas_id === activeCanvasId && l.vault_id === vault.id
        );
      setSaving(true);
      try {
        if (linked) {
          await useVaultStore
            .getState()
            .removeVaultFromCanvas(vault.id, activeCanvasId);
          toast.success(`"${vault.name}" hidden from this canvas`);
        } else {
          const supabase = createClient();
          const { data } = await supabase
            .from("canvas_vaults")
            .select("display_order")
            .eq("canvas_id", activeCanvasId)
            .order("display_order", { ascending: false })
            .limit(1)
            .maybeSingle();
          const nextOrder = (data?.display_order ?? -1) + 1;
          await useVaultStore
            .getState()
            .addVaultToCanvas(vault.id, activeCanvasId, nextOrder);
          toast.success(`"${vault.name}" shown on this canvas`);
        }
        await useVaultStore.getState().fetchVaults(userId, activeCanvasId);
      } catch {
        toast.error("Could not update canvas");
      } finally {
        setSaving(false);
      }
    },
    [activeCanvasId, userId, isMasterView]
  );

  function startEdit(vault: CategoryVault) {
    setEditingId(vault.id);
    setEditingName(vault.name);
    setEditingColor(vault.color);
    const mode = isDark ? "dark" : "light";
    const s = vault.colorOverrides?.[mode];
    setEditingVaultFill(
      s?.pillFill ?? vault.pillFillBg ?? vault.defaultCardBg ?? null
    );
    setEditingVaultBorder(
      vault.pillBorderColor ?? vault.defaultCardAccent ?? null
    );
    setEditingVaultText(
      s?.pillText ?? vault.pillTextColor ?? vault.defaultCardText ?? null
    );
    setEditingIconKey(vault.iconKey ?? null);
    setApplyToExisting(false);
    setIsCreating(false);
  }

  useEffect(() => {
    if (!editingId) return;
    const vault = managerVaults.find((v) => v.id === editingId);
    if (!vault) return;
    const mode = isDark ? "dark" : "light";
    const s = vault.colorOverrides?.[mode];
    queueMicrotask(() => {
      setEditingVaultFill(
        s?.pillFill ?? vault.pillFillBg ?? vault.defaultCardBg ?? null
      );
      setEditingVaultBorder(
        vault.pillBorderColor ?? vault.defaultCardAccent ?? null
      );
      setEditingVaultText(
        s?.pillText ?? vault.pillTextColor ?? vault.defaultCardText ?? null
      );
    });
  }, [isDark, editingId, managerVaults]);

  const saveEdit = useCallback(async () => {
    if (!editingId || !userId || !editingName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const trimmed = editingName.trim();
    const mode = isDark ? "dark" : "light";
    const prev =
      managerVaults.find((v) => v.id === editingId)?.colorOverrides ?? {};
    const nextOverrides = {
      ...prev,
      [mode]: {
        pillFill: editingVaultFill,
        pillText: editingVaultText,
        cardBg: editingVaultFill,
        cardText: editingVaultText,
        cardAccent: editingVaultBorder,
      },
    };
    const { error } = await supabase
      .from("category_vaults")
      .update({
        name: trimmed,
        color: editingColor,
        icon_key: editingIconKey,
        color_overrides: nextOverrides as Json,
        pill_fill_bg: null,
        pill_border_color: editingVaultBorder,
        pill_text_color: null,
        default_card_accent: null,
        default_card_bg: null,
        default_card_text: null,
      })
      .eq("id", editingId)
      .eq("user_id", userId);

    if (error) {
      toast.error("Could not save vault");
      setSaving(false);
      return;
    }

    if (applyToExisting) {
      const { error: nodeErr } = await supabase
        .from("memory_nodes")
        .update({
          custom_accent_color: editingVaultBorder,
          custom_bg_color: editingVaultFill,
          custom_text_color: editingVaultText,
        })
        .eq("vault_id", editingId)
        .eq("user_id", userId);

      if (nodeErr) {
        toast.error("Vault saved but could not update cards");
        setSaving(false);
        return;
      }

      for (const n of useGraphStore.getState().nodes) {
        if (n.vaultId === editingId) {
          useGraphStore.getState().updateNode(n.id, {
            customAccentColor: editingVaultBorder ?? undefined,
            customBgColor: editingVaultFill ?? undefined,
            customTextColor: editingVaultText ?? undefined,
          });
        }
      }
    }

    useVaultStore.getState().updateVault(editingId, {
      name: trimmed,
      color: editingColor,
      iconKey: editingIconKey,
      colorOverrides: parseVaultColorOverrides(nextOverrides),
      pillFillBg: null,
      pillBorderColor: editingVaultBorder,
      pillTextColor: null,
      defaultCardAccent: null,
      defaultCardBg: null,
      defaultCardText: null,
    });
    for (const n of useGraphStore.getState().nodes) {
      if (n.vaultId === editingId) {
        useGraphStore.getState().updateNode(n.id, { vaultName: trimmed });
      }
    }
    setEditingId(null);
    setSaving(false);
    void refreshManagerVaults();
    toast.success(
      applyToExisting
        ? "Vault updated and applied to all cards"
        : "Vault updated"
    );
  }, [
    editingId,
    editingName,
    editingColor,
    editingVaultFill,
    editingVaultBorder,
    editingVaultText,
    editingIconKey,
    applyToExisting,
    userId,
    isDark,
    managerVaults,
    refreshManagerVaults,
  ]);

  const deleteVault = useCallback(
    async (vault: CategoryVault) => {
      if (!userId) return;

      const remaining = listVaults.filter((v) => v.id !== vault.id);
      if (remaining.length === 0) {
        toast.error("You must keep at least one vault");
        return;
      }

      const confirmed = window.confirm(
        `Delete "${vault.name}"?\n\n` +
          `All memories in this vault will be moved to "${remaining[0].name}".`
      );
      if (!confirmed) return;

      setSaving(true);
      const supabase = createClient();

      const { error: moveNodesErr } = await supabase
        .from("memory_nodes")
        .update({ vault_id: remaining[0].id })
        .eq("vault_id", vault.id)
        .eq("user_id", userId);

      if (moveNodesErr) {
        toast.error("Could not move memories");
        setSaving(false);
        return;
      }

      const { data: cvRows } = await supabase
        .from("canvas_vaults")
        .select("canvas_id, display_order")
        .eq("vault_id", vault.id);

      await supabase.from("canvas_vaults").delete().eq("vault_id", vault.id);

      for (const row of cvRows ?? []) {
        const { data: hasTarget } = await supabase
          .from("canvas_vaults")
          .select("canvas_id")
          .eq("canvas_id", row.canvas_id)
          .eq("vault_id", remaining[0].id)
          .maybeSingle();
        if (!hasTarget) {
          await supabase.from("canvas_vaults").insert({
            canvas_id: row.canvas_id,
            vault_id: remaining[0].id,
            display_order: row.display_order ?? 0,
          });
        }
      }

      const canvasIds = [...new Set((cvRows ?? []).map((r) => r.canvas_id))];
      if (canvasIds.length > 0) {
        void useVaultStore.getState().fetchCanvasVaultLinks(canvasIds);
      }

      const { error } = await supabase
        .from("category_vaults")
        .update({ is_active: false })
        .eq("id", vault.id)
        .eq("user_id", userId);

      if (error) {
        toast.error("Could not delete vault");
        setSaving(false);
        return;
      }

      const targetName = remaining[0].name;
      for (const n of useGraphStore.getState().nodes) {
        if (n.vaultId === vault.id) {
          useGraphStore.getState().updateNode(n.id, {
            vaultId: remaining[0].id,
            vaultName: targetName,
          });
        }
      }

      useVaultStore.getState().updateVault(vault.id, { isActive: false });

      setSaving(false);
      void refreshManagerVaults();
      toast.success(
        `"${vault.name}" deleted — memories moved to "${remaining[0].name}"`
      );
    },
    [userId, listVaults, refreshManagerVaults]
  );

  const createVault = useCallback(async () => {
    if (!userId || !newName.trim()) return;
    const parsed = vaultCreateBodySchema.safeParse({
      name: newName,
      color: newColor,
      icon_key: newIconKey,
    });
    if (!parsed.success) {
      toast.error(formatZodError(parsed.error));
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const maxOrder = Math.max(0, ...listVaults.map((v) => v.displayOrder));

    const {
      data: { session },
    } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      toast.error("Sign in required");
      setSaving(false);
      return;
    }

    const res = await fetch("/api/vaults/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(parsed.data),
    });
    const payload = (await res.json()) as {
      vault?: {
        id: string;
        user_id: string;
        name: string;
        color: string | null;
        icon_key?: string | null;
        is_custom: boolean | null;
        is_active: boolean | null;
        display_order: number | null;
        pin_hash?: string | null;
        is_locked?: boolean | null;
        is_exportable?: boolean | null;
      };
      error?: string;
    };

    if (!res.ok || !payload.vault) {
      toast.error(payload.error ?? "Could not create vault");
      setSaving(false);
      return;
    }

    const data = payload.vault;
    const cs = useCanvasStore.getState();
    const canvasIdForLink = cs.activeCanvasId;
    if (canvasIdForLink && !cs.isMasterView) {
      await supabase.from("canvas_vaults").insert({
        canvas_id: canvasIdForLink,
        vault_id: data.id,
        display_order: maxOrder + 1,
      });
      void useVaultStore.getState().fetchCanvasVaultLinks([canvasIdForLink]);
    }

    useVaultStore.getState().addVault({
      id: data.id,
      userId: data.user_id,
      name: data.name,
      color: data.color ?? newColor,
      iconKey: data.icon_key ?? newIconKey,
      isCustom: true,
      isActive: data.is_active !== false,
      isLocked: data.is_locked === true,
      pinHash: data.pin_hash ?? null,
      isExportable: data.is_exportable !== false,
      displayOrder: data.display_order ?? maxOrder + 1,
      defaultCardAccent: null,
      defaultCardBg: null,
      defaultCardText: null,
    });

    setNewName("");
    setNewColor(COLOR_PALETTE[0]);
    setNewIconKey(null);
    setIsCreating(false);
    setSaving(false);
    void refreshManagerVaults();
    toast.success(`"${data.name}" vault created`);
  }, [userId, newName, newColor, newIconKey, listVaults, refreshManagerVaults]);

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 150,
          background: "rgba(0,0,0,0.4)",
        }}
        onClick={onClose}
        aria-hidden
      />

      <div
        style={{
          position: "fixed",
          top: 0,
          right: 0,
          bottom: 0,
          width: 360,
          background: "var(--bg3)",
          borderLeft: "1px solid var(--border2)",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.35)",
          zIndex: 160,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            padding: "16px 20px",
            borderBottom: "1px solid var(--border)",
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}
            >
              Manage vaults
            </div>
            <div
              style={{ fontSize: 11, color: "var(--muted)", marginTop: 1 }}
            >
              {vaultSummaryLine}
              {isMasterView ? (
                <span style={{ display: "block", marginTop: 4 }}>
                  Master view — use “Show when empty (master)” per vault to keep a
                  column with no memories. Eye controls still apply in canvas
                  view.
                </span>
              ) : showCanvasVisibilityToggles && activeCanvas ? (
                <span style={{ display: "block", marginTop: 4 }}>
                  Canvas “{activeCanvas.name}”: only vaults on this canvas are listed
                  here. Use the eye to remove or add. “Show when empty (this canvas)”
                  keeps an empty vault column visible.
                </span>
              ) : (
                <span style={{ display: "block", marginTop: 4 }}>
                  “Show when empty (master)” applies in the all-canvases graph.
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "8px 0" }}>
          {loadingManagerVaults ? (
            <div
              style={{
                padding: "24px 20px",
                fontSize: 13,
                color: "var(--muted)",
              }}
            >
              Loading vaults…
            </div>
          ) : null}
          {!loadingManagerVaults &&
            vaultListSections.map((section) => (
              <div key={section.key}>
                {section.label ? (
                  <div
                    style={{
                      padding: "10px 16px 4px",
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: "var(--muted)",
                    }}
                  >
                    {section.label}
                  </div>
                ) : null}
                {section.vaults.map((vault) => (
            <div
              key={vault.id}
              className={
                section.key === "add" ? "vault-row-off-canvas vault-item" : "vault-item"
              }
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "stretch",
                gap: 0,
                padding: "8px 16px",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {editingId === vault.id ? (
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      gap: 4,
                      flexWrap: "wrap",
                      marginBottom: 8,
                    }}
                  >
                    {COLOR_PALETTE.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setEditingColor(color)}
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 3,
                          background: color,
                          border: "none",
                          cursor: "pointer",
                          outline:
                            editingColor === color
                              ? "2px solid var(--text)"
                              : "none",
                          outlineOffset: 1,
                        }}
                        aria-label={`Color ${color}`}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      autoFocus
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      style={{
                        flex: 1,
                        background: "var(--bg2)",
                        border: "1px solid var(--orange)",
                        borderRadius: 6,
                        padding: "5px 8px",
                        color: "var(--text)",
                        fontSize: 12,
                        outline: "none",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => void saveEdit()}
                      disabled={saving}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "var(--orange)",
                        border: "none",
                        cursor: "pointer",
                        color: "#fff",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      aria-label="Save"
                    >
                      <Check size={12} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 6,
                        background: "var(--bg2)",
                        border: "1px solid var(--border)",
                        cursor: "pointer",
                        color: "var(--text2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      aria-label="Cancel edit"
                    >
                      <X size={12} />
                    </button>
                  </div>

                  <div style={{ marginTop: 10, maxHeight: 200, overflowY: "auto" }}>
                    <LucideIconPicker
                      value={editingIconKey}
                      onChange={setEditingIconKey}
                      accentColor={editingColor}
                    />
                  </div>

                  <div style={{ marginTop: 12 }}>
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.07em",
                        marginBottom: 8,
                      }}
                    >
                      Vault colours (pill &amp; cards)
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: "var(--text2)",
                        marginBottom: 4,
                      }}
                    >
                      Same fill, border, and text for the header pill and default
                      new cards. Per-card colours: open the node details panel.
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text2)",
                          marginBottom: 4,
                        }}
                      >
                        Fill
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {BG_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditingVaultFill(c)}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 3,
                              background: c,
                              border: "1px solid var(--border)",
                              cursor: "pointer",
                              outline:
                                editingVaultFill === c
                                  ? "2px solid var(--text)"
                                  : "none",
                              outlineOffset: 1,
                            }}
                            aria-label={`Vault fill ${c}`}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditingVaultFill(null)}
                          style={{
                            fontSize: 9,
                            color: "var(--muted)",
                            background: "none",
                            border: "1px solid var(--border)",
                            borderRadius: 3,
                            padding: "1px 5px",
                            cursor: "pointer",
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text2)",
                          marginBottom: 4,
                        }}
                      >
                        Border
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {COLOR_PALETTE.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditingVaultBorder(c)}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 3,
                              background: c,
                              border: "none",
                              cursor: "pointer",
                              outline:
                                editingVaultBorder === c
                                  ? "2px solid var(--text)"
                                  : "none",
                              outlineOffset: 1,
                            }}
                            aria-label={`Vault border ${c}`}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditingVaultBorder(null)}
                          style={{
                            fontSize: 9,
                            color: "var(--muted)",
                            background: "none",
                            border: "1px solid var(--border)",
                            borderRadius: 3,
                            padding: "1px 5px",
                            cursor: "pointer",
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div>
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--text2)",
                          marginBottom: 4,
                        }}
                      >
                        Text
                      </div>
                      <div
                        style={{
                          display: "flex",
                          gap: 4,
                          flexWrap: "wrap",
                          alignItems: "center",
                        }}
                      >
                        {TEXT_PRESETS.map((c) => (
                          <button
                            key={c}
                            type="button"
                            onClick={() => setEditingVaultText(c)}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: 3,
                              background: c,
                              border: "1px solid var(--border)",
                              cursor: "pointer",
                              outline:
                                editingVaultText === c
                                  ? "2px solid var(--text)"
                                  : "none",
                              outlineOffset: 1,
                            }}
                            aria-label={`Vault label text ${c}`}
                          />
                        ))}
                        <button
                          type="button"
                          onClick={() => setEditingVaultText(null)}
                          style={{
                            fontSize: 9,
                            color: "var(--muted)",
                            background: "none",
                            border: "1px solid var(--border)",
                            borderRadius: 3,
                            padding: "1px 5px",
                            cursor: "pointer",
                          }}
                        >
                          Reset
                        </button>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        marginTop: 10,
                      }}
                    >
                      <input
                        type="checkbox"
                        id={`applyToExisting-${vault.id}`}
                        checked={applyToExisting}
                        onChange={(e) => setApplyToExisting(e.target.checked)}
                        style={{
                          accentColor: "var(--orange)",
                          width: 13,
                          height: 13,
                        }}
                      />
                      <label
                        htmlFor={`applyToExisting-${vault.id}`}
                        style={{
                          fontSize: 11,
                          color: "var(--text2)",
                          cursor: "pointer",
                        }}
                      >
                        Apply to all existing cards in this vault
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      width: "100%",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: vault.color,
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        flex: 1,
                        fontSize: 13,
                        color: "var(--text)",
                        fontWeight: 500,
                      }}
                    >
                      {vault.name}
                    </span>
                    {!vault.isCustom ? (
                      <span
                        style={{
                          fontSize: 9,
                          color: "var(--muted)",
                          background: "var(--bg2)",
                          border: "1px solid var(--border)",
                          padding: "1px 5px",
                          borderRadius: 100,
                          flexShrink: 0,
                        }}
                      >
                        preset
                      </span>
                    ) : null}
                    {showCanvasVisibilityToggles ? (
                      <button
                        type="button"
                        onClick={() => void toggleCanvasVisibility(vault)}
                        title={
                          isVaultOnActiveCanvas(vault.id)
                            ? "Hide from this canvas"
                            : "Show on this canvas"
                        }
                        disabled={saving}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: 4,
                          background: "none",
                          border: "none",
                          cursor: saving ? "not-allowed" : "pointer",
                          color: isVaultOnActiveCanvas(vault.id)
                            ? "var(--orange)"
                            : "var(--muted)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "color 0.1s",
                        }}
                        onMouseEnter={(e) => {
                          if (saving) return;
                          e.currentTarget.style.color = isVaultOnActiveCanvas(
                            vault.id
                          )
                            ? "var(--text)"
                            : "var(--orange)";
                        }}
                        onMouseLeave={(e) => {
                          if (saving) return;
                          e.currentTarget.style.color = isVaultOnActiveCanvas(
                            vault.id
                          )
                            ? "var(--orange)"
                            : "var(--muted)";
                        }}
                        aria-label={
                          isVaultOnActiveCanvas(vault.id)
                            ? "Hide from canvas"
                            : "Show on canvas"
                        }
                      >
                        {isVaultOnActiveCanvas(vault.id) ? (
                          <Eye size={11} />
                        ) : (
                          <EyeOff size={11} />
                        )}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => startEdit(vault)}
                      title="Rename or recolor"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "color 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "var(--text)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "var(--muted)";
                      }}
                    >
                      <Pencil size={11} />
                    </button>
                    <button
                      type="button"
                      onClick={() => void deleteVault(vault)}
                      title={
                        listVaults.length <= 1
                          ? "Cannot delete last vault"
                          : "Delete vault"
                      }
                      disabled={listVaults.length <= 1 || saving}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 4,
                        background: "none",
                        border: "none",
                        cursor:
                          listVaults.length <= 1 ? "not-allowed" : "pointer",
                        color:
                          listVaults.length <= 1
                            ? "var(--faint)"
                            : "var(--muted)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        transition: "color 0.1s",
                      }}
                      onMouseEnter={(e) => {
                        if (listVaults.length > 1)
                          e.currentTarget.style.color = "#E05C5C";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color =
                          listVaults.length <= 1
                            ? "var(--faint)"
                            : "var(--muted)";
                      }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                  <div
                    style={{
                      marginTop: 8,
                      paddingLeft: 18,
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                    }}
                  >
                    <label
                      htmlFor={`vault-empty-master-${vault.id}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: saving ? "not-allowed" : "pointer",
                        fontSize: 11,
                        color: "var(--text2)",
                      }}
                    >
                      <input
                        id={`vault-empty-master-${vault.id}`}
                        type="checkbox"
                        checked={vault.showEmptyInMaster === true}
                        disabled={saving}
                        onChange={(e) =>
                          void toggleShowEmptyInMaster(vault, e.target.checked)
                        }
                        style={{
                          accentColor: "var(--orange)",
                          width: 13,
                          height: 13,
                          flexShrink: 0,
                        }}
                      />
                      Show when empty (master)
                    </label>
                    {showCanvasVisibilityToggles &&
                    isVaultOnActiveCanvas(vault.id) ? (
                      <label
                        htmlFor={`vault-empty-canvas-${vault.id}`}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          cursor: saving ? "not-allowed" : "pointer",
                          fontSize: 11,
                          color: "var(--text2)",
                        }}
                      >
                        <input
                          id={`vault-empty-canvas-${vault.id}`}
                          type="checkbox"
                          checked={showEmptyOnActiveCanvas(vault.id)}
                          disabled={saving}
                          onChange={(e) =>
                            void toggleShowEmptyOnCanvas(
                              vault,
                              e.target.checked
                            )
                          }
                          style={{
                            accentColor: "var(--orange)",
                            width: 13,
                            height: 13,
                            flexShrink: 0,
                          }}
                        />
                        Show when empty (this canvas)
                      </label>
                    ) : null}
                  </div>
                </>
              )}
            </div>
          ))}
              </div>
            ))}
        </div>

        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            flexShrink: 0,
            background: "var(--bg2)",
          }}
        >
          {!isCreating ? (
            <button
              type="button"
              onClick={() => setIsCreating(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                width: "100%",
                padding: "8px 12px",
                background: "var(--bg3)",
                border: "1px dashed var(--border2)",
                borderRadius: 8,
                cursor: "pointer",
                color: "var(--text2)",
                fontSize: 13,
                fontWeight: 500,
                transition: "all 0.1s",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--orange)";
                e.currentTarget.style.color = "var(--orange)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border2)";
                e.currentTarget.style.color = "var(--text2)";
              }}
            >
              <Plus size={14} />
              Create new vault
            </button>
          ) : (
            <div>
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                {COLOR_PALETTE.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setNewColor(color)}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 3,
                      background: color,
                      border: "none",
                      cursor: "pointer",
                      outline:
                        newColor === color
                          ? "2px solid var(--text)"
                          : "none",
                      outlineOffset: 1,
                    }}
                    aria-label={`Color ${color}`}
                  />
                ))}
              </div>
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createVault();
                  if (e.key === "Escape") {
                    setIsCreating(false);
                    setNewName("");
                    setNewIconKey(null);
                  }
                }}
                placeholder="Vault name..."
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  background: "var(--bg)",
                  border: `2px solid ${newColor}`,
                  borderRadius: 7,
                  padding: "7px 10px",
                  color: "var(--text)",
                  fontSize: 13,
                  outline: "none",
                  marginBottom: 8,
                  fontFamily: "var(--font-sans)",
                }}
              />
              <div style={{ marginBottom: 8, maxHeight: 180, overflowY: "auto" }}>
                <LucideIconPicker
                  value={newIconKey}
                  onChange={setNewIconKey}
                  accentColor={newColor}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <span style={{ fontSize: 10, color: "var(--muted)" }}>
                  Preview:
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 10px",
                    background: `${newColor}28`,
                    border: `1px solid ${newColor}AA`,
                    borderRadius: 16,
                    fontSize: 11,
                    fontWeight: 600,
                    color: newColor,
                  }}
                >
                  <span
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: "50%",
                      background: newColor,
                    }}
                  />
                  {newName || "Vault name"}
                </span>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsCreating(false);
                    setNewName("");
                    setNewIconKey(null);
                  }}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    background: "var(--bg2)",
                    border: "1px solid var(--border)",
                    borderRadius: 7,
                    cursor: "pointer",
                    fontSize: 12,
                    color: "var(--text2)",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void createVault()}
                  disabled={!newName.trim() || saving}
                  style={{
                    flex: 2,
                    padding: "6px 0",
                    background: newName.trim() ? "var(--orange)" : "var(--bg4)",
                    border: "none",
                    borderRadius: 7,
                    cursor: newName.trim() ? "pointer" : "not-allowed",
                    fontSize: 12,
                    fontWeight: 600,
                    color: newName.trim() ? "#fff" : "var(--muted)",
                  }}
                >
                  {saving ? "Creating…" : "Create vault"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
