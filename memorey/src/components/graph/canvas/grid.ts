export function drawGrid(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  offsetX: number,
  offsetY: number,
  scale: number,
  isDark: boolean
): void {
  const spacing = 24 * scale;
  ctx.fillStyle = isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.06)";
  const startX = ((offsetX % spacing) + spacing) % spacing;
  const startY = ((offsetY % spacing) + spacing) % spacing;
  for (let x = startX - spacing; x < W + spacing; x += spacing) {
    for (let y = startY - spacing; y < H + spacing; y += spacing) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
