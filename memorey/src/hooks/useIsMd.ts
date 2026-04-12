"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 768px)";

/** `true` when viewport is Tailwind `md` and up (≥768px). */
export function useIsMd(): boolean {
  return useSyncExternalStore(
    (onStoreChange) => {
      const mq = window.matchMedia(QUERY);
      mq.addEventListener("change", onStoreChange);
      return () => mq.removeEventListener("change", onStoreChange);
    },
    () => window.matchMedia(QUERY).matches,
    () => false
  );
}
