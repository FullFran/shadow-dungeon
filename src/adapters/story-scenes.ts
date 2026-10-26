import type { Shot } from '../data/prologue';
import { SPECIES } from '../data/species';
import { SPRITE_KEYS } from '../data/sprites';
import type { StoryFigure, StoryScene } from '../data/story-quests';
import type { StoryPanel } from '../app/story';
import { drawEclipse, hash01 } from '../ui/eclipse';
import { CUBONE_SCENES } from './story/cubone-scenes';
import { LITWICK_SCENES } from './story/litwick-scenes';
import { ZORUA_SCENES } from './story/zorua-scenes';
import { ABRA_SCENES } from './story/abra-scenes';
import { PIPLUP_SCENES } from './story/piplup-scenes';
import { SHINX_SCENES } from './story/shinx-scenes';
import { AXEW_SCENES } from './story/axew-scenes';
import { BLEED, embers, fillAll, glow, gradient, silhouette, STAGE, stars, vignette, type SceneTime } from './prologue-scenes';

/**
 * The Sendas' tableaux (docs/story-quests.md), in the prologue's style: a
 * low-res stage, few shapes, one warm light. The line's Pokémon stands on
 * them in a pose from its own sheet (in its colours, lit by the scene), and
 * Mimikyu's busted form stands in for a broken disguise. Generic scenes,
 * shared by every Senda: the rag, a candle, the plaza before the Eclipse, the
 * red ring, the dark, and Phantump by the black lake.
 */
const { w: W, h: H } = STAGE;
/** The stage's ground line (the per-line scene files draw on it too). */
export const GROUND = 134;

const spriteFor = (panel: StoryPanel, figure: StoryFigure): string => {
  const sprite = SPECIES[figure.form ?? panel.line].sprite;
  const busted = `${sprite}Busted` as keyof typeof SPRITE_KEYS;
  return SPRITE_KEYS[figure.busted && busted in SPRITE_KEYS ? busted : sprite];
};

/** The line's Pokémon in its pose: its own colours under `shade` of the scene's dark, with a rim of the scene's light. */
export function figure(ctx: CanvasRenderingContext2D, t: SceneTime, panel: StoryPanel, rim: string, shade: number, scale = 2.4, y = GROUND + 4): void {
  const f = panel.figure;
  if (!f) return;
  const x = W * (f.x ?? 0.5);
  const alpha = f.vanish ? vanishAlpha(t.localMs) : 1;
  if (f.vanish && alpha < 1) {
    // The shimmer of a teleport: motes rising where it was.
    const p = (t.localMs % 4200) / 4200;
    const burst = p >= 0.45 && p < 0.7 ? 1 - (p - 0.45) / 0.25 : 0;
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = `rgba(232, 200, 255, ${burst * (0.4 + 0.6 * hash01(i + 70))})`;
      ctx.fillRect(Math.round(x - 14 + hash01(i + 11) * 28), Math.round(y - 8 - hash01(i + 31) * 40 - (1 - burst) * 16), 1, 2);
    }
  }
  if (alpha <= 0) return;
  silhouette(ctx, t.sheets, t.localMs, { sprite: spriteFor(panel, f), anim: f.anim, once: f.anim === 'Faint', row: f.back ? 4 : 0, x, y, scale, fill: '#05030a', rim, shade, alpha });
}

/** How present a vanishing figure is at `ms` (a sleeper that teleports away and comes back): whole, a quick fade out, gone, a fade back in. */
export function vanishAlpha(ms: number): number {
  const p = (ms % 4200) / 4200;
  if (p < 0.45) return 1;
  if (p < 0.52) return 1 - (p - 0.45) / 0.07;
  if (p < 0.8) return 0;
  return Math.min(1, (p - 0.8) / 0.12);
}

export function floorBand(ctx: CanvasRenderingContext2D, color: string): void {
  ctx.fillStyle = gradient(ctx, GROUND - 6, H + BLEED, [[0, color], [1, '#000000']]);
  ctx.fillRect(-BLEED, GROUND - 6, W + BLEED * 2, H);
}

/** A candle's flame and its breathing light. */
export function candleAt(ctx: CanvasRenderingContext2D, x: number, ms: number, size = 1): void {
  const flicker = Math.sin(ms / 110) * 0.8 + Math.sin(ms / 53) * 0.5;
  glow(ctx, x, GROUND - 16, 70 * size, '#ffb45a', 0.32 + 0.04 * flicker);
  ctx.fillStyle = '#d9d0bc';
  ctx.fillRect(x - 2, GROUND - 14, 4, 12);
  ctx.fillStyle = '#ff9a3a';
  ctx.fillRect(x - 1, GROUND - 19 - Math.round(flicker), 3, 5 + Math.round(flicker));
  ctx.fillStyle = '#fff1b0';
  ctx.fillRect(x, GROUND - 17 - Math.round(flicker), 1, 3);
}

