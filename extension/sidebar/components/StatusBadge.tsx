import React from "react";
import type { ApprovalStatus } from "../types";

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; className: string }> = {
  approved: { label: "Approved", className: "memorey-status-badge--approved" },
  auto_approved: { label: "Auto", className: "memorey-status-badge--auto" },
  pending: { label: "Pending", className: "memorey-status-badge--pending" },
  rejected: { label: "Rejected", className: "memorey-status-badge--rejected" },
};

interface StatusBadgeProps {
  status: ApprovalStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return (
    <span className={`memorey-status-badge ${config.className}`}>
      {config.label}
    </span>
  );
}
