import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://memorey.co";
  return raw.replace(/\/$/, "");
}

export async function POST(request: Request) {
  try {
    const monthlyPriceId = process.env.DODO_PRO_MONTHLY_PRICE_ID?.trim();
    const yearlyPriceId = process.env.DODO_PRO_YEARLY_PRICE_ID?.trim();

    if (
      !process.env.DODO_SECRET_KEY?.trim() ||
      (!monthlyPriceId && !yearlyPriceId)
    ) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user)
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const interval: "monthly" | "yearly" =
      body.interval === "yearly" ? "yearly" : "monthly";

    const productId =
      interval === "yearly" ? yearlyPriceId : monthlyPriceId;
    if (!productId) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("dodo_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (
      !sub?.dodo_customer_id &&
      !(user.email && user.email.trim().length > 0)
    ) {
      return NextResponse.json(
        {
          error:
            "Your account needs an email address to subscribe. Update your profile or sign-in provider.",
        },
        { status: 400 }
      );
    }

    const origin = appOrigin();
    const returnUrl = `${origin}/dashboard?upgraded=true`;

    const checkoutUrl = new URL(
      `https://checkout.dodopayments.com/buy/${productId}`
    );
    checkoutUrl.searchParams.set("quantity", "1");
    checkoutUrl.searchParams.set("redirect_url", returnUrl);
    checkoutUrl.searchParams.set("email", user.email ?? "");
    checkoutUrl.searchParams.set("metadata[supabase_user_id]", user.id);
    checkoutUrl.searchParams.set("metadata[interval]", interval);

    return NextResponse.json({ url: checkoutUrl.toString() });
  } catch (err) {
    console.error(
      "[dodo/checkout]",
      err instanceof Error ? err.message : "unknown error"
    );
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
