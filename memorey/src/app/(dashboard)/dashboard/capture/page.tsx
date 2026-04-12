"use client";

import { ShareLinkInput } from "@/components/capture/ShareLinkInput";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { TrackPageView } from "@/components/analytics/TrackPageView";

export default function DashboardCapturePage() {
  return (
    <div
      className="w-full max-w-full p-4 md:p-8"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <TrackPageView pagePath="/dashboard/capture" />
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-sm font-medium">Capture</h1>
        <ThemeToggle />
      </div>
      <p className="mt-2 max-w-lg text-sm text-[var(--text2)]">
        Paste a public share link from ChatGPT, Claude, Gemini, or Perplexity.
        We fetch it once, extract memories, then discard the page content.
      </p>
      <div className="mt-8">
        <ShareLinkInput />
      </div>
    </div>
  );
}
