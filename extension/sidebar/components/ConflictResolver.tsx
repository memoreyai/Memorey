import { useCallback, useState } from "react";
import type { ReconciliationAction } from "memorey-core";
import { usePipeline } from "../hooks/usePipeline";

type ConflictAction = ReconciliationAction & { type: "conflict" };

interface ResolveRequest {
  conflict: ConflictAction;
  resolution: "keep_existing" | "use_new" | "keep_both";
  confidence?: number;
}

export function useConflictResolver() {
  const { pipeline, refreshState, save } = usePipeline();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }, []);

  const resolve = useCallback(
    (req: ResolveRequest) => {
      const { conflict, resolution, confidence } = req;

      pipeline.resolveConflict(conflict, resolution, confidence);
      refreshState(pipeline);
      save(pipeline);

      const labels: Record<string, string> = {
        keep_existing: "Kept existing fact",
        use_new: "Replaced with new fact",
        keep_both: "Kept both facts",
      };
      showToast(labels[resolution]);
    },
    [pipeline, refreshState, save, showToast]
  );

  return { resolve, toast };
}
