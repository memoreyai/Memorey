"use client";

import { useState, useEffect } from "react";
import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";
import HeroGraph from "@/components/landing/HeroGraph";

const platforms = [
  { name: "ChatGPT", color: "#10A37F" },
  { name: "Claude", color: "#D97757" },
  { name: "Gemini", color: "#4285F4" },
];

const steps = [
  {
    num: "01",
    title: "Share a conversation.",
    desc: "Paste a link from any AI. Memorey reads it, extracts the key memories, and deletes the link. What gets stored: meaning. Not history.",
    detail:
      "Links are deleted the moment parsing completes. We never store conversations.",
  },
  {
    num: "02",
    title: "Approve what changes.",
    desc: "A diff shows you exactly what will update in your graph. Old value, new value, which category. Nothing saves without your explicit confirmation.",
    detail:
      "You are always the last checkpoint. Every update is a conscious choice.",
  },
  {
    num: "03",
    title: "Brief any AI, instantly.",
    desc: "One click. Your full context exported to any format — Markdown for chat, JSON for developers, plain text for anywhere. Under 60 seconds from cold start.",
    detail:
      "Works with Claude, ChatGPT, Gemini, Cursor, and any MCP-compatible tool.",
  },
];

const diffCards = [
  {
    vault: "Work",
    color: "#378ADD",
    oldTitle: "Primary stack",
    newTitle: "Primary stack",
    oldVal: "React + JavaScript",
    newVal: "Next.js 14 + TypeScript + Supabase",
  },
  {
    vault: "Work",
    color: "#378ADD",
    isNew: true,
    newTitle: "Current project",
    newVal:
      "Building Memorey — portable AI memory graph. Pre-launch, targeting founders.",
  },
];

const principles = [
  {
    title: "LINKS VANISH THE MOMENT THEY'RE READ.",
    body: "We parse your shared conversation and delete the link immediately. We store what it means. Never what it said.",
  },
  {
    title: "YOUR HEALTH DATA NEVER TOUCHES YOUR WORK EXPORT.",
    body: "Every vault is isolated at the database level. Not application logic. Not a setting. The database itself refuses.",
  },
  {
    title: "NOTHING SAVES WITHOUT YOU SAYING SO. EVER.",
    body: "There are no background mutations. No silent learning. Every change passes through the diff. Every confirmation is conscious.",
  },
];

const comparisonRows = [
  {
    feature: "Built for humans",
    mem0: false,
    supermemory: false,
    platform: false,
    memorey: true,
  },
  {
    feature: "Portable across all AI",
    mem0: "API only",
    supermemory: "API only",
    platform: false,
    memorey: true,
  },
  {
    feature: "You control every update",
    mem0: false,
    supermemory: false,
    platform: false,
    memorey: true,
  },
  {
    feature: "Visual memory graph",
    mem0: false,
    supermemory: false,
    platform: false,
    memorey: true,
  },
  {
    feature: "Vault isolation (Work ≠ Health)",
    mem0: false,
    supermemory: false,
    platform: false,
    memorey: true,
  },
  {
    feature: "Free tier with extension",
    mem0: false,
    supermemory: false,
    platform: false,
    memorey: true,
  },
  {
    feature: "Links deleted after parsing",
    mem0: false,
    supermemory: false,
    platform: false,
    memorey: true,
  },
];

function Cell({ v }: { v: boolean | string }) {
  if (typeof v === "string") {
    return (
      <span
        style={{
          fontSize: 13,
          color: "var(--text-muted)",
          fontFamily: "ui-monospace, monospace",
        }}
      >
        {v}
      </span>
    );
  }
  return v ? (
    <span style={{ color: "var(--accent)", fontSize: 16 }}>✓</span>
  ) : (
    <span style={{ color: "var(--text-muted)", fontSize: 14 }}>—</span>
  );
}

