"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutGrid,
  Columns3,
  Search,
  MessageSquarePlus,
  AlertTriangle,
  Sparkles,
  Settings,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
} from "lucide-react";
import { useCanvasStore, type Canvas } from "@/store/canvasStore";
import { useTrack } from "@/hooks/useTrack";
import { cn } from "@/lib/utils";
import { NewCanvasButton } from "@/components/layout/NewCanvasButton";
import { CanvasSettingsModal } from "@/components/layout/CanvasSettingsModal";
import { CanvasDynamicLucideIcon } from "@/components/layout/CanvasDynamicLucideIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ExpandState = "master" | string | null;

function SidebarDropdown({
  open,
  children,
}: {
  open: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "grid min-h-0 transition-[grid-template-rows] ease-out",
        open ? "grid-rows-[1fr] duration-200" : "grid-rows-[0fr] duration-150"
      )}
    >
      <div className="min-h-0 overflow-hidden">
        <div
          className={cn(
            "transition-opacity ease-out",
            open
              ? "opacity-100 duration-200"
              : "pointer-events-none opacity-0 duration-150"
          )}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function CanvasSidebarGlyph({
  canvas,
  className,
  size = 15,
}: {
  canvas: Canvas;
  className?: string;
  size?: number;
}) {
  if (canvas.iconKey) {
    return (
      <CanvasDynamicLucideIcon
        name={canvas.iconKey}
        size={size + 3}
        color={canvas.color}
        className={className}
      />
    );
  }
  const em = canvas.emoji?.trim();
  if (!em) {
    return (
      <span
        className={cn(
          "flex size-[15px] shrink-0 items-center justify-center rounded-sm text-[9px] font-semibold uppercase leading-none",
          className
        )}
        style={{ background: "var(--bg4)", color: "var(--muted)" }}
        aria-hidden
      >
        {canvas.name.trim().slice(0, 1) || "·"}
      </span>
    );
  }
  return (
    <span className={cn("leading-none", className)} style={{ fontSize: size }}>
      {em}
    </span>
  );
}

