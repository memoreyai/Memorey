"use client";

import { useState, useCallback, useEffect } from "react";
import { ClipboardPaste, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useVaultStore } from "@/store/vaultStore";
import { openDiff } from "@/components/diff";
import { useTrack } from "@/hooks/useTrack";
import { useCanvasStore } from "@/store/canvasStore";
import type { DiffProposal, ProposedNode } from "@/types/memorey";

const MIN_PHASE_MS = 800;
const CAPTURE_CANVAS_LS = "memorey-capture-canvas";

const PHASE_LABELS = [
  "",
  "Fetching conversation...",
  "Extracting memories...",
  "Deleting link...",
] as const;

export function isShareLinkUrl(urlString: string): boolean {
  const url = urlString.trim();
  if (!url) return false;
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return false;
    const h = u.hostname.replace(/^www\./i, "").toLowerCase();
    const path = u.pathname;
    if (h === "chat.openai.com" && path.startsWith("/share/")) return true;
    if (h === "chatgpt.com" && path.startsWith("/share/")) return true;
    if (h === "claude.ai" && path.startsWith("/share/")) return true;
    if (h === "gemini.google.com") return true;
    if (h === "perplexity.ai") return true;
    return false;
  } catch {
    return false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function ShareLinkInput() {
  const { track } = useTrack();
  const canvases = useCanvasStore((s) => s.canvases);
  const isMasterView = useCanvasStore((s) => s.isMasterView);
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const [captureCanvasId, setCaptureCanvasId] = useState<string | null>(null);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [phase, setPhase] = useState<0 | 1 | 2 | 3>(0);
  const [successLine, setSuccessLine] = useState<string | null>(null);

  useEffect(() => {
    if (!isMasterView && activeCanvasId) {
      setCaptureCanvasId(activeCanvasId);
      return;
    }
    if (isMasterView) {
      try {
        const last = localStorage.getItem(CAPTURE_CANVAS_LS);
        if (last && canvases.some((c) => c.id === last)) {
          setCaptureCanvasId(last);
          return;
        }
      } catch {
        /* ignore */
      }
      setCaptureCanvasId((prev) =>
        prev && canvases.some((c) => c.id === prev)
          ? prev
          : (activeCanvasId ?? canvases[0]?.id ?? null)
      );
    }
  }, [isMasterView, activeCanvasId, canvases]);

  const showCanvasPicker = isMasterView || canvases.length > 1;

  const trimmed = value.trim();
  const urlLooksValid = trimmed.length > 0 && isShareLinkUrl(trimmed);
  const busy = phase > 0;

  const runIngest = useCallback(async (url: string) => {
    setError("");
    setSuccessLine(null);

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      setError("Sign in to capture from share links.");
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sign in to capture from share links.");
      return;
    }

    const activeVaultIds = Array.from(useVaultStore.getState().activeVaultIds);

    const targetCanvasId =
      captureCanvasId ?? activeCanvasId ?? canvases[0]?.id ?? null;

    const apiPromise = fetch("/api/ingest-link", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        url: url.trim(),
        userId: user.id,
        activeVaultIds:
          activeVaultIds.length > 0 ? activeVaultIds : undefined,
        canvasId: targetCanvasId ?? undefined,
      }),
    })
      .then(async (res) => {
        const data = (await res.json()) as Record<string, unknown>;
        return { ok: res.ok, data };
      })
      .catch(() => ({
        ok: false as const,
        data: { error: "Something went wrong. Try again." },
      }));

    setPhase(1);
    await sleep(MIN_PHASE_MS);
    setPhase(2);
    await sleep(MIN_PHASE_MS);
    setPhase(3);
    await Promise.all([apiPromise, sleep(MIN_PHASE_MS)]);

    const { ok, data } = await apiPromise;
    setPhase(0);

    if (!ok && typeof data.error === "string") {
      setError(data.error);
      return;
    }

    if (!ok) {
      setError("Something went wrong. Try again.");
      return;
    }

    const proposals = data.proposals as ProposedNode[] | undefined;
    const summary = typeof data.summary === "string" ? data.summary : "";
    const totalExtracted =
      typeof data.totalExtracted === "number"
        ? data.totalExtracted
        : Array.isArray(proposals)
          ? proposals.length
          : 0;

    if (!Array.isArray(proposals)) {
      setError("Invalid response from server.");
      return;
    }

    const proposal: DiffProposal = {
      proposals,
      summary,
      totalExtracted,
      fromShareLink: true,
      memorySource: "share_link",
      canvasId: targetCanvasId,
    };

    openDiff(proposal);
    track("capture_link_ingested", {});
    setSuccessLine("Memories extracted. Review and confirm in the panel above.");
  }, [track, captureCanvasId, activeCanvasId, canvases]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const url = value.trim();
    if (!isShareLinkUrl(url)) {
      setError(
        "Use a share link from ChatGPT, Claude, Gemini, or Perplexity."
      );
      return;
    }
    void runIngest(url);
  };

  const onPasteFromClipboard = async () => {
    if (busy) return;
    try {
      const text = await navigator.clipboard.readText();
      const u = text.trim();
      setValue(u);
      if (isShareLinkUrl(u)) {
        setError("");
        await runIngest(u);
      } else {
        setError(
          "Clipboard does not contain a supported share link. Paste the URL in the field."
        );
      }
    } catch {
      setError("Could not read clipboard. Paste the link manually.");
    }
  };

  return (
    <div className="w-full max-w-full md:max-w-xl">
      {showCanvasPicker ? (
        <div className="mb-4">
          <label
            className="mb-1 block text-xs font-medium"
            style={{ color: "var(--text2)" }}
          >
            Save new memories to canvas
          </label>
          <select
            className="w-full max-w-md rounded-md border px-3 py-2 text-sm"
            style={{
              borderColor: "var(--border)",
              background: "var(--bg2)",
              color: "var(--text)",
            }}
            value={captureCanvasId ?? ""}
            onChange={(e) => {
              const v = e.target.value || null;
              setCaptureCanvasId(v);
              if (v && isMasterView) {
                try {
                  localStorage.setItem(CAPTURE_CANVAS_LS, v);
                } catch {
                  /* ignore */
                }
              }
            }}
          >
            {canvases.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="relative">
        <div
          className={`flex items-stretch rounded-lg border transition-colors ${
            urlLooksValid
              ? "border-emerald-600/40 bg-[#141416]"
              : "border-[#2a2a2e] bg-[#121214]"
          } ${busy ? "opacity-90" : ""}`}
        >
          <button
            type="button"
            onClick={() => void onPasteFromClipboard()}
            disabled={busy}
            className="flex shrink-0 items-center justify-center px-3 text-[#F5F4F0]/50 hover:text-[#F5F4F0] disabled:pointer-events-none disabled:opacity-35"
            aria-label="Paste from clipboard"
          >
            <ClipboardPaste className="size-5" />
          </button>
          <input
            type="url"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              if (error) setError("");
            }}
            placeholder="Paste a shareable AI chat link..."
            disabled={busy}
            className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-sm text-[#F5F4F0] placeholder:text-[#F5F4F0]/35 outline-none disabled:opacity-60"
          />
        </div>
        {phase > 0 && (
          <p className="mt-3 flex items-center gap-2 text-sm text-[#F5F4F0]/60">
            <Loader2 className="size-4 shrink-0 animate-spin text-emerald-500/80" />
            {PHASE_LABELS[phase]}
          </p>
        )}
        {error ? (
          <p className="mt-2 text-sm text-red-400/95">{error}</p>
        ) : null}
        {successLine && !error ? (
          <p className="mt-2 text-sm font-medium text-emerald-500/90">
            {successLine}
          </p>
        ) : null}
      </form>
    </div>
  );
}
