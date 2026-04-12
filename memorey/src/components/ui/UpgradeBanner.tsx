"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

type Summary = {
  plan: string;
  memoriesRemaining: number | null;
};

export function UpgradeBanner() {
  // Hidden until Dodo Payments keys are configured
  // TODO: restore once billing is live
  return null;
}
