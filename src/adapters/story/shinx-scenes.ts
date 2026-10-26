import { SPRITE_KEYS } from '../../data/sprites';
import { hash01 } from '../../ui/eclipse';
import { BLEED, fillAll, glow, gradient, silhouette, STAGE, type SceneTime } from '../prologue-scenes';
import { figure, floorBand, GROUND, type SceneDraw } from '../story-scenes';

/**
 * Shinx's tableaux (docs/story-quests.md, La Senda de la Tormenta): golden
 * eyes opening in a dark cave (or its own sparks), the pack at the storm's
 * edge, and a small lost shape seen through a wall.
 */
const { w: W, h: H } = STAGE;

/** Rain falling slant across the stage. */
function rain(ctx: CanvasRenderingContext2D, ms: number, count: number, alpha: number): void {
  ctx.fillStyle = `rgba(170, 190, 230, ${alpha})`;
  for (let i = 0; i < count; i++) {
    const speed = 0.25 + hash01(i + 40) * 0.15;
    const x = ((hash01(i + 10) * (W + BLEED * 2) + ms * speed * 0.35) % (W + BLEED * 2)) - BLEED;
    const y = ((hash01(i + 20) * (H + BLEED) + ms * speed) % (H + BLEED)) - BLEED / 2;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 4);
  }
}


/** A lightning flash's strength at `ms` (two quick strokes every few seconds). */
function flash(ms: number, period = 3800): number {
  const p = ms % period;
  if (p < 90) return 1;
  if (p > 180 && p < 240) return 0.6;
  return 0;
}


/** A cave in the dark: little light, wet rock, and (with nobody on stage) two golden eyes that open. */
const cave: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, '#010103');
  ctx.fillStyle = '#0a0a10';
  for (let i = 0; i < 9; i++) {
    const x = i * 44 - BLEED + hash01(i + 90) * 20;
    ctx.fillRect(Math.round(x), -BLEED, 14 + Math.round(hash01(i + 91) * 10), 30 + Math.round(hash01(i + 92) * 40));
  }
  floorBand(ctx, '#0e0e16');
  if (panel.figure) {
    // Its own sparks, the only light: they flare and die by turns.
    const spark = Math.max(0, Math.sin(t.localMs / 260) * Math.sin(t.localMs / 1100));
    glow(ctx, W / 2, GROUND - 18, 50 + 20 * spark, '#9ad8ff', 0.12 + 0.25 * spark);
    for (let i = 0; i < 6; i++) {
      if (hash01(i + Math.floor(t.localMs / 120)) > 0.5 + 0.4 * (1 - spark)) continue;
      ctx.fillStyle = '#e8f8ff';
      ctx.fillRect(Math.round(W / 2 - 16 + hash01(i + 7) * 32), Math.round(GROUND - 30 + hash01(i + 8) * 24), 1, 1);
    }
    figure(ctx, t, panel, '#9ad8ff', 0.4);
    return;
  }
  const open = Math.min(1, Math.max(0, (t.localMs - 1000) / 900));
  for (const ex of [W / 2 - 14, W / 2 + 14]) {
    glow(ctx, ex, GROUND - 40, 18, '#ffd23a', 0.3 * open);
    ctx.fillStyle = '#ffd23a';
    ctx.fillRect(ex - 4, GROUND - 40 - Math.round(2 * open), 8, Math.max(1, Math.round(4 * open)));
    ctx.fillStyle = '#1a0e00';
    ctx.fillRect(ex - 1, GROUND - 40 - Math.round(2 * open), 2, Math.max(1, Math.round(4 * open)));
  }
};


/** The pack at the storm's edge: silhouettes on a ridge under a lit sky, rain, and the figure (if any) among them. */
const storm: SceneDraw = (ctx, t, panel) => {
  const f = flash(t.localMs);
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, f > 0 ? '#5a6488' : '#0c1020'], [0.6, f > 0 ? '#2a3050' : '#141a2c'], [1, '#000000']]));
  if (f > 0) {
    // The bolt.
    ctx.strokeStyle = `rgba(240, 246, 255, ${f})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    let x = W * 0.72;
    ctx.moveTo(x, -BLEED);
    for (let y = -BLEED; y < GROUND - 30; y += 12) {
      x += (hash01(Math.floor(t.localMs / 3800) * 31 + y) - 0.5) * 16;
      ctx.lineTo(x, y + 12);
    }
    ctx.stroke();
  }
  // The ridge.
  ctx.fillStyle = '#05060c';
  ctx.beginPath();
  ctx.moveTo(-BLEED, GROUND - 4);
  ctx.lineTo(W * 0.3, GROUND - 16);
  ctx.lineTo(W * 0.62, GROUND - 12);
  ctx.lineTo(W + BLEED, GROUND - 2);
  ctx.lineTo(W + BLEED, H + BLEED);
  ctx.lineTo(-BLEED, H + BLEED);
  ctx.fill();
  // The pack, small and dark against the sky (lit by each flash).
  const rim = f > 0 ? '#e8f0ff' : '#3a4a6a';
  for (const [x, sprite, scale] of [[0.18, SPRITE_KEYS.luxray, 1.3], [0.3, SPRITE_KEYS.luxio, 1.1], [0.38, SPRITE_KEYS.luxray, 1.3]] as const) {
    silhouette(ctx, t.sheets, t.localMs, { sprite, anim: 'Walk', row: 2, x: W * x, y: GROUND - 14, scale, fill: '#05060c', rim });
  }
  rain(ctx, t.localMs, 70, 0.35);
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.66 } }, f > 0 ? '#ffffff' : '#ffd23a', 0.6);
};


/** A wall in the dark, seen through: behind it a small lost shape outlined in gold, and the figure looking at it from this side. */
const wall: SceneDraw = (ctx, t, panel) => {
  fillAll(ctx, '#020206');
  floorBand(ctx, '#0e0e14');
  // The wall, its stones half seen.
  const wx = W * 0.6;
  ctx.fillStyle = '#16161e';
  ctx.fillRect(wx, -BLEED, 26, GROUND + BLEED);
  ctx.fillStyle = '#1e1e28';
  for (let row = 0; row < 12; row++) for (let c = 0; c < 2; c++) ctx.fillRect(wx + 1 + c * 13 + (row % 2) * 6, -BLEED + row * 14 + 1, 11, 12);
  // Through it, golden: a small shape curled up beyond, breathing.
  const look = 0.55 + 0.45 * Math.sin(t.localMs / 800);
  glow(ctx, wx + 64, GROUND - 14, 36, '#ffd23a', 0.12 * look);
  ctx.strokeStyle = `rgba(255, 210, 58, ${0.5 * look})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.ellipse(wx + 64, GROUND - 8, 10, 6 + Math.sin(t.localMs / 700) * 0.6, 0, 0, Math.PI * 2);
  ctx.moveTo(wx + 72, GROUND - 14);
  ctx.ellipse(wx + 72, GROUND - 14, 4, 4, 0, 0, Math.PI * 2);
  ctx.stroke();
  // The line of sight through the stones.
  ctx.fillStyle = `rgba(255, 210, 58, ${0.08 * look})`;
  ctx.fillRect(W * 0.34, GROUND - 26, wx + 60 - W * 0.34, 3);
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.34 } }, '#ffd23a', 0.45);
};


export const SHINX_SCENES = { cave, storm, wall } as const;
