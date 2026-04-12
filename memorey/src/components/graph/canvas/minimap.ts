import type { GraphNode, NodeEdge, CategoryVault } from "@/types/memorey";
import type { Transform, CanvasDims } from "../types/canvas.types";
import {
  MASTER_W,
  MASTER_H,
  MASTER_R,
  NODE_W,
  NODE_H,
  STICKY_W,
  STICKY_H,
  FILE_NODE_W,
  FILE_NODE_H,
  VAULT_HEADER_H,
  VAULT_HEADER_R,
} from "../constants/dimensions";
import { VAULT_HEADER_MAX_W } from "./vaultHeaderLayout";
import { isFileGraphNode } from "../lib/fileNodeHelpers";
import {
  vaultColorForNode,
  hexToRgba,
  hexToRgbaSafe,
  BRAND_ORANGE,
  CANVAS_MINIMAP_BG_DARK,
  CANVAS_MINIMAP_BG_LIGHT,
  CANVAS_MINIMAP_NODE_DARK,
  CANVAS_MINIMAP_NODE_LIGHT,
} from "../constants/colors";
import { drawGrid } from "./grid";
import { screenToWorld } from "../interaction/coordinates";
import { truncate } from "./utils";
import { buildOrthogonalPath, buildCurvedPath } from "./edge";

function skipDraw(n: GraphNode): boolean {
  const k = n.nodeKind;
  return k === "person" || k === "category" || n.id.startsWith("cat:");
}

function nodeHalfDims(n: GraphNode): { hw: number; hh: number } {
  if (isFileGraphNode(n)) {
    return { hw: FILE_NODE_W / 2, hh: FILE_NODE_H / 2 };
  }
  return n.nodeType === "sticky"
    ? { hw: STICKY_W / 2, hh: STICKY_H / 2 }
    : { hw: NODE_W / 2, hh: NODE_H / 2 };
}

