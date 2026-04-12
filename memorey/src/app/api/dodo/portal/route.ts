import { NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const secret = process.env.DODO_SECRET_KEY?.trim();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://memorey.co";

    if (!secret) {
      return NextResponse.json(
        { error: "Billing is not configured." },
        { status: 503 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("dodo_customer_id, plan")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!sub?.dodo_customer_id) {
      return NextResponse.json(
        { error: "No billing account on file." },
        { status: 400 }
      );
    }

    const dodo = new DodoPayments({
      bearerToken: secret,
      environment: secret.startsWith("sk_test_") ? "test_mode" : "live_mode",
    });

    const portal = await dodo.customers.customerPortal.create(
      sub.dodo_customer_id,
      { send_email: false }
    );

    return NextResponse.json({ url: portal.link });
  } catch (err) {
    console.error("[dodo/portal]", err);
    return NextResponse.json(
      { error: "Failed to open billing portal." },
      { status: 500 }
    );
  }
}