export function DashboardSidebarNav({
  userId,
  plan,
  isCollapsed,
}: {
  userId: string;
  plan: string;
  isCollapsed: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { track } = useTrack();

  const canvases = useCanvasStore((s) => s.canvases);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const enterMasterView = useCanvasStore((s) => s.enterMasterView);
  const exitMasterView = useCanvasStore((s) => s.exitMasterView);
  const setActiveCanvas = useCanvasStore((s) => s.setActiveCanvas);
  const toggleCanvasVisibilityInMaster = useCanvasStore(
    (s) => s.toggleCanvasVisibilityInMaster
  );
  const isCanvasHiddenInMaster = useCanvasStore((s) => s.isCanvasHiddenInMaster);

  const [expand, setExpand] = useState<ExpandState>(null);
  const [collapsedPopover, setCollapsedPopover] = useState<{
    id: string;
    top: number;
    left: number;
  } | null>(null);
  const [canvasModalId, setCanvasModalId] = useState<string | null>(null);
  const [canvasModalScrollDanger, setCanvasModalScrollDanger] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    if (isMasterView && (pathname === "/dashboard" || pathname.startsWith("/dashboard/kanban"))) {
      setExpand("master");
    } else if (
      !isMasterView &&
      activeCanvasId &&
      (pathname === "/dashboard" ||
        pathname.startsWith("/dashboard/kanban") ||
        pathname.startsWith("/dashboard/search") ||
        pathname.startsWith("/dashboard/capture"))
    ) {
      setExpand(activeCanvasId);
    }
  }, [pathname, isMasterView, activeCanvasId]);

  useEffect(() => {
    if (!isCollapsed) setCollapsedPopover(null);
  }, [isCollapsed]);

  useEffect(() => {
    if (!collapsedPopover) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("[data-canvas-collapsed-trigger]")) return;
      const pop = document.getElementById("memorey-canvas-collapsed-popover");
      if (pop?.contains(el)) return;
      setCollapsedPopover(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [collapsedPopover]);

  useEffect(() => {
    if (!contextMenu) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      if (el.closest("#memorey-canvas-context-menu")) return;
      setContextMenu(null);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [contextMenu]);

  const settingsCanvas =
    canvasModalId == null
      ? null
      : (canvases.find((c) => c.id === canvasModalId) ?? null);

  const masterGraphActive =
    isMasterView && pathname === "/dashboard";
  const masterKanbanActive =
    isMasterView && pathname.startsWith("/dashboard/kanban");
  const masterConflictsActive =
    isMasterView && pathname.startsWith("/dashboard/conflicts");
  const masterBriefActive =
    isMasterView && pathname.startsWith("/dashboard/brief");

  function goMasterGraph() {
    enterMasterView();
    track("master_graph_opened", {});
    router.push("/dashboard");
  }

  function goMasterKanban() {
    enterMasterView();
    track("master_kanban_opened", {});
    router.push("/dashboard/kanban");
  }

  function goMasterConflicts() {
    enterMasterView();
    router.push("/dashboard/conflicts");
  }

  function goMasterBrief() {
    enterMasterView();
    router.push("/dashboard/brief");
  }

  async function onEyeClick(e: React.MouseEvent, canvasId: string) {
    e.stopPropagation();
    e.preventDefault();
    const beforeHidden = isCanvasHiddenInMaster(canvasId);
    await toggleCanvasVisibilityInMaster(canvasId);
    const afterHidden = isCanvasHiddenInMaster(canvasId);
    if (beforeHidden !== afterHidden) {
      track("master_canvas_toggled", {
        canvasId,
        visible: !afterHidden,
      });
    }
  }

  /** Accordion: one canvas (or master) dropdown open at a time. No full page reload. */
  function onCanvasHeaderClick(canvas: Canvas) {
    exitMasterView();
    if (!isMasterView && canvas.id === activeCanvasId) {
      setExpand((ex) => (ex === canvas.id ? null : canvas.id));
      return;
    }
    setExpand(canvas.id);
    void setActiveCanvas(canvas.id, userId);
  }

  function onCollapsedCanvasTrigger(canvas: Canvas, anchor: HTMLElement) {
    exitMasterView();
    const r = anchor.getBoundingClientRect();
    setCollapsedPopover((prev) => {
      if (prev?.id === canvas.id) return null;
      return { id: canvas.id, top: r.top, left: r.right + 8 };
    });
    setExpand(canvas.id);
    void setActiveCanvas(canvas.id, userId);
  }

  async function goCanvasSubpage(canvasId: string, href: string) {
    exitMasterView();
    if (activeCanvasId !== canvasId) {
      await setActiveCanvas(canvasId, userId);
    }
    router.push(href);
  }

  const subLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-[var(--r-sm)] py-1.5 pl-2 pr-2 text-[11px] no-underline transition-colors",
      active ? "font-medium" : "font-normal"
    );

  const subLinkStyle = (active: boolean): CSSProperties => ({
    color: active ? "var(--primary)" : "var(--text2)",
    background: "transparent",
    borderLeft: active ? "2px solid var(--primary)" : "2px solid transparent",
    paddingLeft: "calc(0.5rem - 2px)",
  });

  const subNavSurface: CSSProperties = {
    borderColor: "var(--border)",
    background:
      "color-mix(in oklab, var(--card-bg) 88%, var(--bg2) 12%)",
  };

  const masterHighlighted = isMasterView;
  const masterOpen = expand === "master";

  const collapsedNav = (
      <div className="flex flex-col gap-1 py-1">
        <button
          type="button"
          onClick={() => {
            setCollapsedPopover(null);
            enterMasterView();
            router.push("/dashboard");
          }}
          className="memorey-nav-tooltip-wrap relative flex w-full items-center justify-center rounded-[var(--r-button)] py-2 text-[16px]"
          style={{
            background: masterHighlighted ? "var(--bg4)" : "transparent",
            border: "none",
            cursor: "pointer",
          }}
          aria-label="Master View"
        >
          <LayoutGrid size={16} strokeWidth={1.75} />
          <span className="sidebar-tooltip">Master View</span>
        </button>
        {canvases.map((c) => (
          <div
            key={c.id}
            className="group/cv-collapsed memorey-nav-tooltip-wrap relative flex w-full justify-center"
            onContextMenu={(e) => {
              e.preventDefault();
              setContextMenu({ id: c.id, x: e.clientX, y: e.clientY });
            }}
          >
            <button
              type="button"
              data-canvas-collapsed-trigger
              onClick={(e) => onCollapsedCanvasTrigger(c, e.currentTarget)}
              className="relative flex w-full items-center justify-center rounded-[var(--r-button)] py-2"
              style={{
                background:
                  !isMasterView && c.id === activeCanvasId
                    ? "var(--bg4)"
                    : "transparent",
                border: "none",
                cursor: "pointer",
                boxShadow: c.color
                  ? `inset 3px 0 0 ${c.color}`
                  : undefined,
              }}
              aria-label={c.name}
              aria-expanded={collapsedPopover?.id === c.id}
            >
              <CanvasSidebarGlyph canvas={c} size={16} />
              <span className="sidebar-tooltip">{c.name}</span>
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger
                type="button"
                className="absolute right-0 top-1/2 z-[1] -translate-y-1/2 rounded p-0.5 opacity-0 transition-opacity group-hover/cv-collapsed:opacity-100 focus:opacity-100"
                style={{ color: "var(--muted)" }}
                aria-label={`Canvas options for ${c.name}`}
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="size-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem
                  onClick={() => {
                    setCanvasModalScrollDanger(false);
                    setCanvasModalId(c.id);
                  }}
                >
                  Settings
                </DropdownMenuItem>
                <DropdownMenuItem
                  variant="destructive"
                  disabled={canvases.length <= 1}
                  onClick={() => {
                    setCanvasModalScrollDanger(true);
                    setCanvasModalId(c.id);
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
        <div className="pt-1">
          <NewCanvasButton userId={userId} plan={plan} isCollapsed />
        </div>
        <Link
          href="/dashboard/settings"
          className="memorey-nav-tooltip-wrap relative flex w-full items-center justify-center rounded-[var(--r-button)] py-2"
          style={{ color: "var(--text2)" }}
          aria-label="Settings"
        >
          <Settings size={18} strokeWidth={1.75} />
          <span className="sidebar-tooltip">Settings</span>
        </Link>
        {collapsedPopover && typeof document !== "undefined"
          ? createPortal(
              <div
                id="memorey-canvas-collapsed-popover"
                className="fixed z-[100] w-[200px] overflow-hidden rounded-[var(--r-md)] border shadow-lg"
                style={{
                  top: collapsedPopover.top,
                  left: collapsedPopover.left,
                  borderColor: "var(--border)",
                  background:
                    "color-mix(in oklab, var(--card-bg) 88%, var(--bg2) 12%)",
                  boxShadow: "var(--shadow-md)",
                }}
              >
                <div className="flex flex-col gap-0.5 p-1.5">
                  {(() => {
                    const c = canvases.find((x) => x.id === collapsedPopover.id);
                    if (!c) return null;
                    const isActiveCanvas = !isMasterView && c.id === activeCanvasId;
                    const graphActive =
                      isActiveCanvas && pathname === "/dashboard";
                    const kanbanActive =
                      isActiveCanvas && pathname.startsWith("/dashboard/kanban");
                    const searchActive =
                      isActiveCanvas && pathname.startsWith("/dashboard/search");
                    const captureActive =
                      isActiveCanvas && pathname.startsWith("/dashboard/capture");
                    const conflictsActiveCollapsed =
                      isActiveCanvas && pathname.startsWith("/dashboard/conflicts");
                    const briefActiveCollapsed =
                      isActiveCanvas && pathname.startsWith("/dashboard/brief");
                    return (
                      <>
                        <Link
                          href="/dashboard"
                          onClick={(e) => {
                            e.preventDefault();
                            void goCanvasSubpage(c.id, "/dashboard");
                          }}
                          className={subLinkClass(graphActive)}
                          style={subLinkStyle(graphActive)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--hover-bg)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <LayoutGrid size={14} strokeWidth={1.75} />
                          Graph
                        </Link>
                        <Link
                          href="/dashboard/kanban"
                          onClick={(e) => {
                            e.preventDefault();
                            void goCanvasSubpage(c.id, "/dashboard/kanban");
                          }}
                          className={subLinkClass(kanbanActive)}
                          style={subLinkStyle(kanbanActive)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--hover-bg)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Columns3 size={14} strokeWidth={1.75} />
                          Kanban
                        </Link>
                        <Link
                          href="/dashboard/search"
                          onClick={(e) => {
                            e.preventDefault();
                            void goCanvasSubpage(c.id, "/dashboard/search");
                          }}
                          className={subLinkClass(searchActive)}
                          style={subLinkStyle(searchActive)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--hover-bg)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Search size={14} strokeWidth={1.75} />
                          Search
                        </Link>
                        <Link
                          href="/dashboard/capture"
                          onClick={(e) => {
                            e.preventDefault();
                            void goCanvasSubpage(c.id, "/dashboard/capture");
                          }}
                          className={subLinkClass(captureActive)}
                          style={subLinkStyle(captureActive)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--hover-bg)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <MessageSquarePlus size={14} strokeWidth={1.75} />
                          Capture
                        </Link>
                        <Link
                          href="/dashboard/conflicts"
                          onClick={(e) => {
                            e.preventDefault();
                            void goCanvasSubpage(c.id, "/dashboard/conflicts");
                          }}
                          className={subLinkClass(conflictsActiveCollapsed)}
                          style={subLinkStyle(conflictsActiveCollapsed)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--hover-bg)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <AlertTriangle size={14} strokeWidth={1.75} />
                          Conflicts
                        </Link>
                        <Link
                          href="/dashboard/brief"
                          onClick={(e) => {
                            e.preventDefault();
                            void goCanvasSubpage(c.id, "/dashboard/brief");
                          }}
                          className={subLinkClass(briefActiveCollapsed)}
                          style={subLinkStyle(briefActiveCollapsed)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = "var(--hover-bg)";
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = "transparent";
                          }}
                        >
                          <Sparkles size={14} strokeWidth={1.75} />
                          Brief AI
                        </Link>
                      </>
                    );
                  })()}
                </div>
              </div>,
              document.body
            )
          : null}
      </div>
  );

  const expandedNav = (
    <nav className="flex flex-col gap-1 pb-2" aria-label="Workspace">
      <div
        className="overflow-hidden rounded-[var(--r-md)] border"
        style={{
          borderColor: masterHighlighted ? "var(--orange-border)" : "var(--border)",
          background: masterHighlighted
            ? "color-mix(in srgb, var(--bg4) 92%, var(--orange) 8%)"
            : "var(--card-bg)",
        }}
      >
        <button
          type="button"
          onClick={() => {
            setExpand((e) => (e === "master" ? null : "master"));
          }}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-[13px] font-semibold"
          style={{ color: "var(--text)" }}
        >
          <LayoutGrid size={15} strokeWidth={1.75} className="shrink-0" style={{ color: "var(--text2)" }} />
          <span className="min-w-0 flex-1">Master View</span>
          {masterOpen ? (
            <ChevronDown className="size-4 shrink-0" style={{ color: "var(--muted)" }} />
          ) : (
            <ChevronRight className="size-4 shrink-0" style={{ color: "var(--muted)" }} />
          )}
        </button>
        <SidebarDropdown open={masterOpen}>
          <div
            className="border-t px-1 pb-2 pl-3 pt-0"
            style={subNavSurface}
          >
            <Link
              href="/dashboard"
              onClick={(e) => {
                e.preventDefault();
                goMasterGraph();
              }}
              className={subLinkClass(masterGraphActive)}
              style={subLinkStyle(masterGraphActive)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <LayoutGrid size={14} strokeWidth={1.75} />
              Graph
            </Link>
            <Link
              href="/dashboard/kanban"
              onClick={(e) => {
                e.preventDefault();
                goMasterKanban();
              }}
              className={subLinkClass(masterKanbanActive)}
              style={subLinkStyle(masterKanbanActive)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Columns3 size={14} strokeWidth={1.75} />
              Kanban
            </Link>
            <Link
              href="/dashboard/conflicts"
              onClick={(e) => {
                e.preventDefault();
                goMasterConflicts();
              }}
              className={subLinkClass(masterConflictsActive)}
              style={subLinkStyle(masterConflictsActive)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <AlertTriangle size={14} strokeWidth={1.75} />
              Conflicts
            </Link>
            <Link
              href="/dashboard/brief"
              onClick={(e) => {
                e.preventDefault();
                goMasterBrief();
              }}
              className={subLinkClass(masterBriefActive)}
              style={subLinkStyle(masterBriefActive)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <Sparkles size={14} strokeWidth={1.75} />
              Brief AI
            </Link>
          </div>
        </SidebarDropdown>
      </div>

      <div
        className="px-1 py-1 text-[10px] font-semibold uppercase tracking-[0.12em]"
        style={{ color: "var(--text2)" }}
      >
        Canvases
      </div>

      <div className="flex flex-col gap-0.5">
        {canvases.map((c) => {
          const isActiveCanvas = !isMasterView && c.id === activeCanvasId;
          const rowOpen = expand === c.id;
          const graphActive =
            isActiveCanvas && pathname === "/dashboard";
          const kanbanActive =
            isActiveCanvas && pathname.startsWith("/dashboard/kanban");
          const searchActive =
            isActiveCanvas && pathname.startsWith("/dashboard/search");
          const captureActive =
            isActiveCanvas && pathname.startsWith("/dashboard/capture");
          const conflictsActive =
            isActiveCanvas && pathname.startsWith("/dashboard/conflicts");
          const briefActive =
            isActiveCanvas && pathname.startsWith("/dashboard/brief");

          return (
            <div
              key={c.id}
              className="group/canvas-row flex overflow-hidden rounded-[var(--r-md)] border"
              style={{
                borderColor: isActiveCanvas ? "var(--border2)" : "var(--border)",
                background: "var(--card-bg)",
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ id: c.id, x: e.clientX, y: e.clientY });
              }}
            >
              <div
                className="w-[3px] shrink-0 self-stretch rounded-l-[var(--r-md)]"
                style={{ background: c.color || "#5DCAA5" }}
                aria-hidden
              />
              <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center gap-0.5 pr-1">
                <button
                  type="button"
                  onClick={() => onCanvasHeaderClick(c)}
                  className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-[13px] font-semibold"
                  style={{
                    color: "var(--text)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  <CanvasSidebarGlyph canvas={c} />
                  <span className="min-w-0 flex-1 truncate">{c.name}</span>
                  {rowOpen ? (
                    <ChevronDown className="size-4 shrink-0" style={{ color: "var(--muted)" }} />
                  ) : (
                    <ChevronRight className="size-4 shrink-0" style={{ color: "var(--muted)" }} />
                  )}
                </button>
                {isMasterView ? (
                  <button
                    type="button"
                    className="flex shrink-0 items-center justify-center rounded p-1"
                    style={{
                      color: isCanvasHiddenInMaster(c.id)
                        ? "var(--muted)"
                        : "var(--text2)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                    title={
                      isCanvasHiddenInMaster(c.id)
                        ? "Hidden in master — show"
                        : "Visible in master — hide"
                    }
                    aria-label={
                      isCanvasHiddenInMaster(c.id)
                        ? `Show ${c.name} in master`
                        : `Hide ${c.name} in master`
                    }
                    onClick={(e) => void onEyeClick(e, c.id)}
                  >
                    {isCanvasHiddenInMaster(c.id) ? (
                      <EyeOff size={15} strokeWidth={1.75} />
                    ) : (
                      <Eye size={15} strokeWidth={1.75} />
                    )}
                  </button>
                ) : null}
                <DropdownMenu>
                  <DropdownMenuTrigger
                    type="button"
                    className="flex shrink-0 items-center justify-center rounded p-1 opacity-0 transition-opacity group-hover/canvas-row:opacity-100 focus:opacity-100"
                    style={{
                      color: "var(--faint)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                    }}
                    aria-label={`Canvas options for ${c.name}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <MoreHorizontal className="size-3.5" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="min-w-[140px]">
                    <DropdownMenuItem
                      onClick={() => {
                        setCanvasModalScrollDanger(false);
                        setCanvasModalId(c.id);
                      }}
                    >
                      Settings
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      disabled={canvases.length <= 1}
                      onClick={() => {
                        setCanvasModalScrollDanger(true);
                        setCanvasModalId(c.id);
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <SidebarDropdown open={rowOpen}>
                <div
                  className="border-t px-1 pb-2 pl-3 pt-0"
                  style={subNavSurface}
                >
                  <Link
                    href="/dashboard"
                    onClick={(e) => {
                      e.preventDefault();
                      void goCanvasSubpage(c.id, "/dashboard");
                    }}
                    className={subLinkClass(graphActive)}
                    style={subLinkStyle(graphActive)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <LayoutGrid size={14} strokeWidth={1.75} />
                    Graph
                  </Link>
                  <Link
                    href="/dashboard/kanban"
                    onClick={(e) => {
                      e.preventDefault();
                      void goCanvasSubpage(c.id, "/dashboard/kanban");
                    }}
                    className={subLinkClass(kanbanActive)}
                    style={subLinkStyle(kanbanActive)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Columns3 size={14} strokeWidth={1.75} />
                    Kanban
                  </Link>
                  <Link
                    href="/dashboard/search"
                    onClick={(e) => {
                      e.preventDefault();
                      void goCanvasSubpage(c.id, "/dashboard/search");
                    }}
                    className={subLinkClass(searchActive)}
                    style={subLinkStyle(searchActive)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Search size={14} strokeWidth={1.75} />
                    Search
                  </Link>
                  <Link
                    href="/dashboard/capture"
                    onClick={(e) => {
                      e.preventDefault();
                      void goCanvasSubpage(c.id, "/dashboard/capture");
                    }}
                    className={subLinkClass(captureActive)}
                    style={subLinkStyle(captureActive)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <MessageSquarePlus size={14} strokeWidth={1.75} />
                    Capture
                  </Link>
                  <Link
                    href="/dashboard/conflicts"
                    onClick={(e) => {
                      e.preventDefault();
                      void goCanvasSubpage(c.id, "/dashboard/conflicts");
                    }}
                    className={subLinkClass(conflictsActive)}
                    style={subLinkStyle(conflictsActive)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <AlertTriangle size={14} strokeWidth={1.75} />
                    Conflicts
                  </Link>
                  <Link
                    href="/dashboard/brief"
                    onClick={(e) => {
                      e.preventDefault();
                      void goCanvasSubpage(c.id, "/dashboard/brief");
                    }}
                    className={subLinkClass(briefActive)}
                    style={subLinkStyle(briefActive)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <Sparkles size={14} strokeWidth={1.75} />
                    Brief AI
                  </Link>
                </div>
              </SidebarDropdown>
              </div>
            </div>
          );
        })}
      </div>

      <div className="px-1 pt-1">
        <NewCanvasButton userId={userId} plan={plan} isCollapsed={false} />
      </div>

      <div
        className="mx-1 my-2 h-px"
        style={{ background: "var(--border)" }}
        aria-hidden
      />

      <Link
        href="/dashboard/settings"
        className={cn(
          "flex items-center gap-2 rounded-[var(--r-button)] px-3 py-2 text-[13px] no-underline transition-colors"
        )}
        style={{
          color:
            pathname.startsWith("/dashboard/settings")
              ? "var(--text)"
              : "var(--text2)",
          background:
            pathname.startsWith("/dashboard/settings")
              ? "var(--bg4)"
              : "transparent",
          fontWeight: pathname.startsWith("/dashboard/settings") ? 500 : 400,
        }}
      >
        <Settings size={16} strokeWidth={1.75} />
        Settings
      </Link>
    </nav>
  );

  const contextMenuPortal =
    contextMenu && typeof document !== "undefined"
      ? createPortal(
          <div
            id="memorey-canvas-context-menu"
            className="fixed z-[200] min-w-[160px] overflow-hidden rounded-lg border p-1 shadow-lg"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              borderColor: "var(--border)",
              background: "var(--card-bg)",
              boxShadow: "var(--shadow-md)",
            }}
          >
            <button
              type="button"
              className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-[var(--text)] hover:bg-[var(--hover-bg)]"
              onClick={() => {
                setCanvasModalScrollDanger(false);
                setCanvasModalId(contextMenu.id);
                setContextMenu(null);
              }}
            >
              Settings
            </button>
            <button
              type="button"
              className="flex w-full rounded-md px-2 py-1.5 text-left text-sm text-destructive hover:bg-destructive/10 disabled:opacity-40"
              disabled={canvases.length <= 1}
              onClick={() => {
                setCanvasModalScrollDanger(true);
                setCanvasModalId(contextMenu.id);
                setContextMenu(null);
              }}
            >
              Delete
            </button>
          </div>,
          document.body
        )
      : null;

  return (
    <>
      {isCollapsed ? collapsedNav : expandedNav}
      <CanvasSettingsModal
        open={canvasModalId != null && settingsCanvas != null}
        scrollToDanger={canvasModalScrollDanger}
        onOpenChange={(next) => {
          if (!next) {
            setCanvasModalId(null);
            setCanvasModalScrollDanger(false);
          }
        }}
        canvas={settingsCanvas}
        userId={userId}
      />
      {contextMenuPortal}
    </>
  );
}
