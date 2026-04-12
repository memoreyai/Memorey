"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const STORAGE_KEY = "memorey-sidebar";

function readExpanded(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return localStorage.getItem(STORAGE_KEY) !== "collapsed";
  } catch {
    return true;
  }
}

function initialExpanded(): boolean {
  if (typeof window === "undefined") return true;
  return readExpanded();
}

function persist(expanded: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, expanded ? "expanded" : "collapsed");
  } catch {
    /* ignore */
  }
}

type SidebarContextValue = {
  expanded: boolean;
  setExpanded: (next: boolean) => void;
  toggleSidebar: () => void;
  /** false until client has read localStorage (avoid layout jump if needed) */
  hydrated: boolean;
};

const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [expanded, setExpandedState] = useState(initialExpanded);
  const [hydrated, setHydrated] = useState(
    () => typeof window !== "undefined"
  );

  useEffect(() => {
    queueMicrotask(() => {
      setExpandedState(readExpanded());
      setHydrated(true);
    });
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setExpandedState(readExpanded());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const setExpanded = useCallback((next: boolean) => {
    setExpandedState(next);
    persist(next);
  }, []);

  const toggleSidebar = useCallback(() => {
    setExpandedState((prev) => {
      const next = !prev;
      persist(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ expanded, setExpanded, toggleSidebar, hydrated }),
    [expanded, setExpanded, toggleSidebar, hydrated]
  );

  return (
    <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>
  );
}

export function useSidebar() {
  const ctx = useContext(SidebarContext);
  if (!ctx) {
    throw new Error("useSidebar must be used within SidebarProvider");
  }
  return ctx;
}
