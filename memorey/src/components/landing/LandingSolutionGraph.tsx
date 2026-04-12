"use client";

import dynamic from "next/dynamic";

const LandingGraphDemo = dynamic(
  () =>
    import("./LandingGraphDemo").then((m) => ({
      default: m.LandingGraphDemo,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex h-[min(52vh,520px)] min-h-[300px] w-full items-center justify-center rounded-lg border border-[#1E1E22] bg-[#0A0A0B]"
        style={{ transform: "translateZ(0)" }}
      >
        <span className="text-sm tracking-widest text-[#888780]">Loading graph…</span>
      </div>
    ),
  }
);

export function LandingSolutionGraph() {
  return <LandingGraphDemo />;
}
