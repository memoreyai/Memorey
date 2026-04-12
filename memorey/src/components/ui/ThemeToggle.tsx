"use client";

import { Sun, Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { getTheme, toggleTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    queueMicrotask(() => setTheme(getTheme()));
    const onStorage = () => setTheme(getTheme());
    const onTheme = () => setTheme(getTheme());
    window.addEventListener("storage", onStorage);
    window.addEventListener("memorey-theme", onTheme);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("memorey-theme", onTheme);
    };
  }, []);

  function handleToggle() {
    toggleTheme();
    setTheme(getTheme());
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      title={
        theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
      }
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 30,
        height: 30,
        background: "var(--bg3)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        cursor: "pointer",
        color: "var(--text2)",
        transition: "all 0.15s ease",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "var(--border2)";
        e.currentTarget.style.color = "var(--text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "var(--border)";
        e.currentTarget.style.color = "var(--text2)";
      }}
    >
      {theme === "dark" ? (
        <Sun size={13} strokeWidth={1.75} />
      ) : (
        <Moon size={13} strokeWidth={1.75} />
      )}
    </button>
  );
}
