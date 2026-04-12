"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Loader2, CheckCircle, Moon, Sun, Mail, MapPin } from "lucide-react";

const SUBJECTS = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Billing Question",
  "Partnership",
  "Other",
];

export default function ContactPage() {
  const [isDark, setIsDark] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("memorey-theme");
    const dark = saved ? saved === "dark" : true;
    setIsDark(dark);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    localStorage.setItem("memorey-theme", isDark ? "dark" : "light");
  }, [isDark]);

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (!name.trim()) e.name = "Name is required";
    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      e.email = "Enter a valid email";
    if (!subject) e.subject = "Please select a subject";
    if (!message.trim()) e.message = "Message is required";
    else if (message.trim().length < 20)
      e.message = "Message must be at least 20 characters";
    return e;
  }

  async function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const fieldErrors = validate();
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) return;

    setSending(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          subject,
          message: message.trim(),
        }),
      });
      const json = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok || !json.success) {
        setErrors({ form: json.error ?? "Something went wrong. Please try again." });
        return;
      }
      setSent(true);
    } catch {
      setErrors({ form: "Network error. Please check your connection." });
    } finally {
      setSending(false);
    }
  }

  const C = {
    bg: "var(--bg)",
    bg2: "var(--bg2)",
    bg3: "var(--bg3)",
    border: "var(--border)",
    border2: "var(--border2)",
    text: "var(--text)",
    text2: "var(--text2, var(--text))",
    muted: "var(--muted)",
    faint: "var(--faint)",
    orange: "var(--orange)",
    orangeDim: "var(--orange-dim)",
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: C.bg, color: C.text }}>
      {/* Header — matches privacy/terms pages */}
      <header
        className="sticky top-0 z-30 flex items-center justify-between border-b px-6 py-4"
        style={{ backgroundColor: C.bg, borderColor: C.border }}
      >
        <Link
          href="/"
          className="flex items-center gap-2 no-underline"
          style={{ color: C.text }}
        >
          <div
            className="h-2 w-2 rounded-full"
            style={{ background: C.orange }}
          />
          <span
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-syne)" }}
          >
            memorey
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Toggle theme"
            onClick={() => setIsDark(!isDark)}
            className="flex items-center justify-center"
            style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              border: `1px solid ${C.border2}`,
              background: "transparent",
              color: C.muted,
              cursor: "pointer",
            }}
          >
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>
          <Link
            href="/"
            className="text-xs no-underline transition-opacity hover:opacity-80"
            style={{ color: C.muted }}
          >
            Back to home
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-6 py-16 pb-24">
        <p
          className="text-xs font-semibold uppercase tracking-[0.12em]"
          style={{ color: C.orange }}
        >
          Contact
        </p>
        <h1
          className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
          style={{ fontFamily: "var(--font-syne)" }}
        >
          Get in Touch
        </h1>
        <p
          className="mt-4 leading-relaxed"
          style={{ color: C.text2, fontSize: 15 }}
        >
          Have a question, feedback, or just want to say hi? I&rsquo;d love to
          hear from you.
        </p>

        {/* ── Success state ── */}
        {sent ? (
          <div
            className="mt-12 rounded-lg border p-8 text-center"
            style={{ borderColor: C.border2, background: C.bg2 }}
          >
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full"
              style={{ background: C.orangeDim }}
            >
              <CheckCircle size={24} style={{ color: C.orange }} />
            </div>
            <h2
              className="text-xl font-semibold"
              style={{ fontFamily: "var(--font-syne)" }}
            >
              Thanks for reaching out!
            </h2>
            <p
              className="mt-2 text-sm leading-relaxed"
              style={{ color: C.text2 }}
            >
              I&rsquo;ll get back to you within 24&ndash;48 hours.
            </p>
            <Link
              href="/"
              className="mt-6 inline-block text-sm font-medium no-underline transition-opacity hover:opacity-80"
              style={{ color: C.orange }}
            >
              &larr; Back to home
            </Link>
          </div>
        ) : (
          <>
            {/* ── Form ── */}
            <form
              onSubmit={(e) => void handleSubmit(e)}
              className="mt-12 space-y-6"
              noValidate
            >
              {errors.form && (
                <div
                  className="rounded-md border px-4 py-3 text-sm"
                  style={{
                    borderColor: "var(--destructive, #e05c5c)",
                    color: "var(--destructive, #e05c5c)",
                    background: "rgba(224,92,92,0.08)",
                  }}
                >
                  {errors.form}
                </div>
              )}

              {/* Name */}
              <div>
                <label
                  htmlFor="contact-name"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em]"
                  style={{ color: C.text2 }}
                >
                  Name
                </label>
                <input
                  id="contact-name"
                  type="text"
                  value={name}
                  onChange={(e) => { setName(e.target.value); setErrors((p) => { const n = { ...p }; delete n.name; return n; }); }}
                  placeholder="Your name"
                  className="w-full rounded-[var(--r-md)] border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--orange)]"
                  style={{
                    backgroundColor: C.bg2,
                    borderColor: errors.name ? "var(--destructive, #e05c5c)" : C.border,
                    color: C.text,
                  }}
                />
                {errors.name && (
                  <p className="mt-1 text-xs" style={{ color: "var(--destructive, #e05c5c)" }}>
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="contact-email"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em]"
                  style={{ color: C.text2 }}
                >
                  Email
                </label>
                <input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setErrors((p) => { const n = { ...p }; delete n.email; return n; }); }}
                  placeholder="you@example.com"
                  className="w-full rounded-[var(--r-md)] border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--orange)]"
                  style={{
                    backgroundColor: C.bg2,
                    borderColor: errors.email ? "var(--destructive, #e05c5c)" : C.border,
                    color: C.text,
                  }}
                />
                {errors.email && (
                  <p className="mt-1 text-xs" style={{ color: "var(--destructive, #e05c5c)" }}>
                    {errors.email}
                  </p>
                )}
              </div>

              {/* Subject */}
              <div>
                <label
                  htmlFor="contact-subject"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em]"
                  style={{ color: C.text2 }}
                >
                  Subject
                </label>
                <select
                  id="contact-subject"
                  value={subject}
                  onChange={(e) => { setSubject(e.target.value); setErrors((p) => { const n = { ...p }; delete n.subject; return n; }); }}
                  className="w-full rounded-[var(--r-md)] border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--orange)]"
                  style={{
                    backgroundColor: C.bg2,
                    borderColor: errors.subject ? "var(--destructive, #e05c5c)" : C.border,
                    color: subject ? C.text : C.muted,
                  }}
                >
                  <option value="" disabled>
                    Select a subject...
                  </option>
                  {SUBJECTS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {errors.subject && (
                  <p className="mt-1 text-xs" style={{ color: "var(--destructive, #e05c5c)" }}>
                    {errors.subject}
                  </p>
                )}
              </div>

              {/* Message */}
              <div>
                <label
                  htmlFor="contact-message"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.06em]"
                  style={{ color: C.text2 }}
                >
                  Message
                </label>
                <textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => { setMessage(e.target.value); setErrors((p) => { const n = { ...p }; delete n.message; return n; }); }}
                  placeholder="Tell us what's on your mind..."
                  rows={5}
                  className="w-full resize-y rounded-[var(--r-md)] border px-3 py-2.5 text-sm outline-none transition-colors focus:border-[var(--orange)]"
                  style={{
                    backgroundColor: C.bg2,
                    borderColor: errors.message ? "var(--destructive, #e05c5c)" : C.border,
                    color: C.text,
                  }}
                />
                {errors.message && (
                  <p className="mt-1 text-xs" style={{ color: "var(--destructive, #e05c5c)" }}>
                    {errors.message}
                  </p>
                )}
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={sending}
                className="flex w-full items-center justify-center gap-2 rounded-[var(--r-md)] border-none px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                style={{ background: C.orange, color: "#fff" }}
              >
                {sending ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Sending...
                  </>
                ) : (
                  "Send Message"
                )}
              </button>
            </form>

            {/* ── Contact info ── */}
            <div
              className="mt-12 rounded-lg border p-6"
              style={{ borderColor: C.border2, background: C.bg2 }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                <div className="flex items-start gap-3">
                  <Mail size={16} className="mt-0.5 shrink-0" style={{ color: C.orange }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.06em]" style={{ color: C.muted }}>
                      Email
                    </p>
                    <a
                      href="mailto:hey@memorey.co"
                      className="mt-1 block text-sm font-medium no-underline transition-opacity hover:opacity-80"
                      style={{ color: C.orange }}
                    >
                      hey@memorey.co
                    </a>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <MapPin size={16} className="mt-0.5 shrink-0" style={{ color: C.orange }} />
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.06em]" style={{ color: C.muted }}>
                      Built from
                    </p>
                    <p className="mt-1 text-sm" style={{ color: C.text2 }}>
                      Solo-built with care in Bangalore, India
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      {/* Footer — matches landing page footer */}
      <footer
        style={{
          borderTop: `1px solid ${C.border}`,
          padding: "1.7rem 2rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            fontFamily: "var(--font-syne)",
            fontWeight: 700,
            color: C.muted,
          }}
        >
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: C.orange,
            }}
          />
          memorey
        </div>
        <div style={{ display: "flex", gap: "1.4rem" }}>
          {[
            { label: "Privacy", href: "/privacy" },
            { label: "Terms", href: "/terms" },
            { label: "Contact", href: "/contact" },
          ].map((l) => (
            <a
              key={l.label}
              href={l.href}
              style={{ fontSize: "0.8rem", color: C.muted, textDecoration: "none" }}
            >
              {l.label}
            </a>
          ))}
        </div>
        <div
          style={{
            fontFamily: 'var(--font-jetbrains-mono, "JetBrains Mono", ui-monospace)',
            fontSize: "0.58rem",
            color: C.faint,
          }}
        >
          &copy; {new Date().getFullYear()} Memorey
        </div>
      </footer>
    </div>
  );
}