/** The rag: a yellow cloth with two ear points, crooked eyes and a stitched seam; a needle glints beside it. */
function rag(ctx: CanvasRenderingContext2D, t: SceneTime, panel: StoryPanel): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.7, '#120d18'], [1, '#000000']]));
  floorBand(ctx, '#1a1420');
  glow(ctx, W / 2, GROUND - 14, 80, '#ffd36a', 0.16);
  if (panel.figure) return figure(ctx, t, panel, '#ffd36a', 0.2);
  const x = W / 2 - 18;
  const y = GROUND - 22;
  ctx.fillStyle = '#d8bf52';
  ctx.fillRect(x, y + 6, 36, 16);
  ctx.fillRect(x + 4, y + 2, 28, 6);
  ctx.fillStyle = '#c2a843';
  ctx.fillRect(x - 2, y + 18, 40, 4);
  // Ear points with their black tips, one limp.
  ctx.fillStyle = '#d8bf52';
  ctx.fillRect(x + 4, y - 6, 4, 9);
  ctx.fillRect(x + 28, y - 1, 8, 4);
  ctx.fillStyle = '#16121a';
  ctx.fillRect(x + 4, y - 9, 4, 4);
  ctx.fillRect(x + 34, y - 1, 4, 4);
  // Crooked eyes and the zigzag mouth, drawn by hand.
  ctx.fillRect(x + 11, y + 8, 3, 3);
  ctx.fillRect(x + 22, y + 9, 3, 3);
  for (let i = 0; i < 6; i++) ctx.fillRect(x + 12 + i * 2, y + 15 + (i % 2), 2, 1);
  // The seam.
  ctx.fillStyle = '#8a7530';
  for (let i = 0; i < 8; i++) ctx.fillRect(x + 2 + i * 4, y + 21, 2, 1);
  // A needle with its thread, glinting now and then.
  const glint = 0.5 + 0.5 * Math.sin(t.localMs / 400);
  ctx.fillStyle = `rgba(230, 230, 240, ${0.5 + 0.5 * glint})`;
  ctx.fillRect(x + 48, GROUND - 6, 10, 1);
  ctx.fillStyle = '#b8343c';
  ctx.fillRect(x + 40, GROUND - 5, 8, 1);
  embers(ctx, t.localMs, 8, 0.25);
}

/** A candle in the dark, and the Pokémon beside it in its light. */
function candle(ctx: CanvasRenderingContext2D, t: SceneTime, panel: StoryPanel): void {
  fillAll(ctx, '#030206');
  floorBand(ctx, '#140e12');
  candleAt(ctx, W * 0.58, t.localMs);
  figure(ctx, t, panel, '#ffb45a', 0.35);
}

/** The plaza before the Eclipse, in a faded gold: a swing that still sways, small friends around. */
function plaza(ctx: CanvasRenderingContext2D, t: SceneTime, panel: StoryPanel): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#f3d79a'], [0.6, '#d9a865'], [1, '#7a4a2c']]));
  glow(ctx, W * 0.75, 30, 90, 'rgba(255, 250, 220, 0.9)', 0.6);
  floorBand(ctx, '#8a5a34');
  // The swing: two posts, a bar, and a seat on two ropes.
  const sx = W * 0.3;
  ctx.fillStyle = '#4a2e1c';
  ctx.fillRect(sx - 30, GROUND - 70, 3, 70);
  ctx.fillRect(sx + 28, GROUND - 70, 3, 70);
  ctx.fillRect(sx - 32, GROUND - 72, 66, 3);
  const swing = Math.sin(t.localMs / 900) * 8;
  ctx.strokeStyle = '#3a2416';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(sx - 8, GROUND - 69);
  ctx.lineTo(sx - 8 + swing, GROUND - 26);
  ctx.moveTo(sx + 8, GROUND - 69);
  ctx.lineTo(sx + 8 + swing, GROUND - 26);
  ctx.stroke();
  ctx.fillStyle = '#5a3a22';
  ctx.fillRect(Math.round(sx - 11 + swing), GROUND - 27, 22, 3);
  // Small friends, round and faded (nobody's face is remembered).
  for (let i = 0; i < 4; i++) {
    const fx = W * 0.62 + i * 20 + Math.round(Math.sin(t.localMs / 600 + i) * 2);
    ctx.fillStyle = 'rgba(90, 58, 38, 0.55)';
    ctx.beginPath();
    ctx.arc(fx, GROUND - 6 - (i % 2) * 2, 6 + (i % 3), 0, Math.PI * 2);
    ctx.fill();
  }
  if (panel.figure) figure(ctx, t, { ...panel, figure: { ...panel.figure, x: panel.figure.x ?? 0.5 } }, '#fff3c8', 0.05);
  // A memory: the edges burn out into black.
  ctx.fillStyle = 'rgba(40, 20, 10, 0.18)';
  ctx.fillRect(-BLEED, -BLEED, W + BLEED * 2, H + BLEED * 2);
}

