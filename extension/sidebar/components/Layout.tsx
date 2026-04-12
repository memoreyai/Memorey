import React, { type ReactNode, useState, useEffect, useCallback } from "react";
import { ViewSwitcher } from "./ViewSwitcher";
import { StatusBar } from "./StatusBar";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";

interface LayoutProps {
  children: ReactNode;
}

function getStoredTheme(): "dark" | "light" {
  try {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      return "dark"; // async load below will correct this
    }
    const saved = localStorage.getItem("memorey-theme");
    return saved === "light" ? "light" : "dark";
  } catch {
    return "dark";
  }
}

export function Layout({ children }: LayoutProps) {
  const { currentView } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const [theme, setTheme] = useState<"dark" | "light">(getStoredTheme);

  useEffect(() => {
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.get("memorey-theme", (result) => {
        const t = result["memorey-theme"] === "light" ? "light" : "dark";
        setTheme(t);
        document.documentElement.setAttribute("data-theme", t);
      });
    } else {
      document.documentElement.setAttribute("data-theme", theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTheme = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    if (typeof chrome !== "undefined" && chrome.storage?.local) {
      chrome.storage.local.set({ "memorey-theme": next });
    } else {
      localStorage.setItem("memorey-theme", next);
    }
  }, [theme]);

  return (
    <div className="memorey-layout">
      <header className="memorey-header">
        <div className="memorey-header__left">
          <div className="memorey-header__logo">M</div>
          <span className="memorey-header__title">Memorey</span>
        </div>
        <div className="memorey-header__actions">
          {/* Theme toggle */}
          <button
            className="memorey-header__icon-btn"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>

          {/* Settings */}
          <button
            className={`memorey-header__icon-btn${currentView === "settings" ? " memorey-header__icon-btn--active" : ""}`}
            title="Settings"
            onClick={() => dispatch({ type: "SET_VIEW", view: "settings" })}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
        </div>
      </header>
      {currentView !== "settings" && <ViewSwitcher />}
      <main className="memorey-content">
        {children}
      </main>
      <StatusBar />
    </div>
  );
}
