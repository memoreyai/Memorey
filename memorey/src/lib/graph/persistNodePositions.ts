import { createClient } from "@/lib/supabase/client";
import { useGraphStore } from "@/store/graphStore";
import type { VaultLayoutRefs } from "@/components/graph/layout/types";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isMemoryNodeRowId(id: string): boolean {
  return UUID_RE.test(id);
}

const DEBOUNCE_MS = 500;
const persistTimers = new Map<string, ReturnType<typeof setTimeout>>();

export function schedulePersistNodePositionAfterDrag(
  nodeId: string,
  x: number,
  y: number
): void {
  const prev = persistTimers.get(nodeId);
  if (prev) clearTimeout(prev);
  persistTimers.set(
    nodeId,
    setTimeout(() => {
      persistTimers.delete(nodeId);
      void persistNodePosition(nodeId, x, y);
    }, DEBOUNCE_MS)
  );
}

async function persistNodePosition(
  nodeId: string,
  x: number,
  y: number
): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  if (!isMemoryNodeRowId(nodeId)) return;
  const { error } = await supabase
    .from("memory_nodes")
    .update({ pos_x: x, pos_y: y })
    .eq("id", nodeId)
    .eq("user_id", user.id);
  if (!error) {
    useGraphStore.getState().updateNode(nodeId, { posX: x, posY: y });
  }
}

/** After explicit auto-layout: write every positioned memory node to the DB. */
export async function persistAllGraphNodePositionsFromRefs(
  refs: VaultLayoutRefs
): Promise<void> {
  const np = refs.nodePositionsRef.current;
  const memIds = new Set(useGraphStore.getState().nodes.map((m) => m.id));
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const updates: Array<{ id: string; x: number; y: number }> = [];
  for (const [id, p] of np) {
    if (!memIds.has(id)) continue;
    if (!isMemoryNodeRowId(id)) continue;
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    updates.push({ id, x: p.x, y: p.y });
  }
  if (updates.length === 0) return;

  const CHUNK = 50;
  for (let i = 0; i < updates.length; i += CHUNK) {
    const chunk = updates.slice(i, i + CHUNK);
    await Promise.all(
      chunk.map((r) =>
        supabase
          .from("memory_nodes")
          .update({ pos_x: r.x, pos_y: r.y })
          .eq("id", r.id)
          .eq("user_id", user.id)
      )
    );
  }

  for (const r of updates) {
    useGraphStore.getState().updateNode(r.id, { posX: r.x, posY: r.y });
  }
}
