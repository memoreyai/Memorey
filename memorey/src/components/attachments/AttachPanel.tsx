"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fileTypeColor } from "@/lib/attachments";
import type { FileType, NodeAttachment } from "@/types/memorey";
import { toast } from "sonner";

type ExtractMeta = {
  title?: string;
  fileName?: string;
  fileType?: FileType;
  thumbnailUrl?: string | null;
  source?: NodeAttachment["source"];
  sourceFileId?: string | null;
  mimeType?: string | null;
};

export function AttachPanel({
  nodeId,
  onClose,
  onAttached,
}: {
  nodeId: string;
  onClose: () => void;
  onAttached: (row: Record<string, unknown>) => void;
}) {
  const [url, setUrl] = useState("");
  const [meta, setMeta] = useState<ExtractMeta | null>(null);
  const [loading, setLoading] = useState(false);
  const [customTitle, setCustomTitle] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchMeta = useCallback(async (value: string) => {
    try {
      new URL(value);
    } catch {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/attachments/extract-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      const data = (await res.json()) as ExtractMeta;
      setMeta(data);
      setCustomTitle(data.title ?? "");
    } catch {
      setMeta(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setMeta(null);
    if (!url.trim()) return;
    try {
      new URL(url.trim());
    } catch {
      return;
    }
    debounceRef.current = setTimeout(() => {
      void fetchMeta(url.trim());
    }, 450);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [url, fetchMeta]);

  async function handleSave() {
    const u = url.trim();
    if (!u || !meta) return;
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session?.access_token) {
      toast.error("Sign in to attach.");
      return;
    }

    const res = await fetch("/api/attachments", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({
        nodeId,
        fileUrl: u,
        fileName:
          meta.fileName ?? u.split("/").pop()?.split("?")[0] ?? "File",
        fileType: meta.fileType ?? "link",
        mimeType: meta.mimeType ?? null,
        thumbnailUrl: meta.thumbnailUrl ?? null,
        source: meta.source ?? "url",
        sourceFileId: meta.sourceFileId ?? null,
        title: customTitle.trim() || meta.title || null,
      }),
    });

    const json = (await res.json().catch(() => ({}))) as {
      error?: string;
      attachment?: Record<string, unknown>;
    };

    if (!res.ok || !json.attachment) {
      const msg =
        typeof json.error === "string" && json.error
          ? json.error
          : `Could not save attachment (${res.status})`;
      toast.error(msg);
      return;
    }

    onAttached(json.attachment);
    onClose();
    toast.success("Attachment added");
  }

  const metaType = meta?.fileType ?? "link";

  return (
    <div className="p-4" style={{ width: 320 }}>
      <div className="mb-3 text-[13px] font-semibold text-[#F5F4F0]">
        Attach a file or link
      </div>

      <div className="mb-3">
        <label className="mb-1.5 block text-[11px] text-[#F5F4F0]/50">
          Paste any URL
        </label>
        <input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://drive.google.com/... or any link"
          className="box-border w-full rounded-md border border-[#2A2A2E] bg-[#121214] px-2.5 py-1.5 text-xs text-[#F5F4F0] outline-none focus:border-[#FF6600]"
        />
        <p className="mt-1 text-[10px] text-[#F5F4F0]/35">
          Google Drive, Dropbox, YouTube, GitHub, Notion, and any URL
        </p>
      </div>

      {loading && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-[#F5F4F0]/50">
          <span
            className="inline-block h-2.5 w-2.5 animate-spin rounded-full border-[1.5px] border-[#FF6600] border-t-transparent"
            aria-hidden
          />
          Reading file info…
        </div>
      )}

      {meta && !loading && (
        <div className="mb-3 overflow-hidden rounded-lg border border-[#2A2A2E] bg-[#121214]">
          {meta.thumbnailUrl ? (
            <img
              src={meta.thumbnailUrl}
              alt=""
              className="block h-[100px] w-full object-cover"
            />
          ) : null}
          <div className="px-2.5 py-2">
            <input
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              className="box-border w-full border-b border-[#2A2A2E] bg-transparent py-0.5 text-xs font-medium text-[#F5F4F0] outline-none"
              placeholder="Title"
            />
            <div className="mt-1 flex items-center gap-1 text-[10px] text-[#F5F4F0]/50">
              <span
                className="text-[9px] font-semibold uppercase"
                style={{ color: fileTypeColor(metaType) }}
              >
                {metaType}
              </span>
              <span>·</span>
              <span>
                {meta.source === "googledrive"
                  ? "Google Drive"
                  : "External link"}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer px-2.5 py-1.5 text-xs text-[#F5F4F0]/50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={!meta || loading}
          className="rounded-md px-3.5 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:bg-[#1E1E21] disabled:text-[#F5F4F0]/40"
          style={{
            background: meta ? "#FF6600" : undefined,
            color: meta ? "#fff" : undefined,
          }}
        >
          Attach
        </button>
      </div>
    </div>
  );
}
