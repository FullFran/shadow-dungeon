import type { CinematicPanel, Shot } from '../data/prologue';
import type { SimaSceneId, SimaStage } from '../data/sima-scenes';
import { SPECIES, type SpeciesId } from '../data/species';
import { SPRITE_KEYS } from '../data/sprites';
import { drawEclipse, hash01 } from '../ui/eclipse';
import { ECHO_FILTER } from './eclipse-echo-view';
import { BLEED, embers, fillAll, glow, gradient, silhouette, STAGE, stars, vignette, type SceneTime } from './prologue-scenes';

/**
 * The Sima del Eclipse's tableaux (data/sima-scenes.ts, docs/sima-redesign.md
 * §5), in the prologue's style: a low-res stage, few shapes, one light. The
 * player's own Pokémon stands on them in its colours under the scene's dark;
 * its shadow is the same sheet in flat black, its echo the same sheet in the
 * eclipse's corruption (the Eco del Eclipse's filter). Down is towards the
 * eclipse: the ring climbs from the sky to below the islands as the strata go.
 */
const { w: W, h: H } = STAGE;
const GROUND = 134;
const RED = '#c8344c';

export interface SimaPanel extends CinematicPanel<SimaStage> {
  scene: SimaStage;
  sceneId: SimaSceneId;
  /** The player's Pokémon. */
  species: SpeciesId;
  pose?: 'Idle' | 'Walk' | 'Hurt' | 'Faint' | 'Sleep';
  /** Somebody's shadow (a lost shadow's sheet), and whether the player knows its face. */
  other?: { sprite: string; known: boolean };
}

type Draw = (ctx: CanvasRenderingContext2D, t: SceneTime, p: SimaPanel) => void;

const sheetOf = (species: SpeciesId): string => SPRITE_KEYS[SPECIES[species].sprite];

/** The player's Pokémon on the stage. */
function player(ctx: CanvasRenderingContext2D, t: SceneTime, p: SimaPanel, o: { x?: number; y?: number; scale?: number; rim?: string; shade?: number; row?: number; anim?: string; alpha?: number } = {}): void {
  const anim = o.anim ?? p.pose ?? 'Idle';
  silhouette(ctx, t.sheets, t.localMs, { sprite: sheetOf(p.species), anim, once: anim === 'Faint', row: o.row ?? 0, x: W * (o.x ?? 0.5), y: o.y ?? GROUND + 4, scale: o.scale ?? 2.2, fill: '#05030a', rim: o.rim ?? '#e8d8ff', shade: o.shade ?? 0.35, ...(o.alpha !== undefined ? { alpha: o.alpha } : {}) });
}

/** Its shadow: the same sheet, flat black, a pale red rim; `lagMs` behind in its animation. */
function shadowOf(ctx: CanvasRenderingContext2D, t: SceneTime, p: SimaPanel, o: { x: number; y?: number; scale?: number; row?: number; lagMs?: number; alpha?: number }): void {
  silhouette(ctx, t.sheets, Math.max(0, t.localMs - (o.lagMs ?? 0)), { sprite: sheetOf(p.species), anim: 'Idle', row: o.row ?? 0, x: W * o.x, y: o.y ?? GROUND + 4, scale: o.scale ?? 2.2, fill: '#000000', rim: 'rgba(200, 52, 76, 0.7)', shade: 1, alpha: o.alpha ?? 0.9 });
}

/** Its echo: the same sheet in the eclipse's corruption, with a red halo. */
function echoOf(ctx: CanvasRenderingContext2D, t: SceneTime, p: SimaPanel, x: number, scale = 2.4, row = 0): void {
  glow(ctx, W * x, GROUND - 22, 60, RED, 0.25 + 0.08 * Math.sin(t.localMs / 500));
  ctx.save();
  ctx.filter = ECHO_FILTER;
  silhouette(ctx, t.sheets, t.localMs, { sprite: sheetOf(p.species), anim: 'Idle', row, x: W * x, y: GROUND + 4, scale, fill: '#2a0008', rim: '#ff2a3a', shade: 0.2 });
  ctx.restore();
}

