import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

/* ── Signature verification (Standard Webhooks spec) ── */

function verifySignature(
  body: string,
  secret: string,
  headers: Headers
): boolean {
  const msgId = headers.get("webhook-id");
  const timestamp = headers.get("webhook-timestamp");
  const signature = headers.get("webhook-signature");

  if (!msgId || !timestamp || !signature) return false;

  // Reject timestamps older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) return false;

  // Secret may be prefixed with "whsec_" — strip it and base64-decode
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Buffer.from(rawSecret, "base64");

  const signedContent = `${msgId}.${timestamp}.${body}`;
  const computed = createHmac("sha256", keyBytes)
    .update(signedContent)
    .digest("base64");

  // webhook-signature may contain multiple space-separated sigs (v1,xxx)
  const signatures = signature.split(" ");
  for (const sig of signatures) {
    const value = sig.split(",").pop() ?? "";
    try {
      if (
        timingSafeEqual(Buffer.from(computed), Buffer.from(value))
      ) {
        return true;
      }
    } catch {
      // length mismatch, continue
    }
  }
  return false;
}

/* ── Webhook handler ── */

export async function POST(request: Request) {
  try {
    const secret = process.env.DODO_WEBHOOK_SECRET?.trim();
    if (!secret) {
      console.error("[dodo/webhook] DODO_WEBHOOK_SECRET not set");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const body = await request.text();

    if (!verifySignature(body, secret, request.headers)) {
      console.error("[dodo/webhook] signature verification failed");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const event = JSON.parse(body) as {
      type: string;
      data: Record<string, unknown>;
      business_id?: string;
      timestamp?: string;
    };

    const admin = createAdminClient();

    switch (event.type) {
      /* ── Subscription activated (new or renewed) ── */
      case "subscription.active": {
        const data = event.data as {
          subscription_id: string;
          customer: { customer_id: string; email?: string };
          product_id: string;
          metadata?: Record<string, string>;
          current_period_end?: string;
        };

        const userId =
          data.metadata?.supabase_user_id ??
          (await resolveUserByCustomerId(admin, data.customer.customer_id));

        if (!userId) {
          console.error(
            "[dodo/webhook] cannot resolve user for subscription",
            data.subscription_id
          );
          break;
        }

        await admin
          .from("subscriptions")
          .update({
            plan: "pro",
            dodo_customer_id: data.customer.customer_id,
            dodo_subscription_id: data.subscription_id,
            current_period_end: data.current_period_end ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);

        console.log(
          `[dodo/webhook] subscription.active applied (sub: ${data.subscription_id})`
        );
        break;
      }

      /* ── Subscription renewed ── */
      case "subscription.renewed": {
        const data = event.data as {
          subscription_id: string;
          current_period_end?: string;
        };

        await admin
          .from("subscriptions")
          .update({
            plan: "pro",
            current_period_end: data.current_period_end ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("dodo_subscription_id", data.subscription_id);

        console.log(
          `[dodo/webhook] subscription renewed: ${data.subscription_id}`
        );
        break;
      }

      /* ── Subscription plan changed ── */
      case "subscription.plan_changed": {
        const data = event.data as {
          subscription_id: string;
          product_id: string;
          current_period_end?: string;
        };

        await admin
          .from("subscriptions")
          .update({
            current_period_end: data.current_period_end ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("dodo_subscription_id", data.subscription_id);

        console.log(
          `[dodo/webhook] plan changed for sub: ${data.subscription_id}`
        );
        break;
      }

      /* ── Subscription cancelled or expired ── */
      case "subscription.cancelled":
      case "subscription.expired":
      case "subscription.failed": {
        const data = event.data as {
          subscription_id: string;
          customer?: { customer_id: string };
        };

        // Find the user
        const { data: sub } = await admin
          .from("subscriptions")
          .select("user_id")
          .eq("dodo_subscription_id", data.subscription_id)
          .maybeSingle();

        if (sub?.user_id) {
          // Downgrade to free
          await admin
            .from("subscriptions")
            .update({
              plan: "free",
              dodo_subscription_id: null,
              current_period_end: null,
              updated_at: new Date().toISOString(),
            })
            .eq("user_id", sub.user_id);

          // Enforce free tier vault cap: keep only first 3 active
          const { data: vaults } = await admin
            .from("category_vaults")
            .select("id")
            .eq("user_id", sub.user_id)
            .eq("is_active", true)
            .order("display_order", { ascending: true });

          if (vaults && vaults.length > 3) {
            const toDisable = vaults.slice(3).map((v) => v.id);
            await admin
              .from("category_vaults")
              .update({ is_active: false })
              .in("id", toDisable);
          }

          console.log(
            `[dodo/webhook] subscription downgraded to free (${event.type}, sub: ${data.subscription_id})`
          );
        }
        break;
      }

      /* ── Subscription paused ── */
      case "subscription.on_hold": {
        const data = event.data as { subscription_id: string };

        await admin
          .from("subscriptions")
          .update({
            plan: "free",
            updated_at: new Date().toISOString(),
          })
          .eq("dodo_subscription_id", data.subscription_id);

        console.log(
          `[dodo/webhook] subscription on hold: ${data.subscription_id}`
        );
        break;
      }

      /* ── Payment events (logging only) ── */
      case "payment.succeeded":
      case "payment.failed":
      case "payment.cancelled":
        console.log(`[dodo/webhook] ${event.type}`);
        break;

      default:
        console.log(`[dodo/webhook] unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error(
      "[dodo/webhook]",
      err instanceof Error ? err.message : "unknown error"
    );
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 }
    );
  }
}

/* ── Helper: resolve Supabase user_id from Dodo customer_id ── */

async function resolveUserByCustomerId(
  admin: ReturnType<typeof createAdminClient>,
  customerId: string
): Promise<string | null> {
  const { data } = await admin
    .from("subscriptions")
    .select("user_id")
    .eq("dodo_customer_id", customerId)
    .maybeSingle();
  return data?.user_id ?? null;
}
