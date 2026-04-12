"use client";

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUTS = [
  {
    group: "Creating",
    items: [
      { keys: ["N"], label: "New memory node at canvas centre" },
      { keys: ["Double-click"], label: "New node at cursor position" },
      { keys: ["C"], label: "Toggle connect mode (draw edges)" },
    ],
  },
  {
    group: "Selection",
    items: [
      { keys: ["Click"], label: "Preview node (peek card)" },
      { keys: ["Click", "Click"], label: "Open full node details" },
      { keys: ["Shift", "Click"], label: "Add/remove from selection" },
      { keys: ["Shift", "Drag"], label: "Box-select multiple nodes" },
      { keys: ["⌘", "A"], label: "Select all nodes" },
      { keys: ["⌘", "C"], label: "Copy selected nodes" },
      { keys: ["⌘", "V"], label: "Paste copied nodes" },
      { keys: ["Delete"], label: "Delete selected nodes" },
    ],
  },
  {
    group: "Canvas",
    items: [
      { keys: ["Drag"], label: "Pan canvas" },
      { keys: ["Scroll"], label: "Zoom in / out" },
      { keys: ["A"], label: "Auto-layout all vaults" },
      { keys: ["F"], label: "Fit all nodes in view" },
      { keys: ["P"], label: "Cycle Graph / Plain / Tree view" },
      { keys: ["⌘", "K"], label: "Search memories" },
      { keys: ["⌘", "0"], label: "Reset zoom to 100%" },
    ],
  },
  {
    group: "General",
    items: [
      {
        keys: ["Escape"],
        label: "Cancel / deselect / close (priority chain)",
      },
      { keys: ["?"], label: "This shortcuts reference" },
    ],
  },
];

export function KeyboardShortcutsModal({
  isOpen,
  onClose,
}: KeyboardShortcutsModalProps) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
      onClick={onClose}
    >
      <div
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border p-5"
        style={{
          backgroundColor: "var(--bg)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold">Keyboard shortcuts</h2>
        <div className="flex flex-col gap-5 text-sm">
          {SHORTCUTS.map((section, gi) => (
            <div key={`group-${gi}-${section.group}`}>
              <div
                className="mb-2 text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "var(--muted)" }}
              >
                {section.group}
              </div>
              <div className="flex flex-col gap-2">
                {section.items.map((row, ii) => (
                  <div
                    key={`item-${gi}-${ii}`}
                    className="flex flex-wrap items-start gap-2"
                  >
                    <div className="flex flex-wrap gap-1">
                      {row.keys.map((k, ki) => (
                        <kbd
                          key={`${gi}-${ii}-${ki}-${k}`}
                          className="rounded border px-1.5 py-0.5 font-mono text-[11px]"
                          style={{
                            borderColor: "var(--border)",
                            backgroundColor: "var(--surface)",
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                    <span style={{ color: "var(--muted)" }}>{row.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="mt-4 text-sm"
          style={{ color: "var(--orange)" }}
          onClick={onClose}
        >
          Close
        </button>
      </div>
    </div>
  );
}
