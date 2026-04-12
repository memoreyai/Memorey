import { useEffect, useState, useRef } from "react";
import type { MemoreyPipeline } from "memorey-core";
import type { MemoreyEvent } from "memorey-core";

interface EventState {
  recentEvents: MemoreyEvent[];
  pendingCount: number;
  conflictCount: number;
  lastEventType: string | null;
}

/**
 * Subscribes to the EventBus from the pipeline and returns reactive state
 * that updates when events fire.
 */
export function useEvents(pipeline: MemoreyPipeline | null): EventState {
  const [state, setState] = useState<EventState>({
    recentEvents: [],
    pendingCount: 0,
    conflictCount: 0,
    lastEventType: null,
  });
  const eventsRef = useRef<MemoreyEvent[]>([]);

  useEffect(() => {
    if (!pipeline) return;

    // Get initial counts
    const pending = pipeline.getPendingNodes();
    const conflicts = pipeline.getPendingConflicts();
    setState((prev) => ({
      ...prev,
      pendingCount: pending.length,
      conflictCount: conflicts.length,
    }));

    // Subscribe to all events
    const unsubscribe = pipeline.onAny((event: MemoreyEvent) => {
      eventsRef.current = [event, ...eventsRef.current].slice(0, 50);

      // Recalculate counts from pipeline
      const newPending = pipeline.getPendingNodes();
      const newConflicts = pipeline.getPendingConflicts();

      setState({
        recentEvents: eventsRef.current,
        pendingCount: newPending.length,
        conflictCount: newConflicts.length,
        lastEventType: event.type,
      });
    });

    return () => {
      unsubscribe();
    };
  }, [pipeline]);

  return state;
}
