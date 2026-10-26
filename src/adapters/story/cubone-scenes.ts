import { drawEclipse, hash01 } from '../../ui/eclipse';
import { BLEED, disc, embers, fillAll, glow, gradient, STAGE, stars, type SceneTime } from '../prologue-scenes';
import { figure, floorBand, GROUND, type SceneDraw } from '../story-scenes';

/**
 * Cubone's tableaux (docs/story-quests.md, La Senda del Hueso), in the
 * prologue's style: the full moon the Eclipse did not take, the black lake's
 * dock, the roofless tower, and the grave mounds where a bone fire dances.
 */
const { w: W, h: H } = STAGE;
const MOON = '#e9e4cf';

/** The full moon, big and pale, with its halo; the red ring small and far. */
function fullMoon(ctx: CanvasRenderingContext2D, t: SceneTime, x: number, y: number, r: number): void {
  glow(ctx, x, y, r * 4, 'rgba(233, 228, 207, 0.9)', 0.18 + 0.02 * Math.sin(t.localMs / 1400));
  disc(ctx, x, y, r, MOON);
  // Its seas, faint and uneven, like a face half remembered.
  ctx.fillStyle = 'rgba(170, 160, 140, 0.22)';
  disc(ctx, x - r * 0.3, y - r * 0.15, r * 0.28, 'rgba(170, 160, 140, 0.22)');
  disc(ctx, x + r * 0.25, y - r * 0.3, r * 0.18, 'rgba(170, 160, 140, 0.18)');
  disc(ctx, x + r * 0.05, y + r * 0.35, r * 0.22, 'rgba(170, 160, 140, 0.16)');
}

function nightSky(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#04050c'], [0.6, '#0b0d1a'], [1, '#000000']]));
  stars(ctx, t.localMs, 0.5, 50, 61);
  drawEclipse(ctx, W * 0.14, 26, 6, 0.55, W + BLEED, H + BLEED);
}

/** The black lake: it reflects nothing, not even the moon. */
function blackLake(ctx: CanvasRenderingContext2D, t: SceneTime, top: number): void {
  ctx.fillStyle = '#020306';
  ctx.fillRect(-BLEED, top, W + BLEED * 2, H + BLEED);
  for (let i = 0; i < 5; i++) {
    const x = ((t.localMs / (90 + i * 25) + hash01(i + 7) * W) % (W + 80)) - 40;
    ctx.fillStyle = 'rgba(120, 130, 160, 0.08)';
    ctx.fillRect(Math.round(x), top + 6 + i * 7, 24, 1);
  }
}

/** The moon over the black lake; Cubone (if any) on the shore under it, its skull lit from above. */
const moon: SceneDraw = (ctx, t, panel) => {
  nightSky(ctx, t);
  fullMoon(ctx, t, W * 0.66, 50, 20);
  blackLake(ctx, t, GROUND - 4);
  floorBand(ctx, '#0d0f14');
  figure(ctx, t, panel, '#dfe6ff', 0.35);
};

/** The dock: planks over the black lake, a fishing rod with no bait, the moon small behind. */
const dock: SceneDraw = (ctx, t, panel) => {
  nightSky(ctx, t);
  fullMoon(ctx, t, W * 0.8, 34, 10);
  blackLake(ctx, t, GROUND - 10);
  // Planks and posts.
  ctx.fillStyle = '#2a1e16';
  ctx.fillRect(-BLEED, GROUND - 6, W * 0.62 + BLEED, 5);
  ctx.fillStyle = '#1a120c';
  for (let i = 0; i < 5; i++) ctx.fillRect(Math.round(W * 0.06 + i * 38), GROUND - 2, 3, 14);
  ctx.fillStyle = '#3a2a1e';
  for (let i = 0; i < 14; i++) ctx.fillRect(Math.round(-BLEED + i * 16), GROUND - 6, 1, 5);
  // The rod: a long line from the end of the dock into the water, which barely moves.
  const sway = Math.sin(t.localMs / 1600) * 1.5;
  ctx.strokeStyle = '#6a5a44';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W * 0.5, GROUND - 14);
  ctx.lineTo(W * 0.66, GROUND - 40);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(200, 200, 220, 0.35)';
  ctx.beginPath();
  ctx.moveTo(W * 0.66, GROUND - 40);
  ctx.lineTo(W * 0.68 + sway, GROUND - 8);
  ctx.stroke();
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.46 } }, '#dfe6ff', 0.4, 2.2);
};

