import type { GuardianCinematic, GuardianScene, SceneTint } from '../data/guardian-cinematics';
import type { CinematicPanel, Shot } from '../data/prologue';
import { SPECIES } from '../data/species';
import { SPRITE_KEYS } from '../data/sprites';
import { drawEclipse, hash01 } from '../ui/eclipse';
import { BLEED, embers, fillAll, glow, gradient, silhouette, STAGE, stars, vignette, type SceneTime } from './prologue-scenes';

/**
 * The guardian cinematics' tableaux, in the prologue's style (low-res stage,
 * dark silhouettes cut from the sprite sheets with a rim of light, the
 * eclipse ring). Each scene is a function of time; the guardian's tint gives
 * the Crypt its red stone and the forest its green mist. Only the reveal
 * shows the guardian's own colours. What lies beneath is only light sinking
 * into the dark and a crystal's glint.
 */
const { w: W, h: H } = STAGE;
const GROUND = 132;

function backdrop(ctx: CanvasRenderingContext2D, t: SceneTime, tint: SceneTint, eclipse: number): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, tint.sky], [1, '#000000']]));
  stars(ctx, t.localMs, 0.5, 40, tint.mist ? 31 : 13);
  if (eclipse > 0) drawEclipse(ctx, W / 2, 26, 10, eclipse * (0.8 + 0.2 * Math.sin(t.localMs / 1100)), W + BLEED, H + BLEED);
  ctx.fillStyle = gradient(ctx, GROUND - 6, H + BLEED, [[0, tint.ground], [1, '#000000']]);
  ctx.fillRect(-BLEED, GROUND - 6, W + BLEED * 2, H);
  if (tint.mist) trees(ctx);
}

/** Forest: bare trunks against the sky on both sides. */
function trees(ctx: CanvasRenderingContext2D): void {
  for (let i = 0; i < 9; i++) {
    const x = Math.round(-BLEED + hash01(i + 77) * (W + BLEED * 2));
    if (Math.abs(x - W / 2) < 60) continue;
    const w = 6 + Math.round(hash01(i + 5) * 8);
    ctx.fillStyle = hash01(i + 11) > 0.5 ? '#050906' : '#070c08';
    ctx.fillRect(x, -BLEED, w, GROUND + BLEED);
    ctx.fillRect(x - 6, 30 + Math.round(hash01(i) * 40), 8, 2);
  }
}