function ground(ctx: CanvasRenderingContext2D, color: string, top = GROUND - 6): void {
  ctx.fillStyle = gradient(ctx, top, H + BLEED, [[0, color], [1, '#000000']]);
  ctx.fillRect(-BLEED, top, W + BLEED * 2, H);
}

function nightSky(ctx: CanvasRenderingContext2D, t: SceneTime, ring = true, warm = false): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, warm ? [[0, '#1a0812'], [0.55, '#4a1a26'], [1, '#120608']] : [[0, '#000000'], [0.6, '#12050a'], [1, '#000000']]));
  stars(ctx, t.localMs, warm ? 0.2 : 0.45, 50, 17);
  if (ring) drawEclipse(ctx, W * 0.72, 34, 12, 0.85 + 0.15 * Math.sin(t.localMs / 1100), W + BLEED, H + BLEED);
}

/** The pit at the crater's heart: a black mouth with red light deep inside. */
function pit(ctx: CanvasRenderingContext2D, t: SceneTime, cx: number, cy: number, rx: number): void {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, rx * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, cx, cy + 6, rx * 0.9, RED, 0.22 + 0.06 * Math.sin(t.localMs / 900));
}

/** The burnt statue: a hooded figure of stone, charred, bowed towards the pit. */
function statue(ctx: CanvasRenderingContext2D, x: number, scale = 1): void {
  ctx.fillStyle = '#0c0a0e';
  ctx.fillRect(x - 10 * scale, GROUND - 10 * scale, 20 * scale, 10 * scale);
  ctx.fillRect(x - 6 * scale, GROUND - 40 * scale, 12 * scale, 30 * scale);
  ctx.beginPath();
  ctx.arc(x - 3 * scale, GROUND - 44 * scale, 6 * scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(200, 52, 76, 0.35)';
  ctx.fillRect(x - 6 * scale, GROUND - 40 * scale, 1, 30 * scale);
}

/** Red motes falling, slowly, through a column. */
function fallingLight(ctx: CanvasRenderingContext2D, t: SceneTime, cx: number, width: number, count: number, alpha = 0.8): void {
  for (let i = 0; i < count; i++) {
    const speed = 10 + hash01(i * 3 + 1) * 14;
    const y = ((t.localMs / 1000) * speed + hash01(i * 7 + 2) * (H + 40)) % (H + 40) - 20;
    const x = cx + (hash01(i * 5 + 3) - 0.5) * width + Math.sin(t.localMs / 1400 + i) * 2;
    ctx.fillStyle = `rgba(255, ${80 + Math.round(hash01(i) * 60)}, 70, ${alpha * (0.4 + 0.6 * hash01(i * 11))})`;
    ctx.fillRect(Math.round(x), Math.round(y), 1, 2);
  }
}

/** Glyphs that write themselves and fade: names nobody has said. */
function glyphs(ctx: CanvasRenderingContext2D, t: SceneTime, count: number, color: string): void {
  for (let i = 0; i < count; i++) {
    const life = ((t.localMs / 1000 + hash01(i * 13) * 6) % 6) / 6;
    const alpha = Math.sin(life * Math.PI) * 0.8;
    const x = 30 + hash01(i * 17 + 1) * (W - 60);
    const y = 24 + hash01(i * 19 + 2) * 80;
    const strokes = 3 + Math.floor(hash01(i * 23) * 4);
    ctx.fillStyle = color.replace('A', String(alpha.toFixed(2)));
    for (let s = 0; s < strokes * life; s++) {
      const h = 2 + Math.floor(hash01(i * 29 + s) * 5);
      ctx.fillRect(Math.round(x + s * 3), Math.round(y + (hash01(i + s) * 4)), 1, h);
      if (hash01(i * 31 + s) > 0.5) ctx.fillRect(Math.round(x + s * 3), Math.round(y + h / 2), 2, 1);
    }
  }
}

/** Faceless shapes: dark rounded figures with their backs to you (one may turn: no face). */
function shapes(ctx: CanvasRenderingContext2D, t: SceneTime, count: number, y: number, turned: number | null): void {
  for (let i = 0; i < count; i++) {
    const x = W * (0.14 + (i / Math.max(1, count - 1)) * 0.72) + Math.sin(t.localMs / 2000 + i) * 1.5;
    const h = 18 + hash01(i * 7) * 14;
    ctx.fillStyle = 'rgba(6, 4, 10, 0.92)';
    ctx.beginPath();
    ctx.ellipse(x, y - h / 2, 6 + hash01(i) * 4, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, y - h - 4, 5 + hash01(i * 3) * 2, 0, Math.PI * 2);
    ctx.fill();
    if (turned === i) {
      // It turns: where a face should be, a pale smooth blank.
      ctx.fillStyle = 'rgba(220, 210, 230, 0.35)';
      ctx.beginPath();
      ctx.arc(x, y - h - 4, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

const rim: Draw = (ctx, t, p) => {
  nightSky(ctx, t);
  ground(ctx, '#1c1418');
  pit(ctx, t, W * 0.42, GROUND + 6, 70);
  statue(ctx, W * 0.82);
  embers(ctx, t.localMs, 14, 0.4);
  if (p.pose) player(ctx, t, p, { x: 0.2, scale: 1.6, rim: '#ff9a7a' });
};

const fall: Draw = (ctx, t) => {
  fillAll(ctx, '#020104');
  // The rift: a crack of dark red from top to bottom, and the light going down it.
  const g = ctx.createLinearGradient(W / 2 - 30, 0, W / 2 + 30, 0);
  g.addColorStop(0, 'rgba(60, 10, 20, 0)');
  g.addColorStop(0.5, 'rgba(120, 20, 36, 0.5)');
  g.addColorStop(1, 'rgba(60, 10, 20, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(W / 2 - 30, -BLEED, 60, H + BLEED * 2);
  fallingLight(ctx, t, W / 2, 40, 60);
};

const rimShadow: Draw = (ctx, t, p) => {
  nightSky(ctx, t, true, p.sceneId === 'return' || p.sceneId === 'return-short');
  ground(ctx, '#211619');
  pit(ctx, t, W * 0.62, GROUND + 8, 80);
  player(ctx, t, p, { x: 0.32, scale: 1.8, rim: '#ffb4a4', row: 4 });
  // Its shadow on the ash, a step behind and a beat late.
  ctx.save();
  ctx.translate(0, GROUND + 4);
  ctx.scale(1, -0.45);
  ctx.translate(0, -(GROUND + 4));
  shadowOf(ctx, t, p, { x: 0.32 - 0.04, scale: 1.8, row: 4, lagMs: 380, alpha: 0.55 });
  ctx.restore();
};

const black: Draw = (ctx) => fillAll(ctx, '#000000');

const voice: Draw = (ctx, t) => {
  fillAll(ctx, '#000000');
  glow(ctx, W / 2, H / 2, 70, '#c49cff', 0.05 + 0.04 * Math.sin(t.localMs / 700));
};

const roots: Draw = (ctx, t) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#050806'], [0.7, '#0c1410'], [1, '#000000']]));
  for (let i = 0; i < 14; i++) {
    const x = 10 + hash01(i * 7) * (W - 20);
    const len = 40 + hash01(i * 3) * 90;
    const sway = Math.sin(t.localMs / 1600 + i) * 3;
    ctx.strokeStyle = 'rgba(40, 30, 24, 0.95)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, -BLEED);
    ctx.quadraticCurveTo(x + sway * 2, len / 2, x + sway, len);
    ctx.stroke();
  }
  // Red moss: it is not daylight.
  for (let i = 0; i < 30; i++) {
    ctx.fillStyle = `rgba(200, 52, 76, ${0.15 + 0.25 * hash01(i * 13)})`;
    ctx.fillRect(Math.round(hash01(i * 17) * W), GROUND - 4 + Math.round(hash01(i * 19) * 10), 2, 1);
  }
  ground(ctx, '#0d120e');
  // Eyes, far off, that might be there.
  const eyes = Math.max(0, Math.sin(t.localMs / 1100) - 0.5) * 2;
  ctx.fillStyle = `rgba(255, 220, 160, ${eyes})`;
  ctx.fillRect(W * 0.78, GROUND - 40, 1, 1);
  ctx.fillRect(W * 0.78 + 4, GROUND - 40, 1, 1);
};

const loop: Draw = (ctx, t) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#06080a'], [0.7, '#10161a'], [1, '#000000']]));
  ground(ctx, '#121614', GROUND - 20);
  // A path that comes back to the same trunk.
  ctx.strokeStyle = 'rgba(120, 110, 90, 0.35)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(W / 2, GROUND, 110, 22, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = '#0a0806';
  ctx.fillRect(W / 2 - 8, GROUND - 90, 16, 90);
  for (let i = 0; i < 4; i++) {
    const x = ((t.localMs / (140 + i * 40) + hash01(i) * W) % (W + 200)) - 160;
    const g = ctx.createLinearGradient(x, 0, x + 200, 0);
    g.addColorStop(0, 'rgba(160, 170, 180, 0)');
    g.addColorStop(0.5, 'rgba(160, 170, 180, 0.12)');
    g.addColorStop(1, 'rgba(160, 170, 180, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, GROUND - 40 + i * 12, 200, 10);
  }
};

const back: Draw = (ctx, t, p) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#040605'], [0.7, '#0e1410'], [1, '#000000']]));
  ground(ctx, '#101410');
  // The Pokémon walks away from you; its shadow, behind it, faces you.
  player(ctx, t, p, { x: 0.5, y: GROUND - 6, scale: 2, row: 4, rim: '#9fd8a0' });
  shadowOf(ctx, t, p, { x: 0.5, y: GROUND + 20, scale: 2, row: 0, alpha: 0.8 });
};

const bell: Draw = (ctx, t, p) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#02050a'], [0.5, '#06101c'], [1, '#000000']]));
  // Still water, and a bell under it.
  ctx.fillStyle = 'rgba(20, 50, 80, 0.5)';
  ctx.fillRect(-BLEED, GROUND - 40, W + BLEED * 2, 2);
  const ringing = p.sceneId === 'stratum-caves' && t.progress > 0.3 && p.id.endsWith('-2');
  const sway = ringing ? Math.sin(t.localMs / 180) * 4 : 0;
  ctx.fillStyle = '#4a3a20';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 22 + sway, GROUND + 10);
  ctx.quadraticCurveTo(W / 2 - 18 + sway, GROUND - 26, W / 2 + sway, GROUND - 28);
  ctx.quadraticCurveTo(W / 2 + 18 + sway, GROUND - 26, W / 2 + 22 + sway, GROUND + 10);
  ctx.fill();
  if (ringing) {
    for (let i = 0; i < 3; i++) {
      const r = ((t.localMs / 12 + i * 40) % 120) + 10;
      ctx.strokeStyle = `rgba(160, 200, 230, ${0.4 * (1 - r / 130)})`;
      ctx.beginPath();
      ctx.ellipse(W / 2, GROUND - 40, r, r * 0.18, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  // The water rises up the walls, towards the eclipse.
  fallingLight(ctx, { ...t, localMs: -t.localMs + 1e6 }, W * 0.1, 20, 14, 0.4);
  fallingLight(ctx, { ...t, localMs: -t.localMs + 1e6 }, W * 0.9, 20, 14, 0.4);
};

const names: Draw = (ctx, t) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#020306'], [1, '#000000']]));
  // A huge faceless shape at the back.
  ctx.fillStyle = 'rgba(14, 12, 20, 0.95)';
  ctx.beginPath();
  ctx.ellipse(W / 2, GROUND - 20, 46, 70, 0, 0, Math.PI * 2);
  ctx.fill();
  glow(ctx, W / 2, GROUND - 60, 40, '#c49cff', 0.06);
  glyphs(ctx, t, 9, 'rgba(220, 200, 255, A)');
};

const mirror: Draw = (ctx, t) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#0a0610'], [0.5, '#1a0c1a'], [1, '#000000']]));
  ground(ctx, '#1a1418', GROUND - 30);
  // The water reflects another sky: one with the ring in it, upside down.
  ctx.save();
  ctx.beginPath();
  ctx.rect(-BLEED, GROUND - 24, W + BLEED * 2, 60);
  ctx.clip();
  fillAll(ctx, gradient(ctx, GROUND - 24, H, [[0, '#2a0a18'], [1, '#0a0208']]));
  drawEclipse(ctx, W * 0.35, GROUND + 14, 9, 0.7, W + BLEED, H + BLEED);
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = 'rgba(255, 200, 220, 0.08)';
    ctx.fillRect(-BLEED + ((t.localMs / 60 + i * 70) % (W + 80)), GROUND - 20 + i * 8, 30, 1);
  }
  ctx.restore();
};

const backs: Draw = (ctx, t, p) => {
  mirror(ctx, t, p);
  const turned = p.id.endsWith('-2') ? 2 : null;
  shapes(ctx, t, 5, GROUND - 4, turned && t.progress > 0.35 ? turned : null);
};

const islands: Draw = (ctx, t) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#0c0710'], [0.6, '#1a0a14'], [1, '#2a0a12']]));
  fallingLight(ctx, t, W / 2, W, 70, 0.7);
  for (const [x, y, w] of [[0.2, 0.62, 60], [0.55, 0.78, 90], [0.82, 0.5, 40]] as const) {
    const bob = Math.sin(t.localMs / 1500 + x * 10) * 2;
    ctx.fillStyle = '#3a2a33';
    ctx.fillRect(W * x - w / 2, H * y + bob, w, 6);
    ctx.fillStyle = '#140b17';
    ctx.beginPath();
    ctx.moveTo(W * x - w / 2, H * y + 6 + bob);
    ctx.lineTo(W * x, H * y + 6 + w * 0.5 + bob);
    ctx.lineTo(W * x + w / 2, H * y + 6 + bob);
    ctx.fill();
    ctx.fillStyle = 'rgba(162, 67, 63, 0.8)';
    ctx.fillRect(W * x - w / 2, H * y + bob, w, 1);
  }
};

const ringBelow: Draw = (ctx, t) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.5, '#0e0408'], [1, '#2a0810']]));
  // Down is towards the eclipse: the ring is below, and the light falls to it.
  drawEclipse(ctx, W / 2, H - 20, 20, 0.95 + 0.05 * Math.sin(t.localMs / 800), W + BLEED, H + BLEED);
  fallingLight(ctx, t, W / 2, W * 0.8, 80, 0.9);
};

