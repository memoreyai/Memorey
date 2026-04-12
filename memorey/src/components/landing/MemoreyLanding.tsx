"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Lock, Menu, X } from "lucide-react";
import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";
import { HeroGraphCanvas } from "@/components/landing/HeroGraphCanvas";

const MemoreyLandingGraph = dynamic(() => import("@/components/landing/MemoreyLandingGraph"), {
  ssr: false,
  loading: () => (
    <div
      className="flex min-h-[300px] items-center justify-center rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0F0F10] text-sm"
      style={{ color: "#6B6966" }}
    >
      Loading graph…
    </div>
  ),
});

const ink = "#F0EFE9";
const muted = "#6B6966";
const accent = "#5DCAA5";
const hostile = "#E05C5C";
const voidBg = "#0A0A0B";
const problemBg = "#0F0F10";
const border = "rgba(255,255,255,0.08)";
const amberApi = "rgba(212, 165, 100, 0.85)";

function AiLogosRow() {
  return (
    <div className="mt-6 flex flex-wrap items-center justify-center gap-6 opacity-80">
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden className="shrink-0">
        <circle cx="18" cy="18" r="16" fill="#10A37F" opacity="0.9" />
        <path d="M12 22 L18 10 L24 22 M14 18 H22" stroke="#0A0A0B" strokeWidth="1.8" fill="none" />
      </svg>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden className="shrink-0">
        <rect x="4" y="4" width="28" height="28" rx="6" fill="#D4A574" />
        <path d="M10 24 L14 12 L18 24 M16 18 H22" stroke="#0A0A0B" strokeWidth="1.5" fill="none" />
      </svg>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden className="shrink-0">
        <circle cx="18" cy="18" r="16" fill="#4285F4" />
        <path d="M18 10 v16 M10 18 h16" stroke="white" strokeWidth="2" />
      </svg>
      <svg width="36" height="36" viewBox="0 0 36 36" aria-hidden className="shrink-0">
        <rect x="4" y="4" width="28" height="28" rx="8" fill="#14B8A6" />
        <circle cx="18" cy="18" r="6" fill="none" stroke="#0A0A0B" strokeWidth="2" />
        <circle cx="18" cy="18" r="2" fill="#0A0A0B" />
      </svg>
    </div>
  );
}

function BrokenChain() {
  return (
    <svg
      width="48"
      height="24"
      viewBox="0 0 48 24"
      className="mx-auto shrink-0 text-[#E05C5C]/50 md:mx-0"
      aria-hidden
    >
      <path
        d="M4 12h8 M14 8a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3 M14 12h6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path d="M28 12h6 M36 8a3 3 0 0 1 3 3v2a3 3 0 0 1-3 3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="22" y1="6" x2="26" y2="18" stroke="currentColor" strokeWidth="1.2" strokeDasharray="2 2" />
    </svg>
  );
}

