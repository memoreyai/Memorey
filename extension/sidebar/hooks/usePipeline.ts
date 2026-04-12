import { createContext, useContext } from "react";
import type { MemoreyPipeline } from "memorey-core";

interface PipelineContextValue {
  pipeline: MemoreyPipeline;
  refreshState: (p: MemoreyPipeline) => void;
  save: (p: MemoreyPipeline) => Promise<void>;
}

export const PipelineContext = createContext<PipelineContextValue | null>(null);

export function usePipeline(): PipelineContextValue {
  const ctx = useContext(PipelineContext);
  if (!ctx) throw new Error("usePipeline must be used within PipelineContext.Provider");
  return ctx;
}
