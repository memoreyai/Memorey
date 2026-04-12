"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { openDiff } from "@/components/diff/useDiff";

const POLL_MS = 20_000;

export function useMcpInbox(userId: string) {
  const [count, setCount] = useState(0);

  const refresh = useCallback(async () => {
    const supabase = createClient();
    const { count: n, error } = await supabase
      .from("pending_proposals")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "pending");
    if (!error && typeof n === "number") setCount(n);
  }, [userId]);

  useEffect(() => {
    queueMicrotask(() => void refresh());
    const t = setInterval(() => void refresh(), POLL_MS);
    const onRefresh = () => void refresh();
    window.addEventListener("memorey-pending-refresh", onRefresh);
    return () => {
      clearInterval(t);
      window.removeEventListener("memorey-pending-refresh", onRefresh);
    };
  }, [refresh]);

  const openInbox = useCallback(async () => {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("pending_proposals")
      .select("id, category, title, value, created_at")
      .eq("user_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error || !data?.length) {
      await refresh();
      return;
    }

    openDiff({
      proposals: data.map((row) => ({
        tempId: `pending-${row.id}`,
        pendingProposalId: row.id,
        category: row.category,
        title: row.title,
        newValue: row.value,
        confidence: 1,
        isNew: true,
      })),
      summary:
        "These memory nodes were proposed by an MCP-connected AI (e.g. Claude Desktop, Cursor). Confirm to add them to your graph.",
      maxVisibleNodes: 50,
      memorySource: "extension",
    });
  }, [userId, refresh]);

  return { count, openInbox, refresh };
}
