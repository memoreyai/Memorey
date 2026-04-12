"use client";

import { useEffect, type MutableRefObject } from "react";
import type { MasterProfile } from "../types/graph.types";
import type {
  ContextMenuState,
  EdgeContextMenuState,
} from "../types/graph.types";

type SyncPack = {
  userId: string | null;
  profile: MasterProfile | null;
  selectedNodeId: string | null;
  selectedNodes: Set<string>;
  peekNodeId: string | null;
  collapsedVaults: Set<string>;
  contextMenu: ContextMenuState | null;
  edgeContextMenu: EdgeContextMenuState | null;
  searchExpanded: boolean;
  quickCreateOpen: boolean;
};

type RefPack = {
  userIdRef: MutableRefObject<string | null>;
  profileRef: MutableRefObject<MasterProfile | null>;
  masterHasBioRef: MutableRefObject<boolean>;
  selectedNodeIdRef: MutableRefObject<string | null>;
  selectedNodesRef: MutableRefObject<Set<string>>;
  peekNodeIdRef: MutableRefObject<string | null>;
  collapsedVaultsRef: MutableRefObject<Set<string>>;
  contextMenuOpenRef: MutableRefObject<boolean>;
  searchExpandedRef: MutableRefObject<boolean>;
  quickCreateOpenRef: MutableRefObject<boolean>;
};

export function useMemoryGraphLifecycle(
  sync: SyncPack,
  refs: RefPack,
  profileAvatarUrl: string | null | undefined,
  avatarImageRef: MutableRefObject<CanvasImageSource | null>,
  setCanvasReady: (v: boolean) => void
): void {
  useEffect(() => {
    refs.userIdRef.current = sync.userId;
    refs.profileRef.current = sync.profile;
    refs.masterHasBioRef.current = !!sync.profile?.master_node_bio?.trim();
    refs.selectedNodeIdRef.current = sync.selectedNodeId;
    refs.selectedNodesRef.current = sync.selectedNodes;
    refs.peekNodeIdRef.current = sync.peekNodeId;
    refs.collapsedVaultsRef.current = sync.collapsedVaults;
    refs.contextMenuOpenRef.current =
      !!sync.contextMenu || !!sync.edgeContextMenu;
    refs.searchExpandedRef.current = sync.searchExpanded;
    refs.quickCreateOpenRef.current = sync.quickCreateOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ref objects stable; sync fields drive updates
  }, [
    sync.userId,
    sync.profile,
    sync.selectedNodeId,
    sync.selectedNodes,
    sync.peekNodeId,
    sync.collapsedVaults,
    sync.contextMenu,
    sync.edgeContextMenu,
    sync.searchExpanded,
    sync.quickCreateOpen,
  ]);

  useEffect(() => {
    if (!profileAvatarUrl) {
      avatarImageRef.current = null;
      return;
    }
    const cur = avatarImageRef.current as
      | (HTMLImageElement & { __src?: string })
      | null;
    if (cur && cur.__src === profileAvatarUrl) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      (img as HTMLImageElement & { __src?: string }).__src = profileAvatarUrl;
      avatarImageRef.current = img;
    };
    img.onerror = () => {
      avatarImageRef.current = null;
    };
    img.src = profileAvatarUrl;
  }, [profileAvatarUrl, avatarImageRef]);

  useEffect(() => {
    const t = setTimeout(() => setCanvasReady(true), 0);
    return () => clearTimeout(t);
  }, [setCanvasReady]);
}