/** Forest: slow bands of mist drifting across. */
function mist(ctx: CanvasRenderingContext2D, ms: number, alpha: number): void {
  for (let i = 0; i < 5; i++) {
    const y = 70 + i * 16;
    const x = ((ms / (90 + i * 25) + hash01(i) * W) % (W + 160)) - 120;
    const g = ctx.createLinearGradient(x, 0, x + 200, 0);
    g.addColorStop(0, 'rgba(150, 168, 160, 0)');
    g.addColorStop(0.5, `rgba(150, 168, 160, ${0.18 * alpha})`);
    g.addColorStop(1, 'rgba(150, 168, 160, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, 200, 10);
  }
}

/** The sealed door the guardian keeps: dark stone, a ring seal that breathes. */
function door(ctx: CanvasRenderingContext2D, t: SceneTime, c: GuardianCinematic): void {
  backdrop(ctx, t, c.tint, 1);
  const seal = 0.5 + 0.5 * Math.sin(t.localMs / 900);
  glow(ctx, W / 2, 84, 60, c.tint.rim, 0.12 + 0.12 * seal);
  ctx.fillStyle = '#17111b';
  ctx.fillRect(W / 2 - 26, 46, 52, GROUND - 46);
  ctx.fillStyle = '#08060a';
  ctx.fillRect(W / 2 - 22, 50, 21, GROUND - 50);
  ctx.fillRect(W / 2 + 1, 50, 21, GROUND - 50);
  ctx.strokeStyle = c.tint.rim;
  ctx.globalAlpha = 0.3 + 0.5 * seal;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(W / 2, 74, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (c.tint.mist) mist(ctx, t.localMs, 1);
  embers(ctx, t.localMs, 20, 0.5);
}

const spriteOf = (c: GuardianCinematic): string => SPRITE_KEYS[c.species === 'aegislash' ? 'aegislashBlade' : SPECIES[c.species].sprite];

/** Its gaze: the guardian as a dark shape before the door, coming closer. */
function gaze(ctx: CanvasRenderingContext2D, t: SceneTime, c: GuardianCinematic): void {
  backdrop(ctx, t, c.tint, 0.6);
  glow(ctx, W / 2, 96, 70, c.tint.rim, 0.18);
  silhouette(ctx, t.sheets, t.localMs, { sprite: spriteOf(c), anim: 'Idle', row: 0, x: W / 2, y: GROUND + 6, scale: 2 + 0.4 * t.progress, fill: '#020103', rim: c.tint.rim });
  if (c.tint.mist) mist(ctx, t.localMs, 1.2);
}

/** The reveal: the shape fills with its own colours under a growing glow (the name card is the narration). */
function reveal(ctx: CanvasRenderingContext2D, t: SceneTime, c: GuardianCinematic): void {
  backdrop(ctx, t, c.tint, 1);
  const k = Math.min(1, t.progress / 0.55);
  glow(ctx, W / 2, 98, 90, c.tint.rim, 0.25 + 0.35 * k);
  silhouette(ctx, t.sheets, t.localMs, { sprite: spriteOf(c), anim: 'Idle', row: 0, x: W / 2, y: GROUND + 4, scale: 2.4, fill: '#020103', rim: c.tint.rim, shade: 1 - 0.9 * k });
  embers(ctx, t.localMs, 30, 0.4 + 0.4 * k);
}

/** Its fall: the guardian fades into motes that drift up; the seal behind goes dark. */
function fall(ctx: CanvasRenderingContext2D, t: SceneTime, c: GuardianCinematic): void {
  backdrop(ctx, t, c.tint, 0.4);
  const fade = 1 - Math.min(1, t.progress / 0.8);
  silhouette(ctx, t.sheets, t.localMs, { sprite: spriteOf(c), anim: 'Idle', row: 0, x: W / 2, y: GROUND + 4 + 6 * t.progress, scale: 2.2, fill: '#020103', rim: c.tint.rim, alpha: fade, shade: 0.6 });
  for (let i = 0; i < 40; i++) {
    const phase = ((t.localMs / 1000) * (0.2 + hash01(i) * 0.2) + hash01(i + 9)) % 1;
    ctx.globalAlpha = (1 - phase) * (1 - fade * 0.5) * 0.8;
    ctx.fillStyle = c.tint.rim;
    ctx.fillRect(Math.round(W / 2 - 24 + hash01(i + 3) * 48), Math.round(GROUND - phase * 90), 1, 1);
  }
  ctx.globalAlpha = 1;
  if (c.tint.mist) mist(ctx, t.localMs, 0.8);
}

/** Below: the floor opens to a drop; the light keeps falling, and once in a while a crystal glints in the dark. */
function below(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  fillAll(ctx, '#000000');
  for (let i = 0; i < 60; i++) {
    const phase = ((t.localMs / 1000) * (0.14 + hash01(i + 40) * 0.1) + hash01(i)) % 1;
    const k = phase * phase;
    const sx = (hash01(i + 7) - 0.1) * W * 1.2;
    ctx.globalAlpha = (1 - phase) * 0.7;
    ctx.fillStyle = hash01(i + 3) > 0.6 ? '#fff3c8' : '#ffc860';
    ctx.fillRect(Math.round(sx + (W / 2 - sx) * k * 0.85), Math.round(-10 + (H + 20) * k), 1, 2);
  }
  ctx.globalAlpha = 1;
  const glint = Math.max(0, Math.sin(t.localMs / 700) - 0.85) / 0.15;
  if (glint > 0) {
    ctx.fillStyle = `rgba(230, 240, 255, ${glint})`;
    ctx.fillRect(W / 2, H - 22, 1, 1);
    ctx.fillRect(W / 2 - 2, H - 22, 5, 1);
    ctx.fillRect(W / 2, H - 24, 1, 5);
  }
}

const SCENES: Record<GuardianScene, (ctx: CanvasRenderingContext2D, t: SceneTime, c: GuardianCinematic) => void> = { door, gaze, reveal, fall, below };

/** Draws one moment of a guardian cinematic on a STAGE-sized context (same camera, vignette and fade as the prologue). */
export function drawGuardianScene(ctx: CanvasRenderingContext2D, c: GuardianCinematic, panel: CinematicPanel, time: SceneTime, camera: Shot, alpha: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, W / 2 - camera.x * W * camera.zoom, H / 2 - camera.y * H * camera.zoom);
  SCENES[panel.scene as GuardianScene](ctx, time, c);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx);
  if (alpha < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.max(0, alpha)})`;
    ctx.fillRect(0, 0, W, H);
  }
}
