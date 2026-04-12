import type { GraphNode } from "@/types/memorey";
import { isFileGraphNode } from "./fileNodeHelpers";
import {
  NODE_W,
  NODE_H,
  ATTACH_W,
  ATTACH_H,
  STICKY_W,
  STICKY_H,
  FILE_NODE_W,
  FILE_NODE_H,
} from "../constants/dimensions";

/** World-space card size — matches `nodeAt` hit targets and canvas draw. */
export function graphNodeCardWorldDimensions(node: GraphNode): {
  w: number;
  h: number;
} {
  if (node.nodeKind === "attachment") {
    return { w: ATTACH_W, h: ATTACH_H };
  }
  if (isFileGraphNode(node)) {
    return { w: FILE_NODE_W, h: FILE_NODE_H };
  }
  if (node.nodeType === "sticky") {
    return { w: STICKY_W, h: STICKY_H };
  }
  return { w: NODE_W, h: NODE_H };
}
