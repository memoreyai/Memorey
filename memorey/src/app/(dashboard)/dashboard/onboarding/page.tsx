"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { MemoryNode, UserSegment } from "@/types/memorey";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, Plus } from "lucide-react";

const TOTAL_STEPS = 4;

const ROLES: { id: UserSegment; label: string }[] = [
  { id: "founder", label: "Founder" },
  { id: "researcher", label: "Researcher" },
  { id: "student", label: "Student" },
  { id: "consultant", label: "Consultant" },
  { id: "developer", label: "Developer" },
  { id: "designer", label: "Designer" },
  { id: "other", label: "Other" },
];

const GOALS = [
  { id: "decisions", label: "Remember important decisions" },
  { id: "ideas", label: "Capture research and ideas" },
  { id: "projects", label: "Organise work projects" },
  { id: "ai_context", label: "Brief AI tools with context" },
  { id: "goals", label: "Track goals and progress" },
  { id: "other", label: "Other" },
] as const;

const VAULT_COLORS = [
  "#378ADD", "#F5C542", "#FF6600", "#FF5B8A",
  "#C792EA", "#A8E063", "#4FC1E9", "#888780",
  "#E05C5C", "#5DCAA5", "#F0A500", "#7C6FF0",
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [isDark, setIsDark] = useState(true);
  const { track } = useTrack();

  // Step 1: Personal details
  const [fullName, setFullName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserSegment | null>(null);
  const [otherRole, setOtherRole] = useState("");

  // Step 2: Goals
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [otherGoal, setOtherGoal] = useState("");

  // Step 3: Canvas + memory + vault
  const [canvasName, setCanvasName] = useState("");
  const [memoryText, setMemoryText] = useState("");
  const [onboardingVaults, setOnboardingVaults] = useState<
    { id: string; name: string; color: string }[]
  >([]);
  const [selectedVaultId, setSelectedVaultId] = useState<string | null>(null);
  const [isCreatingNewVault, setIsCreatingNewVault] = useState(false);
  const [newVaultName, setNewVaultName] = useState("");
  const [newVaultColor, setNewVaultColor] = useState("#5DCAA5");

  // Step 4: Confirmation data
  const [createdCanvasName, setCreatedCanvasName] = useState("");
  const [createdMemory, setCreatedMemory] = useState("");
  const [createdVaultName, setCreatedVaultName] = useState("");

  const addNode = useGraphStore((s) => s.addNode);
  const setActiveCanvas = useCanvasStore((s) => s.setActiveCanvas);

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

  // Load existing state
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || cancelled) { setLoading(false); return; }
      setUserId(user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("onboarding_completed, display_name, full_name")
        .eq("id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (profile?.onboarding_completed) { router.replace("/dashboard"); return; }
      if (profile?.full_name) setFullName(profile.full_name as string);
      else if (profile?.display_name) setFullName(profile.display_name as string);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [router]);

  useEffect(() => {
    if (loading || !userId) return;
    track("onboarding_started", {});
  }, [loading, userId, track]);

  // Load vaults when reaching step 3
  useEffect(() => {
    if (step !== 3 || !userId) return;
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
      const { data: allVaults } = await supabase
        .from("category_vaults")
        .select("id, name, color, is_active, display_order")
        .eq("user_id", userId)
        .eq("is_active", true)
        .order("display_order", { ascending: true });
      if (cancelled) return;
      const mapped = (allVaults ?? []).map((v) => ({
        id: v.id as string,
        name: v.name as string,
        color: (v.color as string) ?? "#5DCAA5",
      }));
      setOnboardingVaults(mapped);
      if (mapped.length > 0 && !selectedVaultId) {
        const personal = mapped.find((v) => v.name.toLowerCase() === "personal");
        setSelectedVaultId(personal?.id ?? mapped[0].id);
      }
    })();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, userId]);

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
    if (step === 1) return fullName.trim().length > 0 && selectedRole !== null;
    if (step === 2) return selectedGoals.length >= 1;
    if (step === 3)
      return canvasName.trim().length > 0 && memoryText.trim().length > 0 && selectedVaultId !== null;
    return true; // step 4 always
  }, [step, fullName, selectedRole, selectedGoals, canvasName, memoryText, selectedVaultId]);

  function toggleGoal(id: string) {
    setSelectedGoals((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleNext() {
    if (!userId || saving) return;
    setSaving(true);
    try {
      if (step === 1) {
        const segment = selectedRole === "other" ? "other" : selectedRole;
        const patch = {
          display_name: fullName.trim(),
          segment,
          onboarding_step: 1,
        };
        const check = onboardingProfilePatchSchema.safeParse(patch);
        if (!check.success) { toast.error(formatZodError(check.error)); return; }
        const res = await fetch("/api/profile/onboarding", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(check.data),
        });
        if (!res.ok) { toast.error("Could not save profile"); return; }
        setStep(2);
      } else if (step === 2) {
        // Save goals as memory_goals
        const goalIds = selectedGoals.filter((g) => g !== "other");
        const patch = { memory_goals: goalIds, onboarding_step: 2 };
        const check = onboardingProfilePatchSchema.safeParse(patch);
        if (check.success) {
          await fetch("/api/profile/onboarding", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify(check.data),
          });
        }
        setStep(3);
      } else if (step === 3) {
        await handleStep3Submit();
      } else if (step === 4) {
        await finishOnboarding();
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleStep3Submit() {
    if (!userId || !selectedVaultId) return;
    const supabase = createClient();

    // Create canvas
    const { data: newCanvas, error: canvasErr } = await supabase
      .from("canvases")
      .insert({
        user_id: userId,
        name: canvasName.trim(),
        emoji: null,
        display_order: 1,
        color: "#5DCAA5",
        icon_key: null,
      })
      .select()
      .single();

    if (canvasErr || !newCanvas) { toast.error("Could not create canvas"); return; }
    const canvasId = (newCanvas as { id: string }).id;

    // Add canvas to store optimistically (sidebar updates immediately)
    const canvasStore = useCanvasStore.getState();
    const mapped = {
      id: canvasId,
      name: canvasName.trim(),
      emoji: null,
      color: "#5DCAA5",
      iconKey: null,
      description: null,
      masterNodeBio: null,
      masterNodeColor: "#FF6600",
      displayOrder: 1,
      isActive: true,
      masterLineStyle: null,
      masterLineColor: null,
    };
    canvasStore.canvases = [...canvasStore.canvases, mapped];
    useCanvasStore.setState({ canvases: canvasStore.canvases });

    // Seed vaults and set active
    await supabase.rpc("seed_canvas_vaults", { p_user_id: userId, p_canvas_id: canvasId });
    await supabase.from("profiles").update({ active_canvas_id: canvasId }).eq("id", userId);
    await setActiveCanvas(canvasId, userId);

    // Create first memory node
    const title = memoryText.trim().length > 80
      ? memoryText.trim().slice(0, 77) + "..."
      : memoryText.trim();

    const { data: { session } } = await supabase.auth.getSession();
    const selectedVault = onboardingVaults.find((v) => v.id === selectedVaultId);

    const nodeRes = await fetch("/api/memory/create", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token ?? ""}`,
      },
      body: JSON.stringify({
        userId,
        vaultId: selectedVaultId,
        canvasId,
        title,
        value: memoryText.trim(),
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
          vaultColor: selectedVault?.color ?? "#5DCAA5",
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

    // Store confirmation data
    setCreatedCanvasName(canvasName.trim());
    setCreatedMemory(memoryText.trim());
    setCreatedVaultName(selectedVault?.name ?? "Personal");
    setStep(4);
  }

  async function createOnboardingVault() {
    if (!userId || !newVaultName.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const nextOrder = onboardingVaults.length + 1;
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
    };
    setOnboardingVaults((prev) => [...prev, newV]);
    setSelectedVaultId(newV.id);
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
    1: { title: "Welcome to Memorey", subtitle: "Tell us about yourself." },
    2: { title: "What would you like to achieve?", subtitle: "Select all that apply." },
    3: { title: "Set up your first memory", subtitle: "Name your canvas, pick a vault, and create your first memory." },
    4: { title: "You're all set!", subtitle: "Here's what we created for you." },
  };
  const { title: stepTitle, subtitle: stepSubtitle } = stepCopy[step];

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

      <div style={{ width: "100%", maxWidth: 520, background: "var(--bg3)", border: "1px solid var(--border)", borderRadius: "var(--r-xl)", padding: "40px", boxShadow: "var(--shadow-lg)" }}>
        {/* Progress: Step X of 4 */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 28 }}>
          {step > 1 && step < 4 && (
            <button
              type="button"
              onClick={() => setStep(step - 1)}
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
                  transition: "all var(--t-base)",
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: 11, color: "var(--muted)", whiteSpace: "nowrap" }}>Step {step} of 4</span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", marginBottom: 6, fontFamily: "var(--font-display)" }}>{stepTitle}</h2>
        <p style={{ fontSize: 14, color: "var(--text2)", marginBottom: 28, lineHeight: 1.6 }}>{stepSubtitle}</p>

        {/* ── Step 1: Personal details ── */}
        {step === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Full name</label>
              <input autoFocus value={fullName} onChange={(e) => setFullName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && canProceed) void handleNext(); }} placeholder="Your name"
                style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Role</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {ROLES.map((r) => (
                  <button key={r.id} type="button" onClick={() => setSelectedRole(r.id)}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "7px 14px",
                      background: selectedRole === r.id ? "var(--orange-dim)" : "var(--bg2)",
                      border: `1.5px solid ${selectedRole === r.id ? "var(--orange-border)" : "var(--border)"}`,
                      borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 500,
                      color: selectedRole === r.id ? "var(--orange)" : "var(--text2)", transition: "all 0.15s",
                    }}
                  >
                    {r.label}
                    {selectedRole === r.id && <Check size={11} strokeWidth={2.5} />}
                  </button>
                ))}
              </div>
              {selectedRole === "other" && (
                <input value={otherRole} onChange={(e) => setOtherRole(e.target.value)} placeholder="What do you do?" autoFocus
                  style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none", marginTop: 10 }} />
              )}
            </div>
          </div>
        )}

        {/* ── Step 2: Goals ── */}
        {step === 2 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {GOALS.map((g) => (
              <button key={g.id} type="button" onClick={() => toggleGoal(g.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                  background: selectedGoals.includes(g.id) ? "var(--orange-dim)" : "var(--bg2)",
                  border: `1px solid ${selectedGoals.includes(g.id) ? "var(--orange-border)" : "var(--border)"}`,
                  borderRadius: "var(--r-md)", cursor: "pointer", textAlign: "left", width: "100%", transition: "all 0.15s",
                }}
              >
                <span style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: selectedGoals.includes(g.id) ? "var(--orange)" : "var(--bg4)",
                  border: selectedGoals.includes(g.id) ? "none" : "1px solid var(--border2)",
                }}>
                  {selectedGoals.includes(g.id) && <Check size={11} color="#fff" strokeWidth={3} />}
                </span>
                <span style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>{g.label}</span>
              </button>
            ))}
            {selectedGoals.includes("other") && (
              <input value={otherGoal} onChange={(e) => setOtherGoal(e.target.value)} placeholder="Tell us more..." autoFocus
                style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none", marginTop: 4 }} />
            )}
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 4 }}>Select at least one.</p>
          </div>
        )}

        {/* ── Step 3: Canvas + vault + memory ── */}
        {step === 3 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            {/* Canvas name */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Canvas name</label>
              <input autoFocus value={canvasName} onChange={(e) => setCanvasName(e.target.value)} placeholder='e.g. "My Work", "Personal", "Research"'
                style={{ width: "100%", boxSizing: "border-box", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)", padding: "9px 12px", color: "var(--text)", fontSize: 13, outline: "none" }} />
            </div>

            {/* Vault selector */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Choose a vault</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: isCreatingNewVault ? 10 : 0 }}>
                {onboardingVaults.map((vault) => (
                  <button key={vault.id} type="button" onClick={() => { setSelectedVaultId(vault.id); setIsCreatingNewVault(false); }}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 12px",
                      background: selectedVaultId === vault.id ? `${vault.color}22` : "var(--bg2)",
                      border: `1.5px solid ${selectedVaultId === vault.id ? vault.color : "var(--border)"}`,
                      borderRadius: 20, cursor: "pointer", fontSize: 12, fontWeight: 500,
                      color: selectedVaultId === vault.id ? vault.color : "var(--text2)", transition: "all 0.15s",
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: vault.color, flexShrink: 0 }} />
                    {vault.name}
                    {selectedVaultId === vault.id && <Check size={11} strokeWidth={2.5} />}
                  </button>
                ))}
                <button type="button" onClick={() => setIsCreatingNewVault(!isCreatingNewVault)}
                  style={{
                    display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 12px",
                    background: "var(--bg2)", border: "1.5px dashed var(--border2)", borderRadius: 20,
                    cursor: "pointer", fontSize: 12, fontWeight: 500, color: "var(--text2)", transition: "all 0.15s",
                  }}>
                  <Plus size={12} /> New vault
                </button>
              </div>
              {isCreatingNewVault && (
                <div style={{ padding: 12, background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 8 }}>
                    {VAULT_COLORS.map((c) => (
                      <button key={c} type="button" onClick={() => setNewVaultColor(c)}
                        style={{ width: 18, height: 18, borderRadius: 3, background: c, border: "none", cursor: "pointer", outline: newVaultColor === c ? "2px solid var(--text)" : "none", outlineOffset: 1 }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input autoFocus value={newVaultName} onChange={(e) => setNewVaultName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void createOnboardingVault(); if (e.key === "Escape") setIsCreatingNewVault(false); }}
                      placeholder="Vault name..."
                      style={{ flex: 1, background: "var(--bg)", border: `2px solid ${newVaultColor}`, borderRadius: 6, padding: "6px 10px", color: "var(--text)", fontSize: 12, outline: "none" }} />
                    <button type="button" onClick={() => void createOnboardingVault()} disabled={!newVaultName.trim() || saving}
                      style={{ padding: "6px 14px", background: newVaultName.trim() ? "var(--orange)" : "var(--bg4)", border: "none", borderRadius: 6, cursor: newVaultName.trim() ? "pointer" : "not-allowed", fontSize: 12, fontWeight: 600, color: newVaultName.trim() ? "#fff" : "var(--muted)" }}>
                      Add
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Memory text */}
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text2)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>What is the first thing you want to remember?</label>
              <Textarea value={memoryText} onChange={(e) => setMemoryText(e.target.value)}
                placeholder="e.g. I prefer concise answers, work in fintech, and I'm based in London."
                className={cn("min-h-[100px] resize-y", "border-[var(--border)] bg-[var(--bg2)] text-[var(--text)]", "placeholder:text-[var(--muted)]")} />
            </div>
          </div>
        )}

        {/* ── Step 4: Confirmation ── */}
        {step === 4 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ padding: "16px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>Canvas</div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text)" }}>{createdCanvasName}</div>
            </div>
            <div style={{ padding: "16px", background: "var(--bg2)", border: "1px solid var(--border)", borderRadius: "var(--r-md)" }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>First memory</div>
              <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.6 }}>{createdMemory}</div>
              <div style={{ marginTop: 8 }}>
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", background: "var(--bg4)", borderRadius: 12, fontSize: 11, color: "var(--text2)" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: onboardingVaults.find((v) => v.name === createdVaultName)?.color ?? "#5DCAA5" }} />
                  {createdVaultName}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Continue / Open button */}
        <button type="button" onClick={() => void handleNext()} disabled={!canProceed || saving}
          style={{
            width: "100%", padding: "11px 0",
            background: canProceed && !saving ? "var(--orange)" : "var(--bg4)",
            color: canProceed && !saving ? "#fff" : "var(--muted)",
            border: "none", borderRadius: "var(--r-md)", fontSize: 14, fontWeight: 600,
            cursor: canProceed && !saving ? "pointer" : "not-allowed",
            marginTop: 24, transition: "all var(--t-fast)",
          }}
        >
          {step === 3 ? (saving ? "Setting up..." : "Create & continue") :
           step === 4 ? (saving ? "Opening..." : "Open my Memorey") :
           "Continue"}
        </button>

        {/* Skip (steps 1-3 only) */}
        {step < 4 && (
          <button type="button" disabled={saving}
            onClick={async () => {
              if (step === 1) { setStep(2); }
              else if (step === 2) { setStep(3); }
              else if (step === 3) {
                // Skip step 3: create a default canvas without memory
                setSaving(true);
                try {
                  const supabase = createClient();
                  if (!userId) return;
                  const { data: existing } = await supabase.from("category_vaults").select("id").eq("user_id", userId).limit(1);
                  if (!existing || existing.length === 0) await supabase.rpc("seed_default_vaults", { p_user_id: userId });
                  const { data: nc } = await supabase.from("canvases").insert({ user_id: userId, name: "My Canvas", emoji: null, display_order: 1, color: "#5DCAA5", icon_key: null }).select("id").single();
                  if (nc) {
                    const cid = (nc as { id: string }).id;
                    await supabase.rpc("seed_canvas_vaults", { p_user_id: userId, p_canvas_id: cid });
                    await supabase.from("profiles").update({ active_canvas_id: cid }).eq("id", userId);
                  }
                  await finishOnboarding();
                } finally { setSaving(false); }
              }
            }}
            style={{ display: "block", width: "100%", marginTop: 16, background: "none", border: "none", fontSize: 13, color: "var(--muted)", cursor: saving ? "not-allowed" : "pointer", textAlign: "center" }}
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
