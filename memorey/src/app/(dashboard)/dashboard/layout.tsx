"use client";

import { Suspense } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { resolveAvatarUrl } from "@/lib/resolveAvatarUrl";
import { useEffect, useState } from "react";
import {
  DashboardShell,
  type DashboardShellUser,
} from "@/components/layout/DashboardShell";
import { DashboardLayoutSkeleton } from "@/components/layout/DashboardLayoutSkeleton";
import { OnboardingTour } from "@/components/onboarding/OnboardingTour";
import { CheckoutReturnToast } from "@/components/billing/CheckoutReturnToast";
import { useCanvasStore } from "@/store/canvasStore";
import type { PlanTier } from "@/types/memorey";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [user, setUser] = useState<DashboardShellUser | null>(null);
  const fetchCanvases = useCanvasStore((s) => s.fetchCanvases);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) fetchCanvases(u.id);
    });
  }, [fetchCanvases]);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const {
        data: { user: u },
      } = await supabase.auth.getUser();
      if (!u || cancelled) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", u.id)
        .maybeSingle();

      const { data: sub, error: subErr } = await supabase
        .from("subscriptions")
        .select("plan")
        .eq("user_id", u.id)
        .maybeSingle();

      const plan: PlanTier =
        !subErr && sub?.plan === "enterprise"
          ? "enterprise"
          : !subErr && sub?.plan === "pro"
            ? "pro"
            : "free";
      const rawAvatar =
        profile?.avatar_url ??
        (u.user_metadata?.avatar_url as string | undefined) ??
        (u.user_metadata?.picture as string | undefined) ??
        null;
      setUser({
        userId: u.id,
        email: u.email ?? null,
        name:
          profile?.full_name ??
          (u.user_metadata?.full_name as string | undefined) ??
          (u.user_metadata?.name as string | undefined) ??
          null,
        avatarUrl: resolveAvatarUrl(rawAvatar),
        plan,
      });
    }

    void load();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (pathname === "/dashboard/onboarding") {
    return (
      <div className="min-h-screen" style={{ backgroundColor: "var(--bg)" }}>
        {children}
      </div>
    );
  }

  if (!user) {
    return <DashboardLayoutSkeleton />;
  }

  return (
    <>
      <Suspense fallback={null}>
        <CheckoutReturnToast />
      </Suspense>
      <DashboardShell user={user}>{children}</DashboardShell>
      <OnboardingTour />
    </>
  );
}
