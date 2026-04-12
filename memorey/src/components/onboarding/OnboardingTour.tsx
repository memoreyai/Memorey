"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Brain,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Keyboard,
  Layout,
  MousePointer2,
  Sparkles,
  X,
} from "lucide-react";

const TOUR_STEPS = [
  {
    icon: Brain,
    iconColor: "#FF6600",
    title: "Welcome to Memorey",
    description:
      "Your second brain powered by AI. Let\u2019s take a quick tour of the key features and shortcuts so you can hit the ground running.",
    items: [],
  },
  {
    icon: Layout,
    iconColor: "#5DCAA5",
    title: "Your Memory Canvas",
    description:
      "This is your workspace. Memory cards are displayed in columns organized by vault. You can drag, zoom, and rearrange freely.",
    items: [
      { keys: ["Drag"], label: "Pan around the canvas" },
      { keys: ["Scroll"], label: "Zoom in and out" },
      { keys: ["\u2318", "0"], label: "Reset zoom to 100%" },
    ],
  },
  {
    icon: MousePointer2,
    iconColor: "#378ADD",
    title: "Creating Memories",
    description: "There are several ways to add new memories to your canvas:",
    items: [
      { keys: ["N"], label: "New memory card at canvas centre" },
      { keys: ["Double-click"], label: "Create a card at cursor position" },
      { keys: ["Paste text"], label: "Auto-extract memories from pasted content" },
      { keys: ["Drag file"], label: "Drop files onto the canvas to attach" },
    ],
  },
  {
    icon: Columns3,
    iconColor: "#7C6FF0",
    title: "Vaults & Organisation",
    description:
      "Vaults are categories that organise your memories \u2014 Work, Personal, Goals, and more. Open Vault Manager from the toolbar to customise, create, or reorder vaults.",
    items: [
      { keys: ["\u2318", "K"], label: "Search across all memories" },
      { keys: ["A"], label: "Auto-layout all vault columns" },
      { keys: ["F"], label: "Fit all nodes in view" },
    ],
  },
  {
    icon: Keyboard,
    iconColor: "#F5C542",
    title: "Selection & Views",
    description:
      "Interact with memory cards and switch between different layout views:",
    items: [
      { keys: ["Click"], label: "Preview a memory card (peek)" },
      { keys: ["Click", "Click"], label: "Open full node details" },
      { keys: ["Shift", "Click"], label: "Add/remove from multi-selection" },
      { keys: ["Shift", "Drag"], label: "Box-select multiple cards" },
      { keys: ["P"], label: "Cycle Graph / Plain / Tree view" },
      { keys: ["C"], label: "Toggle connect mode (draw edges)" },
      { keys: ["Delete"], label: "Delete selected memories" },
      { keys: ["?"], label: "Open keyboard shortcuts reference" },
    ],
  },
  {
    icon: Sparkles,
    iconColor: "#FF6600",
    title: "You\u2019re all set!",
    description:
      "Start adding memories to build your second brain. The more context you add, the smarter Memorey becomes. You can revisit shortcuts anytime by pressing ?",
    items: [],
  },
];

export function OnboardingTour() {
  const [visible, setVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const show = localStorage.getItem("memorey-show-tour");
    const done = localStorage.getItem("memorey-tour-completed");
    if (show === "true" && done !== "true") {
      const timer = setTimeout(() => setVisible(true), 600);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.removeItem("memorey-show-tour");
    localStorage.setItem("memorey-tour-completed", "true");
  }, []);

  const next = useCallback(() => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep((s) => s + 1);
    } else {
      dismiss();
    }
  }, [currentStep, dismiss]);

  const prev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      } else if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        prev();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [visible, next, prev, dismiss]);

  if (!visible) return null;

  const step = TOUR_STEPS[currentStep];
  const Icon = step.icon;
  const isLast = currentStep === TOUR_STEPS.length - 1;
  const isFirst = currentStep === 0;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 9998,
          background: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(3px)",
          transition: "opacity 0.2s",
        }}
        onClick={dismiss}
      />

      {/* Tour card */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 9999,
          width: "100%",
          maxWidth: 500,
          background: "var(--bg3)",
          border: "1px solid var(--border2)",
          borderRadius: "var(--r-xl)",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.5)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "24px 24px 0",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: `${step.iconColor}18`,
              border: `1px solid ${step.iconColor}33`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: step.iconColor,
              flexShrink: 0,
            }}
          >
            <Icon size={22} />
          </div>
          <button
            type="button"
            onClick={dismiss}
            style={{
              width: 28,
              height: 28,
              borderRadius: 6,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            aria-label="Close tour"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "16px 24px 20px" }}>
          <h3
            style={{
              fontSize: 20,
              fontWeight: 700,
              color: "var(--text)",
              marginBottom: 8,
              fontFamily: "var(--font-display)",
            }}
          >
            {step.title}
          </h3>
          <p
            style={{
              fontSize: 13,
              color: "var(--text2)",
              lineHeight: 1.6,
              marginBottom: step.items.length > 0 ? 16 : 0,
            }}
          >
            {step.description}
          </p>

          {step.items.length > 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                padding: 12,
                background: "var(--bg2)",
                borderRadius: "var(--r-md)",
                border: "1px solid var(--border)",
              }}
            >
              {step.items.map((item, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      gap: 3,
                      flexShrink: 0,
                      minWidth: 90,
                    }}
                  >
                    {item.keys.map((k, ki) => (
                      <kbd
                        key={ki}
                        style={{
                          padding: "2px 6px",
                          borderRadius: 4,
                          background: "var(--bg3)",
                          border: "1px solid var(--border2)",
                          fontSize: 11,
                          fontFamily: "var(--font-mono, monospace)",
                          color: "var(--text)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                  <span style={{ color: "var(--text2)" }}>{item.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 24px 20px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          {/* Progress dots */}
          <div style={{ display: "flex", gap: 5 }}>
            {TOUR_STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCurrentStep(i)}
                style={{
                  width: i === currentStep ? 18 : 6,
                  height: 6,
                  borderRadius: 3,
                  background:
                    i <= currentStep ? "var(--orange)" : "var(--border2)",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  padding: 0,
                }}
                aria-label={`Go to step ${i + 1}`}
              />
            ))}
          </div>

          {/* Navigation buttons */}
          <div style={{ display: "flex", gap: 8 }}>
            {!isFirst && (
              <button
                type="button"
                onClick={prev}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "7px 14px",
                  background: "var(--bg2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-md)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                  color: "var(--text2)",
                }}
              >
                <ChevronLeft size={13} />
                Back
              </button>
            )}
            <button
              type="button"
              onClick={next}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                padding: "7px 18px",
                background: "var(--orange)",
                border: "none",
                borderRadius: "var(--r-md)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                color: "#fff",
              }}
            >
              {isLast ? (
                "Get started"
              ) : (
                <>
                  Next
                  <ChevronRight size={13} />
                </>
              )}
            </button>
          </div>
        </div>

        {/* Keyboard hint */}
        <div
          style={{
            padding: "0 24px 14px",
            fontSize: 10,
            color: "var(--muted)",
            textAlign: "center",
          }}
        >
          \u2190 \u2192 navigate \u00b7 enter next \u00b7 esc skip
        </div>
      </div>
    </>
  );
}
