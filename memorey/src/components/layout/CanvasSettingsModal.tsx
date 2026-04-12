"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { KANBAN_COLUMN_PRESET_COLORS } from "@/components/kanban/KanbanColumnSettingsModal";
import { LucideIconPicker } from "@/components/graph/ui/LucideIconPicker";
import { CanvasDynamicLucideIcon } from "@/components/layout/CanvasDynamicLucideIcon";
import { cn } from "@/lib/utils";
import type { Canvas } from "@/store/canvasStore";
import { useCanvasStore } from "@/store/canvasStore";
import { Check } from "lucide-react";

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: "Smileys",
    emojis: ["🧠", "💡", "⭐", "🔥", "🚀", "💎", "🎯", "✨", "💪", "🏆"],
  },
  {
    label: "Objects",
    emojis: ["📝", "📚", "💼", "🔬", "💻", "🎨", "🎮", "📊", "📁", "🗂️"],
  },
  {
    label: "Nature",
    emojis: ["🌐", "🌍", "🌱", "🌊", "🏔️", "🌙", "☀️", "🌈"],
  },
  {
    label: "Symbols",
    emojis: ["❤️", "💜", "💙", "💚", "🔴", "🟡", "🟢", "🔵"],
  },
];

const PREFERRED_LUCIDE = [
  "Folder",
  "Star",
  "Heart",
  "Briefcase",
  "Code",
  "BookOpen",
  "Lightbulb",
  "Rocket",
  "Target",
  "Zap",
  "Globe",
  "Music",
  "Camera",
  "Coffee",
  "Gamepad2",
  "Palette",
  "GraduationCap",
  "Microscope",
  "Wrench",
  "Shield",
] as const;

type Draft = {
  name: string;
  emoji: string;
  iconKey: string | null;
  color: string;
  description: string;
};

function draftKey(d: Draft): string {
  return JSON.stringify({
    name: d.name.trim(),
    emoji: d.emoji,
    iconKey: d.iconKey,
    color: d.color.toUpperCase(),
    description: d.description.trim(),
  });
}

function normHex(hex: string): string {
  let h = hex.trim();
  if (!h.startsWith("#")) h = `#${h}`;
  if (h.length === 4) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  return h.slice(0, 7).toUpperCase();
}

