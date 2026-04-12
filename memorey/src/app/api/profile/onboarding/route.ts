import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  onboardingProfilePatchSchema,
} from "@/lib/validation/schemas";
import { formatZodError } from "@/lib/validation/formatZodError";

/**
 * Validates onboarding profile fields (segment enums, etc.) before updating Supabase.
 */
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = onboardingProfilePatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: formatZodError(parsed.error) },
        { status: 400 }
      );
    }

    const patch = parsed.data;
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No fields to update" }, { status: 400 });
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) {
      console.error("[profile/onboarding]", error);
      return NextResponse.json(
        { error: "Could not update profile" },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[profile/onboarding] unexpected", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
