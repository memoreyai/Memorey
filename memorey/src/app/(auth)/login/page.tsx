"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { MemoreyLogo } from "@/components/memorey/MemoreyLogo";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [loading, setLoading] = useState(false);

  async function signInWithGoogle() {
    setLoading(true);
    const supabase = createClient();
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (oauthError) {
      setLoading(false);
      console.error(oauthError);
    }
  }

  return (
    <main
      className="flex min-h-[100dvh] flex-col items-center justify-center px-4 py-10 sm:px-6 sm:py-12"
      style={{ backgroundColor: "#0A0A0B", color: "#F5F4F0" }}
    >
      <div className="flex w-full max-w-sm flex-col items-center text-center">
        <MemoreyLogo size={48} className="mb-8" />
        <h1 className="text-balance text-xl font-semibold tracking-tight text-[#F5F4F0] sm:text-2xl">
          Memorey
        </h1>
        <p
          className="mt-3 max-w-[min(100%,280px)] text-sm leading-relaxed text-[#F5F4F0]/65"
        >
          Your memory. For every AI you use.
        </p>

        {error === "oauth_failed" ? (
          <div
            className="mt-6 w-full max-w-[280px]"
            style={{
              padding: "10px 14px",
              background: "rgba(224, 92, 92, 0.1)",
              border: "1px solid rgba(224, 92, 92, 0.3)",
              borderRadius: 8,
              fontSize: 13,
              color: "#E05C5C",
            }}
            role="alert"
          >
            Sign-in failed. Please try again.
          </div>
        ) : error ? (
          <p className="mt-6 text-xs text-red-400/90" role="alert">
            {error}
          </p>
        ) : null}

        <Button
          type="button"
          disabled={loading}
          onClick={() => void signInWithGoogle()}
          className="mt-10 h-11 w-full max-w-[min(100%,280px)] rounded-lg border border-[#2A2A2D] bg-[#141416] text-[#F5F4F0] hover:border-[#3A3A3E] hover:bg-[#1A1A1D]"
          variant="outline"
        >
          <GoogleGlyph className="mr-2 size-4" />
          {loading ? "Redirecting…" : "Continue with Google"}
        </Button>

        <p className="mt-6 max-w-[min(100%,280px)] text-center text-[11px] leading-[1.6] text-[#F5F4F0]/45">
          By continuing, you agree to our{" "}
          <a
            href="/terms"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-[#F5F4F0]/70"
            style={{ color: "inherit" }}
          >
            Terms&nbsp;and&nbsp;Conditions
          </a>{" "}
          and{" "}
          <a
            href="/privacy"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 transition-colors hover:text-[#F5F4F0]/70"
            style={{ color: "inherit" }}
          >
            Privacy&nbsp;Policy
          </a>
          .
        </p>
      </div>
    </main>
  );
}

function GoogleGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <main
          className="flex min-h-screen items-center justify-center"
          style={{ backgroundColor: "#0A0A0B" }}
        >
          <MemoreyLogo size={48} />
        </main>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
