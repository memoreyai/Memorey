"use client";

import { useEffect, useState, type ComponentType } from "react";
import { cn } from "@/lib/utils";

export function CanvasDynamicLucideIcon({
  name,
  size = 16,
  strokeWidth = 1.75,
  color,
  className,
}: {
  name: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
  className?: string;
}) {
  const [Icon, setIcon] = useState<ComponentType<{
    size?: number;
    strokeWidth?: number;
    color?: string;
    className?: string;
  }> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void import("lucide-react").then((mod) => {
      const I = (mod as Record<string, unknown>)[name];
      const ok =
        typeof I === "function" ||
        (I !== null &&
          typeof I === "object" &&
          "render" in I &&
          typeof (I as { render?: unknown }).render === "function");
      if (!cancelled && ok) {
        setIcon(
          () =>
            I as ComponentType<{
              size?: number;
              strokeWidth?: number;
              color?: string;
              className?: string;
            }>
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  if (!Icon) {
    return (
      <span
        className={cn(
          "inline-block shrink-0 rounded-sm bg-[var(--bg3)]",
          className
        )}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      color={color}
      className={cn("inline-block shrink-0", className)}
    />
  );
}
