"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { openDiff } from "@/components/diff/useDiff";
import { cn } from "@/lib/utils";

const POLL_MS = 20_000;

export function PendingProposalsBell({
  userId,
  expanded,
}: {
  userId: string;
  expanded: boolean;
}) {
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

  const onOpen = useCallback(async () => {
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

  return (
    <div className={cn("px-2 pb-1", !expanded && "flex justify-center")}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(
          "relative h-10 w-full justify-start gap-2 rounded-md transition-colors",
          "text-[color:var(--text2)] hover:bg-[color:var(--bg4)] hover:text-[color:var(--text)]",
          !expanded && "w-9 justify-center px-0"
        )}
        onClick={() => void onOpen()}
        aria-label={
          count > 0
            ? `${count} pending memory proposals from MCP`
            : "Pending MCP proposals"
        }
        title={expanded ? undefined : "MCP proposals"}
      >
        <span className="relative inline-flex">
          <Bell className="size-[18px] shrink-0" />
          {count > 0 ? (
            <span
              className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold tabular-nums"
              style={{
                backgroundColor: "var(--orange)",
                color: "#0c0b09",
              }}
              aria-hidden
            >
              {count > 99 ? "99+" : count}
            </span>
          ) : null}
        </span>
        {expanded ? (
          <span className="truncate text-sm">MCP inbox</span>
        ) : null}
      </Button>
    </div>
  );
}
