import React from "react";

export interface ImportStats {
  total: number;
  processed: number;
  factsExtracted: number;
  factsAdded: number;
  duplicates: number;
  conflicts: number;
  isComplete: boolean;
  errors: string[];
}

interface ImportProgressProps {
  stats: ImportStats;
  onViewPending: () => void;
  onViewConflicts: () => void;
  onDone: () => void;
}

export function ImportProgress({ stats, onViewPending, onViewConflicts, onDone }: ImportProgressProps) {
  const pct = stats.total > 0 ? Math.round((stats.processed / stats.total) * 100) : 0;

  return (
    <div className="memorey-import-progress">
      {!stats.isComplete ? (
        <>
          <div className="memorey-import-progress__header">Importing...</div>
          <div className="memorey-import-progress__bar-container">
            <div className="memorey-import-progress__bar">
              <div
                className="memorey-import-progress__bar-fill"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="memorey-import-progress__pct">{pct}%</span>
          </div>
          <div className="memorey-import-progress__status">
            Processing exchange {stats.processed} of {stats.total}...
          </div>
          <div className="memorey-import-progress__counters">
            <CounterRow label="Facts extracted" value={stats.factsExtracted} />
            <CounterRow label="Facts added" value={stats.factsAdded} />
            <CounterRow label="Duplicates found" value={stats.duplicates} />
            <CounterRow label="Conflicts found" value={stats.conflicts} />
          </div>
        </>
      ) : (
        <>
          <div className="memorey-import-progress__header memorey-import-progress__header--done">
            Import Complete
          </div>
          <div className="memorey-import-progress__summary">
            <SummaryRow label="Total exchanges" value={stats.total} />
            <SummaryRow label="Facts extracted" value={stats.factsExtracted} />
            <SummaryRow label="Facts added" value={stats.factsAdded} />
            <SummaryRow label="Duplicates skipped" value={stats.duplicates} />
            <SummaryRow label="Conflicts detected" value={stats.conflicts} highlight={stats.conflicts > 0} />
          </div>

          {stats.errors.length > 0 && (
            <div className="memorey-import-progress__errors">
              <div className="memorey-import-progress__errors-title">
                {stats.errors.length} error{stats.errors.length > 1 ? "s" : ""}
              </div>
              {stats.errors.slice(0, 5).map((err, i) => (
                <div key={i} className="memorey-import-progress__error-item">{err}</div>
              ))}
            </div>
          )}

          <div className="memorey-import-progress__actions">
            {stats.factsAdded > 0 && (
              <button className="memorey-btn memorey-btn--sm" onClick={onViewPending}>
                View pending facts
              </button>
            )}
            {stats.conflicts > 0 && (
              <button className="memorey-btn memorey-btn--sm" onClick={onViewConflicts}>
                View conflicts
              </button>
            )}
            <button className="memorey-btn memorey-btn--primary" onClick={onDone}>
              Done
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function CounterRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="memorey-import-progress__counter-row">
      <span className="memorey-import-progress__counter-label">{label}</span>
      <span className="memorey-import-progress__counter-value">{value}</span>
    </div>
  );
}

function SummaryRow({ label, value, highlight = false }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className={`memorey-import-progress__summary-row${highlight ? " memorey-import-progress__summary-row--highlight" : ""}`}>
      <span>{label}</span>
      <span className="memorey-import-progress__summary-value">{value}</span>
    </div>
  );
}