/** The roofless tower: a broken top open to the moon, a stair of windows, mist at its foot. */
const tower: SceneDraw = (ctx, t, panel) => {
  nightSky(ctx, t);
  const cx = panel.figure ? W * 0.3 : W * 0.5;
  fullMoon(ctx, t, cx, 30, 14);
  // The tower.
  ctx.fillStyle = '#0a0a10';
  ctx.fillRect(Math.round(cx - 26), 40, 52, GROUND - 40);
  // Its broken crown: teeth of stone, no roof.
  for (let i = 0; i < 6; i++) ctx.fillRect(Math.round(cx - 26 + i * 9), 40 - (i % 2 === 0 ? 8 : 3) - Math.round(hash01(i + 3) * 4), 7, 10);
  // Windows climbing round it, a few still lit.
  for (let i = 0; i < 6; i++) {
    const lit = hash01(i + 40) > 0.6;
    ctx.fillStyle = lit ? `rgba(255, 190, 120, ${0.5 + 0.2 * Math.sin(t.localMs / 700 + i)})` : '#16161e';
    ctx.fillRect(Math.round(cx - 14 + (i % 2) * 24), GROUND - 22 - i * 13, 4, 6);
  }
  floorBand(ctx, '#0e0e14');
  for (let i = 0; i < 4; i++) {
    const x = ((t.localMs / (140 + i * 40) + hash01(i) * W) % (W + 160)) - 120;
    const g = ctx.createLinearGradient(x, 0, x + 200, 0);
    g.addColorStop(0, 'rgba(170, 176, 200, 0)');
    g.addColorStop(0.5, 'rgba(170, 176, 200, 0.12)');
    g.addColorStop(1, 'rgba(170, 176, 200, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, GROUND - 10 + i * 5, 200, 6);
  }
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.62 } }, '#e9e4cf', 0.35);
};

/** The grave mounds: a bone stuck in each, and a fire that dances from mound to mound. */
const graves: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#050308'], [0.6, '#140a0c'], [1, '#000000']]));
  stars(ctx, t.localMs, 0.3, 30, 71);
  fullMoon(ctx, t, W * 0.82, 30, 9);
  floorBand(ctx, '#160e0e');
  const mounds = [0.12, 0.3, 0.7, 0.88];
  mounds.forEach((mx, i) => {
    const x = W * mx;
    ctx.fillStyle = '#1e1414';
    ctx.beginPath();
    ctx.ellipse(x, GROUND - 2, 20, 9, 0, Math.PI, 0);
    ctx.fill();
    // The bone on top.
    ctx.fillStyle = '#cfc6b0';
    ctx.fillRect(Math.round(x - 1), GROUND - 22, 3, 12);
    ctx.fillRect(Math.round(x - 3), GROUND - 23, 7, 2);
    // The bone fire passes over each mound in turn.
    const turn = (t.localMs / 900 + i) % mounds.length;
    const near = Math.max(0, 1 - Math.abs(turn - 1.5));
    if (near > 0) {
      glow(ctx, x, GROUND - 26, 26, '#ff8a3a', 0.35 * near);
      ctx.fillStyle = `rgba(255, 150, 70, ${0.8 * near})`;
      ctx.fillRect(Math.round(x - 1), GROUND - 30 - Math.round(Math.sin(t.localMs / 90) * 2), 3, 6);
      ctx.fillStyle = `rgba(255, 240, 180, ${near})`;
      ctx.fillRect(Math.round(x), GROUND - 28, 1, 2);
    }
  });
  embers(ctx, t.localMs, 16, 0.4, ['#ffb46a', '#c8344c']);
  figure(ctx, t, panel, '#ffb46a', 0.3);
};

export const CUBONE_SCENES = { moon, dock, tower, graves } as const;
