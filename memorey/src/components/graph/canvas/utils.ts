export function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxW: number
): string {
  if (!text) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 0 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t}…`;
}