export function CanvasSettingsModal({
  open,
  onOpenChange,
  canvas,
  userId,
  scrollToDanger = false,
}: {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  canvas: Canvas | null;
  userId: string;
  /** When true (e.g. opened from sidebar “Delete”), scroll the danger zone into view. */
  scrollToDanger?: boolean;
}) {
  const router = useRouter();
  const updateCanvas = useCanvasStore((s) => s.updateCanvas);
  const deleteCanvas = useCanvasStore((s) => s.deleteCanvas);
  const canvases = useCanvasStore((s) => s.canvases);

  const [draft, setDraft] = useState<Draft>({
    name: "",
    emoji: "🧠",
    iconKey: null,
    color: "#5DCAA5",
    description: "",
  });
  const [pickerTab, setPickerTab] = useState<"emoji" | "icon">("emoji");
  const [savedFlash, setSavedFlash] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);

  const lastSavedKey = useRef("");
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const dangerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !canvas) return;
    const initial: Draft = {
      name: canvas.name.slice(0, 50),
      emoji: canvas.emoji ?? "",
      iconKey: canvas.iconKey ?? null,
      color: canvas.color ?? "#5DCAA5",
      description: (canvas.description ?? "").slice(0, 200),
    };
    setDraft(initial);
    lastSavedKey.current = draftKey(initial);
    setPickerTab(canvas.iconKey ? "icon" : "emoji");
    setDeleteArmed(false);
    setSavedFlash(false);
  }, [open, canvas?.id]);

  useEffect(() => {
    if (!open || !scrollToDanger) return;
    const t = window.setTimeout(() => {
      dangerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }, 120);
    return () => window.clearTimeout(t);
  }, [open, canvas?.id, scrollToDanger]);

  useEffect(() => {
    if (!deleteArmed) return;
    const t = window.setTimeout(() => setDeleteArmed(false), 5000);
    return () => window.clearTimeout(t);
  }, [deleteArmed]);

  const persist = useCallback(
    async (d: Draft) => {
      if (!canvas) return;
      const key = draftKey(d);
      if (key === lastSavedKey.current) return;
      const nextName = d.name.trim();
      if (!nextName) return;
      await updateCanvas(canvas.id, {
        name: nextName.slice(0, 50),
        emoji: d.emoji.trim() ? d.emoji.trim() : null,
        iconKey: d.iconKey,
        color: d.color,
        description: d.description.trim() ? d.description.trim() : null,
      });
      lastSavedKey.current = key;
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1400);
    },
    [canvas, updateCanvas]
  );

  useEffect(() => {
    if (!open || !canvas) return;
    const t = window.setTimeout(() => {
      void persist(draftRef.current);
    }, 500);
    return () => window.clearTimeout(t);
  }, [draft, open, canvas?.id, persist]);

  const currentHex = normHex(draft.color);

  const handleDelete = async () => {
    if (!canvas || canvases.length <= 1) return;
    if (!deleteArmed) {
      setDeleteArmed(true);
      return;
    }
    const ok = await deleteCanvas(canvas.id, userId);
    setDeleteArmed(false);
    if (ok) {
      onOpenChange(false);
      router.push("/dashboard");
      router.refresh();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "max-h-[min(92vh,840px)] gap-0 overflow-y-auto border-[var(--border)] bg-[var(--card-bg)] p-0 text-[var(--text)]",
          "sm:max-w-[480px]"
        )}
      >
        <DialogHeader className="border-b border-[var(--border)] px-4 py-3">
          <div className="flex items-center justify-between gap-2 pr-8">
            <DialogTitle className="text-base font-semibold text-[var(--text)]">
              Canvas Settings
            </DialogTitle>
            {savedFlash ? (
              <span
                className="text-[11px] font-medium tabular-nums text-[var(--text2)] transition-opacity"
                aria-live="polite"
              >
                Saved
              </span>
            ) : null}
          </div>
        </DialogHeader>

        {canvas ? (
          <div className="flex flex-col gap-4 px-4 py-4">
            <div
              className="flex items-center gap-3 rounded-lg border p-3"
              style={{
                borderColor: "var(--border)",
                background: "var(--bg2)",
              }}
            >
              <div
                className="h-12 w-1 shrink-0 rounded-full"
                style={{ background: draft.color }}
              />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex size-10 shrink-0 items-center justify-center text-2xl leading-none">
                  {draft.iconKey ? (
                    <CanvasDynamicLucideIcon
                      name={draft.iconKey}
                      size={28}
                      color={draft.color}
                    />
                  ) : (
                    <span aria-hidden>{draft.emoji}</span>
                  )}
                </span>
                <span className="truncate text-sm font-semibold text-[var(--text)]">
                  {draft.name.trim() || canvas.name || "Untitled"}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text2)]">
                  Name
                </span>
                <span className="text-[10px] text-[var(--text2)]">
                  {draft.name.length}/50
                </span>
              </div>
              <Input
                value={draft.name}
                maxLength={50}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, name: e.target.value.slice(0, 50) }))
                }
                className="h-9 text-sm"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
              />
            </div>

            <Tabs
              value={pickerTab}
              onValueChange={(v) => setPickerTab(v as "emoji" | "icon")}
            >
              <TabsList variant="line" className="w-full">
                <TabsTrigger value="emoji" className="flex-1">
                  Emoji
                </TabsTrigger>
                <TabsTrigger value="icon" className="flex-1">
                  Icon
                </TabsTrigger>
              </TabsList>
              <TabsContent value="emoji" className="mt-3 space-y-3">
                {EMOJI_CATEGORIES.map((cat) => (
                  <div key={cat.label} className="space-y-1.5">
                    <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text2)]">
                      {cat.label}
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {cat.emojis.map((em) => {
                        const selected = !draft.iconKey && draft.emoji === em;
                        return (
                          <button
                            key={`${cat.label}-${em}`}
                            type="button"
                            className={cn(
                              "flex size-9 items-center justify-center rounded-lg border-2 text-lg transition-transform hover:scale-[1.05]",
                              selected
                                ? "border-[var(--primary)] ring-2 ring-[var(--primary)]/30"
                                : "border-transparent"
                            )}
                            style={{ background: "var(--bg3)" }}
                            onClick={() =>
                              setDraft((d) => ({
                                ...d,
                                emoji: em,
                                iconKey: null,
                              }))
                            }
                          >
                            {em}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </TabsContent>
              <TabsContent value="icon" className="mt-3">
                <LucideIconPicker
                  value={draft.iconKey}
                  accentColor={draft.color}
                  preferredIconNames={[...PREFERRED_LUCIDE]}
                  onChange={(name) =>
                    setDraft((d) => ({ ...d, iconKey: name }))
                  }
                />
              </TabsContent>
            </Tabs>

            <div className="flex flex-col gap-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text2)]">
                Accent color
              </span>
              <div className="grid grid-cols-6 gap-2">
                {KANBAN_COLUMN_PRESET_COLORS.map((preset) => {
                  const selected = currentHex === normHex(preset);
                  return (
                    <button
                      key={preset}
                      type="button"
                      title={preset}
                      className={cn(
                        "relative flex size-9 items-center justify-center rounded-lg border-2 transition-[box-shadow,transform] hover:scale-[1.03]",
                        selected
                          ? "border-[var(--text)] ring-2 ring-[var(--text)]/25"
                          : "border-transparent"
                      )}
                      style={{ backgroundColor: preset }}
                      onClick={() =>
                        setDraft((d) => ({ ...d, color: normHex(preset) }))
                      }
                    >
                      {selected ? (
                        <Check
                          className="size-4 text-white drop-shadow-md"
                          strokeWidth={2.5}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-[var(--text2)]">
                  Description
                </span>
                <span className="text-[10px] text-[var(--text2)]">
                  {draft.description.length}/200
                </span>
              </div>
              <Textarea
                value={draft.description}
                maxLength={200}
                rows={3}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    description: e.target.value.slice(0, 200),
                  }))
                }
                className="resize-y text-sm"
                style={{
                  borderColor: "var(--border)",
                  background: "var(--bg)",
                  color: "var(--text)",
                }}
                placeholder="Optional notes about this canvas…"
              />
            </div>

            <Separator className="bg-[var(--border)]" />

            <div ref={dangerRef} className="flex flex-col gap-2 pb-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text2)]">
                Danger zone
              </span>
              <Button
                type="button"
                variant="destructive"
                className={cn(
                  "h-auto min-h-9 w-full whitespace-normal py-2 text-left text-sm",
                  deleteArmed && "ring-2 ring-destructive/50"
                )}
                disabled={canvases.length <= 1}
                onClick={() => void handleDelete()}
              >
                {canvases.length <= 1
                  ? "Cannot delete your only canvas"
                  : deleteArmed
                    ? "This will delete the canvas and move all its memories to your default canvas. Click again to confirm."
                    : "Delete canvas"}
              </Button>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
