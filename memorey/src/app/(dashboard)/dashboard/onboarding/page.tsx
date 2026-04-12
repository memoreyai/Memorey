"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Textarea } from "@/components/ui/textarea";
import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";
import { toast } from "sonner";
import { onboardingProfilePatchSchema } from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";
import { useTrack } from "@/hooks/useTrack";
import { useGraphStore } from "@/store/graphStore";
import { useCanvasStore } from "@/store/canvasStore";
import type { MemoryNode } from "@/types/memorey";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Plus, Sparkles, MousePointerClick, Download, Chrome } from "lucide-react";

const TOTAL_STEPS = 4;

const VAULT_COLORS = [
  "#378ADD", "#F5C542", "#FF6600", "#FF5B8A",
  "#C792EA", "#A8E063", "#4FC1E9", "#888780",
  "#E05C5C", "#5DCAA5", "#F0A500", "#7C6FF0",
];

const VAULT_ICONS: Record<string, string> = {};

const TIPS = [
  {
    icon: Sparkles,
    title: "Chat to create nodes",
    description: "Use the AI chat to quickly create nodes with natural language.",
  },
  {
    icon: MousePointerClick,
    title: "Double-click the canvas",
    description: "Add nodes visually by double-clicking anywhere on the canvas.",
  },
  {
    icon: Download,
    title: "Import conversations",
    description: "Import from ChatGPT, Claude, or any AI tool to build your memory.",
  },
  {
    icon: Chrome,
    title: "Chrome extension",
    description: "Install the extension to capture memories while browsing.",
  },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const { track } = useTrack();

  // Step 1: Master node setup
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");

  // Step 2: Vault selection
  const [allVaults, setAllVaults] = useState<
    { id: string; name: string; color: string; isActive: boolean }[]
  >([]);
  const [selectedVaultIds, setSelectedVaultIds] = useState<Set<string>>(new Set());
  const [isCreatingNewVault, setIsCreatingNewVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultColor, setNewVaultColor] = useState("#5DCAA5");

  // Step 3: First memory
  const [memTitle, setMemTitle] = useState("");
  const [memValue, setMemValue] = useState("");
  const [memVaultId, setMemVaultId] = useState<string>("");

  const addNode = useGraphStore((s) => s.addNode);
  const setActiveCanvas = useCanvasStore((s) => s.setActiveCanvas);

  // Transition direction for animations
  const [direction, setDirection] = useState<"forward" | "back">("forward");
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("memorey-theme");
    const dark = saved ? saved === "dark" : true;
    setIsDark(dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("memorey-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, display_name, full_name, master_node_bio")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.onboarding_completed) { router.replace("/dashboard"); return; }
      if (profile?.full_name) setFullName(profile.full_name as string);
      else if (profile?.display_name) setFullName(profile.display_name as string);
      if (profile?.master_node_bio) setBio(profile.master_node_bio as string);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (loading || !userId) return;
    track("onboarding_started", {});
  }, [loading, userId, track]);

  const vaultsFetchedRef = useRef(false);

  // Seed and load vaults when reaching step 2
  useEffect(() => {
    if (step !== 2 || !userId) return;
    if (vaultsFetchedRef.current) return;
    let cancelled = false;
    const supabase = createClient();
    void (async () => {
      const { data: existing } = await supabase
        .from("category_vaults")
        .select("id")
        .eq("user_id", userId)
        .limit(1);
      if (!existing || existing.length === 0) {
        await supabase.rpc("seed_default_vaults", { p_user_id: userId });
      }
      const { data: vaults } = await supabase
        .from("category_vaults")
        .select("id, name, color, is_active, display_order")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (cancelled) return;
      vaultsFetchedRef.current = true;
      const mapped = (vaults ?? []).map((v) => ({
        id: v.id as string,
        name: v.name as string,
        color: (v.color as string) ?? "#5DCAA5",
        isActive: true,
      }));
      setAllVaults(mapped);
      setSelectedVaultIds(new Set(mapped.map((v) => v.id)));
    })();
    return () => { cancelled = true; };
  }, [step, userId]);

  // Set default vault for step 3
  useEffect(() => {
    if (step === 3 && !memVaultId && allVaults.length > 0) {
      const selected = allVaults.filter((v) => selectedVaultIds.has(v.id));
      const personal = selected.find((v) => v.name.toLowerCase() === "personal");
      setMemVaultId(personal?.id ?? selected[0]?.id ?? allVaults[0].id);
    }
  }, [step, memVaultId, allVaults, selectedVaultIds]);

  const finishOnboarding = useCallback(async () => {
    if (!userId) return;
    const body = { onboarding_completed: true, onboarding_step: TOTAL_STEPS };
    const check = onboardingProfilePatchSchema.safeParse(body);
    if (!check.success) { toast.error(formatZodError(check.error)); return; }
    await fetch("/api/profile/onboarding", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(check.data),
    });
    track("onboarding_completed", {});
    localStorage.setItem("memorey-show-tour", "true");
    router.replace("/dashboard");
  }, [userId, router, track]);

  const canProceed = useMemo(() => {
    if (step === 1) return fullName.trim().length > 0;
    if (step === 2) return selectedVaultIds.size >= 1;
    if (step === 3) return true;
    return true;
  }, [step, fullName, selectedVaultIds]);

  function goToStep(target: number) {
    if (target === step) return;
    setDirection(target > step ? "forward" : "back");
    setAnimating(true);
    setTimeout(() => {
      setStep(target);
      setTimeout(() => setAnimating(false), 20);
    }, 150);
  }

  async function ensureCanvasExists(): Promise<string | null> {
    if (!userId) return null;
    const supabase = createClient();

    const { data: existingCanvases } = await supabase
      .from("canvases")
      .select("id")
      .eq("user_id", userId)
      .limit(1);

    if (existingCanvases && existingCanvases.length > 0) {
      const cid = (existingCanvases[0] as { id: string }).id;

      const selectedIds = Array.from(selectedVaultIds);
      if (selectedIds.length > 0) {
        await supabase.from("canvas_vaults").upsert(
          selectedIds.map((vaultId) => ({
            canvas_id: cid,
            vault_id: vaultId,
            user_id: userId,
          }))
        );
      }

      await setActiveCanvas(cid, userId);
      return cid;
    }

    const displayName = fullName.trim() || "My Canvas";
    const { data: nc, error: canvasErr } = await supabase
      .from("canvases")
      .insert({
        user_id: userId,
        name: `${displayName}'s Canvas`,
        emoji: null,
        display_order: 1,
        color: "#5DCAA5",
        icon_key: null,
      })
      .select("id")
      .single();

    if (canvasErr || !nc) { toast.error("Could not create canvas"); return null; }
    const canvasId = (nc as { id: string }).id;

    const canvasStore = useCanvasStore.getState();
    useCanvasStore.setState({
      canvases: [...canvasStore.canvases, {
        id: canvasId,
        userId,
        name: `${displayName}'s Canvas`,
        emoji: null,
        color: "#5DCAA5",
        iconKey: null,
        description: null,
        masterNodeBio: bio.trim() || null,
        masterNodeColor: "#FF6600",
        displayOrder: 1,
        isActive: true,
        masterLineStyle: null,
        masterLineColor: null,
        createdAt: new Date().toISOString(),
      }],
    });

    await supabase.rpc("seed_canvas_vaults", { p_user_id: userId, p_canvas_id: canvasId });

    const selectedIds = Array.from(selectedVaultIds);
    if (selectedIds.length > 0) {
      await supabase.from("canvas_vaults").upsert(
        selectedIds.map((vaultId) => ({
          canvas_id: canvasId,
          vault_id: vaultId,
          user_id: userId,
        }))
      );
    }

    await supabase.from("profiles").update({ active_canvas_id: canvasId }).eq("id", userId);
    await setActiveCanvas(canvasId, userId);
    return canvasId;
  }

  async function handleNext() {
    if (!userId || saving) return;
    setSaving(true);
    try {
      if (step === 1) {
        const patch: Record<string, unknown> = {
          display_name: fullName.trim(),
          onboarding_step: 1,
        };
        if (bio.trim()) patch.master_node_bio = bio.trim();
        const check = onboardingProfilePatchSchema.safeParse(patch);
        if (!check.success) { toast.error(formatZodError(check.error)); return; }
        const res = await fetch("/api/profile/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(check.data),
        });
        if (!res.ok) { toast.error("Could not save profile"); return; }
        goToStep(2);
      } else if (step === 2) {
        // Deactivate unselected vaults
        const supabase = createClient();
        const deselected = allVaults.filter((v) => !selectedVaultIds.has(v.id));
        for (const v of deselected) {
          await supabase
            .from("category_vaults")
            .update({ is_active: false })
            .eq("id", v.id)
            .eq("user_id", userId);
        }
        const patch = { onboarding_step: 2 };
        const check = onboardingProfilePatchSchema.safeParse(patch);
        if (check.success) {
          await fetch("/api/profile/onboarding", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(check.data),
          });
        }
        goToStep(3);
      } else if (step === 3) {
        if (memTitle.trim() && memValue.trim() && memVaultId) {
          const canvasId = await ensureCanvasExists();
          if (!canvasId) return;
          const supabase = createClient();
          const { data: { session } } = await supabase.auth.getSession();
          const selectedVault = allVaults.find((v) => v.id === memVaultId);
          const nodeRes = await fetch("/api/memory/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token ?? ""}`,
            },
            body: JSON.stringify({
              userId,
              vaultId: memVaultId,
              canvasId,
              title: memTitle.trim().slice(0, 100),
              value: memValue.trim(),
              source: "manual",
            }),
          });
          if (nodeRes.ok) {
            const { node } = (await nodeRes.json()) as { node: Record<string, unknown> };
            if (node) {
              const nodeObj: MemoryNode = {
                id: node.id as string,
                userId: node.user_id as string,
                vaultId: node.vault_id as string,
                vaultName: selectedVault?.name ?? "Personal",
                canvasId: node.canvas_id as string | undefined,
                title: node.title as string,
                value: node.value as string,
                confidence: (node.confidence as number) ?? 1,
                source: "manual",
                isActive: true,
                createdAt: node.created_at as string,
                updatedAt: node.updated_at as string,
              };
              addNode(nodeObj);
            }
          }
        } else {
          await ensureCanvasExists();
        }
        goToStep(4);
      } else if (step === 4) {
        await finishOnboarding();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleSkip() {
    if (saving) return;
    if (step === 1) {
      goToStep(2);
    } else if (step === 2) {
      goToStep(3);
    } else if (step === 3) {
      setSaving(true);
      try {
        await ensureCanvasExists();
        goToStep(4);
      } finally {
        setSaving(false);
      }
    } else if (step === 4) {
      await finishOnboarding();
    }
  }

  function toggleVault(id: string) {
    setSelectedVaultIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVaults() {
    setSelectedVaultIds(new Set(allVaults.map((v) => v.id)));
  }

  async function createOnboardingVault() {
    if (!userId || !newVaultName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const nextOrder = allVaults.length + 1;
    const { data, error } = await supabase
      .from("category_vaults")
      .insert({
        user_id: userId,
        name: newVaultName.trim(),
        color: newVaultColor,
        is_custom: true,
        is_active: true,
        display_order: nextOrder,
      })
      .select("id, name, color")
      .single();

    if (error || !data) { toast.error("Could not create vault"); setSaving(false); return; }
    const newV = {
      id: data.id as string,
      name: data.name as string,
      color: (data.color as string) ?? newVaultColor,
      isActive: true,
    };
    setAllVaults((prev) => [...prev, newV]);
    setSelectedVaultIds((prev) => new Set([...prev, newV.id]));
    setNewVaultName("");
    setNewVaultColor("#5DCAA5");
    setIsCreatingNewVault(false);
    setSaving(false);
    toast.success(`"${newV.name}" vault created`);
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: "var(--bg)", color: "var(--text)" }}>
        <MemoreyLogo size={40} />
      </div>
    );
  }

  const stepCopy: Record<number, { title: string; subtitle: string }> = {
    1: { title: "Welcome to Memorey", subtitle: "Let's set up your memory space. Start by telling us about yourself." },
    2: { title: "Organize your memories", subtitle: "Vaults are categories for your memories. Pick the ones relevant to you or create your own." },
    3: { title: "Add your first memory", subtitle: "Try creating a memory node. You can also do this later from the dashboard." },
    4: { title: "You're all set!", subtitle: "Here are some quick tips to get the most out of Memorey." },
  };
  const { title: stepTitle, subtitle: stepSubtitle } = stepCopy[step];

  const selectedVaults = allVaults.filter((v) => selectedVaultIds.has(v.id));

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg)", padding: "24px", position: "relative" }}>
      {/* Theme toggle */}
      <button
        type="button"
        aria-label="Toggle theme"
        onClick={() => setIsDark(!isDark)}
        style={{ position: "absolute", top: 20, right: 24, width: 40, height: 40, borderRadius: "var(--r-lg)", border: "1px solid var(--border)", background: "var(--bg3)", color: "var(--text2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all var(--t-fast)" }}
      >
        {isDark ? (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
        )}
      </button>

      <div
        style={{
          width: "100%",
          maxWidth: 540,
          background: "var(--bg3)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-xl)",
          padding: "40px",
          boxShadow: "var(--shadow-lg)",
          overflow: "hidden",
        }}
      >
        {/* Progress indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          {step > 1 && (
            <button
              type="button"
              onClick={() => goToStep(step - 1)}
              style={{ background: "none", border: "none", color: "var(--text2)", cursor: "pointer", padding: 0, display: "flex", alignItems: "center" }}
              aria-label="Go back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div style={{ display: "flex", gap: 6, flex: 1, justifyContent: "center" }}>
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                style={{
                  height: 3,
                  width: n === step ? 24 : 16,
                  borderRadius: 2,
                  background: n <= step ? "var(--orange)" : "var(--border2)",
                  transition: "all 0.3s ease",
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>Step {step} of 4</span>
        </div>

        <div
          style={{
            transition: animating ? "opacity 0.15s ease, transform 0.15s ease" : "none",
            opacity: animating ? 0 : 1,
            transform: animating
              ? `translateX(${direction === "forward" ? "12px" : "-12px"})`
              : "translateX(0)",
          }}
        >
          <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6, fontFamily: "var(--font-display)" }}>{stepTitle}</h2>
          <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 28, lineHeight: 1.6 }}>{stepSubtitle}</p>

          {/* ── Step 1: Welcome + Master Node Setup ── */}
          {step === 1 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>What should we call you?</label>
                <input
                  autoFocus
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canProceed) void handleNext(); }}
                  placeholder="Your name"
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Describe yourself in a line</label>
                <input
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && canProceed) void handleNext(); }}
                  placeholder="e.g., Product designer at a fintech startup"
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none" }}
                />
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 6 }}>This becomes your master node identity on the canvas. Optional.</p>
              </div>
            </div>
          )}

          {/* ── Step 2: Vault Selection ── */}
          {step === 2 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {allVaults.length > 0 && selectedVaultIds.size < allVaults.length && (
                <button
                  type="button"
                  onClick={selectAllVaults}
                  style={{ alignSelf: "flex-end", background: "none", border: "none", fontSize: 12, color: "var(--orange)", cursor: "pointer", fontWeight: 500, marginBottom: -4 }}
                >
                  Select all
                </button>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {allVaults.map((vault) => {
                  const isSelected = selectedVaultIds.has(vault.id);
                  return (
                    <button
                      key={vault.id}
                      type="button"
                      onClick={() => toggleVault(vault.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 10,
                        padding: "12px 14px",
                        background: isSelected ? `${vault.color}15` : "var(--bg2)",
                        border: `1.5px solid ${isSelected ? vault.color : "var(--border)"}`,
                        borderRadius: "var(--r-md)",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.15s",
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 4,
                          background: vault.color,
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: isSelected ? "var(--text)" : "var(--text2)" }}>
                        {vault.name}
                      </span>
                      <span
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 4,
                          flexShrink: 0,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          background: isSelected ? vault.color : "var(--bg4)",
                          border: isSelected ? "none" : "1px solid var(--border2)",
                          transition: "all 0.15s",
                        }}
                      >
                        {isSelected && <Check size={11} color="#fff" strokeWidth={3} />}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* New vault button */}
              <button
                type="button"
                onClick={() => setIsCreatingNewVault(!isCreatingNewVault)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                  padding: "10px",
                  background: "var(--bg2)",
                  border: "1.5px dashed var(--border2)",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text2)",
                  transition: "all 0.15s",
                }}
              >
                <Plus size={14} /> Create custom vault
              </button>

              {isCreatingNewVault && (
                <div style={{ padding: 12, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {VAULT_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setNewVaultColor(c)}
                        style={{ width: 18, height: 18, borderRadius: 3, background: c, border: "none", cursor: "pointer", outline: newVaultColor === c ? "2px solid var(--text)" : "none", outlineOffset: 1 }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      autoFocus
                      value={newVaultName}
                      onChange={(e) => setNewVaultName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void createOnboardingVault(); if (e.key === "Escape") setIsCreatingNewVault(false); }}
                      placeholder="Vault name..."
                      style={{ flex: 1, background: "var(--bg)", border: `2px solid ${newVaultColor}`, borderRadius: 6, padding: "6px 10px", color: "var(--text)", fontSize: 12, outline: "none" }}
                    />
                    <button
                      type="button"
                      onClick={() => void createOnboardingVault()}
                      disabled={!newVaultName.trim() || saving}
                      style={{
                        padding: "6px 14px",
                        background: newVaultName.trim() ? "var(--orange)" : "var(--bg4)",
                        border: "none",
                        borderRadius: 6,
                        cursor: newVaultName.trim() ? "pointer" : "not-allowed",
                        fontSize: 12,
                        fontWeight: 600,
                        color: newVaultName.trim() ? "#fff" : "var(--muted)",
                      }}
                    >
                      Add
                    </button>
                  </div>
                </div>
              )}

              <p style={{ fontSize: 11, color: "var(--muted)" }}>
                {selectedVaultIds.size} of {allVaults.length} selected. You can always add or remove vaults later.
              </p>
            </div>
          )}

          {/* ── Step 3: First Memory Node ── */}
          {step === 3 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Title</label>
                <input
                  autoFocus
                  value={memTitle}
                  onChange={(e) => setMemTitle(e.target.value)}
                  placeholder="e.g., Learning React Native"
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Content</label>
                <Textarea
                  value={memValue}
                  onChange={(e) => setMemValue(e.target.value)}
                  placeholder="e.g., Started learning React Native for our mobile app. Using Expo for faster development."
                  className={cn("min-h-[100px] resize-y", "border-[var(--border)] bg-[var(--bg2)] text-[var(--text)]", "placeholder:text-[var(--muted)]")}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Vault</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {selectedVaults.map((vault) => (
                    <button
                      key={vault.id}
                      type="button"
                      onClick={() => setMemVaultId(vault.id)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "6px 12px",
                        background: memVaultId === vault.id ? `${vault.color}22` : "var(--bg2)",
                        border: `1.5px solid ${memVaultId === vault.id ? vault.color : "var(--border)"}`,
                        borderRadius: 20,
                        cursor: "pointer",
                        fontSize: 12,
                        fontWeight: 500,
                        color: memVaultId === vault.id ? vault.color : "var(--text2)",
                        transition: "all 0.15s",
                      }}
                    >
                      <span style={{ width: 7, height: 7, borderRadius: "50%", background: vault.color, flexShrink: 0 }} />
                      {vault.name}
                      {memVaultId === vault.id && <Check size={11} strokeWidth={2.5} />}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Step 4: Quick Tips ── */}
          {step === 4 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {TIPS.map((tip) => {
                const Icon = tip.icon;
                return (
                  <div
                    key={tip.title}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 12,
                      padding: "14px 16px",
                      background: "var(--bg2)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--r-md)",
                    }}
                  >
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: "var(--r-md)",
                      background: "var(--orange-dim)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      <Icon size={16} style={{ color: "var(--orange)" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 2 }}>{tip.title}</div>
                      <div style={{ fontSize: 12, color: "var(--text2)", lineHeight: 1.5 }}>{tip.description}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Primary CTA */}
        <button
          type="button"
          onClick={() => void handleNext()}
          disabled={!canProceed || saving}
          style={{
            width: "100%",
            padding: "11px 0",
            background: canProceed && !saving ? "var(--orange)" : "var(--bg4)",
            color: canProceed && !saving ? "#fff" : "var(--muted)",
            border: "none",
            borderRadius: "var(--r-md)",
            fontSize: 14,
            fontWeight: 600,
            cursor: canProceed && !saving ? "pointer" : "not-allowed",
            marginTop: 24,
            transition: "all var(--t-fast)",
          }}
        >
          {step === 1 ? "Continue"
            : step === 2 ? "Continue"
            : step === 3 ? (memTitle.trim() && memValue.trim() ? (saving ? "Creating..." : "Create & continue") : "Skip & continue")
            : saving ? "Opening..." : "Go to Dashboard"}
        </button>

        {/* Skip link (steps 1-3) */}
        {step < 4 && (
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleSkip()}
            style={{
              display: "block",
              width: "100%",
              marginTop: 16,
              background: "none",
              border: "none",
              fontSize: 13,
              color: "var(--muted)",
              cursor: saving ? "not-allowed" : "pointer",
              textAlign: "center",
            }}
          >
            {step === 3 ? "Skip, take me to dashboard" : "Skip for now"}
          </button>
        )}
      </div>
    </div>
  );
}
