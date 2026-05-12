"use client";

import { useEffect, useRef } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

/**
 * After Dodo checkout, users land on /dashboard?upgraded=true — show once and strip the query.
 */
export function CheckoutReturnToast() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    if (searchParams.get("upgraded") !== "true") return;
    handled.current = true;
    toast.success("Welcome to Pro — you now have unlimited memories and imports.");
    router.replace("/dashboard");
  }, [searchParams, router]);

  return null;
}
