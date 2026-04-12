import React from "react";
import type { ApprovalStatus, VaultDefinition } from "../types";

export interface FilterState {
  vault: string;
  status: ApprovalStatus | "all";
  confidenceMin: number;
  confidenceMax: number;
  sortBy: "date" | "confidence" | "vault";
}

export const DEFAULT_FILTERS: FilterState = {
  vault: "all",
  status: "all",
  confidenceMin: 0,
  confidenceMax: 1,
  sortBy: "date",
};

interface FilterBarProps {
  filters: FilterState;
  vaults: VaultDefinition[];
  onChange: (filters: FilterState) => void;
}

export function FilterBar({ filters, vaults, onChange }: FilterBarProps) {
  const update = (patch: Partial<FilterState>) => onChange({ ...filters, ...patch });

  return (
    <div className="memorey-filter-bar">
      <div className="memorey-filter-bar__row">
        <select
          className="memorey-filter-bar__select"
          value={filters.vault}
          onChange={(e) => update({ vault: e.target.value })}
          title="Filter by vault"
        >
          <option value="all">All Vaults</option>
          {vaults.map((v) => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>

        <select
          className="memorey-filter-bar__select"
          value={filters.status}
          onChange={(e) => update({ status: e.target.value as FilterState["status"] })}
          title="Filter by status"
        >
          <option value="all">All Statuses</option>
          <option value="approved">Approved</option>
          <option value="auto_approved">Auto Approved</option>
          <option value="pending">Pending</option>
          <option value="rejected">Rejected</option>
        </select>

        <select
          className="memorey-filter-bar__select"
          value={filters.sortBy}
          onChange={(e) => update({ sortBy: e.target.value as FilterState["sortBy"] })}
          title="Sort by"
        >
          <option value="date">Newest First</option>
          <option value="confidence">Highest Confidence</option>
          <option value="vault">By Vault</option>
        </select>
      </div>

      <div className="memorey-filter-bar__confidence-row">
        <span className="memorey-filter-bar__label">Confidence</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={filters.confidenceMin}
          onChange={(e) => update({ confidenceMin: parseFloat(e.target.value) })}
          className="memorey-filter-bar__range"
          title={`Min: ${filters.confidenceMin}`}
        />
        <span className="memorey-filter-bar__range-value">
          {Math.round(filters.confidenceMin * 100)}%–{Math.round(filters.confidenceMax * 100)}%
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={filters.confidenceMax}
          onChange={(e) => update({ confidenceMax: parseFloat(e.target.value) })}
          className="memorey-filter-bar__range"
          title={`Max: ${filters.confidenceMax}`}
        />
      </div>
    </div>
  );
}
