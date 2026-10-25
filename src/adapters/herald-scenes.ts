import { shakeAt, type HeraldIntro, type HeraldScene } from '../ui/herald-intro';
import type { HeraldDef } from '../data/herald';
import type { CinematicPanel, Shot } from '../data/prologue';
import { SPRITE_KEYS, SPRITES } from '../data/sprites';
import { drawEclipse, hash01 } from '../ui/eclipse';
import { BLEED, embers, fillAll, glow, gradient, silhouette, STAGE, stars, vignette, type SceneTime } from './prologue-scenes';

/**
 * A herald's intro tableaux (app/herald-intro.ts composes the timing), in
 * the prologue's style: a dark arena under the pulsing eclipse, the herald
 * a silhouette rimmed in its type's colour arriving as it moves, the ground
 * shaking as it lands; then the title card, the herald in its own colours
 * under a glow of its theme (the name, epithet and epigraph are the DOM
 * narration below).
 */
const { w: W, h: H } = STAGE;
const GROUND = 134;
/** On the title card the herald stands higher, above its name (the narration sits in the lower third). */
const TITLE_FEET = 104;

const ease = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

function arena(ctx: CanvasRenderingContext2D, t: SceneTime, def: HeraldDef, eclipse: number): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.55, '#0a0610'], [1, '#000000']]));
  stars(ctx, t.localMs, 0.4, 50, def.seed % 97);
  // The eclipse, pulsing like a heartbeat.
  const beat = Math.pow(Math.max(0, Math.sin(t.localMs / 330)), 6);
  drawEclipse(ctx, W / 2, 30, 11, eclipse * (0.75 + 0.25 * beat), W + BLEED, H + BLEED);
  // The arena floor and its four low pillars.
  ctx.fillStyle = gradient(ctx, GROUND - 8, H + BLEED, [[0, '#140c18'], [1, '#000000']]);
  ctx.fillRect(-BLEED, GROUND - 8, W + BLEED * 2, H);
  ctx.fillStyle = '#07040a';
  for (const [x, w] of [[40, 12], [84, 9], [228, 9], [268, 12]] as const) ctx.fillRect(x, GROUND - 18 - (w > 10 ? 4 : 0), w, 18 + (w > 10 ? 4 : 0));
  // The ground glows in its colour where it will stand.
  glow(ctx, W / 2, GROUND, 70, def.theme.glow, 0.18 * eclipse);
}

const spriteOf = (def: HeraldDef): string => (SPRITE_KEYS as Record<string, string>)[def.sprite] ?? SPRITE_KEYS.gastly;

/** Stage scale of its silhouette: about 76 px wide whatever its sheet (big sheets are not blown up over the eclipse). */
const scaleOf = (def: HeraldDef): number => Math.min(2.4, 76 / (SPRITES.sprites[spriteOf(def)]?.anims.Idle?.frameWidth ?? 32));

function arrive(ctx: CanvasRenderingContext2D, t: SceneTime, def: HeraldDef, intro: HeraldIntro): void {
  arena(ctx, t, def, ease(t.localMs / 900));
  const land = intro.impactMs;
  const k = ease(t.localMs / land);
  const after = t.localMs - land;
  const rim = def.theme.colour;
  let y = GROUND + 4;
  let alpha = 1;
  if (def.arrival === 'descend') y = -40 + (GROUND + 44) * k;
  if (def.arrival === 'emerge') {
    // It rises out of the ground: drawn only above the floor line.
    y = GROUND + 60 - 56 * k;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-BLEED, -BLEED, W + BLEED * 2, GROUND + BLEED + 4);
    ctx.clip();
  }
  if (def.arrival === 'teleport') alpha = after < 0 ? (Math.floor(t.localMs / 90) % 5 === 0 ? 0.25 : 0) : 1;
  silhouette(ctx, t.sheets, t.localMs, { sprite: spriteOf(def), anim: 'Idle', row: 0, x: W / 2, y, scale: scaleOf(def), fill: '#020103', rim, alpha });
  if (def.arrival === 'emerge') ctx.restore();
  // The landing: a flash (teleport), a ring of dust, embers.
  if (after >= 0) {
    const ring = Math.min(1, after / 600);
    ctx.globalAlpha = 1 - ring;
    ctx.strokeStyle = rim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(W / 2, GROUND + 3, 10 + 70 * ring, 3 + 12 * ring, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    if (def.arrival === 'teleport' && after < 220) {
      ctx.fillStyle = `rgba(255, 255, 255, ${0.85 * (1 - after / 220)})`;
      ctx.fillRect(-BLEED, -BLEED, W + BLEED * 2, H + BLEED * 2);
    }
    glow(ctx, W / 2, GROUND - 20, 60, rim, 0.25 * (1 - ring) + 0.12);
    embers(ctx, t.localMs, 24, 0.5);
  }
  // Dust falling from above while it comes.
  if (after < 0) for (let i = 0; i < 14; i++) {
    const phase = ((t.localMs / 1000) * (0.4 + hash01(i) * 0.4) + hash01(i + 5)) % 1;
    ctx.globalAlpha = 0.4 * (1 - phase);
    ctx.fillStyle = rim;
    ctx.fillRect(Math.round(W / 2 - 40 + hash01(i + 9) * 80), Math.round(phase * GROUND), 1, 2);
  }
  ctx.globalAlpha = 1;
}

function title(ctx: CanvasRenderingContext2D, t: SceneTime, def: HeraldDef): void {
  arena(ctx, t, def, 1);
  const k = Math.min(1, t.progress / 0.5);
  glow(ctx, W / 2, 70, 100, def.theme.colour, 0.22 + 0.3 * k);
  silhouette(ctx, t.sheets, t.localMs, { sprite: spriteOf(def), anim: 'Idle', row: 0, x: W / 2, y: TITLE_FEET, scale: scaleOf(def), fill: '#020103', rim: def.theme.colour, shade: 1 - 0.85 * k });
  embers(ctx, t.localMs, 34, 0.4 + 0.4 * k);
  // A thin rule in its colour where the name card sits.
  ctx.globalAlpha = 0.7 * k;
  ctx.fillStyle = def.theme.colour;
  ctx.fillRect(Math.round(W / 2 - 70 * k), H - 46, Math.round(140 * k), 1);
  ctx.globalAlpha = 1;
}

/** Draws one moment of a herald's intro on a STAGE-sized context (camera, shake, vignette and fade like the prologue). */
export function drawHeraldScene(ctx: CanvasRenderingContext2D, def: HeraldDef, intro: HeraldIntro, panel: CinematicPanel, time: SceneTime, camera: Shot, alpha: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const shake = panel.scene === 'arrive' ? shakeAt(intro, time.localMs) : { x: 0, y: 0 };
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, W / 2 - camera.x * W * camera.zoom + shake.x, H / 2 - camera.y * H * camera.zoom + shake.y);
  if ((panel.scene as HeraldScene) === 'arrive') arrive(ctx, time, def, intro);
  else title(ctx, time, def);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx);
  if (alpha < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.max(0, alpha)})`;
    ctx.fillRect(0, 0, W, H);
  }
}
