import React from "react";
import { useMemoreyState, useMemoreyDispatch, type View } from "../store/memoreyStore";

const VIEWS: { id: View; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "nodes", label: "Nodes" },
  { id: "pending", label: "Pending" },
  { id: "kanban", label: "Kanban" },
  { id: "conflicts", label: "Conflicts" },
  { id: "canvas", label: "Canvas" },
  { id: "import", label: "Import" },
];

export function ViewSwitcher() {
  const { currentView, pendingNodes, pendingProposals } = useMemoreyState();
  const dispatch = useMemoreyDispatch();

  const activeTab = currentView === "node-detail" ? "nodes" : currentView;
  const pendingCount = pendingNodes.length + pendingProposals.length;

  return (
    <nav className="memorey-view-switcher">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          className={`memorey-view-tab${activeTab === view.id ? " memorey-view-tab--active" : ""}`}
          onClick={() => dispatch({ type: "SET_VIEW", view: view.id })}
        >
          {view.label}
          {view.id === "pending" && pendingCount > 0 && (
            <span className="memorey-view-tab__badge">{pendingCount}</span>
          )}
          {view.id === "conflicts" && pendingProposals.length > 0 && (
            <span className="memorey-view-tab__badge">{pendingProposals.length}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
