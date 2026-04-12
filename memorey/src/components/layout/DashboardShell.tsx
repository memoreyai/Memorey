"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Zap,
  Bell,
  Menu,
  LogOut,
  Boxes,
} from "lucide-react";
import { useExportPanelStore } from "@/store/exportPanelStore";
import { ExportPanel } from "@/components/export/ExportPanel";
import { useEffect, useState } from "react";
import { useVaultStore } from "@/store/vaultStore";
import { useCanvasStore } from "@/store/canvasStore";
import { VaultManager } from "@/components/graph/ui/VaultManager";
import { useVaultManagerOverlayStore } from "@/store/vaultManagerOverlayStore";
import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";
import { DashboardSidebarNav } from "@/components/layout/DashboardSidebarNav";
import { cn } from "@/lib/utils";
import type { PlanTier } from "@/types/memorey";
import { SidebarProvider, useSidebar } from "./sidebar-context";
import { useMcpInbox } from "@/hooks/useMcpInbox";
import { useIsMd } from "@/hooks/useIsMd";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export { useSidebar } from "./sidebar-context";

export interface DashboardShellUser {
  userId: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  plan: PlanTier;
}

function ShellBody({
  user,
  children,
}: {
  user: DashboardShellUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isMd = useIsMd();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const { expanded, toggleSidebar } = useSidebar();
  const isCollapsed = isMd ? !expanded : false;
  const vaultManagerOpen = useVaultManagerOverlayStore((s) => s.open);
  const setVaultManagerOpen = useVaultManagerOverlayStore((s) => s.setOpen);
  const openVaultManager = useVaultManagerOverlayStore((s) => s.openManager);
  const openExportPanel = useExportPanelStore((s) => s.openExportPanel);
  const fetchVaults = useVaultStore((s) => s.fetchVaults);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const isMasterView = useCanvasStore((s) => s.isMasterView);

  const { count: mcpCount, openInbox } = useMcpInbox(user.userId);

  useEffect(() => {
    queueMicrotask(() => setMobileNavOpen(false));
  }, [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.metaKey || e.ctrlKey) &&
        e.key.toLowerCase() === "b" &&
        !e.altKey
      ) {
        const t = e.target as HTMLElement;
        if (
          t.tagName === "INPUT" ||
          t.tagName === "TEXTAREA" ||
          t.isContentEditable
        )
          return;
        e.preventDefault();
        if (isMd) toggleSidebar();
        else setMobileNavOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggleSidebar, isMd]);

  useEffect(() => {
    void fetchVaults(
      user.userId,
      isMasterView ? undefined : activeCanvasId ?? undefined
    );
  }, [user.userId, activeCanvasId, isMasterView, fetchVaults]);

  const showVaultQuickAccess =
    pathname.startsWith("/dashboard/kanban") ||
    pathname.startsWith("/dashboard/search") ||
    pathname.startsWith("/dashboard/capture") ||
    pathname.startsWith("/dashboard/settings");

  const initials =
    user.name
      ?.split(/\s+/)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() ||
    user.email?.slice(0, 2).toUpperCase() ||
    "?";

  const sidebarW = !isMd
    ? "var(--sidebar-w, 220px)"
    : expanded
      ? "var(--sidebar-w, 220px)"
      : "var(--sidebar-w-collapsed, 52px)";

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    toast.success("Signed out");
    setMobileNavOpen(false);
    router.push("/login");
    router.refresh();
  };

  const planLabel =
    user.plan === "enterprise"
      ? "Enterprise"
      : user.plan === "pro"
        ? "Pro"
        : "Free";

  return (
    <div
      className="memorey-dashboard-root flex h-screen overflow-hidden"
      style={{
        backgroundColor: "var(--bg)",
        color: "var(--text)",
      }}
    >
      {!isMd && mobileNavOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          aria-hidden
          onClick={() => setMobileNavOpen(false)}
        />
      ) : null}
      <aside
        className={cn(
          "memorey-sidebar flex shrink-0 flex-col overflow-hidden",
          isCollapsed && "sidebar-collapsed",
          !isMd &&
            "fixed left-0 top-0 z-50 h-screen shadow-xl transition-transform duration-200 ease-out",
          !isMd && (mobileNavOpen ? "translate-x-0" : "-translate-x-full"),
          !isMd && !mobileNavOpen && "pointer-events-none"
        )}
        style={{
          width: sidebarW,
          minWidth: sidebarW,
          maxWidth: sidebarW,
          height: "100vh",
          background: "var(--sidebar)",
          borderRight: "1px solid var(--border)",
          transition: isMd
            ? "width 0.2s ease, min-width 0.2s ease, max-width 0.2s ease"
            : "transform 0.2s ease",
        }}
        aria-label="Main navigation"
        aria-hidden={!isMd && !mobileNavOpen ? true : undefined}
      >
        <div
          className="flex shrink-0 flex-col border-b"
          style={{ borderColor: "var(--border2)" }}
        >
          <div
            className="flex min-h-10 w-full shrink-0 items-center gap-1 px-1 py-1.5"
            style={{ boxSizing: "border-box" }}
          >
            {!isCollapsed ? (
              <Link
                href="/dashboard"
                className="flex min-w-0 flex-1 items-center gap-2 rounded-sm py-1 pl-1 no-underline"
                style={{ color: "var(--text)" }}
              >
                <MemoreyLogo size={26} />
                <span className="sidebar-label truncate text-[13px] font-semibold tracking-tight">
                  Memorey
                </span>
              </Link>
            ) : (
              <div className="min-w-0 flex-1" aria-hidden />
            )}
            {isMd ? (
              <button
                type="button"
                onClick={toggleSidebar}
                className="flex shrink-0 items-center justify-center rounded-sm p-1.5"
                style={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  color: "var(--text2)",
                  transition: "color var(--t-fast), border-color var(--t-fast)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "var(--text)";
                  e.currentTarget.style.borderColor = "var(--border2)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "var(--text2)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
                aria-expanded={expanded}
                aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
                title={
                  expanded
                    ? "Collapse sidebar (⌘B / Ctrl+B)"
                    : "Expand sidebar (⌘B / Ctrl+B)"
                }
              >
                {isCollapsed ? (
                  <ChevronRight size={14} strokeWidth={2} />
                ) : (
                  <ChevronLeft size={14} strokeWidth={2} />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                className="flex shrink-0 items-center justify-center rounded-sm p-1.5"
                style={{
                  background: "var(--bg3)",
                  border: "1px solid var(--border)",
                  cursor: "pointer",
                  color: "var(--text2)",
                }}
                aria-label="Close menu"
              >
                <ChevronLeft size={14} strokeWidth={2} />
              </button>
            )}
          </div>
          {isCollapsed ? (
            <div className="flex justify-center px-1 pb-2">
              <Link
                href="/dashboard"
                className="flex justify-center rounded-sm py-0.5 no-underline"
                style={{ color: "var(--text)" }}
                aria-label="Memorey home"
              >
                <MemoreyLogo size={22} />
              </Link>
            </div>
          ) : null}
        </div>

        <nav
          className={cn(
            "flex min-h-0 flex-1 flex-col gap-px overflow-y-auto pb-2",
            isCollapsed ? "px-0" : "px-2"
          )}
        >
          <DashboardSidebarNav
            userId={user.userId}
            plan={user.plan}
            isCollapsed={isCollapsed}
          />
        </nav>

        <div
          className={cn(
            "memorey-sidebar-section shrink-0 pb-1 pt-0",
            isCollapsed ? "px-0" : "px-2"
          )}
        >
          {!isCollapsed ? (
            <div className="memorey-section-label px-3 pb-2 pt-1">Inbox</div>
          ) : null}
          <button
            type="button"
            onClick={() => void openInbox()}
            className={cn(
              "memorey-nav-tooltip-wrap relative flex w-full items-center rounded-[var(--r-button)] border-none bg-transparent text-left transition-[background,color] duration-[var(--t-fast)]",
              isCollapsed ? "justify-center px-0 py-1.5" : "gap-2 px-3 py-1.5"
            )}
            style={{
              color: "var(--text2)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg3)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text2)";
            }}
            aria-label={
              mcpCount > 0
                ? `${mcpCount} pending MCP proposals`
                : "MCP inbox"
            }
          >
            <span className="relative z-[1] flex shrink-0">
              <Bell size={18} strokeWidth={1.75} />
              {isCollapsed && mcpCount > 0 ? (
                <span
                  className="absolute -right-2 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold text-white"
                  style={{ background: "var(--orange)" }}
                >
                  {mcpCount > 99 ? "99+" : mcpCount}
                </span>
              ) : null}
            </span>
            <div className="sidebar-label-slot relative z-[1] flex min-w-0 items-center gap-2">
              <span className="sidebar-label flex-1 truncate text-[13px]">
                MCP proposals
              </span>
              {mcpCount > 0 ? (
                <span
                  className="sidebar-label min-w-4 shrink-0 rounded-full px-1.5 text-center text-[10px] font-semibold text-white"
                  style={{ background: "var(--orange)", padding: "1px 6px" }}
                >
                  {mcpCount > 99 ? "99+" : mcpCount}
                </span>
              ) : null}
            </div>
            {isCollapsed ? (
              <span className="sidebar-tooltip">MCP inbox</span>
            ) : null}
          </button>
        </div>

        {/* Brief an AI */}
        <div className={cn("shrink-0 pb-2", isCollapsed ? "px-0" : "px-2")}>
          <button
            type="button"
            onClick={() => openExportPanel()}
            className={cn(
              "memorey-nav-tooltip-wrap relative flex items-center overflow-hidden border-none font-semibold",
              !isCollapsed && "w-full max-w-full"
            )}
            style={{
              margin: isCollapsed ? "8px auto" : "6px 8px",
              padding: isCollapsed ? 0 : "8px 12px",
              background: "var(--orange)",
              color: "#fff",
              borderRadius: isCollapsed ? 6 : "var(--r-button)",
              fontSize: 12,
              cursor: "pointer",
              justifyContent: isCollapsed ? "center" : "flex-start",
              gap: 8,
              width: isCollapsed ? 32 : "calc(100% - 16px)",
              height: isCollapsed ? 32 : undefined,
              minWidth: isCollapsed ? 32 : undefined,
              boxSizing: "border-box",
            }}
            aria-label="Brief an AI"
          >
            <Zap size={14} strokeWidth={2.25} className="shrink-0" />
            <span className="sidebar-label-slot flex min-w-0 items-center overflow-hidden">
              <span className="sidebar-label whitespace-nowrap">Brief an AI</span>
            </span>
            {isCollapsed ? (
              <span className="sidebar-tooltip">Brief an AI</span>
            ) : null}
          </button>
        </div>

        <div className="mt-auto flex shrink-0 flex-col">
        {/* User row */}
        <div
          className="flex shrink-0 items-center border-t"
          style={{
            padding: isCollapsed ? "10px 0" : "8px 12px",
            borderColor: "var(--border2)",
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: isCollapsed ? 0 : 8,
          }}
        >
          {isCollapsed ? (
            <Link
              href="/dashboard/settings"
              className="memorey-nav-tooltip-wrap relative flex shrink-0 rounded-full no-underline"
              aria-label="Account"
            >
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={26}
                  height={26}
                  referrerPolicy="no-referrer"
                  className="shrink-0 rounded-full object-cover"
                  style={{ width: 26, height: 26 }}
                />
              ) : (
                <div
                  className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: "var(--bg5)",
                    color: "var(--text2)",
                  }}
                >
                  {initials}
                </div>
              )}
              <span className="sidebar-tooltip">Account</span>
            </Link>
          ) : (
            <>
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt=""
                  width={26}
                  height={26}
                  referrerPolicy="no-referrer"
                  className="shrink-0 rounded-full object-cover"
                  style={{ width: 26, height: 26 }}
                />
              ) : (
                <div
                  className="flex size-[26px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold"
                  style={{
                    background: "var(--bg5)",
                    color: "var(--text2)",
                  }}
                >
                  {initials}
                </div>
              )}
              <div className="sidebar-label-slot min-w-0 flex-1">
                <div
                  className="sidebar-label truncate text-[13px] font-medium"
                  style={{ color: "var(--text)" }}
                >
                  {user.name || user.email || "Account"}
                </div>
                <div
                  className="sidebar-label text-[10px] uppercase"
                  style={{
                    color:
                      user.plan === "free" ? "var(--muted)" : "var(--orange)",
                    letterSpacing: "0.06em",
                  }}
                >
                  {planLabel}
                </div>
              </div>
            </>
          )}
        </div>

        <div
          className={cn(
            "memorey-sidebar-section shrink-0 border-t",
            isCollapsed ? "px-0 py-2" : "px-2 py-2"
          )}
          style={{ borderColor: "var(--border2)" }}
        >
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className={cn(
              "memorey-nav-tooltip-wrap relative flex w-full items-center rounded-[var(--r-button)] border-none bg-transparent text-left transition-[background,color] duration-[var(--t-fast)]",
              isCollapsed ? "justify-center px-0 py-1.5" : "gap-2 px-3 py-1.5"
            )}
            style={{
              color: "var(--text2)",
              cursor: "pointer",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--bg3)";
              e.currentTarget.style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text2)";
            }}
          >
            <LogOut size={18} strokeWidth={1.75} className="shrink-0" />
            <span className="sidebar-label-slot min-w-0 flex-1">
              <span className="sidebar-label text-[13px]">Sign out</span>
            </span>
            {isCollapsed ? (
              <span className="sidebar-tooltip">Sign out</span>
            ) : null}
          </button>
        </div>
        </div>
      </aside>

      <main
        className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-hidden"
        style={{
          height: "100vh",
          background: "var(--bg)",
        }}
      >
        {!isMd ? (
          <div
            className="flex shrink-0 items-center gap-2 border-b px-3 py-2 md:hidden"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg)",
            }}
          >
            <button
              type="button"
              onClick={() => setMobileNavOpen(true)}
              className="flex shrink-0 items-center justify-center rounded-sm p-2"
              style={{
                background: "var(--bg3)",
                border: "1px solid var(--border)",
                color: "var(--text2)",
                cursor: "pointer",
              }}
              aria-label="Open menu"
            >
              <Menu size={18} strokeWidth={2} />
            </button>
            <Link
              href="/dashboard"
              className="flex min-w-0 flex-1 items-center gap-2 no-underline"
              style={{ color: "var(--text)" }}
            >
              <MemoreyLogo size={22} />
              <span className="truncate text-[13px] font-semibold tracking-tight">
                Memorey
              </span>
            </Link>
          </div>
        ) : null}
        {showVaultQuickAccess ? (
          <button
            type="button"
            onClick={() => openVaultManager()}
            className={cn(
              "fixed z-40 flex h-9 w-9 items-center justify-center rounded-[var(--r-md)] border shadow-sm",
              !isMd ? "right-3 top-[52px]" : "right-4 top-3"
            )}
            style={{
              borderColor: "var(--border)",
              background: "var(--card-bg)",
              color: "var(--text2)",
            }}
            title="Vaults"
            aria-label="Open vault manager"
          >
            <Boxes size={18} strokeWidth={1.75} />
          </button>
        ) : null}
        {children}
      </main>

      <ExportPanel />
      <VaultManager
        isOpen={vaultManagerOpen}
        onClose={() => setVaultManagerOpen(false)}
        userId={user.userId}
      />
    </div>
  );
}

export function DashboardShell({
  user,
  children,
}: {
  user: DashboardShellUser;
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <ShellBody user={user}>{children}</ShellBody>
    </SidebarProvider>
  );
}
