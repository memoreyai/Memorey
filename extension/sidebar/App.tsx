import React from "react";
import { Layout } from "./components/Layout";
import { DashboardView } from "./views/DashboardView";
import { NodesListView } from "./views/NodesListView";
import { NodeDetailView } from "./views/NodeDetailView";
import { PendingView } from "./views/PendingView";
import { ConflictsView } from "./views/ConflictsView";
import { KanbanView } from "./views/KanbanView";
import { CanvasView } from "./views/CanvasView";
import { ImportView } from "./views/ImportView";
import { useMemoreyState } from "./store/memoreyStore";
import { useMemoreyEngine } from "./hooks/useMemoreyEngine";
import { useEvents } from "./hooks/useEvents";
import { PipelineContext } from "./hooks/usePipeline";

export function App() {
  const { currentView } = useMemoreyState();
  const { pipeline, isReady, error, refreshState, save } = useMemoreyEngine();

  useEvents(pipeline);

  if (error) {
    return (
      <div className="memorey-loading">
        <span>Failed to load: {error}</span>
      </div>
    );
  }

  if (!isReady || !pipeline) {
    return (
      <div className="memorey-loading">
        <div className="memorey-loading__spinner" />
        <span>Loading Memorey...</span>
      </div>
    );
  }

  return (
    <PipelineContext.Provider value={{ pipeline, refreshState, save }}>
      <Layout>
        {currentView === "dashboard" && <DashboardView />}
        {currentView === "nodes" && <NodesListView />}
        {currentView === "node-detail" && <NodeDetailView />}
        {currentView === "pending" && <PendingView />}
        {currentView === "conflicts" && <ConflictsView />}
        {currentView === "kanban" && <KanbanView />}
        {currentView === "canvas" && <CanvasView />}
        {currentView === "import" && <ImportView />}
      </Layout>
    </PipelineContext.Provider>
  );
}
