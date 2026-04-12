import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/types";

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/auth/callback")) {
    return NextResponse.next();
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (
    !supabaseUrl ||
    !supabaseAnonKey ||
    !supabaseUrl.startsWith("http") ||
    supabaseAnonKey === "your_supabase_anon_key" ||
    supabaseUrl.includes("your_supabase") ||
    supabaseUrl === "your_supabase_url"
  ) {
    console.error(
      "[Memorey] Supabase env vars missing or invalid. Check .env.local"
    );
    if (process.env.NODE_ENV === "development") {
      return NextResponse.next({ request });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let supabaseResponse = NextResponse.next({ request });
  const supabase = createServerClient<Database>(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const path = request.nextUrl.pathname;

  const isAdminRoute = path.startsWith("/admin");
  const isProtectedRoute =
    path.startsWith("/dashboard") ||
    path.startsWith("/graph") ||
    path.startsWith("/settings") ||
    isAdminRoute;

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (user && path === "/login") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();
    const dest =
      profile?.onboarding_completed === true
        ? "/dashboard"
        : "/dashboard/onboarding";
    return NextResponse.redirect(new URL(dest, request.url));
  }

  if (user && isProtectedRoute && !isAdminRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", user.id)
      .maybeSingle();
    const done = profile?.onboarding_completed === true;
    const isOnboarding = path === "/dashboard/onboarding";

    if (!done && !isOnboarding) {
      return NextResponse.redirect(
        new URL("/dashboard/onboarding", request.url)
      );
    }
    if (done && isOnboarding) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/graph/:path*",
    "/graph",
    "/settings/:path*",
    "/settings",
    "/login",
    "/admin",
    "/admin/:path*",
  ],
};
