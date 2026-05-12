import { NextResponse } from "next/server";
import DodoPayments, { APIError } from "dodopayments";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type PaymentCreateParams = Parameters<DodoPayments["payments"]["create"]>[0];

function appOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://memorey.co";
  return raw.replace(/\/$/, "");
}

/** Placeholder billing — `payments.create` requires it; customer completes real details on Dodo checkout. */
const CHECKOUT_BILLING_PLACEHOLDER: PaymentCreateParams["billing"] = {
  country: "US",
  state: "CA",
  city: "San Francisco",
  street: "1 Market Street",
  zipcode: "94105",
};

export async function POST(request: Request) {
  try {
    const secret = process.env.DODO_SECRET_KEY?.trim();
    const monthlyPriceId = process.env.DODO_PRO_MONTHLY_PRICE_ID?.trim();
    const yearlyPriceId = process.env.DODO_PRO_YEARLY_PRICE_ID?.trim();
    console.log("[dodo/checkout] env check", {
      hasSecret: !!secret,
      hasMonthlyId: !!process.env.DODO_PRO_MONTHLY_PRICE_ID,
      hasYearlyId: !!process.env.DODO_PRO_YEARLY_PRICE_ID,
    });

    if (!secret || (!monthlyPriceId && !yearlyPriceId)) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    console.log("[dodo/checkout] user", user?.id);
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

    console.log("[dodo/checkout] creating admin client");
    const admin = createAdminClient();
    console.log("[dodo/checkout] admin client created");
    const { data: sub } = await admin
      .from("subscriptions")
      .select("dodo_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    console.log("[dodo/checkout] sub", sub?.dodo_customer_id ?? "none");
    console.log("[dodo/checkout] subscription fetch done");

    console.log("[dodo/checkout] creating dodo client");
    const dodo = new DodoPayments({
      bearerToken: secret,
      environment: "live_mode",
    });

    const customer: PaymentCreateParams["customer"] = sub?.dodo_customer_id
      ? { customer_id: sub.dodo_customer_id }
      : {
          email: user.email?.trim() || "",
          name:
            (user.user_metadata?.full_name as string | undefined)?.trim() ||
            user.email?.trim() ||
            "Memorey user",
        };

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

    const createBody: PaymentCreateParams = {
      billing: CHECKOUT_BILLING_PLACEHOLDER,
      customer,
      product_cart: [{ product_id: productId, quantity: 1 }],
      payment_link: true,
      return_url: returnUrl,
      metadata: {
        supabase_user_id: user.id,
        interval,
      },
    };

    console.log("[dodo/checkout] calling dodo");
    console.log("[dodo/checkout] payload", JSON.stringify(createBody, null, 2));
    const session = await dodo.payments.create(createBody);

    return NextResponse.json({ url: session.payment_link });
  } catch (err) {
    if (err instanceof APIError) {
      console.error("[dodo/checkout]", err.status, err.message);
    } else {
      console.error(
        "[dodo/checkout]",
        err instanceof Error ? err.message : "unknown error"
      );
    }
    return NextResponse.json(
      { error: "Failed to create checkout session." },
      { status: 500 }
    );
  }
}
