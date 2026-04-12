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
  const { currentView, pendingNodes, pendingConflicts } = useMemoreyState();
  const dispatch = useMemoreyDispatch();

  const activeTab = currentView === "node-detail" ? "nodes" : currentView;
  const conflictCount = pendingConflicts.filter((a) => a.type === "conflict").length;

  return (
    <nav className="memorey-view-switcher">
      {VIEWS.map((view) => (
        <button
          key={view.id}
          className={`memorey-view-tab${activeTab === view.id ? " memorey-view-tab--active" : ""}`}
          onClick={() => dispatch({ type: "SET_VIEW", view: view.id })}
        >
          {view.label}
          {view.id === "pending" && pendingNodes.length > 0 && (
            <span className="memorey-view-tab__badge">{pendingNodes.length}</span>
          )}
          {view.id === "conflicts" && conflictCount > 0 && (
            <span className="memorey-view-tab__badge memorey-view-tab__badge--conflict">{conflictCount}</span>
          )}
        </button>
      ))}
    </nav>
  );
}