const alone: Draw = (ctx, t, p) => {
  islands(ctx, t, p);
  ctx.fillStyle = '#3a2a33';
  ctx.fillRect(W / 2 - 34, GROUND, 68, 6);
  ctx.fillStyle = '#140b17';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 34, GROUND + 6);
  ctx.lineTo(W / 2, GROUND + 40);
  ctx.lineTo(W / 2 + 34, GROUND + 6);
  ctx.fill();
  shadowOf(ctx, t, p, { x: 0.5, y: GROUND + 6, scale: 2, alpha: 0.5 });
  player(ctx, t, p, { x: 0.5, y: GROUND + 2, scale: 2, rim: '#ff9a7a' });
};

const rise: Draw = (ctx, t, p) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#0e0a14'], [1, '#000000']]));
  ground(ctx, '#151018');
  glow(ctx, W * 0.36, GROUND - 24, 70, '#e8d8ff', 0.1);
  player(ctx, t, p, { x: 0.36, scale: 2.2, row: 2 });
  // Its shadow peels off the floor (the second tableau: it stands in front, upright).
  const standing = p.id.endsWith('-1') ? Math.min(1, Math.max(0, (t.progress - 0.2) / 0.6)) : p.id.endsWith('-0') ? 0 : 1;
  ctx.save();
  const sy = 0.35 + 0.65 * standing;
  ctx.translate(0, (GROUND + 4) * (1 - sy));
  ctx.scale(1, sy);
  shadowOf(ctx, t, p, { x: 0.36 + 0.28 * standing, scale: 2.2, row: 6, alpha: 0.95 });
  ctx.restore();
};