/** The red ring over a black world; the Pokémon (if any) as a dark shape under it. */
function eclipse(ctx: CanvasRenderingContext2D, t: SceneTime, panel: StoryPanel): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#12050a'], [1, '#000000']]));
  stars(ctx, t.localMs, 0.4, 40, 21);
  drawEclipse(ctx, W / 2, 46, 18, 0.85 + 0.15 * Math.sin(t.localMs / 1100), W + BLEED, H + BLEED);
  floorBand(ctx, '#140a10');
  figure(ctx, t, panel, '#c8344c', 0.9);
  embers(ctx, t.localMs, 24, 0.5);
}

/** The dark: only a little light, and what stands in it as a shape. */
function dark(ctx: CanvasRenderingContext2D, t: SceneTime, panel: StoryPanel): void {
  fillAll(ctx, '#000000');
  const breath = 0.5 + 0.5 * Math.sin(t.localMs / 1300);
  glow(ctx, W / 2, GROUND - 20, 60, '#c49cff', 0.06 + 0.06 * breath);
  if (panel.figure) figure(ctx, t, panel, '#8a6cc8', 1, 2.2);
  else {
    // What was seen is not shown: two motes of light where eyes would be, then nothing.
    const eyes = Math.max(0, Math.sin(t.localMs / 900) - 0.4);
    ctx.fillStyle = `rgba(255, 236, 200, ${eyes})`;
    ctx.fillRect(W / 2 - 5, GROUND - 26, 1, 1);
    ctx.fillRect(W / 2 + 4, GROUND - 26, 1, 1);
  }
}

/** Phantump by the black lake that no longer reflects the sky, the red ring in the water. */
function phantump(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.55, '#060a14'], [1, '#000000']]));
  stars(ctx, t.localMs, 0.35, 30, 41);
  drawEclipse(ctx, W * 0.72, 30, 9, 0.7, W + BLEED, H + BLEED);
  ctx.fillStyle = '#050a12';
  ctx.fillRect(-BLEED, GROUND - 10, W + BLEED * 2, H);
  // The ring's reflection, broken by slow ripples.
  for (let i = 0; i < 6; i++) {
    const wobble = Math.round(Math.sin(t.localMs / 500 + i) * 2);
    ctx.fillStyle = `rgba(200, 52, 76, ${0.35 - i * 0.05})`;
    ctx.fillRect(W * 0.72 - 9 + wobble, GROUND + 2 + i * 4, 18 - i * 2, 1);
  }
  // The stump on the shore.
  ctx.fillStyle = '#1b1410';
  ctx.fillRect(W * 0.38 - 12, GROUND - 16, 24, 8);
  glow(ctx, W * 0.38, GROUND - 30, 50, '#86d68f', 0.12);
  silhouette(ctx, t.sheets, t.localMs, { sprite: SPRITE_KEYS.phantump, anim: 'Idle', row: 0, x: W * 0.38, y: GROUND - 12, scale: 2.2, fill: '#05030a', rim: '#86d68f', shade: 0.3 });
  for (let i = 0; i < 4; i++) {
    const x = ((t.localMs / (120 + i * 30) + hash01(i) * W) % (W + 160)) - 120;
    const g = ctx.createLinearGradient(x, 0, x + 200, 0);
    g.addColorStop(0, 'rgba(150, 168, 190, 0)');
    g.addColorStop(0.5, 'rgba(150, 168, 190, 0.12)');
    g.addColorStop(1, 'rgba(150, 168, 190, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, GROUND - 8 + i * 6, 200, 6);
  }
}

/** The Pokémon alone in a soft light (a close moment). */
function pose(ctx: CanvasRenderingContext2D, t: SceneTime, panel: StoryPanel): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#16101e'], [1, '#000000']]));
  floorBand(ctx, '#1c1424');
  glow(ctx, W / 2, GROUND - 24, 90, '#e8d8ff', 0.16);
  figure(ctx, t, panel, '#e8d8ff', 0.1, 2.8);
  embers(ctx, t.localMs, 10, 0.25);
}

/** How a tableau is drawn. */
export type SceneDraw = (ctx: CanvasRenderingContext2D, t: SceneTime, panel: StoryPanel) => void;

// Each Senda's own tableaux live beside its data (adapters/story/<line>-scenes.ts).
const SCENES: Record<StoryScene, SceneDraw> = { rag, candle, plaza, eclipse, dark, phantump, pose, ...CUBONE_SCENES, ...LITWICK_SCENES, ...ZORUA_SCENES, ...ABRA_SCENES, ...PIPLUP_SCENES, ...SHINX_SCENES, ...AXEW_SCENES };

/** Draws one moment of a Senda cinematic on a STAGE-sized context (the prologue's camera, vignette and fade). */
export function drawStoryScene(ctx: CanvasRenderingContext2D, panel: StoryPanel, time: SceneTime, camera: Shot, alpha: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, W / 2 - camera.x * W * camera.zoom, H / 2 - camera.y * H * camera.zoom);
  SCENES[panel.scene](ctx, time, panel);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx);
  if (alpha < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.max(0, alpha)})`;
    ctx.fillRect(0, 0, W, H);
  }
}
