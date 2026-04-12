"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { mapAttachmentRow } from "@/lib/supabase/mappers";
import { resolveAvatarUrl } from "@/lib/resolveAvatarUrl";
import { useGraphStore } from "@/store/graphStore";
import { useVaultStore } from "@/store/vaultStore";
import type { MasterProfile } from "../types/graph.types";
import type { NodeAttachment } from "@/types/memorey";
import { useCanvasStore, type Canvas } from "@/store/canvasStore";

export function useGraphData(
  canvasId: string | null,
  isMasterView = false
): {
  userId: string | null;
  profile: MasterProfile | null;
  setProfile: React.Dispatch<React.SetStateAction<MasterProfile | null>>;
} {
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<MasterProfile | null>(null);
  const fetchNodes = useGraphStore((s) => s.fetchNodes);
  const fetchEdges = useGraphStore((s) => s.fetchEdges);
  const fetchVaults = useVaultStore((s) => s.fetchVaults);
  const fetchCanvasVaultLinks = useVaultStore((s) => s.fetchCanvasVaultLinks);
  const canvases: Canvas[] = useCanvasStore((s) => s.canvases);
  const setAttachmentData = useGraphStore((s) => s.setAttachmentData);
  const masterHiddenCanvasIds = useCanvasStore((s) => s.masterHiddenCanvasIds);

  // Stable string so the data-loading effect only re-runs when the actual
  // set of canvas IDs changes, not on every Zustand reference change.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const canvasIdKey = canvases.map((c) => c.id).sort().join(",");

  const loadAttachments = useCallback(
    async (uid: string) => {
      const supabase = createClient();
      const { data } = await supabase
        .from("node_attachments")
        .select("*")
        .eq("user_id", uid)
        .eq("is_active", true);
      const rows = (data ?? []).map((r) =>
        mapAttachmentRow(r as unknown as Record<string, unknown>)
      );
      const counts: Record<string, number> = {};
      const standalone: NodeAttachment[] = [];
      for (const a of rows) {
        if (a.nodeId) counts[a.nodeId] = (counts[a.nodeId] ?? 0) + 1;
        else standalone.push(a);
      }
      setAttachmentData(counts, standalone);
    },
    [setAttachmentData]
  );

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, session) => {
      setUserId(session?.user?.id ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    void (async () => {
      const [{ data: row }, { data: auth }] = await Promise.all([
        supabase
          .from("profiles")
          .select(
            "display_name, full_name, master_node_bio, avatar_url, master_node_color"
          )
          .eq("id", userId)
          .single(),
        supabase.auth.getUser(),
      ]);
      if (!row) return;
      const u = auth?.user;
      const raw =
        row.avatar_url ??
        (u?.user_metadata?.avatar_url as string | undefined) ??
        (u?.user_metadata?.picture as string | undefined) ??
        null;
      const resolved = resolveAvatarUrl(raw);
      setProfile({
        ...(row as MasterProfile),
        avatar_url: resolved ?? row.avatar_url,
      });
    })();
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    const cid = isMasterView ? null : canvasId;
    const exclude =
      isMasterView && masterHiddenCanvasIds.length > 0
        ? masterHiddenCanvasIds
        : undefined;
    void fetchVaults(userId, cid ?? undefined);
    void fetchNodes(userId, cid, { excludeCanvasIds: exclude });
    void fetchEdges(userId, cid, { excludeCanvasIds: exclude });
    void loadAttachments(userId);

    const cids = isMasterView
      ? canvasIdKey.split(",").filter(Boolean)
      : canvasId
        ? [canvasId]
        : [];
    if (cids.length > 0) void fetchCanvasVaultLinks(cids);
  // Use canvasIdKey (stable string) instead of canvases (unstable array ref)
  // to prevent spurious re-fetches when a canvas is added to the store.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    userId,
    canvasId,
    isMasterView,
    masterHiddenCanvasIds,
    canvasIdKey,
    fetchNodes,
    fetchEdges,
    fetchVaults,
    fetchCanvasVaultLinks,
    loadAttachments,
  ]);

  useEffect(() => {
    if (!userId) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`graph-${canvasId ?? "all"}-${isMasterView ? "m" : "s"}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "memory_nodes" },
        (payload) => {
          const row = payload.new as { canvas_id?: string | null } | null;
          const oldRow = payload.old as { canvas_id?: string | null } | null;
          const cid = row?.canvas_id ?? oldRow?.canvas_id;
          if (!isMasterView && canvasId && cid !== canvasId) return;
          void fetchNodes(userId, isMasterView ? null : canvasId, {
            excludeCanvasIds:
              isMasterView && masterHiddenCanvasIds.length > 0
                ? masterHiddenCanvasIds
                : undefined,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "node_edges" },
        (payload) => {
          const row = payload.new as { canvas_id?: string | null } | null;
          const oldRow = payload.old as { canvas_id?: string | null } | null;
          const cid = row?.canvas_id ?? oldRow?.canvas_id;
          if (!isMasterView && canvasId && cid !== canvasId) return;
          void fetchEdges(userId, isMasterView ? null : canvasId, {
            excludeCanvasIds:
              isMasterView && masterHiddenCanvasIds.length > 0
                ? masterHiddenCanvasIds
                : undefined,
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "node_attachments" },
        () => {
          void loadAttachments(userId);
        }
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [
    userId,
    canvasId,
    isMasterView,
    masterHiddenCanvasIds,
    fetchNodes,
    fetchEdges,
    loadAttachments,
  ]);

  return { userId, profile, setProfile };
}