const echo: Draw = (ctx, t, p) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#1a0408'], [1, '#000000']]));
  ground(ctx, '#140a10');
  echoOf(ctx, t, p, 0.5, 2.8);
  embers(ctx, t.localMs, 20, 0.5);
};

const face: Draw = (ctx, t, p) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#120610'], [1, '#000000']]));
  ground(ctx, '#140a10');
  player(ctx, t, p, { x: 0.3, scale: 2.2, row: 2, rim: '#e8d8ff', shade: 0.25 });
  echoOf(ctx, t, p, 0.7, 2.2, 6);
};

const murmur: Draw = (ctx, t) => {
  fillAll(ctx, '#000000');
  glyphs(ctx, t, 12, 'rgba(255, 210, 200, A)');
};

const herald: Draw = (ctx, t) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#0c0c10'], [1, '#000000']]));
  // Colourless and too big: a shape with too many points.
  ctx.fillStyle = 'rgba(28, 28, 34, 0.96)';
  ctx.beginPath();
  const cx = W / 2;
  const cy = GROUND - 50;
  for (let i = 0; i <= 14; i++) {
    const a = (i / 14) * Math.PI * 2;
    const r = (i % 2 === 0 ? 70 : 40) + Math.sin(t.localMs / 900 + i) * 4;
    ctx.lineTo(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r);
  }
  ctx.fill();
  glyphs(ctx, t, 5, 'rgba(200, 200, 210, A)');
};

