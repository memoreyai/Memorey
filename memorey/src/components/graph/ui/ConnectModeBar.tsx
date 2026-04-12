"use client";

import type { GraphNode } from "@/types/memorey";

interface ConnectModeBarProps {
  connectSource: GraphNode | null;
}

export function ConnectModeBar({ connectSource }: ConnectModeBarProps) {
  return (
    <div
      className="pointer-events-none fixed bottom-8 left-1/2 z-40 -translate-x-1/2 rounded-full border px-4 py-2 text-sm shadow-lg"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--orange)",
        color: "var(--text)",
      }}
    >
      {connectSource ? (
        <span>
          <strong style={{ color: "var(--orange)" }}>
            {connectSource.title || "Node"}
          </strong>{" "}
          → click target
        </span>
      ) : (
        <span>Click a node to start connecting</span>
      )}
    </div>
  );
}