export function drawMinimap(
  ctx: CanvasRenderingContext2D,
  MW: number,
  MH: number,
  options: {
    nodePositions: Map<string, { x: number; y: number }>;
    nodes: GraphNode[];
    edges: NodeEdge[];
    vaults: CategoryVault[];
    vaultGroupPositions: Map<string, { x: number; y: number }>;
    collapsedVaultIds: Set<string>;
    mutedVaultIds: Set<string>;
    transform: Transform;
    canvasDims: CanvasDims;
    selectedNodeIds: Set<string>;
    isDark: boolean;
    userId: string | null;
    edgeStyle: string;
    edgeColorOverride: string | null;
    frameCount: number;
  }
): void {
  const masterHalfW = MASTER_W / 2;
  const masterHalfH = MASTER_H / 2;

  let minX = -masterHalfW;
  let maxX = masterHalfW;
  let minY = -masterHalfH;
  let maxY = masterHalfH;

  for (const [, p] of options.nodePositions) {
    minX = Math.min(minX, p.x - NODE_W);
    maxX = Math.max(maxX, p.x + NODE_W);
    minY = Math.min(minY, p.y - NODE_H);
    maxY = Math.max(maxY, p.y + NODE_H);
  }

  for (const n of options.nodes) {
    if (skipDraw(n)) continue;
    const p = options.nodePositions.get(n.id);
    if (!p) continue;
    const { hw, hh } = nodeHalfDims(n);
    minX = Math.min(minX, p.x - hw);
    maxX = Math.max(maxX, p.x + hw);
    minY = Math.min(minY, p.y - hh);
    maxY = Math.max(maxY, p.y + hh);
  }

  for (const [, p] of options.vaultGroupPositions) {
    minX = Math.min(minX, p.x - VAULT_HEADER_MAX_W / 2 - 8);
    maxX = Math.max(maxX, p.x + VAULT_HEADER_MAX_W / 2 + 8);
    minY = Math.min(minY, p.y - VAULT_HEADER_H / 2 - 8);
    maxY = Math.max(maxY, p.y + VAULT_HEADER_H / 2 + 8);
  }

  const bw = Math.max(400, maxX - minX);
  const bh = Math.max(400, maxY - minY);
  const pad = 40;
  const mmScale = Math.min(MW / (bw + pad * 2), MH / (bh + pad * 2));
  const ox = MW / 2 - ((minX + maxX) / 2) * mmScale;
  const oy = MH / 2 - ((minY + maxY) / 2) * mmScale;

  const wToMM = (wx: number, wy: number) => ({
    x: wx * mmScale + ox,
    y: wy * mmScale + oy,
  });

  ctx.save();
  ctx.fillStyle = options.isDark
    ? CANVAS_MINIMAP_BG_DARK
    : CANVAS_MINIMAP_BG_LIGHT;
  ctx.fillRect(0, 0, MW, MH);

  ctx.save();
  ctx.beginPath();
  const clipR = 8;
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(0, 0, MW, MH, clipR);
  } else {
    ctx.rect(0, 0, MW, MH);
  }
  ctx.clip();

  drawGrid(ctx, MW, MH, ox, oy, mmScale, options.isDark);

  const np = options.nodePositions;
  const nodes = options.nodes;

  // Master→vault connection lines
  for (const [vaultId, groupPos] of options.vaultGroupPositions) {
    const vault = options.vaults.find((v) => v.id === vaultId);
    if (!vault?.isActive) continue;

    const masterMM = wToMM(0, 0);
    const vaultMM = wToMM(groupPos.x, groupPos.y);

    ctx.strokeStyle = vault.color + "55";
    ctx.lineWidth = Math.max(0.5, 0.8 * mmScale);
    ctx.setLineDash([
      Math.max(1, 3 * mmScale),
      Math.max(1, 2 * mmScale),
    ]);
    ctx.beginPath();
    ctx.moveTo(masterMM.x, masterMM.y);
    ctx.lineTo(vaultMM.x, vaultMM.y);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // Edges (same routing as main canvas; collapse rules match useDrawLoop)
  for (const e of options.edges) {
    const sourceNode = nodes.find((n) => n.id === e.sourceNodeId);
    const targetNode = nodes.find((n) => n.id === e.targetNodeId);
    if (!sourceNode || !targetNode) continue;
    if (skipDraw(sourceNode) || skipDraw(targetNode)) continue;

    const sv = sourceNode.vaultId ?? "";
    const tv = targetNode.vaultId ?? "";
    if (options.mutedVaultIds.has(sv) || options.mutedVaultIds.has(tv))
      continue;

    const isCrossVault = sv !== tv;
    if (!isCrossVault && options.collapsedVaultIds.has(sv)) continue;

    const sourceCollapsed =
      isCrossVault && options.collapsedVaultIds.has(sv);
    const targetCollapsed =
      isCrossVault && options.collapsedVaultIds.has(tv);

    if (sourceCollapsed && targetCollapsed) continue;

    let drawSx: number;
    let drawSy: number;
    let drawTx: number;
    let drawTy: number;

    if (sourceCollapsed) {
      const gp = options.vaultGroupPositions.get(sv);
      if (!gp) continue;
      drawSx = gp.x;
      drawSy = gp.y;
    } else {
      const sp = np.get(e.sourceNodeId);
      if (!sp) continue;
      drawSx = sp.x;
      drawSy = sp.y;
    }

    if (targetCollapsed) {
      const gp = options.vaultGroupPositions.get(tv);
      if (!gp) continue;
      drawTx = gp.x;
      drawTy = gp.y;
    } else {
      const tp = np.get(e.targetNodeId);
      if (!tp) continue;
      drawTx = tp.x;
      drawTy = tp.y;
    }

    const bothExpanded = !sourceCollapsed && !targetCollapsed;
    const isDimmed = sourceCollapsed || targetCollapsed;
    const baseStroke = vaultColorForNode(sourceNode);
    const sourceColor =
      options.edgeColorOverride != null && options.edgeColorOverride !== ""
        ? hexToRgbaSafe(
            options.edgeColorOverride,
            isDimmed ? 0.35 : 0.45,
            hexToRgba(baseStroke, isDimmed ? 0.35 : 0.45)
          )
        : hexToRgba(baseStroke, isDimmed ? 0.35 : 0.45);

    const effectiveStyle = isDimmed ? "orthogonal-dashed" : options.edgeStyle;
    const isCurved = effectiveStyle.startsWith("curved");
    const dashed = effectiveStyle.includes("dashed");
    const dotted = effectiveStyle.includes("dotted");

    const sDim = nodeHalfDims(sourceNode);
    const tDim = nodeHalfDims(targetNode);
    const sHw = sDim.hw;
    const sHh = sDim.hh;
    const tHw = tDim.hw;
    const tHh = tDim.hh;

    let lastMM: { x: number; y: number };
    let prevMM: { x: number; y: number };

    ctx.save();
    ctx.globalAlpha = bothExpanded ? 1 : 0.35;
    ctx.strokeStyle = hexToRgba(sourceColor, isDimmed ? 0.35 : 0.45);
    ctx.lineWidth = isDimmed
      ? Math.max(0.4, 0.6 * mmScale)
      : Math.max(0.5, 0.8 * mmScale);
    const dashPat = isDimmed
      ? [Math.max(1, 3 * mmScale), Math.max(1, 2 * mmScale)]
      : dashed || dotted
        ? dotted
          ? [Math.max(1, 2 * mmScale), Math.max(1, 4 * mmScale)]
          : [Math.max(1, 6 * mmScale), Math.max(1, 4 * mmScale)]
        : [Math.max(0.5, 1 * mmScale), Math.max(1, 4 * mmScale)];
    ctx.setLineDash(dashPat);
    const dashLen = dashPat[0] + dashPat[1];
    ctx.lineDashOffset =
      dashLen > 0
        ? -((options.frameCount * 0.3) % dashLen)
        : 0;

    if (isCurved) {
      const worldPts = buildCurvedPath(
        drawSx,
        drawSy,
        drawTx,
        drawTy,
        sHw,
        sHh,
        tHw,
        tHh
      );
      const mmPts = worldPts.map((p) => wToMM(p.x, p.y));
      ctx.beginPath();
      ctx.moveTo(mmPts[0].x, mmPts[0].y);
      ctx.lineTo(mmPts[1].x, mmPts[1].y);
      ctx.quadraticCurveTo(
        mmPts[2].x,
        mmPts[2].y,
        mmPts[3].x,
        mmPts[3].y
      );
      ctx.lineTo(mmPts[4].x, mmPts[4].y);
      ctx.stroke();
      lastMM = mmPts[mmPts.length - 1];
      prevMM = mmPts[mmPts.length - 2];
    } else {
      const worldPts = buildOrthogonalPath(
        drawSx,
        drawSy,
        drawTx,
        drawTy,
        sHw,
        sHh,
        tHw,
        tHh
      );
      const mmPts = worldPts.map((p) => wToMM(p.x, p.y));
      ctx.beginPath();
      ctx.moveTo(mmPts[0].x, mmPts[0].y);
      for (let i = 1; i < mmPts.length; i++) {
        ctx.lineTo(mmPts[i].x, mmPts[i].y);
      }
      ctx.stroke();
      lastMM = mmPts[mmPts.length - 1];
      prevMM = mmPts[mmPts.length - 2];
    }

    ctx.setLineDash([]);
    const angle = Math.atan2(lastMM.y - prevMM.y, lastMM.x - prevMM.x);
    const aLen = Math.max(2, 4 * mmScale);
    ctx.beginPath();
    ctx.moveTo(lastMM.x, lastMM.y);
    ctx.lineTo(
      lastMM.x - aLen * Math.cos(angle - 0.42),
      lastMM.y - aLen * Math.sin(angle - 0.42)
    );
    ctx.moveTo(lastMM.x, lastMM.y);
    ctx.lineTo(
      lastMM.x - aLen * Math.cos(angle + 0.42),
      lastMM.y - aLen * Math.sin(angle + 0.42)
    );
    ctx.stroke();

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // Vault group header pills
  for (const [vaultId, groupPos] of options.vaultGroupPositions) {
    const vault = options.vaults.find((v) => v.id === vaultId);
    if (!vault?.isActive) continue;

    const mm = wToMM(groupPos.x, groupPos.y);
    const pillW = VAULT_HEADER_MAX_W * mmScale;
    const pillH = VAULT_HEADER_H * mmScale;
    const pillR = Math.max(1, VAULT_HEADER_R * mmScale);

    ctx.fillStyle = vault.color + "28";
    ctx.strokeStyle = vault.color + "AA";
    ctx.lineWidth = Math.max(0.5, mmScale);
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(mm.x - pillW / 2, mm.y - pillH / 2, pillW, pillH, pillR);
    } else {
      ctx.rect(mm.x - pillW / 2, mm.y - pillH / 2, pillW, pillH);
    }
    ctx.fill();
    ctx.stroke();

    if (pillW > 30) {
      ctx.font = `600 ${Math.max(5, 9 * mmScale)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = vault.color;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(
        vault.name.slice(0, 12),
        mm.x,
        mm.y
      );
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  const nw = Math.max(4, NODE_W * mmScale * 0.22);
  const nh = Math.max(3, NODE_H * mmScale * 0.22);
  const fw = Math.max(4, FILE_NODE_W * mmScale * 0.22);
  const fh = Math.max(3, FILE_NODE_H * mmScale * 0.22);
  const sw = Math.max(4, STICKY_W * mmScale * 0.2);
  const sh = Math.max(3, STICKY_H * mmScale * 0.2);
  const nodeFill = options.isDark
    ? CANVAS_MINIMAP_NODE_DARK
    : CANVAS_MINIMAP_NODE_LIGHT;

  for (const n of options.nodes) {
    if (skipDraw(n)) continue;
    const vid = n.vaultId ?? "";
    if (options.mutedVaultIds.has(vid)) continue;
    if (options.collapsedVaultIds.has(vid)) continue;

    const p = np.get(n.id);
    if (!p) continue;

    const isSticky = n.nodeType === "sticky";
    const isFile = isFileGraphNode(n);
    const mw = isSticky ? sw : isFile ? fw : nw;
    const mh = isSticky ? sh : isFile ? fh : nh;
    const m = wToMM(p.x, p.y);
    const vaultCol = vaultColorForNode(n);

    ctx.fillStyle = vaultCol;
    ctx.fillRect(m.x - mw / 2, m.y - mh / 2, Math.max(2, 3 * mmScale), mh);
    ctx.fillStyle = isSticky ? "#F5E6A3" : nodeFill;
    ctx.fillRect(
      m.x - mw / 2 + Math.max(2, 3 * mmScale),
      m.y - mh / 2,
      mw - Math.max(2, 3 * mmScale),
      mh
    );

    const titleFont = `600 ${Math.max(4, 7 * mmScale)}px Inter, system-ui, sans-serif`;
    ctx.font = titleFont;
    ctx.fillStyle = options.isDark ? "#e8e8e8" : "#1a1a1a";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const title = n.title || "Untitled";
    const innerW = mw - Math.max(2, 3 * mmScale) - 4;
    if (innerW > 8) {
      ctx.fillText(
        truncate(ctx, title, innerW),
        m.x - mw / 2 + Math.max(2, 3 * mmScale) + 2,
        m.y
      );
    }
    ctx.textAlign = "left";
    ctx.textBaseline = "alphabetic";

    const attachCount = n.attachmentCount ?? 0;
    if (attachCount > 0 && mw > 12 && !isSticky) {
      const bSize = Math.max(3, 5 * mmScale);
      const bR = Math.max(1, 1.5 * mmScale);
      const nx = m.x - mw / 2;
      const ny = m.y - mh / 2;
      const NW = mw;
      const NH = mh;
      ctx.fillStyle = "#4FC1E9";
      ctx.beginPath();
      if (typeof ctx.roundRect === "function") {
        ctx.roundRect(nx + NW - bSize - 1, ny + NH - bSize - 1, bSize, bSize, bR);
      } else {
        ctx.rect(nx + NW - bSize - 1, ny + NH - bSize - 1, bSize, bSize);
      }
      ctx.fill();
    }

    if (options.selectedNodeIds.has(n.id)) {
      ctx.strokeStyle = BRAND_ORANGE;
      ctx.lineWidth = 1;
      ctx.strokeRect(m.x - mw / 2 - 1, m.y - mh / 2 - 1, mw + 2, mh + 2);
    }
  }

  // Master node
  if (options.userId) {
    const masterMM = wToMM(0, 0);
    const mNW = MASTER_W * mmScale;
    const mNH = MASTER_H * mmScale;
    const mNR = Math.max(1, MASTER_R * mmScale);

    ctx.fillStyle = options.isDark ? "#1A1208" : "#FFFFFF";
    ctx.beginPath();
    if (typeof ctx.roundRect === "function") {
      ctx.roundRect(
        masterMM.x - mNW / 2,
        masterMM.y - mNH / 2,
        mNW,
        mNH,
        mNR
      );
    } else {
      ctx.rect(masterMM.x - mNW / 2, masterMM.y - mNH / 2, mNW, mNH);
    }
    ctx.fill();

    ctx.strokeStyle = "#FF6600CC";
    ctx.lineWidth = Math.max(1, 1.5 * mmScale);
    ctx.stroke();

    ctx.fillStyle = "#FF6600";
    ctx.fillRect(
      masterMM.x - mNW / 2,
      masterMM.y - mNH / 2 + mNR,
      Math.max(1, 3 * mmScale),
      mNH - mNR * 2
    );

    if (mNW > 20) {
      ctx.font = `600 ${Math.max(5, 7 * mmScale)}px Inter, system-ui, sans-serif`;
      ctx.fillStyle = "#FF6600";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText("YOU", masterMM.x, masterMM.y);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
    }
  }

  const c1 = screenToWorld(0, 0, options.transform);
  const c2 = screenToWorld(
    options.canvasDims.W,
    options.canvasDims.H,
    options.transform
  );
  const vx = Math.min(c1.x, c2.x);
  const vy = Math.min(c1.y, c2.y);
  const vw = Math.abs(c2.x - c1.x);
  const vh = Math.abs(c2.y - c1.y);
  const vpTL = wToMM(vx, vy);
  const vpBR = wToMM(vx + vw, vy + vh);
  const rawVpX = vpTL.x;
  const rawVpY = vpTL.y;
  const rawVpW = vpBR.x - vpTL.x;
  const rawVpH = vpBR.y - vpTL.y;

  const vpX = Math.max(0, rawVpX);
  const vpY = Math.max(0, rawVpY);
  const vpX2 = Math.min(MW, rawVpX + rawVpW);
  const vpY2 = Math.min(MH, rawVpY + rawVpH);
  const vpW = Math.max(0, vpX2 - vpX);
  const vpH = Math.max(0, vpY2 - vpY);

  const isDark = options.isDark;
  ctx.fillStyle = isDark ? "rgba(0,0,0,0.28)" : "rgba(0,0,0,0.10)";
  if (vpY > 0) ctx.fillRect(0, 0, MW, vpY);
  if (vpY2 < MH) ctx.fillRect(0, vpY2, MW, MH - vpY2);
  if (vpX > 0) ctx.fillRect(0, vpY, vpX, vpH);
  if (vpX2 < MW) ctx.fillRect(vpX2, vpY, MW - vpX2, vpH);

  if (vpW < MW * 0.98 || vpH < MH * 0.98) {
    ctx.strokeStyle = isDark
      ? "rgba(255,255,255,0.55)"
      : "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(vpX, vpY, vpW, vpH);
  }

  ctx.restore();
  ctx.restore();
}
