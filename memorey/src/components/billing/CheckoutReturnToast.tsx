"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { toast } from "sonner";

/**
 * After Dodo hosted checkout, customers return with query params on redirect_url
 * (e.g. subscription_id + status for subscriptions). Show success once and strip the query.
 * Cancel / abandon: same settings URL without success params — no toast.
 */
export function CheckoutReturnToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;

    const status = (searchParams.get("status") || "").toLowerCase();
    const subscriptionId = searchParams.get("subscription_id");
    const paymentId = searchParams.get("payment_id");
    const sessionId = searchParams.get("session_id");

    const subscriptionSuccess =
      Boolean(subscriptionId) &&
      (status === "active" ||
        status === "trialing" ||
        status === "succeeded" ||
        status === "success");
    const paymentSuccess =
      Boolean(paymentId) &&
      (status === "succeeded" ||
        status === "completed" ||
        status === "success");
    const sessionSuccess =
      Boolean(sessionId) && (status === "success" || status === "succeeded");

    const legacyUpgraded = searchParams.get("upgraded") === "true";

    if (
      !subscriptionSuccess &&
      !paymentSuccess &&
      !sessionSuccess &&
      !legacyUpgraded
    )
      return;

    handled.current = true;
    toast.success(
      "Welcome to Pro — you now have unlimited memories and imports."
    );
    const clean = pathname || "/dashboard/settings";
    router.replace(clean);
  }, [searchParams, router, pathname]);

  return null;
}
