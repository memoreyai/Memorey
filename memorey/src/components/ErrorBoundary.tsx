"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";

type Props = {
  children: ReactNode;
};

type State = { hasError: boolean };

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-6 px-6"
          style={{
            backgroundColor: "var(--bg, #0a0a0a)",
            color: "var(--text, #f2f0eb)",
          }}
        >
          <MemoreyLogo size={48} showWordmark />
          <div className="max-w-md text-center">
            <h1
              className="font-[family-name:var(--font-display)] text-xl font-semibold tracking-tight"
              style={{ color: "var(--text, #f2f0eb)" }}
            >
              Something went wrong
            </h1>
            <p className="mt-2 text-sm" style={{ color: "var(--text2, #a8a49d)" }}>
              A part of the app crashed while rendering. You can reload to try again.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false });
              window.location.reload();
            }}
            className="rounded-[var(--r-button)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
            style={{ background: "var(--orange, #ff6600)" }}
          >
            Reload
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
