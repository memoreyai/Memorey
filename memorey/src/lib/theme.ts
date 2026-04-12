export type Theme = "dark" | "light";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  const t = localStorage.getItem("memorey-theme") as Theme | null;
  return t === "light" || t === "dark" ? t : "dark";
}

export function setTheme(theme: Theme) {
  if (typeof document === "undefined") return;
  localStorage.setItem("memorey-theme", theme);
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.style.colorScheme = theme === "light" ? "light" : "dark";
  document.documentElement.classList.toggle("dark", theme === "dark");
  window.dispatchEvent(new Event("memorey-theme"));
}

export function toggleTheme() {
  setTheme(getTheme() === "dark" ? "light" : "dark");
}

export function applyThemeFromStorage() {
  if (typeof document === "undefined") return;
  const t = getTheme();
  document.documentElement.setAttribute("data-theme", t);
  document.documentElement.style.colorScheme = t === "light" ? "light" : "dark";
  document.documentElement.classList.toggle("dark", t === "dark");
}

/** Matches graph canvas `data-theme` (dark when not `light`). */
export function isDarkThemeSnapshot(): boolean {
  if (typeof document === "undefined") return true;
  return document.documentElement.getAttribute("data-theme") !== "light";
}

/** Subscribe to theme changes (storage apply, toggle, or `data-theme` mutation). */
export function subscribeDataTheme(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const run = () => onStoreChange();
  window.addEventListener("memorey-theme", run);
  const mo = new MutationObserver(run);
  mo.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
  return () => {
    window.removeEventListener("memorey-theme", run);
    mo.disconnect();
  };
}
