"use client";

import { createElement, type ComponentType } from "react";
import { renderToStaticMarkup } from "react-dom/server";

const cache = new Map<string, HTMLImageElement | "loading" | null>();

export function lucideIconCacheKey(
  iconName: string,
  color: string,
  size: number
): string {
  return `${iconName}|${color}|${size}`;
}

export function getLucideIconImageSync(
  iconName: string,
  color: string,
  size: number
): HTMLImageElement | null {
  const v = cache.get(lucideIconCacheKey(iconName, color, size));
  return v && v !== "loading" ? v : null;
}

/**
 * Renders a Lucide icon to an Image for canvas use. Call from effects or
 * one-off loads; invoke onReady when the image is ready to redraw the canvas.
 */
export function ensureLucideIconImage(
  iconName: string,
  color: string,
  size: number,
  onReady: () => void
): void {
  const key = lucideIconCacheKey(iconName, color, size);
  if (cache.has(key)) {
    const v = cache.get(key);
    if (v && v !== "loading") onReady();
    return;
  }
  cache.set(key, "loading");
  void (async () => {
    try {
      const Lucide = (await import("lucide-react")) as unknown as Record<
        string,
        ComponentType<{
          size?: number;
          color?: string;
          strokeWidth?: number;
        }>
      >;
      const Icon = Lucide[iconName];
      if (!Icon) {
        cache.set(key, null);
        onReady();
        return;
      }
      const svg = renderToStaticMarkup(
        createElement(Icon, { size, color, strokeWidth: 2 })
      );
      const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        cache.set(key, img);
        onReady();
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        cache.set(key, null);
        onReady();
      };
      img.src = url;
    } catch {
      cache.set(key, null);
      onReady();
    }
  })();
}
