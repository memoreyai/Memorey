import React, { useCallback, useRef, useState } from "react";
import type { ConversationExchange } from "memorey-core";
import { useMemoreyDispatch } from "../store/memoreyStore";
import { usePipeline } from "../hooks/usePipeline";
import { ImportForm } from "../components/ImportForm";
import { ImportProgress, type ImportStats } from "../components/ImportProgress";

type Phase = "form" | "importing" | "done";

export function ImportView() {
  const dispatch = useMemoreyDispatch();
  const { pipeline, refreshState, save } = usePipeline();

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

  const abortRef = useRef(false);

  const handleImport = useCallback(
    async (exchanges: ConversationExchange[], platform: string) => {
      abortRef.current = false;
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

      let factsExtracted = 0;
      let factsAdded = 0;
      let duplicates = 0;
      let conflicts = 0;
      const errors: string[] = [];

      for (let i = 0; i < exchanges.length; i++) {
        if (abortRef.current) break;

        const ex = {
          ...exchanges[i],
          platform: platform || exchanges[i].platform,
        };

        try {
          const result = await pipeline.processExchange(ex);
          factsExtracted += result.extracted.facts.length;
          factsAdded += result.reconciliation.autoApproved + result.reconciliation.pending;
          duplicates += result.reconciliation.duplicates;
          conflicts += result.reconciliation.conflicts;
        } catch (err) {
          errors.push(`Exchange ${i + 1}: ${err instanceof Error ? err.message : "Unknown error"}`);
        }

        setStats({
          total: exchanges.length,
          processed: i + 1,
          factsExtracted,
          factsAdded,
          duplicates,
          conflicts,
          isComplete: false,
          errors: [...errors],
        });

        // Yield to UI
        await new Promise((r) => setTimeout(r, 0));
      }

      await save(pipeline);
      refreshState(pipeline);

      setStats((s) => ({ ...s, isComplete: true }));
      setPhase("done");
    },
    [pipeline, save, refreshState]
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
