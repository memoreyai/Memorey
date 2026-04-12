"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  BarChart3,
  DollarSign,
  LayoutDashboard,
  MessageSquare,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/activity", label: "Activity", icon: Activity },
  { href: "/admin/revenue", label: "Revenue", icon: DollarSign },
  { href: "/admin/messages", label: "Messages", icon: MessageSquare },
] as const;

export function AdminLayoutClient({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [gate, setGate] = useState<"loading" | "ok">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/admin/stats", { credentials: "include" });
      if (cancelled) return;
      if (res.status === 401) {
        router.replace("/login");
        return;
      }
      if (res.status === 403) {
        toast.error("Access denied");
        router.replace("/dashboard");
        return;
      }
      if (!res.ok) {
        toast.error("Could not verify admin access");
        router.replace("/dashboard");
        return;
      }
      setGate("ok");
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (gate === "loading") {
    return (
      <div className="flex min-h-screen bg-[var(--bg)]">
        <aside className="w-[var(--sidebar-w-collapsed)] shrink-0 border-r border-[var(--border)] bg-[var(--sidebar)] lg:w-[var(--sidebar-w)]" />
        <div className="flex flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b border-[var(--border)] px-4">
            <div className="h-9 w-32 animate-pulse rounded-md bg-[var(--bg4)]" />
            <div className="h-5 w-40 animate-pulse rounded bg-[var(--bg4)]" />
          </header>
          <main className="flex-1 p-4 md:p-6">
            <div className="h-48 animate-pulse rounded-[var(--r-card)] bg-[var(--bg3)]" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <aside
        className={cn(
          "flex w-[var(--sidebar-w-collapsed)] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar)]",
          "lg:w-[var(--sidebar-w)]"
        )}
      >
        <div className="flex h-14 items-center justify-center border-b border-[var(--border)] px-2 lg:justify-start lg:px-4">
          <Link href="/admin" className="flex items-center gap-2" title="Admin home">
            <MemoreyLogo size={32} />
            <span className="hidden font-display text-sm font-semibold tracking-tight lg:inline">
              Admin
            </span>
          </Link>
        </div>
        <nav className="flex flex-1 flex-col gap-0.5 p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active =
              href === "/admin"
                ? pathname === "/admin"
                : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                title={label}
                className={cn(
                  "flex items-center justify-center gap-2 rounded-[var(--r-md)] px-2 py-2 text-[13px] font-medium transition-colors lg:justify-start lg:px-3",
                  active
                    ? "bg-[var(--bg4)] text-[var(--text)]"
                    : "text-[var(--text2)] hover:bg-[var(--bg4)] hover:text-[var(--text)]"
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                <span className="hidden lg:inline">{label}</span>
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-[var(--border)] p-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 rounded-[var(--r-md)] px-2 py-2 text-[13px] font-medium text-[var(--text2)] transition-colors hover:bg-[var(--bg4)] hover:text-[var(--text)] lg:justify-start lg:px-3"
            title="Back to app"
          >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="hidden lg:inline">Back to app</span>
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border)] bg-[var(--bg2)] px-4 md:px-6">
          <MemoreyLogo size={36} showWordmark />
          <div className="h-4 w-px bg-[var(--border2)]" aria-hidden />
          <h1 className="font-display text-base font-semibold tracking-tight md:text-lg">
            Admin Dashboard
          </h1>
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