const fogWall: Draw = (ctx, t, p) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#0c0c12'], [1, '#000000']]));
  ground(ctx, '#121018');
  // The fog in a far doorway: pale bands that breathe.
  for (let i = 0; i < 6; i++) {
    const breath = 0.5 + 0.5 * Math.sin(t.localMs / 900 + i);
    ctx.fillStyle = `rgba(200, 205, 220, ${0.12 + 0.1 * breath})`;
    ctx.fillRect(W * 0.6, GROUND - 70 + i * 11, 60, 9);
  }
  glow(ctx, W * 0.6 + 30, GROUND - 40, 50, '#d8dcf0', 0.12);
  if (p.pose) player(ctx, t, p, { x: 0.22, scale: 1.6, row: 2 });
};

const someone: Draw = (ctx, t, p) => {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#0e0a12'], [1, '#000000']]));
  ground(ctx, '#120e16');
  const other = p.other;
  if (!other) return;
  // Known: its own sheet, dim and rimmed in the eclipse's red; unknown: flat black.
  silhouette(ctx, t.sheets, t.localMs, { sprite: other.sprite, anim: 'Idle', row: 0, x: W / 2, y: GROUND + 4, scale: 3, fill: '#000000', rim: other.known ? RED : 'rgba(210, 200, 230, 0.6)', shade: other.known ? 0.55 : 1 });
};

