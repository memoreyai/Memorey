"use client";

import { cn } from "@/lib/utils";

function Bar({
  className,
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-[var(--bg4)]",
        className
      )}
      style={style}
      aria-hidden
    />
  );
}

/** Full-screen shell skeleton: sidebar + main (graph-sized canvas area). */
export function DashboardLayoutSkeleton() {
  const sidebarW = "var(--sidebar-w, 220px)";
  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <aside
        className="flex shrink-0 flex-col border-r border-[var(--border)]"
        style={{
          width: sidebarW,
          minWidth: sidebarW,
          background: "var(--sidebar)",
        }}
        aria-hidden
      >
        <div className="flex items-center gap-2 border-b border-[var(--border2)] px-3 py-3">
          <Bar className="size-7 shrink-0 rounded-lg" />
          <Bar className="h-4 flex-1 max-w-[100px]" />
          <Bar className="size-8 shrink-0 rounded-md" />
        </div>
        <div className="px-2 py-2">
          <Bar className="h-9 w-full rounded-[var(--r-button)]" />
        </div>
        <div className="px-3 py-2">
          <Bar className="mb-2 h-3 w-20" />
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Bar key={i} className="h-9 w-full rounded-[var(--r-button)]" />
          ))}
        </nav>
        <div className="mt-auto border-t border-[var(--border2)] px-3 py-3">
          <div className="flex items-center gap-2">
            <Bar className="size-7 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-1">
              <Bar className="h-3 max-w-[120px]" style={{ width: "75%" }} />
              <Bar className="h-2 w-10" />
            </div>
          </div>
        </div>
      </aside>
      <main
        className="flex min-h-0 min-w-0 flex-1 flex-col p-5"
        style={{ background: "var(--bg)" }}
      >
        <div className="mb-4 flex shrink-0 items-center gap-3">
          <Bar className="h-4 w-32" />
          <Bar className="ml-auto h-8 w-24 rounded-[var(--r-button)]" />
        </div>
        <div
          className="min-h-0 flex-1 overflow-hidden rounded-[var(--r-card)] border border-[var(--border2)] bg-[var(--bg2)] p-4"
          style={{ minHeight: "min(70vh, calc(100vh - 140px))" }}
        >
          <div className="relative h-full min-h-[320px] w-full">
            <Bar className="absolute left-[12%] top-[18%] h-16 w-40 rounded-xl opacity-90" />
            <Bar className="absolute left-[38%] top-[42%] h-14 w-36 rounded-xl opacity-80" />
            <Bar className="absolute right-[14%] top-[28%] h-16 w-44 rounded-xl opacity-85" />
            <Bar className="absolute bottom-[16%] left-1/4 h-3 w-48 max-w-[40%] opacity-60" />
            <Bar className="absolute bottom-[22%] right-1/4 h-3 w-40 max-w-[35%] opacity-50" />
          </div>
        </div>
      </main>
    </div>
  );
}

/** Kanban: three columns + header strip */
export function KanbanPageSkeleton() {
  return (
    <div
      className="flex min-h-0 flex-1 flex-col"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <div
        className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-6 py-4"
        aria-hidden
      >
        <Bar className="h-3 w-16" />
        <Bar className="h-7 w-24 rounded-full" />
        <Bar className="h-7 w-28 rounded-full" />
        <Bar className="ml-auto h-8 w-8 rounded-md" />
      </div>
      <div
        className="grid min-h-0 flex-1 gap-4 p-6"
        style={{
          gridTemplateColumns: "1fr 1fr 1fr",
          height: "calc(100vh - 120px)",
        }}
      >
        {Array.from({ length: 3 }).map((_, col) => (
          <div
            key={col}
            className="flex min-h-0 flex-col rounded-[var(--r-card)] border border-[var(--border2)] bg-[var(--bg2)]"
          >
            <div className="flex shrink-0 items-center gap-2 border-b border-[var(--border2)] px-3 py-2">
              <Bar className="h-2 w-2 rounded-full" />
              <Bar className="h-3 w-16" />
              <Bar className="h-4 w-6 rounded" />
            </div>
            <div className="flex flex-1 flex-col gap-2 overflow-hidden p-2">
              {Array.from({ length: 4 }).map((__, i) => (
                <Bar key={i} className="h-24 w-full rounded-lg" />
              ))}
            </div>
            <div className="shrink-0 border-t border-[var(--border2)] p-2">
              <Bar className="h-9 w-full rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SearchPageSkeleton() {
  return (
    <div
      className="p-6 md:p-8"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
      aria-hidden
    >
      <Bar className="h-4 w-24" />
      <Bar className="mt-3 h-3 w-full max-w-lg" />
      <Bar className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-8 space-y-3">
        <Bar className="h-11 w-full max-w-xl rounded-md" />
        <Bar className="h-32 w-full max-w-2xl rounded-[var(--r-card)]" />
        <Bar className="h-4 w-48" />
      </div>
    </div>
  );
}

export function CapturePageSkeleton() {
  return (
    <div
      className="p-6 md:p-8"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
      aria-hidden
    >
      <div className="flex items-start justify-between gap-4">
        <Bar className="h-4 w-28" />
        <Bar className="h-8 w-8 rounded-md" />
      </div>
      <Bar className="mt-3 h-3 w-full max-w-lg" />
      <Bar className="mt-2 h-3 w-full max-w-md" />
      <div className="mt-8 space-y-3">
        <Bar className="h-12 w-full max-w-xl rounded-md" />
        <Bar className="h-10 w-32 rounded-md" />
      </div>
    </div>
  );
}
