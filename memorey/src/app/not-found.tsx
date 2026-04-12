import Link from "next/link";
import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";

export default function NotFound() {
  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-6"
      style={{ backgroundColor: "var(--bg)", color: "var(--text)" }}
    >
      <MemoreyLogo size={48} className="mb-6" />
      <p
        className="text-center text-sm font-medium uppercase tracking-[0.08em]"
        style={{ color: "var(--muted)" }}
      >
        404
      </p>
      <h1 className="mt-2 text-center text-xl font-semibold tracking-tight">
        This page doesn&apos;t exist
      </h1>
      <p
        className="mt-3 max-w-sm text-center text-sm leading-relaxed"
        style={{ color: "var(--text2)" }}
      >
        The link may be broken, or the page may have been removed.
      </p>
      <Link
        href="/dashboard"
        className="mt-10 inline-flex h-10 items-center justify-center rounded-[var(--r-button)] px-5 text-sm font-medium no-underline transition-opacity hover:opacity-90"
        style={{
          background: "var(--orange)",
          color: "#fff",
        }}
      >
        Back to dashboard
      </Link>
    </div>
  );
}
