import React, { useCallback, useState } from "react";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { useAuthContext } from "../hooks/useAuth";
import { useDataReload } from "../App";
import { createSupabaseClient } from "../utils/supabase";
import { formatRelativeTime } from "../utils/time";
import { PLATFORM_ABBREV } from "../utils/colors";

export function ConflictsView() {
  const { pendingProposals, vaults } = useMemoreyState();
  const dispatch = useMemoreyDispatch();
  const { token, userId } = useAuthContext();
  const reload = useDataReload();
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  const handleApprove = useCallback(
    async (proposalId: string) => {
      if (!token || !userId) return;
      const client = createSupabaseClient(token);
      if (!client) return;

      setProcessing((s) => new Set(s).add(proposalId));

      try {
        const proposal = pendingProposals.find((p) => p.id === proposalId);
        if (!proposal) return;

        await client
          .from("pending_proposals")
          .update({ status: "approved", updated_at: new Date().toISOString() })
          .eq("id", proposalId)
          .eq("user_id", userId);

        await client.from("memory_nodes").insert({
          user_id: userId,
          title: proposal.proposed_title || proposal.proposed_value.slice(0, 100),
          value: proposal.proposed_value,
          vault_id: proposal.proposed_vault_id,
          source: proposal.source || "extension",
          confidence: 0.8,
          is_active: true,
        });

        dispatch({ type: "REMOVE_PROPOSAL", proposalId });
        await reload();
      } catch (err) {
        console.error("Failed to approve proposal", err);
      } finally {
        setProcessing((s) => {
          const next = new Set(s);
          next.delete(proposalId);
          return next;
        });
      }
    },
    [token, userId, pendingProposals, dispatch, reload]
  );

  const handleReject = useCallback(
    async (proposalId: string) => {
      if (!token || !userId) return;
      const client = createSupabaseClient(token);
      if (!client) return;

      setProcessing((s) => new Set(s).add(proposalId));

      try {
        await client
          .from("pending_proposals")
          .update({ status: "rejected", updated_at: new Date().toISOString() })
          .eq("id", proposalId)
          .eq("user_id", userId);

        dispatch({ type: "REMOVE_PROPOSAL", proposalId });
        await reload();
      } catch (err) {
        console.error("Failed to reject proposal", err);
      } finally {
        setProcessing((s) => {
          const next = new Set(s);
          next.delete(proposalId);
          return next;
        });
      }
    },
    [token, userId, dispatch, reload]
  );

  const resolveVaultName = useCallback(
    (vaultId: string | null): string => {
      if (!vaultId) return "Unassigned";
      return vaults.find((v) => v.id === vaultId)?.name ?? "Unknown";
    },
    [vaults]
  );

  if (pendingProposals.length === 0) {
    return (
      <div className="memorey-conflicts">
        <div className="memorey-conflicts__empty">
          <div className="memorey-conflicts__empty-icon">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="var(--memorey-success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="memorey-conflicts__empty-title">No conflicts!</div>
          <div className="memorey-conflicts__empty-text">
            All proposals have been reviewed. New proposals will appear here.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="memorey-conflicts">
      <div className="memorey-conflicts__header">
        <span className="memorey-conflicts__count">
          {pendingProposals.length} pending {pendingProposals.length === 1 ? "proposal" : "proposals"}
        </span>
      </div>
      <div className="memorey-conflicts__list">
        {pendingProposals.map((proposal) => {
          const isProcessing = processing.has(proposal.id);
          return (
            <div
              key={proposal.id}
              className={`memorey-proposal-card${isProcessing ? " memorey-proposal-card--processing" : ""}`}
            >
              <div className="memorey-proposal-card__content">
                {proposal.proposed_value}
              </div>
              <div className="memorey-proposal-card__meta">
                <span className="memorey-badge-pill memorey-badge-pill--vault">
                  {proposal.proposed_vault_name || resolveVaultName(proposal.proposed_vault_id)}
                </span>
                {proposal.source && (
                  <span className="memorey-platform-icon" title={proposal.source}>
                    {PLATFORM_ABBREV[proposal.source] ?? proposal.source.slice(0, 2).toUpperCase()}
                  </span>
                )}
                <span className="memorey-proposal-card__time">
                  {formatRelativeTime(proposal.created_at)}
                </span>
              </div>
              <div className="memorey-proposal-card__actions">
                <button
                  className="memorey-proposal-card__btn memorey-proposal-card__btn--approve"
                  onClick={() => handleApprove(proposal.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? "..." : "Approve"}
                </button>
                <button
                  className="memorey-proposal-card__btn memorey-proposal-card__btn--reject"
                  onClick={() => handleReject(proposal.id)}
                  disabled={isProcessing}
                >
                  {isProcessing ? "..." : "Reject"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
