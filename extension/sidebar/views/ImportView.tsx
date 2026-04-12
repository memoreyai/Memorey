import React, { useCallback, useState } from "react";
import type { ConversationExchange } from "memorey-core";
import { useMemoreyState, useMemoreyDispatch } from "../store/memoreyStore";
import { useAuthContext } from "../hooks/useAuth";
import { useDataReload } from "../App";
import { ImportForm } from "../components/ImportForm";
import { ImportProgress, type ImportStats } from "../components/ImportProgress";

declare const __WEB_APP_URL__: string;
const WEB_APP_URL = typeof __WEB_APP_URL__ !== "undefined" ? __WEB_APP_URL__ : "https://memorey.co";

type Phase = "form" | "importing" | "done";

export function ImportView() {
  const dispatch = useMemoreyDispatch();
  const { vaults } = useMemoreyState();
  const { token } = useAuthContext();
  const reload = useDataReload();

  const [phase, setPhase] = useState<Phase>("form");
  const [stats, setStats] = useState<ImportStats>({
    total: 0,
    processed: 0,
    factsExtracted: 0,
    factsAdded: 0,
    duplicates: 0,
    conflicts: 0,
    isComplete: false,
    errors: [],
  });

  const handleImport = useCallback(
    async (exchanges: ConversationExchange[], platform: string) => {
      if (!token) return;

      setPhase("importing");
      setStats({
        total: exchanges.length,
        processed: 0,
        factsExtracted: 0,
        factsAdded: 0,
        duplicates: 0,
        conflicts: 0,
        isComplete: false,
        errors: [],
      });

      const conversationText = exchanges
        .map((e) => `User: ${e.userMessage}\nAssistant: ${e.assistantMessage}`)
        .join("\n\n");

      try {
        const res = await fetch(`${WEB_APP_URL}/api/graph-builder`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message: conversationText,
            vaults: vaults.map((v) => ({ id: v.id, name: v.name })),
          }),
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({ error: "Import failed" }));
          setStats((s) => ({
            ...s,
            errors: [(err as { error?: string }).error ?? "Import failed"],
            isComplete: true,
          }));
          setPhase("done");
          return;
        }

        const result = (await res.json()) as {
          created?: number;
          updated?: number;
          nodes?: unknown[];
        };

        setStats({
          total: exchanges.length,
          processed: exchanges.length,
          factsExtracted: (result.nodes as unknown[])?.length ?? result.created ?? 0,
          factsAdded: result.created ?? 0,
          duplicates: 0,
          conflicts: 0,
          isComplete: true,
          errors: [],
        });

        await reload();
      } catch (err) {
        setStats((s) => ({
          ...s,
          errors: [err instanceof Error ? err.message : "Network error"],
          isComplete: true,
        }));
      }

      setPhase("done");
    },
    [token, vaults, reload]
  );

  const handleViewPending = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "pending" });
  }, [dispatch]);

  const handleViewConflicts = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "conflicts" });
  }, [dispatch]);

  const handleDone = useCallback(() => {
    dispatch({ type: "SET_VIEW", view: "dashboard" });
  }, [dispatch]);

  return (
    <div className="memorey-import-view">
      <div className="memorey-section__title">Import Conversations</div>

      {phase === "form" && <ImportForm onImport={handleImport} />}

      {(phase === "importing" || phase === "done") && (
        <ImportProgress
          stats={stats}
          onViewPending={handleViewPending}
          onViewConflicts={handleViewConflicts}
          onDone={handleDone}
        />
      )}
    </div>
  );
}
