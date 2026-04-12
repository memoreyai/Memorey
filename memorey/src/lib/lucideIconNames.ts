/**
 * Lucide React icon component names (PascalCase, excludes *Icon aliases).
 * Built for searchable pickers; dynamic import loads the icon module once.
 *
 * Icons are often `forwardRef` objects (typeof === "object"), not plain functions.
 */
function isLucideIconExport(v: unknown): boolean {
  if (typeof v === "function") return true;
  if (v !== null && typeof v === "object") {
    return (
      "render" in v &&
      typeof (v as { render?: unknown }).render === "function"
    );
  }
  return false;
}

export async function loadLucideIconNames(): Promise<string[]> {
  const Lucide = await import("lucide-react");
  return Object.keys(Lucide).filter(
    (k) =>
      /^[A-Z]/.test(k) &&
      !k.endsWith("Icon") &&
      !k.startsWith("Lucide") &&
      k !== "Icon" &&
      k !== "createLucideIcon" &&
      isLucideIconExport((Lucide as Record<string, unknown>)[k])
  );
}
