import {
  VAULT_HEADER_H,
  COLLAPSE_BTN_SIZE,
  GEAR_SIZE,
  VAULT_PLUS_BTN,
} from "../constants/dimensions";

const HDR_PAD_RIGHT = 4;
const HDR_GAP = 6;
export const TITLE_PAD_LEFT = 12;
const TITLE_TO_COUNT_GAP = 6;

/** Min / max pill width (full title preferred up to max). */
export const VAULT_HEADER_MIN_W = 200;
export const VAULT_HEADER_MAX_W = 560;

export const VAULT_ICON_SLOT = 18;
export const VAULT_ICON_GAP = 4;

export type VaultHeaderRects = {
  hx: number;
  hy: number;
  centerY: number;
  countW: number;
  headerWidth: number;
  collapse: { left: number; top: number; w: number; h: number };
  gear: { left: number; top: number; w: number; h: number };
  plus: { left: number; top: number; w: number; h: number };
  count: { left: number; top: number; w: number; h: number };
  titleMaxWidth: number;
  nameX: number;
  iconLeft: number;
  hasIcon: boolean;
};

/** Same chip width for draw + hit tests (matches ~500 9px digit width). */
export function estimateVaultCountChipWidth(positionCount: number): number {
  const s = String(positionCount);
  return Math.max(18, s.length * 6.5 + 8);
}

export function measureVaultTitleWidthPx(name: string): number {
  if (typeof document === "undefined") return name.length * 6.8;
  const c = document.createElement("canvas");
  const ctx = c.getContext("2d");
  if (!ctx) return name.length * 6.8;
  ctx.font = "600 11px Inter, system-ui, sans-serif";
  return ctx.measureText(name).width;
}

/** Right block: count chip through collapse padding (from count left edge to header right). */
function rightClusterOuterWidth(
  countW: number,
  includePlus: boolean
): number {
  return (
    countW +
    HDR_GAP +
    (includePlus ? VAULT_PLUS_BTN + HDR_GAP : 0) +
    GEAR_SIZE +
    HDR_GAP +
    COLLAPSE_BTN_SIZE +
    HDR_PAD_RIGHT
  );
}

export function computeVaultHeaderLayout(
  vaultName: string,
  positionCount: number,
  includePlus: boolean,
  hasIcon: boolean
): { headerWidth: number; titleMaxWidth: number; nameX: number; iconLeft: number } {
  const countW = estimateVaultCountChipWidth(positionCount);
  const iconExtra = hasIcon ? VAULT_ICON_SLOT + VAULT_ICON_GAP : 0;
  const titleMeasured = measureVaultTitleWidthPx(vaultName);
  const R = rightClusterOuterWidth(countW, includePlus);
  const L = TITLE_PAD_LEFT + iconExtra;
  const ideal = L + titleMeasured + TITLE_TO_COUNT_GAP + R;
  const headerWidth = Math.ceil(
    Math.min(VAULT_HEADER_MAX_W, Math.max(VAULT_HEADER_MIN_W, ideal))
  );
  const maxTitle = Math.max(
    28,
    headerWidth - L - TITLE_TO_COUNT_GAP - R
  );
  const nameX = TITLE_PAD_LEFT + iconExtra;
  const iconLeft = TITLE_PAD_LEFT;
  return {
    headerWidth,
    titleMaxWidth: maxTitle,
    nameX,
    iconLeft,
  };
}

export function getVaultHeaderRects(
  groupPos: { x: number; y: number },
  countW: number,
  includePlus: boolean,
  headerWidth: number,
  hasIcon: boolean,
  layout: { nameX: number; iconLeft: number; titleMaxWidth: number }
): VaultHeaderRects {
  const hx = groupPos.x - headerWidth / 2;
  const hy = groupPos.y - VAULT_HEADER_H / 2;
  const centerY = groupPos.y;

  let x = hx + headerWidth - HDR_PAD_RIGHT - COLLAPSE_BTN_SIZE;
  const collapse = {
    left: x,
    top: centerY - COLLAPSE_BTN_SIZE / 2,
    w: COLLAPSE_BTN_SIZE,
    h: COLLAPSE_BTN_SIZE,
  };

  x -= HDR_GAP + GEAR_SIZE;
  const gear = {
    left: x,
    top: centerY - GEAR_SIZE / 2,
    w: GEAR_SIZE,
    h: GEAR_SIZE,
  };

  let plus = {
    left: 0,
    top: 0,
    w: 0,
    h: 0,
  };
  if (includePlus) {
    x -= HDR_GAP + VAULT_PLUS_BTN;
    plus = {
      left: x,
      top: centerY - VAULT_PLUS_BTN / 2,
      w: VAULT_PLUS_BTN,
      h: VAULT_PLUS_BTN,
    };
  }

  const countRight = x - HDR_GAP;
  const countLeft = countRight - countW;
  const count = {
    left: countLeft,
    top: centerY - 8,
    w: countW,
    h: 16,
  };

  return {
    hx,
    hy,
    centerY,
    countW,
    headerWidth,
    collapse,
    gear,
    plus,
    count,
    titleMaxWidth: layout.titleMaxWidth,
    nameX: hx + layout.nameX,
    iconLeft: hx + layout.iconLeft,
    hasIcon,
  };
}

export function pointInVaultRect(
  wx: number,
  wy: number,
  r: { left: number; top: number; w: number; h: number }
): boolean {
  return (
    wx >= r.left &&
    wx <= r.left + r.w &&
    wy >= r.top &&
    wy <= r.top + r.h
  );
}
