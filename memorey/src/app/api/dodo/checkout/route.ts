import { NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const secret = process.env.DODO_SECRET_KEY?.trim();
    const monthlyPriceId = process.env.DODO_PRO_MONTHLY_PRICE_ID?.trim();
    const yearlyPriceId = process.env.DODO_PRO_YEARLY_PRICE_ID?.trim();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://memorey.co";

    if (!secret || (!monthlyPriceId && !yearlyPriceId)) {
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

    const body = await request.json().catch(() => ({}));
    const interval: "monthly" | "yearly" = body.interval === "yearly" ? "yearly" : "monthly";

    const productId = interval === "yearly" ? yearlyPriceId : monthlyPriceId;
    if (!productId) {
      return NextResponse.json(
        { error: `No ${interval} price configured.` },
        { status: 503 }
      );
    }

    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("dodo_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const dodo = new DodoPayments({
      bearerToken: secret,
      environment: secret.startsWith("sk_test_") ? "test_mode" : "live_mode",
    });

    const customerPayload: Record<string, string> = {
      email: user.email ?? "",
      name: user.user_metadata?.full_name ?? user.email ?? "",
    };
    if (sub?.dodo_customer_id) {
      customerPayload.customer_id = sub.dodo_customer_id;
    }

    const session = await dodo.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      customer: customerPayload,
      return_url: `${appUrl}/dashboard?upgraded=true`,
      metadata: {
        supabase_user_id: user.id,
        interval,
      },
    });

    return NextResponse.json({ url: session.checkout_url });
  } catch (err) {
    console.error("[dodo/checkout]", err);
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