export function LandingHomeClient() {
  const [isDark, setIsDark] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [annual, setAnnual] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("memorey-theme");
    const prefersDark = window.matchMedia(
      "(prefers-color-scheme: dark)"
    ).matches;
    queueMicrotask(() =>
      setIsDark(saved ? saved === "dark" : prefersDark)
    );
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute(
      "data-theme",
      isDark ? "dark" : "light"
    );
    localStorage.setItem("memorey-theme", isDark ? "dark" : "light");
  }, [isDark]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const plans = [
    {
      name: "Free",
      badge: "Always",
      price: "$0",
      sub: "Your first 100 memories",
      features: [
        "100 memory nodes",
        "3 active vaults",
        "5 conversation imports/month",
        "Browser extension",
        "JSON export",
        "5 graph queries/month",
      ],
      cta: "Start free",
      ctaStyle: "ghost" as const,
      href: "/login",
      featured: false,
    },
    {
      name: "Pro",
      badge: "Most popular",
      price: annual ? "$15" : "$19",
      priceSub: annual ? "/mo · billed annually" : "/month",
      sub: "Unlimited memory, everywhere",
      features: [
        "Unlimited memory nodes",
        "All 9 vaults + custom vaults",
        "Unlimited conversation imports",
        "Extension: inject + capture",
        "JSON, Markdown, TOML export",
        "Unlimited graph queries",
        "MCP server (Claude Desktop, Cursor)",
      ],
      cta: "Start 14-day trial",
      ctaStyle: "primary" as const,
      href: "/login",
      featured: true,
    },
  ];

  const accentBtnColor = "#0A0A0B";

  return (
    <div
      id="memorey-landing"
      style={{
        background: "var(--bg-primary)",
        color: "var(--text-primary)",
        minHeight: "100vh",
      }}
    >
      <nav
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          height: 60,
          display: "flex",
          alignItems: "center",
          padding: "0 24px",
          background: scrolled
            ? `rgba(var(--bg-primary-rgb), 0.88)`
            : "transparent",
          backdropFilter: scrolled ? "blur(12px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(12px)" : "none",
          borderBottom: scrolled ? "1px solid var(--border)" : "none",
          transition: "all 0.3s ease",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <MemoreyLogo size={24} />
          <span
            style={{
              fontWeight: 500,
              fontSize: 15,
              color: "var(--text-primary)",
            }}
          >
            memorey
          </span>
        </div>

        <div className="landing-nav-links">
          {["How it works", "Graph demo", "Privacy", "Pricing"].map((label) => {
            const id = label.toLowerCase().replace(/ /g, "-");
            const hash =
              label === "Graph demo"
                ? "graph-demo"
                : label === "How it works"
                  ? "how-it-works"
                  : id;
            return (
              <a
                key={label}
                href={`#${hash}`}
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  transition: "color 0.2s",
                }}
              >
                {label}
              </a>
            );
          })}
        </div>

        <div
          style={{ display: "flex", gap: 12, alignItems: "center", flexShrink: 0 }}
        >
          <button
            type="button"
            onClick={() => setIsDark(!isDark)}
            aria-label="Toggle theme"
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              color: "var(--text-secondary)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "all 0.2s",
              flexShrink: 0,
            }}
          >
            {isDark ? (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="5" />
                <line x1="12" y1="1" x2="12" y2="3" />
                <line x1="12" y1="21" x2="12" y2="23" />
                <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                <line x1="1" y1="12" x2="3" y2="12" />
                <line x1="21" y1="12" x2="23" y2="12" />
                <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
              </svg>
            ) : (
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
              </svg>
            )}
          </button>
          <a
            href="/login"
            style={{
              fontSize: 13,
              color: "var(--text-secondary)",
              textDecoration: "none",
              padding: "7px 14px",
            }}
          >
            Sign in
          </a>
          <a
            href="/login"
            style={{
              fontSize: 13,
              fontWeight: 500,
              background: "var(--accent)",
              color: accentBtnColor,
              textDecoration: "none",
              padding: "8px 18px",
              borderRadius: 8,
              transition: "opacity 0.2s",
            }}
          >
            Start free
          </a>
        </div>
      </nav>

      {/* Hero */}
      <section
        className="landing-hero-grid reveal"
        style={{ paddingTop: 60 }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "clamp(40px, 5vw, 80px)",
            paddingLeft: "clamp(24px, 6vw, 80px)",
          }}
        >
          <div
            className="reveal reveal-delay-1"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 12px",
              borderRadius: 20,
              border: "1px solid var(--border)",
              background: "var(--bg-secondary)",
              fontSize: 12,
              color: "var(--text-secondary)",
              marginBottom: 28,
              width: "fit-content",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: "var(--accent)",
              }}
            />
            Human-first AI memory
          </div>

          <h1
            className="landing-hero-h1"
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontSize: "clamp(40px, 5vw, 72px)",
              fontWeight: 700,
              lineHeight: 1.1,
              color: "var(--text-primary)",
              margin: "0 0 8px",
            }}
          >
            Every AI you use starts from zero.
          </h1>
          <h2
            className="landing-hero-h2"
            style={{
              fontFamily: "var(--font-playfair), serif",
              fontSize: "clamp(40px, 5vw, 72px)",
              fontWeight: 400,
              lineHeight: 1.1,
              color: "var(--text-secondary)",
              margin: "0 0 28px",
            }}
          >
            Memorey doesn&apos;t.
          </h2>

          <p
            className="reveal reveal-delay-2"
            style={{
              fontSize: 18,
              color: "var(--text-secondary)",
              lineHeight: 1.6,
              margin: "0 0 32px",
              maxWidth: 440,
            }}
          >
            One graph. Every AI. You in control.
          </p>

          <div
            className="reveal reveal-delay-2"
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 40,
            }}
          >
            <a
              href="/login"
              style={{
                fontSize: 14,
                fontWeight: 600,
                background: "var(--accent)",
                color: accentBtnColor,
                textDecoration: "none",
                padding: "12px 24px",
                borderRadius: 10,
              }}
            >
              Start free
            </a>
            <a
              href="#how-it-works"
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text-primary)",
                textDecoration: "none",
                padding: "12px 20px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "transparent",
              }}
            >
              See how it works →
            </a>
          </div>

          <div className="reveal reveal-delay-3">
            <span
              style={{
                fontSize: 12,
                color: "var(--text-muted)",
                letterSpacing: "0.04em",
                display: "block",
                marginBottom: 12,
              }}
            >
              Works with:
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
              {[
                { name: "Claude", w: 52 },
                { name: "ChatGPT", w: 64 },
                { name: "Gemini", w: 56 },
                { name: "Perplexity", w: 78 },
              ].map((p) => (
                <span
                  key={p.name}
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--text-secondary)",
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid var(--border)",
                    background: "var(--bg-tertiary)",
                    fontFamily: "ui-monospace, monospace",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {p.name}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT — sticky interactive graph */}
        <div
          style={{
            position: "sticky",
            top: 60,
            alignSelf: "start",
            height: "calc(100vh - 60px)",
            minHeight: 360,
            borderLeft: "1px solid var(--border)",
            background: "var(--bg-secondary)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
          }}
        >
          <div
            style={{
              padding: "14px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "var(--accent)",
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontFamily: "ui-monospace, monospace",
                color: "var(--text-secondary)",
                letterSpacing: "0.05em",
              }}
            >
              vikram.memory_graph · 14 nodes · 5 vaults
            </span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {["Work", "Goals", "Personal", "Finance", "Study"].map((vault, i) => {
                const colors = ["#378ADD", "#7F77DD", "#5DCAA5", "#EF9F27", "#D4537E"];
                return (
                  <div
                    key={vault}
                    title={vault}
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: colors[i],
                    }}
                  />
                );
              })}
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden" }}>
            <HeroGraph />
          </div>
        </div>
      </section>

      {/* Problem */}
      <section
        className="reveal"
        style={{
          background: "var(--bg-secondary)",
          padding: "120px clamp(24px, 5vw, 80px)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            alignItems: "stretch",
            gap: 0,
            maxWidth: 960,
            margin: "0 auto 56px",
          }}
        >
          {platforms.map((platform, i) => (
            <div key={platform.name} style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: 16,
                  padding: "32px 24px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 12,
                  background: "var(--bg-tertiary)",
                  flex: "1 1 180px",
                  minWidth: 160,
                  maxWidth: 260,
                }}
              >
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "50%",
                    background: platform.color + "22",
                    border: `1px solid ${platform.color}44`,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 18,
                  }}
                >
                  🔒
                </div>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 16,
                    color: "var(--text-primary)",
                  }}
                >
                  {platform.name}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    color: "var(--text-secondary)",
                    textAlign: "center",
                  }}
                >
                  Remembers you here.
                </span>
              </div>
              {i < platforms.length - 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    color: "var(--text-muted)",
                    fontSize: 12,
                    padding: "0 8px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  — ✕ —
                </div>
              )}
            </div>
          ))}
        </div>
        <p
          className="reveal reveal-delay-1"
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: "clamp(22px, 3vw, 36px)",
            fontWeight: 700,
            color: "var(--text-primary)",
            textAlign: "center",
            maxWidth: 720,
            margin: "0 auto 20px",
            lineHeight: 1.35,
          }}
        >
          That&apos;s not a technical limitation. That&apos;s a business model.
        </p>
        <p
          className="reveal reveal-delay-2"
          style={{
            fontSize: "clamp(18px, 2vw, 22px)",
            fontWeight: 500,
            color: "var(--accent)",
            textAlign: "center",
            margin: 0,
          }}
        >
          Memorey is the only memory that&apos;s yours.
        </p>
      </section>

      {/* How it works */}
      <section
        id="how-it-works"
        className="reveal"
        style={{
          padding: "100px clamp(24px, 5vw, 80px)",
          maxWidth: 800,
          margin: "0 auto",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: "clamp(28px, 3vw, 40px)",
            fontWeight: 700,
            marginBottom: 48,
            color: "var(--text-primary)",
          }}
        >
          How it works
        </h2>
        {steps.map((step, i) => (
          <div
            key={step.num}
            className={`reveal reveal-delay-${Math.min(i + 1, 4)}`}
            style={{
              display: "flex",
              gap: 32,
              padding: "40px 0",
              borderBottom: "1px solid var(--border)",
              alignItems: "flex-start",
            }}
          >
            <span
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: 13,
                color: "var(--accent)",
                opacity: 0.6,
                flexShrink: 0,
                paddingTop: 4,
                minWidth: 24,
              }}
            >
              {step.num}
            </span>
            <div>
              <h3
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontSize: "clamp(20px, 2.5vw, 28px)",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: "0 0 12px",
                }}
              >
                {step.title}
              </h3>
              <p
                style={{
                  fontSize: 16,
                  color: "var(--text-secondary)",
                  lineHeight: 1.7,
                  margin: "0 0 12px",
                }}
              >
                {step.desc}
              </p>
              <p
                style={{
                  fontSize: 13,
                  color: "var(--text-muted)",
                  fontFamily: "ui-monospace, monospace",
                  borderLeft: "2px solid var(--border)",
                  paddingLeft: 12,
                  margin: 0,
                }}
              >
                {step.detail}
              </p>
            </div>
          </div>
        ))}
      </section>

      {/* Graph demo / Diff */}
      <section
        id="graph-demo"
        className="reveal"
        style={{
          padding: "100px clamp(24px, 5vw, 80px)",
          background: "var(--bg-primary)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: "clamp(28px, 3vw, 40px)",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 48,
            color: "var(--text-primary)",
          }}
        >
          You approve everything.
        </h2>
        <div
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
            maxWidth: 600,
            margin: "0 auto",
            fontFamily: "ui-sans-serif, sans-serif",
          }}
        >
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--border)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontWeight: 500,
                color: "var(--text-primary)",
              }}
            >
              Review memory update
            </span>
            <span
              style={{
                fontSize: 11,
                background: "#5DCAA533",
                color: "var(--accent)",
                padding: "3px 10px",
                borderRadius: 20,
                fontFamily: "ui-monospace, monospace",
              }}
            >
              ✓ Link deleted at 14:32:07
            </span>
          </div>
          <div
            style={{
              padding: "12px 20px",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              2 work context nodes updated from your Claude conversation.
            </span>
          </div>
          {diffCards.map((card, i) => (
            <div
              key={i}
              style={{
                borderBottom: "1px solid var(--border)",
                borderLeft: `3px solid ${card.color}`,
                padding: "16px 20px",
                display: "flex",
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 3,
                  border: "1.5px solid var(--accent)",
                  background: "var(--accent-dim)",
                  flexShrink: 0,
                  marginTop: 2,
                }}
              />
              <div style={{ flex: 1 }}>
                <div
                  style={{
                    display: "flex",
                    gap: 8,
                    marginBottom: 8,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      background: card.color + "22",
                      color: card.color,
                      padding: "2px 7px",
                      borderRadius: 20,
                    }}
                  >
                    {card.vault}
                  </span>
                  {card.isNew && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        background: "#5DCAA522",
                        color: "var(--accent)",
                        padding: "2px 7px",
                        borderRadius: 20,
                      }}
                    >
                      NEW
                    </span>
                  )}
                </div>
                {!card.isNew && (
                  <div style={{ marginBottom: 6 }}>
                    <span
                      style={{
                        fontSize: 13,
                        color: "#E05C5C",
                        textDecoration: "line-through",
                        opacity: 0.7,
                      }}
                    >
                      {card.oldVal}
                    </span>
                  </div>
                )}
                <div
                  style={{
                    fontSize: 13,
                    color: "#5DCAA5",
                    fontWeight: 500,
                  }}
                >
                  {card.newVal}
                </div>
              </div>
            </div>
          ))}
          <div
            style={{
              padding: "14px 20px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 12,
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
              2 of 2 selected
            </span>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                style={{
                  fontSize: 13,
                  padding: "7px 16px",
                  borderRadius: 8,
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--text-secondary)",
                  cursor: "pointer",
                }}
              >
                Reject all
              </button>
              <button
                type="button"
                style={{
                  fontSize: 13,
                  padding: "7px 16px",
                  borderRadius: 8,
                  background: "var(--accent)",
                  color: accentBtnColor,
                  border: "none",
                  cursor: "pointer",
                  fontWeight: 500,
                }}
              >
                Confirm 2 updates
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Privacy */}
      <section
        id="privacy"
        className="reveal"
        style={{
          padding: "80px clamp(24px, 5vw, 80px)",
          maxWidth: 1000,
          margin: "0 auto",
        }}
      >
        {principles.map((principle) => (
          <div
            key={principle.title}
            className="landing-principle-row reveal"
            style={{
              padding: "48px 0",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <h3
              style={{
                fontFamily: "ui-monospace, monospace",
                fontSize: "clamp(12px, 1.2vw, 14px)",
                letterSpacing: "0.1em",
                color: "var(--text-primary)",
                fontWeight: 500,
                lineHeight: 1.4,
                margin: 0,
              }}
            >
              {principle.title}
            </h3>
            <p
              style={{
                fontSize: 16,
                color: "var(--text-secondary)",
                lineHeight: 1.75,
                margin: 0,
              }}
            >
              {principle.body}
            </p>
          </div>
        ))}
      </section>

      {/* Comparison */}
      <section
        id="comparison"
        className="reveal"
        style={{
          padding: "100px clamp(16px, 4vw, 48px)",
          overflowX: "auto",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: "clamp(26px, 3vw, 36px)",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 48,
            color: "var(--text-primary)",
          }}
        >
          Not the same kind of memory
        </h2>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            minWidth: 640,
            maxWidth: 920,
            margin: "0 auto",
            border: "1px solid var(--border)",
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
              gap: 0,
            }}
          >
            <div
              style={{
                padding: "14px 16px",
                fontSize: 11,
                letterSpacing: "0.08em",
                color: "var(--text-muted)",
                borderBottom: "1px solid var(--border)",
                background: "var(--bg-secondary)",
              }}
            />
            {["mem0", "Supermemory", "Platforms", "Memorey"].map((h, i) => (
              <div
                key={h}
                style={{
                  padding: "14px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  textAlign: "center",
                  color:
                    i === 3 ? "var(--accent)" : "var(--text-secondary)",
                  borderBottom: "1px solid var(--border)",
                  background:
                    i === 3 ? "var(--accent-dim)" : "var(--bg-secondary)",
                  borderTop: i === 3 ? "3px solid var(--accent)" : "none",
                  marginTop: i === 3 ? -2 : 0,
                }}
              >
                {h}
              </div>
            ))}
          </div>
          {comparisonRows.map((row) => (
            <div
              key={row.feature}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 1fr 1fr 1fr",
                gap: 0,
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  fontSize: 14,
                  color: "var(--text-primary)",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-primary)",
                }}
              >
                {row.feature}
              </div>
              <div
                style={{
                  padding: "14px 12px",
                  textAlign: "center",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-primary)",
                }}
              >
                <Cell v={row.mem0} />
              </div>
              <div
                style={{
                  padding: "14px 12px",
                  textAlign: "center",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-primary)",
                }}
              >
                <Cell v={row.supermemory} />
              </div>
              <div
                style={{
                  padding: "14px 12px",
                  textAlign: "center",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-primary)",
                }}
              >
                <Cell v={row.platform} />
              </div>
              <div
                style={{
                  padding: "14px 12px",
                  textAlign: "center",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--accent-dim)",
                }}
              >
                <Cell v={row.memorey} />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section
        id="pricing"
        className="reveal"
        style={{
          padding: "100px clamp(24px, 5vw, 80px)",
          background: "var(--bg-secondary)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: "clamp(28px, 3vw, 40px)",
            fontWeight: 700,
            textAlign: "center",
            marginBottom: 16,
            color: "var(--text-primary)",
          }}
        >
          Pricing
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "var(--text-secondary)",
            marginBottom: 40,
            fontSize: 15,
          }}
        >
          Start free. Upgrade when memory becomes infrastructure.
        </p>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 40,
            justifyContent: "center",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: 14,
              color: annual ? "var(--text-muted)" : "var(--text-primary)",
            }}
          >
            Monthly
          </span>
          <button
            type="button"
            onClick={() => setAnnual(!annual)}
            aria-label="Toggle annual billing"
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              background: annual ? "var(--accent)" : "var(--border)",
              border: "none",
              cursor: "pointer",
              position: "relative",
              transition: "background 0.2s",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 3,
                left: annual ? 23 : 3,
                width: 18,
                height: 18,
                borderRadius: "50%",
                background: "white",
                transition: "left 0.2s",
              }}
            />
          </button>
          <span
            style={{
              fontSize: 14,
              color: annual ? "var(--text-primary)" : "var(--text-muted)",
            }}
          >
            Annually
            <span
              style={{
                marginLeft: 6,
                fontSize: 11,
                background: "var(--accent-dim)",
                color: "var(--accent)",
                padding: "2px 6px",
                borderRadius: 8,
                fontWeight: 500,
              }}
            >
              Save 21%
            </span>
          </span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
            maxWidth: 880,
            margin: "0 auto",
          }}
        >
          {plans.map((plan) => (
            <div
              key={plan.name}
              style={{
                border: plan.featured
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                borderRadius: 16,
                padding: "36px 28px",
                background: plan.featured
                  ? "var(--bg-tertiary)"
                  : "var(--bg-primary)",
                boxShadow: plan.featured
                  ? "0 12px 40px rgba(0,0,0,0.12)"
                  : "none",
                position: "relative",
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: "0.12em",
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                {plan.badge.toUpperCase()}
              </span>
              <h3
                style={{
                  fontFamily: "var(--font-playfair), serif",
                  fontSize: 28,
                  fontWeight: 700,
                  margin: "12px 0 8px",
                  color: "var(--text-primary)",
                }}
              >
                {plan.name}
              </h3>
              <div style={{ marginBottom: 8 }}>
                <span
                  style={{
                    fontSize: 36,
                    fontWeight: 700,
                    color: "var(--text-primary)",
                  }}
                >
                  {plan.price}
                </span>
                {"priceSub" in plan && plan.priceSub ? (
                  <span
                    style={{
                      fontSize: 14,
                      color: "var(--text-muted)",
                      marginLeft: 4,
                    }}
                  >
                    {plan.priceSub}
                  </span>
                ) : null}
              </div>
              <p
                style={{
                  fontSize: 14,
                  color: "var(--text-secondary)",
                  marginBottom: 24,
                }}
              >
                {plan.sub}
              </p>
              <ul
                style={{
                  listStyle: "none",
                  padding: 0,
                  margin: "0 0 28px",
                }}
              >
                {plan.features.map((f) => (
                  <li
                    key={f}
                    style={{
                      fontSize: 14,
                      color: "var(--text-secondary)",
                      marginBottom: 10,
                      paddingLeft: 20,
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        color: "var(--accent)",
                      }}
                    >
                      ✓
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={plan.href}
                style={{
                  display: "block",
                  textAlign: "center",
                  fontSize: 14,
                  fontWeight: 600,
                  padding: "12px 20px",
                  borderRadius: 10,
                  textDecoration: "none",
                  background:
                    plan.ctaStyle === "primary"
                      ? "var(--accent)"
                      : "transparent",
                  color:
                    plan.ctaStyle === "primary"
                      ? accentBtnColor
                      : "var(--text-primary)",
                  border:
                    plan.ctaStyle === "ghost"
                      ? "1px solid var(--border)"
                      : "none",
                }}
              >
                {plan.cta}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section
        className="reveal"
        style={{
          textAlign: "center",
          padding: "clamp(80px, 10vw, 160px) clamp(24px, 5vw, 80px)",
          background: "var(--bg-secondary)",
          borderTop: "1px solid var(--border)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-playfair), serif",
            fontSize: "clamp(32px, 5vw, 64px)",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: 16,
            lineHeight: 1.15,
          }}
        >
          You&apos;ve explained yourself enough.
        </h2>
        <p
          style={{
            fontSize: 18,
            color: "var(--text-secondary)",
            marginBottom: 40,
            lineHeight: 1.6,
          }}
        >
          Your memory. Portable. Private. Yours.
        </p>
        <a
          href="/login"
          style={{
            display: "inline-block",
            background: "var(--accent)",
            color: accentBtnColor,
            padding: "14px 36px",
            borderRadius: 10,
            fontSize: 16,
            fontWeight: 600,
            textDecoration: "none",
            transition: "opacity 0.2s",
          }}
        >
          Start remembering →
        </a>
        <p
          style={{
            marginTop: 16,
            fontSize: 13,
            color: "var(--text-muted)",
          }}
        >
          Free forever · No credit card · Works with every AI
        </p>
      </section>

      {/* Footer */}
      <footer
        className="reveal"
        style={{
          borderTop: "1px solid var(--border)",
          padding: "48px clamp(24px, 5vw, 80px)",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: 40,
          background: "var(--bg-primary)",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
            }}
          >
            <MemoreyLogo size={20} />
            <span
              style={{
                fontWeight: 500,
                fontSize: 14,
                color: "var(--text-primary)",
              }}
            >
              memorey
            </span>
          </div>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              lineHeight: 1.6,
              margin: 0,
            }}
          >
            Your memory.
            <br />
            For every AI you use.
          </p>
        </div>
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            PRODUCT
          </p>
          {["Graph", "Capture", "Export", "Extension", "MCP Server"].map(
            (item) => (
              <a
                key={item}
                href="/login"
                style={{
                  display: "block",
                  fontSize: 13,
                  color: "var(--text-secondary)",
                  textDecoration: "none",
                  marginBottom: 8,
                  transition: "color 0.2s",
                }}
              >
                {item}
              </a>
            )
          )}
        </div>
        <div>
          <p
            style={{
              fontSize: 11,
              letterSpacing: "0.1em",
              color: "var(--text-muted)",
              marginBottom: 12,
            }}
          >
            LEGAL
          </p>
          {[
            { label: "Privacy Policy", href: "/privacy" },
            { label: "Terms of Service", href: "/terms" },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              style={{
                display: "block",
                fontSize: 13,
                color: "var(--text-secondary)",
                textDecoration: "none",
                marginBottom: 8,
              }}
            >
              {item.label}
            </a>
          ))}
        </div>
      </footer>

      <div
        style={{
          borderTop: "1px solid var(--border)",
          padding: "16px clamp(24px, 5vw, 80px)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          background: "var(--bg-primary)",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          © 2026 Memorey · Bengaluru, India
        </span>
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          Built with privacy at its core
        </span>
      </div>
    </div>
  );
}
