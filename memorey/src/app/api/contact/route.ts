import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = ReturnType<typeof createAdminClient> extends infer C ? C & { from: (table: string) => any } : never;

const SUBJECTS = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Billing Question",
  "Partnership",
  "Other",
] as const;

export async function POST(req: NextRequest) {
  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { name, email, subject, message } = body as Record<string, string>;

    if (!name?.trim() || !email?.trim() || !subject?.trim() || !message?.trim()) {
      return NextResponse.json(
        { error: "All fields are required" },
        { status: 400 },
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email address" },
        { status: 400 },
      );
    }

    if (!SUBJECTS.includes(subject as (typeof SUBJECTS)[number])) {
      return NextResponse.json(
        { error: "Invalid subject" },
        { status: 400 },
      );
    }

    if (message.trim().length < 20) {
      return NextResponse.json(
        { error: "Message must be at least 20 characters" },
        { status: 400 },
      );
    }

    const supabase = createAdminClient() as AnyClient;

    // Rate limit: max 3 per email per hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: emailCount } = await supabase
      .from("contact_submissions")
      .select("*", { count: "exact", head: true })
      .eq("email", email.trim().toLowerCase())
      .gte("created_at", oneHourAgo);

    if (emailCount != null && emailCount >= 3) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 },
      );
    }

    // Rate limit: max 10 per IP per hour (best-effort via x-forwarded-for)
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      req.headers.get("x-real-ip") ??
      "unknown";

    if (ip !== "unknown") {
      const { count: ipCount } = await supabase
        .from("contact_submissions")
        .select("*", { count: "exact", head: true })
        .gte("created_at", oneHourAgo);

      if (ipCount != null && ipCount >= 50) {
        return NextResponse.json(
          { error: "Too many submissions. Please try again later." },
          { status: 429 },
        );
      }
    }

    const { error } = await supabase.from("contact_submissions").insert({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      subject: subject.trim(),
      message: message.trim(),
    });

    if (error) {
      console.error("Failed to save contact submission:", error);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact form error:", err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
