import type { GraphNode } from "@/types/memorey";

export function isFileGraphNode(n: GraphNode): boolean {
  return n.nodeKindV2 === "file" || Boolean(n.fileUrl);
}
