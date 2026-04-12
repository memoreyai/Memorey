"use client";

import { useSyncExternalStore } from "react";
import { isDarkThemeSnapshot, subscribeDataTheme } from "@/lib/theme";

export function useIsDarkTheme(): boolean {
  return useSyncExternalStore(
    subscribeDataTheme,
    isDarkThemeSnapshot,
    () => true
  );
}