const pulse: Draw = (ctx, t) => {
  const beat = Math.pow(Math.max(0, Math.sin(t.localMs / 420)), 6);
  fillAll(ctx, `rgb(${Math.round(18 + 50 * beat)}, ${Math.round(4 + 6 * beat)}, ${Math.round(10 + 10 * beat)})`);
  // Walls on both sides, closing in with the beat.
  ctx.fillStyle = '#050206';
  ctx.fillRect(-BLEED, -BLEED, BLEED + 50 + 8 * beat, H + BLEED * 2);
  ctx.fillRect(W - 50 - 8 * beat, -BLEED, 50 + BLEED, H + BLEED * 2);
};

const kneel: Draw = (ctx, t, p) => {
  pulse(ctx, t, p);
  shapes(ctx, t, 6, GROUND - 2, null);
  player(ctx, t, p, { x: 0.5, scale: 2, rim: '#ff6a6a', shade: 0.5 });
};

const hand: Draw = (ctx, t, p) => {
  fillAll(ctx, '#000000');
  // The Pokémon rises, held by a hand of shadow from above.
  const lift = t.progress * 40;
  player(ctx, t, p, { x: 0.5, y: GROUND + 20 - lift, scale: 2, rim: '#c8a0ff', shade: 0.6 });
  ctx.fillStyle = '#000000';
  ctx.strokeStyle = 'rgba(200, 52, 76, 0.6)';
  ctx.beginPath();
  ctx.moveTo(W / 2 - 6, -BLEED);
  ctx.lineTo(W / 2 - 4, GROUND - 46 - lift);
  ctx.lineTo(W / 2 - 12, GROUND - 36 - lift);
  ctx.lineTo(W / 2 + 12, GROUND - 36 - lift);
  ctx.lineTo(W / 2 + 4, GROUND - 46 - lift);
  ctx.lineTo(W / 2 + 6, -BLEED);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
};

