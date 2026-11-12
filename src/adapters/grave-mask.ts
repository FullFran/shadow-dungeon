import type { Vec2 } from '../core/vec';

/**
 * A mimic's disguise (Yamask asleep, data/crypt-enemies.ts): a small grave
 * marker with a mask leaning on it, drawn in code like the crypt's slabs.
 * The only tell is the mask's faint, slow breathing glow in the eye holes.
 */
export function drawGraveMask(ctx: CanvasRenderingContext2D, pos: Vec2, radius: number, timeMs = 0): void {
  const w = radius * 1.6;
  const h = radius * 2;
  const x = pos.x - w / 2;
  const y = pos.y - h + radius * 0.4;
  ctx.save();
  // The stone: a slab with a rounded top.
  ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
  ctx.beginPath();
  ctx.ellipse(pos.x, pos.y + radius * 0.4, w * 0.6, radius * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#5b5866';
  ctx.strokeStyle = '#2c2a33';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, pos.y + radius * 0.4);
  ctx.lineTo(x, y + w / 2);
  ctx.arc(pos.x, y + w / 2, w / 2, Math.PI, 0);
  ctx.lineTo(x + w, pos.y + radius * 0.4);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The mask leaning on its foot.
  const my = pos.y - radius * 0.1;
  ctx.fillStyle = '#d8c48a';
  ctx.beginPath();
  ctx.ellipse(pos.x, my, radius * 0.55, radius * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  const glow = 0.25 + 0.2 * Math.sin(timeMs / 700);
  ctx.fillStyle = `rgba(150, 40, 60, ${glow.toFixed(3)})`;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(pos.x + side * radius * 0.22, my - radius * 0.05, radius * 0.12, radius * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
