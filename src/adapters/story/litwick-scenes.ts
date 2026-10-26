import { BLEED, embers, fillAll, glow, gradient, STAGE, type SceneTime } from '../prologue-scenes';
import { figure, floorBand, GROUND, type SceneDraw } from '../story-scenes';

/**
 * Litwick's tableaux (docs/story-quests.md, La Senda de la Llama), in the
 * prologue's style: the empty big house's corridor with its lamps, its hall
 * of chandeliers where nobody lives, and a child's hand reaching for a pale
 * light in a cave.
 */
const { w: W, h: H } = STAGE;

/** A small flame (a lamp's, a candle's) and its breathing light. */
function flame(ctx: CanvasRenderingContext2D, ms: number, x: number, y: number, size: number, i: number, color = '#ffb45a'): void {
  const flicker = Math.sin(ms / (100 + i * 7) + i) * 0.8;
  glow(ctx, x, y, 22 * size, color, 0.22 + 0.04 * flicker);
  ctx.fillStyle = '#ff9a3a';
  ctx.fillRect(Math.round(x - size), Math.round(y - 2 * size - flicker), Math.max(1, Math.round(2 * size)), Math.max(2, Math.round(3 * size)));
  ctx.fillStyle = '#fff1b0';
  ctx.fillRect(Math.round(x), Math.round(y - size - flicker), 1, 1);
}

/** The corridor: two walls running away to a dark door, a lamp on each side every few steps, smaller and smaller. */
const corridor: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, '#050306');
  const vx = W / 2;
  const vy = 74;
  // Floor and ceiling as two wedges towards the vanishing point.
  ctx.fillStyle = '#140c0c';
  ctx.beginPath();
  ctx.moveTo(-BLEED, H + BLEED);
  ctx.lineTo(W + BLEED, H + BLEED);
  ctx.lineTo(vx + 14, vy + 10);
  ctx.lineTo(vx - 14, vy + 10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#0a0608';
  ctx.beginPath();
  ctx.moveTo(-BLEED, -BLEED);
  ctx.lineTo(W + BLEED, -BLEED);
  ctx.lineTo(vx + 14, vy - 16);
  ctx.lineTo(vx - 14, vy - 16);
  ctx.closePath();
  ctx.fill();
  // The door at the end, darker than the dark.
  ctx.fillStyle = '#000000';
  ctx.fillRect(vx - 8, vy - 14, 16, 24);
  // Carpet boards.
  ctx.strokeStyle = 'rgba(90, 40, 40, 0.35)';
  ctx.lineWidth = 1;
  for (let i = 1; i < 7; i++) {
    const y = vy + 10 + (H - vy) * (i / 7) ** 1.6;
    const half = 14 + (W / 2 + BLEED - 14) * ((y - vy - 10) / (H - vy));
    ctx.beginPath();
    ctx.moveTo(vx - half, y);
    ctx.lineTo(vx + half, y);
    ctx.stroke();
  }
  // Lamps in pairs, nearer ones bigger; every one lit, nobody to light them.
  for (let i = 0; i < 5; i++) {
    const d = 1 - i / 5;
    const off = 12 + (W / 2 - 12) * d * 0.95;
    const y = vy - 4 + 30 * d;
    flame(ctx, t.localMs, vx - off, y, 0.5 + d, i);
    flame(ctx, t.localMs, vx + off, y, 0.5 + d, i + 5);
  }
  if (panel.figure) figure(ctx, t, panel, '#ffb45a', 0.4);
};

/** A chandelier: a ring of arms with a flame on each. */
function chandelier(ctx: CanvasRenderingContext2D, ms: number, x: number, y: number, size: number, salt: number): void {
  ctx.strokeStyle = '#2a1e18';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, -BLEED);
  ctx.lineTo(x, y);
  ctx.stroke();
  ctx.fillStyle = '#3a2a20';
  ctx.fillRect(Math.round(x - 14 * size), Math.round(y), Math.round(28 * size), 2);
  for (let i = 0; i < 5; i++) {
    const ax = x + (i - 2) * 7 * size;
    ctx.fillRect(Math.round(ax), Math.round(y - 4 * size), 1, Math.round(4 * size));
    flame(ctx, ms, ax, y - 4 * size, 0.6 * size, i + salt);
  }
}

/** The hall: three chandeliers lit over a long table laid for nobody. */
const chandeliers: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#0a0506'], [0.7, '#1a0e0c'], [1, '#000000']]));
  floorBand(ctx, '#1a100c');
  chandelier(ctx, t.localMs, W * 0.25, 40, 1, 0);
  chandelier(ctx, t.localMs, W * 0.5, 30, 1.3, 10);
  chandelier(ctx, t.localMs, W * 0.75, 40, 1, 20);
  // The table, its chairs pushed in.
  ctx.fillStyle = '#120a08';
  ctx.fillRect(W * 0.18, GROUND - 18, W * 0.64, 4);
  for (let i = 0; i < 6; i++) {
    ctx.fillRect(Math.round(W * 0.2 + i * W * 0.11), GROUND - 14, 2, 14);
    ctx.fillRect(Math.round(W * 0.2 + i * W * 0.11) - 2, GROUND - 26, 2, 12);
  }
  embers(ctx, t.localMs, 10, 0.25, ['#ffd08a', '#ff8a3a']);
  if (panel.figure) figure(ctx, t, panel, '#ffd08a', 0.3, panel.figure.form ? 2 : 2.4);
};

/** The cave: a small hand reaches from the left for a pale light; the light (Litwick, when it stands there) waits. */
const hand: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#020304'], [0.6, '#070a0e'], [1, '#000000']]));
  floorBand(ctx, '#0a0c10');
  const lx = W * 0.62;
  glow(ctx, lx, GROUND - 22, 70, '#cfe0ff', 0.14 + 0.03 * Math.sin(t.localMs / 800));
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.62 } }, '#cfe0ff', 0.3);
  else flame(ctx, t.localMs, lx, GROUND - 24, 1.4, 3, '#cfe0ff');
  // The hand: a sleeve from the left edge, small fingers stretching a little further now and then.
  const reach = 4 * (0.5 + 0.5 * Math.sin(t.localMs / 1500));
  const hx = W * 0.3 + reach;
  const hy = GROUND - 26;
  ctx.fillStyle = '#2a2430';
  ctx.fillRect(-BLEED, hy - 2, hx - 6 + BLEED, 8);
  ctx.fillStyle = '#c9b6a6';
  ctx.fillRect(Math.round(hx - 6), hy - 1, 7, 6);
  for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(hx + 1), hy - 1 + i * 1.5, 4 + (i === 1 ? 1 : 0), 1);
  ctx.fillRect(Math.round(hx - 3), hy - 3, 2, 2);
};

export const LITWICK_SCENES = { corridor, chandeliers, hand } as const;