const wake: Draw = (ctx, t, p) => {
  nightSky(ctx, t, true, true);
  ground(ctx, '#2a1a1c');
  pit(ctx, t, W * 0.78, GROUND + 4, 50);
  // Ash, and the Pokémon lying in it.
  for (let i = 0; i < 24; i++) {
    ctx.fillStyle = `rgba(160, 140, 140, ${0.1 + 0.15 * hash01(i)})`;
    ctx.fillRect(Math.round(hash01(i * 3) * W), GROUND - 2 + Math.round(hash01(i * 5) * 12), 2, 1);
  }
  player(ctx, t, p, { x: 0.4, scale: 2, anim: 'Faint', rim: '#ffb4a4', shade: 0.3 });
  shadowOf(ctx, t, p, { x: 0.4, y: GROUND + 10, scale: 2, alpha: 0.3 });
};

const phantump: Draw = (ctx, t, p) => {
  nightSky(ctx, t, true, true);
  ground(ctx, '#2a1a1c');
  pit(ctx, t, W * 0.82, GROUND + 4, 44);
  ctx.fillStyle = '#1b1410';
  ctx.fillRect(W * 0.6 - 12, GROUND - 6, 24, 8);
  glow(ctx, W * 0.6, GROUND - 24, 50, '#86d68f', 0.14);
  silhouette(ctx, t.sheets, t.localMs, { sprite: SPRITE_KEYS.phantump, anim: 'Idle', row: 2, x: W * 0.6, y: GROUND - 2, scale: 2.2, fill: '#05030a', rim: '#86d68f', shade: 0.3 });
  player(ctx, t, p, { x: 0.36, scale: 2, row: 6, rim: '#ffb4a4', shade: 0.3 });
};

const statueScene: Draw = (ctx, t) => {
  nightSky(ctx, t, true, true);
  ground(ctx, '#20161a');
  pit(ctx, t, W * 0.38, GROUND + 6, 80);
  statue(ctx, W * 0.72, 1.6);
  fallingLight(ctx, t, W * 0.38, 40, 18, 0.5);
};

const STAGES: Record<SimaStage, Draw> = {
  rim,
  fall,
  'rim-shadow': rimShadow,
  black,
  voice,
  roots,
  loop,
  back,
  bell,
  names,
  mirror,
  backs,
  islands,
  'ring-below': ringBelow,
  alone,
  rise,
  echo,
  face,
  murmur,
  herald,
  'fog-wall': fogWall,
  someone,
  pulse,
  kneel,
  hand,
  wake,
  phantump,
  statue: statueScene,
};

/** Draws one moment of a Sima cinematic on a STAGE-sized context (the prologue's camera, vignette and fade). */
export function drawSimaScene(ctx: CanvasRenderingContext2D, panel: SimaPanel, time: SceneTime, camera: Shot, alpha: number): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.filter = 'none';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, W / 2 - camera.x * W * camera.zoom, H / 2 - camera.y * H * camera.zoom);
  STAGES[panel.scene](ctx, time, panel);
  ctx.filter = 'none';
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx);
  if (alpha < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.max(0, alpha)})`;
    ctx.fillRect(0, 0, W, H);
  }
}