export function MemoreyLanding() {
  const navRef = useRef<HTMLElement>(null);
  const pricingRef = useRef<HTMLDivElement>(null);
  const problemRef = useRef<HTMLDivElement>(null);
  const stepsRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [waitlistDone, setWaitlistDone] = useState(false);

  useEffect(() => {
    const nav = navRef.current;
    const onScroll = () => {
      if (!nav) return;
      if (window.scrollY > 20) nav.classList.add("memorey-nav-scrolled");
      else nav.classList.remove("memorey-nav-scrolled");
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) e.target.classList.add("memorey-reveal-visible");
        });
      },
      { threshold: 0.1 }
    );
    document.querySelectorAll(".memorey-reveal").forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const root = problemRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) root.classList.add("memorey-jail-visible");
      },
      { threshold: 0.2 }
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const root = stepsRef.current;
    if (!root) return;
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.querySelectorAll(".memorey-step-card").forEach((card, i) => {
              window.setTimeout(() => card.classList.add("memorey-step-visible"), i * 100);
            });
          }
        });
      },
      { threshold: 0.15 }
    );
    obs.observe(root);
    return () => obs.disconnect();
  }, []);

  const setPricingAnnual = (annual: boolean) => {
    pricingRef.current?.classList.toggle("memorey-pricing-annual", annual);
    const m = document.getElementById("memorey-toggle-m");
    const a = document.getElementById("memorey-toggle-a");
    if (m && a) {
      m.setAttribute("aria-pressed", annual ? "false" : "true");
      a.setAttribute("aria-pressed", annual ? "true" : "false");
      m.classList.toggle("bg-[#5DCAA5]/20", !annual);
      m.classList.toggle("text-[#F0EFE9]", !annual);
      a.classList.toggle("bg-[#5DCAA5]/20", annual);
      a.classList.toggle("text-[#F0EFE9]", annual);
    }
  };

  return (
    <div
      className="min-h-screen antialiased selection:bg-[#5DCAA5]/20"
      style={{ backgroundColor: voidBg, color: ink }}
    >
      {/* —— NAV —— */}
      <header
        ref={navRef}
        className="memorey-nav fixed left-0 right-0 top-0 z-50 flex h-16 items-center justify-between border-b border-transparent px-4 md:px-8"
        style={{ borderColor: "transparent" }}
      >
        <Link href="/" className="flex items-center gap-2 transition-opacity duration-200 hover:opacity-90">
          <MemoreyLogo size={36} showWordmark />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          <a
            href="#how-it-works"
            className="text-sm transition-colors duration-200"
            style={{ color: muted }}
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="text-sm transition-colors duration-200"
            style={{ color: muted }}
          >
            Pricing
          </a>
          <Link
            href="/login"
            className="rounded-xl border px-4 py-2 text-sm transition-all duration-200"
            style={{ borderColor: border, color: ink }}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-xl px-5 py-2.5 text-sm font-medium text-[#0A0A0B] transition-opacity duration-200 hover:opacity-92"
            style={{ backgroundColor: accent }}
          >
            Start free
          </Link>
        </nav>

        <button
          type="button"
          className="flex h-10 w-10 items-center justify-center rounded-lg md:hidden"
          style={{ color: ink }}
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          onClick={() => setMenuOpen((o) => !o)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </header>

      {menuOpen && (
        <div
          className="fixed inset-0 z-40 flex flex-col bg-[#0A0A0B] pt-20 md:hidden"
          style={{ borderTop: `1px solid ${border}` }}
        >
          <a
            href="#how-it-works"
            className="border-b px-6 py-5 text-lg"
            style={{ borderColor: border, color: ink }}
            onClick={() => setMenuOpen(false)}
          >
            How it works
          </a>
          <a
            href="#pricing"
            className="border-b px-6 py-5 text-lg"
            style={{ borderColor: border, color: ink }}
            onClick={() => setMenuOpen(false)}
          >
            Pricing
          </a>
          <Link href="/login" className="border-b px-6 py-5 text-lg" style={{ borderColor: border }} onClick={() => setMenuOpen(false)}>
            Sign in
          </Link>
          <Link
            href="/login"
            className="mx-6 mt-6 rounded-xl py-4 text-center font-medium text-[#0A0A0B]"
            style={{ backgroundColor: accent }}
            onClick={() => setMenuOpen(false)}
          >
            Start free
          </Link>
        </div>
      )}

      {/* —— HERO —— */}
      <section
        className="relative flex min-h-[100dvh] flex-col items-center justify-center px-5 pb-20 pt-24"
        style={{ backgroundColor: voidBg }}
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <HeroGraphCanvas />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse 75% 60% at 50% 45%, transparent 0%, #0A0A0B 70%)",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto w-full max-w-[680px] text-center">
          <p
            className="memorey-hero-piece memorey-hero-d0 mx-auto mb-8 inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs tracking-[0.15em] uppercase"
            style={{ borderColor: border, color: muted }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: accent }} />
            Human-first AI memory
          </p>

          <h1
            className="memorey-hero-piece memorey-hero-d1 text-[44px] font-normal leading-[1.08] tracking-[-0.02em] md:text-[72px] md:leading-[1.05]"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif", color: ink }}
          >
            Every AI you use
            <br />
            starts from zero.
          </h1>

          <p
            className="memorey-hero-piece memorey-hero-d2 mt-6 text-[22px] font-medium md:text-[24px]"
            style={{ color: "#C8C4BC" }}
          >
            Memorey doesn&apos;t.
          </p>

          <p
            className="memorey-hero-piece memorey-hero-d3 mx-auto mt-4 max-w-md text-base leading-[1.75]"
            style={{ color: muted }}
          >
            One graph. Every AI. You in control.
          </p>

          <div className="memorey-hero-piece memorey-hero-d4 mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/login"
              className="flex h-12 w-full max-w-xs items-center justify-center rounded-[20px] text-base font-medium text-[#0A0A0B] transition-opacity duration-200 hover:opacity-90 sm:w-auto sm:min-w-[240px]"
              style={{ backgroundColor: accent }}
            >
              Start free — no card needed
            </Link>
            <a
              href="#how-it-works"
              className="flex h-12 w-full max-w-xs items-center justify-center gap-2 rounded-[20px] border text-base transition-all duration-200 sm:w-auto sm:min-w-[200px]"
              style={{ borderColor: border, color: ink }}
            >
              See how it works
              <ArrowRight className="h-4 w-4" />
            </a>
          </div>

          <p className="memorey-hero-piece memorey-hero-d4 mt-8 text-sm" style={{ color: muted }}>
            Privacy-first · Works with Claude, ChatGPT, Gemini, Perplexity +
          </p>
          <AiLogosRow />
        </div>
      </section>

      {/* —— PROBLEM —— */}
      <section
        ref={problemRef}
        className="memorey-reveal border-t px-5 py-[120px] md:px-10"
        style={{ backgroundColor: problemBg, borderColor: border }}
      >
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row md:gap-4">
            <div
              className="memorey-jail-a flex h-36 w-full max-w-[200px] flex-col items-center justify-center rounded-2xl border md:w-[200px]"
              style={{ borderColor: `${hostile}40`, backgroundColor: "rgba(224,92,92,0.04)" }}
            >
              <span className="text-sm tracking-[0.15em] uppercase" style={{ color: hostile }}>
                ChatGPT
              </span>
              <Lock className="mt-3 h-6 w-6" style={{ color: `${hostile}99` }} aria-hidden />
            </div>
            <BrokenChain />
            <div
              className="memorey-jail-b flex h-36 w-full max-w-[200px] flex-col items-center justify-center rounded-2xl border md:w-[200px]"
              style={{ borderColor: `${hostile}40`, backgroundColor: "rgba(224,92,92,0.04)" }}
            >
              <span className="text-sm tracking-[0.15em] uppercase" style={{ color: hostile }}>
                Claude
              </span>
              <Lock className="mt-3 h-6 w-6" style={{ color: `${hostile}99` }} aria-hidden />
            </div>
            <BrokenChain />
            <div
              className="memorey-jail-c flex h-36 w-full max-w-[200px] flex-col items-center justify-center rounded-2xl border md:w-[200px]"
              style={{ borderColor: `${hostile}40`, backgroundColor: "rgba(224,92,92,0.04)" }}
            >
              <span className="text-sm tracking-[0.15em] uppercase" style={{ color: hostile }}>
                Gemini
              </span>
              <Lock className="mt-3 h-6 w-6" style={{ color: `${hostile}99` }} aria-hidden />
            </div>
          </div>

          <h2
            className="mx-auto mt-20 max-w-3xl text-center text-[clamp(1.5rem,4vw,2.25rem)] font-medium leading-tight"
            style={{ color: ink }}
          >
            They built memory to keep you.{" "}
            <span style={{ color: hostile }}>Not to serve you.</span>
          </h2>
          <div
            className="mx-auto mt-10 max-w-2xl space-y-4 text-center text-base leading-[1.75] md:text-lg"
            style={{ color: muted }}
          >
            <p>ChatGPT remembers you in ChatGPT.</p>
            <p>Claude remembers you in Claude.</p>
            <p>Neither remembers you in the other.</p>
            <p className="font-medium text-[#9A9690]">
              That&apos;s not an accident. That&apos;s a business model.
            </p>
          </div>
          <p
            className="mx-auto mt-14 text-center text-xl font-medium md:text-2xl"
            style={{ color: accent }}
          >
            Memorey is the only memory that&apos;s yours.
          </p>
        </div>
      </section>

      {/* —— HOW IT WORKS —— */}
      <section
        id="how-it-works"
        className="memorey-reveal scroll-mt-20 border-t px-5 py-[120px] md:px-10"
        style={{ backgroundColor: voidBg, borderColor: border }}
      >
        <h2 className="text-center text-[clamp(1.5rem,3.5vw,2rem)] font-medium" style={{ color: ink }}>
          Three moves. Then it never forgets.
        </h2>
        <div
          ref={stepsRef}
          className="mx-auto mt-16 grid max-w-5xl gap-12 md:grid-cols-3 md:gap-8"
        >
          {[
            {
              n: "01",
              title: "Share a conversation.",
              body: "Paste a link from any AI. Memorey reads it and forgets the link.",
              illus: (
                <div className="relative mx-auto h-32 max-w-[220px] rounded-lg border p-3 text-left text-[10px]" style={{ borderColor: border }}>
                  <div className="truncate font-mono opacity-60">https://chat.openai.com/c/…</div>
                  <div
                    className="memorey-anim-link mt-2 truncate rounded bg-[#141416] px-2 py-1 font-mono"
                    style={{ color: accent }}
                  >
                    …/conversation/shared
                  </div>
                </div>
              ),
              icon: (
                <svg className="h-8 w-8" viewBox="0 0 32 32" fill="none" aria-hidden>
                  <path
                    d="M8 16h16M20 12l4 4-4 4"
                    stroke={accent}
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                </svg>
              ),
            },
            {
              n: "02",
              title: "Approve what changes.",
              body: "You see exactly what updates. Nothing saves without your say.",
              illus: (
                <div className="mx-auto max-w-[220px] space-y-2 rounded-lg border p-3 text-left text-[11px]" style={{ borderColor: border }}>
                  <p className="line-through opacity-50">React + JavaScript</p>
                  <p className="memorey-anim-diff-new font-medium" style={{ color: accent }}>
                    Next.js 14 + TypeScript
                  </p>
                </div>
              ),
              icon: (
                <svg className="h-8 w-8" viewBox="0 0 32 32" fill="none" aria-hidden>
                  <path d="M8 16l6 6 12-12" stroke={accent} strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ),
            },
            {
              n: "03",
              title: "Brief any AI, instantly.",
              body: "One click. Your full context. Any platform. Under 60 seconds.",
              illus: (
                <div className="flex justify-center pt-4">
                  <span
                    className="memorey-anim-badge rounded-full px-4 py-2 text-[10px] font-medium tracking-wide"
                    style={{
                      backgroundColor: "rgba(93,202,165,0.15)",
                      color: accent,
                      border: `1px solid ${accent}44`,
                    }}
                  >
                    Context injected
                  </span>
                </div>
              ),
              icon: (
                <svg className="h-8 w-8" viewBox="0 0 32 32" fill="none" aria-hidden>
                  <path
                    d="M18 4L8 18h6l-2 10 12-16h-6l2-8z"
                    stroke={accent}
                    strokeWidth="1.4"
                    fill="none"
                    strokeLinejoin="round"
                  />
                </svg>
              ),
            },
          ].map((step) => (
            <div key={step.n} className="memorey-step-card text-center md:text-left">
              <span
                className="text-5xl font-extralight tabular-nums md:text-6xl"
                style={{ color: accent }}
              >
                {step.n}
              </span>
              <div className="mt-4 flex justify-center md:justify-start">{step.icon}</div>
              <div className="mt-4">{step.illus}</div>
              <h3 className="mt-6 text-lg font-medium" style={{ color: ink }}>
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-[1.75]" style={{ color: muted }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* —— GRAPH DEMO —— */}
      <section
        className="memorey-reveal border-t px-5 py-[120px] md:px-10"
        style={{ backgroundColor: problemBg, borderColor: border }}
      >
        <div className="mx-auto max-w-4xl">
          <h2 className="text-center text-[clamp(1.5rem,3.5vw,2rem)] font-medium" style={{ color: ink }}>
            Your thinking. Visualized.
          </h2>
          <div className="mt-12">
            <MemoreyLandingGraph />
          </div>
          <p className="mt-6 text-center text-sm" style={{ color: muted }}>
            This is your graph after one week.
          </p>
          <p
            className="mx-auto mt-10 max-w-xl text-center text-base leading-[1.75]"
            style={{ color: muted }}
          >
            Every node. Every connection. Every category.
            <br />
            <span style={{ color: ink }}>You decide what gets built. You decide what gets shared.</span>
          </p>
        </div>
      </section>

      {/* —— DIFF MOCKUP —— */}
      <section
        className="memorey-reveal border-t px-5 py-[120px] md:px-10"
        style={{ backgroundColor: voidBg, borderColor: border }}
      >
        <div className="mx-auto max-w-3xl">
          <h2 className="text-center text-[clamp(1.5rem,3.5vw,2rem)] font-medium" style={{ color: ink }}>
            You approve everything.
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-center text-base leading-[1.75]" style={{ color: muted }}>
            Every update shows you exactly what changes and what stays.
          </p>

          <div
            className="mt-12 rounded-2xl border p-6 md:p-8"
            style={{ borderColor: border, backgroundColor: "#0C0C0D" }}
          >
            <p className="text-sm font-medium" style={{ color: ink }}>
              TL;DR:{" "}
              <span style={{ color: muted }}>3 work context nodes updated from your ChatGPT conversation.</span>
            </p>
            <span
              className="mt-3 inline-block rounded-md px-2 py-1 text-xs font-medium"
              style={{ backgroundColor: "rgba(93,202,165,0.12)", color: accent }}
            >
              Link deleted at 14:32:07
            </span>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border p-4" style={{ borderColor: border }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs tracking-[0.15em] uppercase" style={{ color: accent }}>
                    Work
                  </span>
                </div>
                <p className="mt-2 font-medium" style={{ color: ink }}>
                  Primary stack
                </p>
                <p className="mt-2 text-sm line-through opacity-45">React + JavaScript</p>
                <p className="mt-1 text-sm" style={{ color: accent }}>
                  Next.js 14 + TypeScript + Supabase
                </p>
              </div>
              <div className="rounded-xl border p-4" style={{ borderColor: border }}>
                <div className="flex items-center justify-between">
                  <span className="text-xs tracking-[0.15em] uppercase" style={{ color: accent }}>
                    Work
                  </span>
                  <span className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase" style={{ backgroundColor: `${accent}22`, color: accent }}>
                    New
                  </span>
                </div>
                <p className="mt-2 font-medium" style={{ color: ink }}>
                  Current project
                </p>
                <p className="mt-2 text-sm" style={{ color: accent }}>
                  Building Memorey — portable AI memory graph
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-xl px-6 py-3 text-sm font-medium text-[#0A0A0B]"
                style={{ backgroundColor: accent }}
              >
                Confirm 3 updates
              </button>
              <button
                type="button"
                className="rounded-xl border px-6 py-3 text-sm transition-colors duration-200"
                style={{ borderColor: border, color: muted }}
              >
                Reject all
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* —— PRIVACY —— */}
      <section
        className="memorey-reveal border-t px-5 py-[120px] md:px-10"
        style={{ backgroundColor: problemBg, borderColor: border }}
      >
        <h2 className="mx-auto max-w-3xl text-center text-[clamp(1.5rem,3.5vw,2rem)] font-medium" style={{ color: ink }}>
          Privacy isn&apos;t a toggle. It&apos;s the architecture.
        </h2>
        <div className="mx-auto mt-16 max-w-4xl divide-y" style={{ borderColor: border }}>
          {[
            {
              t: "LINKS VANISH THE MOMENT THEY'RE READ.",
              d: "We parse your shared conversation and delete the link immediately. We store what it means. Never what it said.",
            },
            {
              t: "YOUR HEALTH DATA NEVER TOUCHES YOUR WORK EXPORT.",
              d: "Every vault is isolated at the database level. Not application logic. Not settings. The database itself refuses.",
            },
            {
              t: "NOTHING SAVES WITHOUT YOU SAYING SO. EVER.",
              d: "There are no background mutations. No silent learning. Every change passes through the diff. Every confirmation is a conscious choice.",
            },
          ].map((row) => (
            <div key={row.t} className="py-12 first:pt-0">
              <p
                className="text-sm font-medium tracking-[0.15em] md:text-base"
                style={{
                  fontFamily:
                    'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace), monospace',
                  color: ink,
                }}
              >
                {row.t}
              </p>
              <p className="mt-4 max-w-2xl text-base leading-[1.75]" style={{ color: muted }}>
                {row.d}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* —— COMPARISON —— */}
      <section
        className="memorey-reveal border-t px-5 py-[120px] md:px-10"
        style={{ backgroundColor: voidBg, borderColor: border }}
      >
        <h2 className="text-center text-[clamp(1.5rem,3.5vw,2rem)] font-medium" style={{ color: ink }}>
          Memory tools exist. Memorey is different.
        </h2>
        <div className="mx-auto mt-12 max-w-5xl overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${border}` }}>
                <th className="pb-4 pr-4 font-medium" style={{ color: muted }}>
                  Feature
                </th>
                <th className="pb-4 px-2 font-normal" style={{ color: muted }}>
                  Mem0
                </th>
                <th className="pb-4 px-2 font-normal" style={{ color: muted }}>
                  Supermemory
                </th>
                <th className="pb-4 px-2 font-normal" style={{ color: muted }}>
                  Platform memory
                </th>
                <th
                  className="rounded-t-lg border-x border-t pb-4 pl-4 pr-2 font-medium"
                  style={{
                    borderColor: border,
                    backgroundColor: "rgba(93,202,165,0.06)",
                    borderLeft: `3px solid ${accent}`,
                    color: ink,
                  }}
                >
                  Memorey
                </th>
              </tr>
            </thead>
            <tbody>
              {[
                ["Built for humans (not developers)", "✗", "✗", "✗", "✓"],
                ["Works across all AI platforms", "API only", "API only", "✗ Siloed", "✓"],
                ["You control every update", "✗", "✗", "✗", "✓"],
                ["Visual graph of your memory", "✗", "✗", "✗", "✓"],
                ["Vault isolation (Work ≠ Health)", "✗", "✗", "✗", "✓"],
                ["Free tier with browser extension", "✗", "✗", "N/A", "✓"],
                ["Links deleted after parsing", "✗", "✗", "N/A", "✓"],
              ].map(([feat, m0, sm, plat, mem]) => (
                <tr key={feat as string} style={{ borderBottom: `1px solid ${border}` }}>
                  <td className="py-4 pr-4" style={{ color: ink }}>
                    {feat}
                  </td>
                  <td className="py-4 px-2" style={{ color: m0 === "API only" ? amberApi : hostile, opacity: m0 === "✗" ? 0.55 : 1 }}>
                    {m0}
                  </td>
                  <td className="py-4 px-2" style={{ color: sm === "API only" ? amberApi : hostile, opacity: sm === "✗" ? 0.55 : 1 }}>
                    {sm}
                  </td>
                  <td className="py-4 px-2" style={{ color: plat.includes("API") ? amberApi : hostile, opacity: 0.75 }}>
                    {plat}
                  </td>
                  <td
                    className="border-x py-4 pl-4 pr-2 font-medium"
                    style={{
                      borderColor: border,
                      backgroundColor: "rgba(93,202,165,0.04)",
                      borderLeft: `3px solid ${accent}`,
                      color: accent,
                    }}
                  >
                    {mem}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* —— PRICING —— */}
      <section
        id="pricing"
        className="memorey-reveal scroll-mt-20 border-t px-5 py-[120px] md:px-10"
        style={{ backgroundColor: problemBg, borderColor: border }}
      >
        <h2 className="text-center text-[clamp(1.5rem,3.5vw,2rem)] font-medium" style={{ color: ink }}>
          Start free. Own your memory forever.
        </h2>

        <div ref={pricingRef} className="memorey-landing-pricing mx-auto mt-10 max-w-4xl">
          <div className="mb-10 flex flex-wrap items-center justify-center gap-3">
            <span className="text-sm" style={{ color: muted }}>
              Monthly / Annually (save 21%)
            </span>
            <div
              className="flex rounded-full border p-1"
              style={{ borderColor: border }}
              role="group"
              aria-label="Billing period"
            >
              <button
                type="button"
                id="memorey-toggle-m"
                className="rounded-full px-4 py-2 text-sm transition-all duration-200 bg-[#5DCAA5]/20 text-[#F0EFE9]"
                aria-pressed="true"
                onClick={() => setPricingAnnual(false)}
              >
                Monthly
              </button>
              <button
                type="button"
                id="memorey-toggle-a"
                className="rounded-full px-4 py-2 text-sm transition-all duration-200"
                style={{ color: muted }}
                aria-pressed="false"
                onClick={() => setPricingAnnual(true)}
              >
                Annually
              </button>
            </div>
          </div>
          <p className="mb-8 text-center text-sm" style={{ color: muted }}>
            Save 21% annually — $15/month, billed $180/year.
          </p>

          <div className="grid gap-8 md:grid-cols-2">
            <div className="flex flex-col rounded-2xl border p-8 md:p-10" style={{ borderColor: border }}>
              <span
                className="w-fit rounded-full px-3 py-1 text-xs tracking-[0.15em] uppercase"
                style={{ backgroundColor: "rgba(255,255,255,0.06)", color: muted }}
              >
                Free — Always
              </span>
              <p className="mt-6 text-4xl font-medium tabular-nums" style={{ color: ink }}>
                $0
              </p>
              <p className="mt-2 text-sm leading-[1.75]" style={{ color: muted }}>
                100 memories across your most important contexts. Browser extension included. No credit
                card.
              </p>
              <ul className="mt-8 flex-1 space-y-3 text-sm leading-[1.75]" style={{ color: muted }}>
                {[
                  "100 memory nodes",
                  "3 active vaults",
                  "5 conversation imports per month",
                  "Browser extension (inject context)",
                  "JSON export",
                  "Ask your graph (5 queries/mo)",
                ].map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
              <Link
                href="/login"
                className="mt-10 block rounded-xl border py-4 text-center text-sm font-medium transition-colors duration-200"
                style={{ borderColor: border, color: ink }}
              >
                Start free →
              </Link>
            </div>

            <div
              className="relative flex flex-col rounded-2xl border-2 p-8 md:p-10"
              style={{ borderColor: `${accent}55`, backgroundColor: "rgba(93,202,165,0.03)" }}
            >
              <span
                className="w-fit rounded-full px-3 py-1 text-xs tracking-[0.15em] uppercase"
                style={{ backgroundColor: `${accent}18`, color: accent }}
              >
                Most popular
              </span>
              <div className="memorey-when-monthly mt-6">
                <p className="text-4xl font-medium tabular-nums" style={{ color: ink }}>
                  $19<span className="text-lg font-normal">/month</span>
                </p>
                <p className="mt-2 text-sm" style={{ color: muted }}>
                  $15/month if annual
                </p>
              </div>
              <div className="memorey-when-annual mt-6">
                <p className="text-4xl font-medium tabular-nums" style={{ color: ink }}>
                  $15<span className="text-lg font-normal">/month</span>
                </p>
                <p className="mt-2 text-sm line-through opacity-50">$19/month</p>
                <p className="text-xs" style={{ color: muted }}>
                  Billed $180/year
                </p>
              </div>
              <p className="mt-4 text-sm leading-[1.75]" style={{ color: muted }}>
                Unlimited memories. All vaults. Every export format. Full MCP access. The extension that
                briefs every AI you open.
              </p>
              <ul className="mt-8 flex-1 space-y-3 text-sm leading-[1.75]" style={{ color: muted }}>
                {[
                  "Unlimited memory nodes",
                  "All 9 vaults + custom vaults",
                  "Unlimited conversation imports",
                  "Browser extension (inject + capture)",
                  "JSON, Markdown, TOML export",
                  "Unlimited graph queries",
                  "MCP server access (Claude Desktop, Cursor)",
                  "Priority support",
                ].map((x) => (
                  <li key={x}>· {x}</li>
                ))}
              </ul>
              <Link
                href="/login"
                className="mt-10 block rounded-xl py-4 text-center text-sm font-medium text-[#0A0A0B] transition-opacity duration-200 hover:opacity-90"
                style={{ backgroundColor: accent }}
              >
                Start 14-day trial →
              </Link>
              <p className="mt-3 text-center text-xs" style={{ color: muted }}>
                No credit card required for trial
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* —— EARLY ADOPTERS —— */}
      <section
        className="memorey-reveal border-t px-5 py-[120px] md:px-10"
        style={{ backgroundColor: voidBg, borderColor: border }}
      >
        <h2 className="text-center text-[clamp(1.5rem,3.5vw,2rem)] font-medium" style={{ color: ink }}>
          Built for founders who live in AI.
        </h2>
        <div className="mx-auto mt-14 grid max-w-5xl gap-6 md:grid-cols-3">
          {[
            {
              title: "The Founder",
              body: "You're using Claude for strategy, ChatGPT for writing, Cursor for code. None of them know what the others know about your startup.",
            },
            {
              title: "The Developer",
              body: "Every new Cursor session, you paste the same codebase context. Every Claude conversation, you re-explain your tech stack. There's a better way.",
            },
            {
              title: "The Consultant",
              body: "You maintain context on 6 clients across 3 AI tools. One mistake and the wrong context goes to the wrong client.",
            },
          ].map((c) => (
            <div key={c.title} className="rounded-2xl border p-6" style={{ borderColor: border }}>
              <p className="text-xs tracking-[0.15em] uppercase" style={{ color: accent }}>
                {c.title}
              </p>
              <p className="mt-4 text-sm leading-[1.75]" style={{ color: muted }}>
                {c.body}
              </p>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-16 max-w-md text-center">
          <p className="text-sm font-medium" style={{ color: ink }}>
            Join the waitlist. Be one of the first 500.
          </p>
          {waitlistDone ? (
            <p className="mt-4 text-sm" style={{ color: accent }}>
              You&apos;re on the list. We&apos;ll be in touch.
            </p>
          ) : (
            <form
              className="mt-6 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                setWaitlistDone(true);
              }}
            >
              <input
                type="email"
                required
                placeholder="you@company.com"
                className="h-12 flex-1 rounded-xl border bg-transparent px-4 text-sm outline-none transition-colors duration-200 focus:border-[#5DCAA5]/50"
                style={{ borderColor: border, color: ink }}
              />
              <button
                type="submit"
                className="h-12 shrink-0 rounded-xl px-6 text-sm font-medium text-[#0A0A0B]"
                style={{ backgroundColor: accent }}
              >
                Join waitlist
              </button>
            </form>
          )}
        </div>
      </section>

      {/* —— FINAL CTA —— */}
      <section
        className="memorey-reveal relative overflow-hidden border-t px-5 py-32 md:py-40"
        style={{ backgroundColor: voidBg, borderColor: border }}
      >
        <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
          <HeroGraphCanvas />
        </div>
        <div className="relative z-10 mx-auto max-w-2xl text-center">
          <h2
            className="text-[clamp(2rem,5vw,3rem)] font-normal leading-tight"
            style={{ fontFamily: "var(--font-playfair), Georgia, serif", color: ink }}
          >
            You&apos;ve explained yourself enough.
          </h2>
          <p className="mt-6 text-lg leading-[1.75]" style={{ color: muted }}>
            Your memory. Portable. Private. Yours.
          </p>
          <Link
            href="/login"
            className="mt-10 inline-flex h-[52px] min-w-[220px] items-center justify-center rounded-xl px-8 text-base font-medium text-[#0A0A0B] transition-opacity duration-200 hover:opacity-90"
            style={{ backgroundColor: accent }}
          >
            Start remembering →
          </Link>
          <p className="mt-6 text-sm" style={{ color: muted }}>
            Free forever · No credit card · Works with every AI
          </p>
        </div>
      </section>

      {/* —— FOOTER —— */}
      <footer className="border-t px-5 py-16 md:px-10" style={{ borderColor: border, backgroundColor: problemBg }}>
        <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-4">
          <div>
            <MemoreyLogo size={32} showWordmark />
            <p className="mt-4 text-sm leading-[1.75]" style={{ color: muted }}>
              memorey.ai — Your memory. For every AI you use.
            </p>
          </div>
          <div>
            <p className="text-xs tracking-[0.15em] uppercase" style={{ color: muted }}>
              Product
            </p>
            <ul className="mt-4 space-y-2 text-sm" style={{ color: ink }}>
              <li>
                <Link href="/graph" className="transition-colors duration-200 hover:text-[#5DCAA5]">
                  Graph
                </Link>
              </li>
              <li>
                <Link href="/dashboard/capture" className="transition-colors duration-200 hover:text-[#5DCAA5]">
                  Capture
                </Link>
              </li>
              <li>
                <Link href="/dashboard/search" className="transition-colors duration-200 hover:text-[#5DCAA5]">
                  Search
                </Link>
              </li>
              <li>
                <span style={{ color: muted }}>Extension</span>
              </li>
              <li>
                <span style={{ color: muted }}>MCP</span>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs tracking-[0.15em] uppercase" style={{ color: muted }}>
              Company
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#" className="transition-colors duration-200" style={{ color: ink }}>
                  About
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors duration-200" style={{ color: ink }}>
                  Blog
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors duration-200" style={{ color: ink }}>
                  Twitter/X
                </a>
              </li>
              <li>
                <a href="#" className="transition-colors duration-200" style={{ color: ink }}>
                  LinkedIn
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs tracking-[0.15em] uppercase" style={{ color: muted }}>
              Legal
            </p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="/privacy" style={{ color: ink }}>
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" style={{ color: ink }}>
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="#" style={{ color: ink }}>
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div
          className="mx-auto mt-14 max-w-6xl border-t pt-8 text-center text-xs md:text-left"
          style={{ borderColor: border, color: muted }}
        >
          © 2026 Memorey · Built with privacy at its core · Bengaluru, India
        </div>
      </footer>
    </div>
  );
}
