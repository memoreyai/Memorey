import React, { type ReactNode } from "react";
import { ViewSwitcher } from "./ViewSwitcher";
import { StatusBar } from "./StatusBar";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const { currentView } = useMemoreyState();
  const dispatch = useMemoreyDispatch();

  return (
    <div className="memorey-layout">
      <header className="memorey-header">
        <div className="memorey-header__left">
          <div className="memorey-header__logo">M</div>
          <span className="memorey-header__title">Memorey</span>
        </div>
        <button
          className={`memorey-header__settings${currentView === "settings" ? " memorey-header__settings--active" : ""}`}
          title="Settings"
          onClick={() => dispatch({ type: "SET_VIEW", view: "settings" })}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </button>
      </header>
      {currentView !== "settings" && <ViewSwitcher />}
      <main className="memorey-content">
        {children}
      </main>
      <StatusBar />
    </div>
  );
}
