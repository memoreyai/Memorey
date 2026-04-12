"use client";

import { useEffect } from "react";
import { useTrack } from "@/hooks/useTrack";

/** Mount once per page to record page_view with a stable path (for dashboards). */
export function TrackPageView({ pagePath }: { pagePath: string }) {
  const { track } = useTrack();

  useEffect(() => {
    track("page_view", { page_path: pagePath });
  }, [pagePath, track]);

  return null;
}
