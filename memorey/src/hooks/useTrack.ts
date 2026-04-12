"use client";

import { useCallback, useRef } from "react";

/**
 * Fire-and-forget analytics. Debounces duplicate event_name within 1s (client).
 */
export function useTrack() {
  const lastFiredRef = useRef<Record<string, number>>({});

  const track = useCallback(
    (eventName: string, eventData?: Record<string, unknown>) => {
      const now = Date.now();
      const last = lastFiredRef.current[eventName] ?? 0;
      if (now - last < 1000) return;
      lastFiredRef.current[eventName] = now;

      const payload = {
        event_name: eventName,
        event_data: eventData ?? {},
        page_path:
          typeof window !== "undefined" ? window.location.pathname : undefined,
      };

      try {
        void fetch("/api/track", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    },
    []
  );

  return { track };
}
