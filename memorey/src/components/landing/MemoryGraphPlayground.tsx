"use client";

import { useCallback, useState } from "react";
import { LandingGraphDemo } from "@/components/landing/LandingGraphDemo";

type Msg = { role: "user" | "assistant"; text: string };

const SEED: Msg[] = [
  {
    role: "assistant",
    text: "Describe something about yourself — work, goals, health — and watch the graph suggest nodes. (Demo: replies are simulated.)",
  },
];

export function MemoryGraphPlayground() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>(SEED);
  const [busy, setBusy] = useState(false);

  const send = useCallback(() => {
    const t = input.trim();
    if (!t || busy) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", text: t }]);
    setBusy(true);
    window.setTimeout(() => {
      setMessages((m) => [
        ...m,
        {
          role: "assistant",
          text: `I’d add nodes like “${t.slice(0, 32)}${t.length > 32 ? "…" : ""}” to your graph. On the real product, you’d review each change in a diff before anything saves.`,
        },
      ]);
      setBusy(false);
    }, 900);
  }, [input, busy]);

  return (
    <div className="grid min-h-[min(70vh,640px)] gap-0 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-secondary)] md:grid-cols-2">
      <div className="flex min-h-[320px] flex-col border-b border-[var(--border)] md:border-b-0 md:border-r">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <span className="size-2 shrink-0 rounded-full bg-[var(--accent)]" />
          <span className="font-mono text-[11px] tracking-wider text-[var(--text-muted)]">
            LIVE GRAPH · DEMO
          </span>
        </div>
        <div className="min-h-0 flex-1 p-3">
          <LandingGraphDemo />
        </div>
      </div>
      <div className="flex min-h-[320px] flex-col">
        <div className="flex items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          <span className="font-mono text-[11px] tracking-wider text-[var(--text-muted)]">
            MEMORY ASSISTANT
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-hidden p-4">
          <div className="flex max-h-[min(40vh,360px)] flex-1 flex-col gap-3 overflow-y-auto pr-1">
            {messages.map((msg, i) => (
              <div
                key={`${i}-${msg.text.slice(0, 12)}`}
                className={`max-w-[92%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "ml-auto bg-[var(--accent)] text-[#0A0A0B]"
                    : "mr-auto border border-[var(--border)] bg-[var(--bg-tertiary)] text-[var(--text-primary)]"
                }`}
              >
                {msg.text}
              </div>
            ))}
            {busy && (
              <div className="mr-auto rounded-xl border border-[var(--border)] bg-[var(--bg-tertiary)] px-3.5 py-2.5 text-sm text-[var(--text-muted)]">
                Thinking…
              </div>
            )}
          </div>
          <div className="flex gap-2 border-t border-[var(--border)] pt-3">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
              placeholder="e.g. I’m training for a half marathon in April…"
              className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-primary)] px-3 py-2.5 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none focus:border-[var(--accent)]"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !input.trim()}
              className="shrink-0 rounded-xl bg-[var(--accent)] px-4 py-2.5 text-sm font-medium text-[#0A0A0B] transition-opacity disabled:opacity-40"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
