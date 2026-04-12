"use client";

import { useEffect } from "react";
import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[global-error]", error);
  }, [error]);

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="antialiased"
        style={{
          margin: 0,
          minHeight: "100vh",
          backgroundColor: "#0a0a0a",
          color: "#f2f0eb",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            minHeight: "100vh",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 24,
            padding: 24,
          }}
        >
          <MemoreyLogo size={48} showWordmark />
          <div style={{ maxWidth: 420, textAlign: "center" }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
              Something went wrong
            </h1>
            <p style={{ marginTop: 8, fontSize: 14, color: "#a8a49d", lineHeight: 1.5 }}>
              The app hit a critical error. Try reloading — your data in Memorey is safe.
            </p>
          </div>
          <button
            type="button"
            onClick={() => reset()}
            style={{
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              color: "#fff",
              background: "#ff6600",
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
