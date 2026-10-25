import { ECLIPSE_REVEAL_MS, type PrologueScene } from '../data/prologue';
import { SPRITE_KEYS, SPRITES } from '../data/sprites';
import { drawEclipse, emberAt, hash01, skyline } from '../ui/eclipse';
import { PALETTE } from '../ui/tokens';
import { sheetKey, type SheetStore } from './assets';
import { frameAtTime } from './sprite-anim';

/**
 * The prologue tableaux, drawn in code on a low-resolution stage (STAGE,
 * scaled up pixelated by the player). Each scene is a function of time only:
 * `localMs` into its panel and `progress` (0..1) through it. Pokémon appear
 * only as dark silhouettes cut from the sprite sheets already loaded for the
 * game; when a sheet is missing that figure is simply left out. What lies
 * beneath the earth is never drawn: only light sinking into the dark and the
 * glint of a crystal.
 */
export const STAGE = { w: 320, h: 180 } as const;

/** Margin drawn around the stage so a camera pan or zoom never shows an edge. */
const BLEED = 40;

export interface SceneTime {
  localMs: number;
  progress: number;
  sheets: SheetStore | null;
}

const { w: W, h: H } = STAGE;

function gradient(ctx: CanvasRenderingContext2D, top: number, bottom: number, stops: readonly [number, string][]): CanvasGradient {
  const g = ctx.createLinearGradient(0, top, 0, bottom);
  for (const [at, color] of stops) g.addColorStop(at, color);
  return g;
}

function fillAll(ctx: CanvasRenderingContext2D, style: string | CanvasGradient): void {
  ctx.fillStyle = style;
  ctx.fillRect(-BLEED, -BLEED, W + BLEED * 2, H + BLEED * 2);
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

function disc(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

function stars(ctx: CanvasRenderingContext2D, ms: number, alpha: number, count = 70, salt = 0): void {
  for (let i = 0; i < count; i++) {
    const twinkle = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(ms / (700 + hash01(i + salt + 500) * 1600) + i));
    ctx.fillStyle = `rgba(220, 225, 255, ${alpha * twinkle * hash01(i + salt + 900)})`;
    ctx.fillRect(Math.floor(hash01(i + salt + 100) * (W + BLEED * 2)) - BLEED, Math.floor(hash01(i + salt + 300) * H * 0.7) - BLEED / 2, 1, 1);
  }
}

function embers(ctx: CanvasRenderingContext2D, ms: number, count: number, alpha: number, colors: readonly [string, string] = [PALETTE.cursor, PALETTE.eclipseGlow]): void {
  for (let i = 0; i < count; i++) {
    const e = emberAt(i, ms, W + BLEED * 2, H + BLEED);
    ctx.globalAlpha = e.alpha * alpha;
    ctx.fillStyle = e.hot ? colors[0] : colors[1];
    ctx.fillRect(Math.round(e.x) - BLEED, Math.round(e.y), 1, e.hot ? 1 : 2);
  }
  ctx.globalAlpha = 1;
}

/** Skyline layer across the stage and its bleed. */
function ruins(ctx: CanvasRenderingContext2D, base: number, salt: number, color: string, rim: number): void {
  ctx.save();
  ctx.translate(-BLEED, 0);
  skyline(ctx, W + BLEED * 2, H + BLEED, base, salt, color, rim);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Silhouettes cut from the sprite sheets.

let scratch: HTMLCanvasElement | null = null;

interface Figure {
  sprite: string;
  anim: 'Idle' | 'Walk';
  /** Sheet row: 0 faces the viewer, 4 shows the back. */
  row: number;
  /** Ground point on the stage. */
  x: number;
  y: number;
  scale: number;
  fill: string;
  rim: string;
  alpha?: number;
  /** How much of the sprite the dark fill hides (1, the default, is a flat silhouette). */
  shade?: number;
}

function figureLayer(image: HTMLImageElement, sx: number, sy: number, fw: number, fh: number, color: string, shade = 1): HTMLCanvasElement {
  scratch ??= document.createElement('canvas');
  if (scratch.width !== fw || scratch.height !== fh) {
    scratch.width = fw;
    scratch.height = fh;
  }
  const s = scratch.getContext('2d')!;
  s.globalCompositeOperation = 'source-over';
  s.clearRect(0, 0, fw, fh);
  s.drawImage(image, sx, sy, fw, fh, 0, 0, fw, fh);
  s.globalCompositeOperation = shade >= 1 ? 'source-in' : 'source-atop';
  s.globalAlpha = shade;
  s.fillStyle = color;
  s.fillRect(0, 0, fw, fh);
  s.globalAlpha = 1;
  return scratch;
}

/** A Pokémon as a dark shape (flat, or with a little of the sprite showing through) with a one-pixel rim of light around it. */
function silhouette(ctx: CanvasRenderingContext2D, sheets: SheetStore | null, ms: number, f: Figure): void {
  const meta = SPRITES.sprites[f.sprite]?.anims[f.anim];
  const image = meta ? sheets?.get(sheetKey(f.sprite, meta.file)) : undefined;
  if (!meta || !image) return;
  const frame = frameAtTime(meta.durations, ms, true);
  const row = Math.min(f.row, meta.rows - 1);
  const anchor = meta.anchor ?? { x: meta.frameWidth / 2, y: meta.frameHeight * 0.8 };
  const dx = Math.round(f.x - anchor.x * f.scale);
  const dy = Math.round(f.y - anchor.y * f.scale);
  const dw = meta.frameWidth * f.scale;
  const dh = meta.frameHeight * f.scale;
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = f.alpha ?? 1;
  const rim = figureLayer(image, frame * meta.frameWidth, row * meta.frameHeight, meta.frameWidth, meta.frameHeight, f.rim);
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) ctx.drawImage(rim, dx + ox, dy + oy, dw, dh);
  const body = figureLayer(image, frame * meta.frameWidth, row * meta.frameHeight, meta.frameWidth, meta.frameHeight, f.fill, f.shade);
  ctx.drawImage(body, dx, dy, dw, dh);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------------------
// Scenes.

/** The age of light: a white-gold sun over warm hills, Pokémon looking up at it. */
function light(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#fff1c4'], [0.45, '#f6c777'], [0.8, '#e08c4a'], [1, '#b0532f']]));
  const sx = W / 2;
  const sy = 58;
  glow(ctx, sx, sy, 120, 'rgba(255, 252, 230, 0.9)', 0.8);
  // Slow rays turning around the sun.
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(t.localMs / 40000);
  ctx.fillStyle = 'rgba(255, 250, 225, 0.07)';
  for (let i = 0; i < 12; i++) {
    ctx.rotate((Math.PI * 2) / 12);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-6, -200);
    ctx.lineTo(6, -200);
    ctx.fill();
  }
  ctx.restore();
  disc(ctx, sx, sy, 21, '#fffbea');
  // Far and near hills.
  hills(ctx, 114, 9, 0.021, '#c4743f', 3);
  hills(ctx, 132, 6, 0.034, '#5c2c1d', 11);
  const figures: Figure[] = [
    { sprite: SPRITE_KEYS.mimikyu, anim: 'Idle', row: 4, x: 128, y: 128, scale: 1, fill: '#3b1a12', rim: '#ffe3a3' },
    { sprite: SPRITE_KEYS.poochyena, anim: 'Idle', row: 4, x: 156, y: 129, scale: 1, fill: '#3b1a12', rim: '#ffe3a3' },
    { sprite: SPRITE_KEYS.gastly, anim: 'Idle', row: 4, x: 192, y: 118 + Math.sin(t.localMs / 700) * 2, scale: 1, fill: '#3b1a12', rim: '#ffe3a3' },
  ];
  for (const f of figures) silhouette(ctx, t.sheets, t.localMs, f);
  embers(ctx, t.localMs, 40, 0.55, ['#fffbe0', '#ffd98a']);
}

function hills(ctx: CanvasRenderingContext2D, base: number, height: number, freq: number, color: string, salt: number): void {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-BLEED, H + BLEED);
  for (let x = -BLEED; x <= W + BLEED; x += 2) {
    const y = base - height * (0.5 + 0.5 * Math.sin(x * freq + salt)) - 3 * Math.sin(x * freq * 2.7 + salt * 2);
    ctx.lineTo(x, Math.round(y));
  }
  ctx.lineTo(W + BLEED, H + BLEED);
  ctx.fill();
}

/** Something beneath the earth: the light sinks through the rock into the dark; a crystal glints once in a while. */
function hunger(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  const ground = 40;
  fillAll(ctx, gradient(ctx, -BLEED, ground, [[0, '#4a2a26'], [1, '#8a4a30']]));
  glow(ctx, W / 2, 12, 60, 'rgba(255, 220, 160, 0.7)', 0.7);
  disc(ctx, W / 2, 12, 9, '#ffe6b0');
  ctx.fillStyle = gradient(ctx, ground, H + BLEED, [[0, '#21130f'], [0.4, '#0d0709'], [1, '#000000']]);
  ctx.fillRect(-BLEED, ground, W + BLEED * 2, H + BLEED);
  ctx.fillStyle = '#3a2219';
  ctx.fillRect(-BLEED, ground, W + BLEED * 2, 2);
  // Strata: wavy darker lines.
  for (let layer = 0; layer < 6; layer++) {
    const y0 = ground + 14 + layer * 17;
    ctx.fillStyle = layer % 2 ? '#1d1013' : '#170c10';
    for (let x = -BLEED; x < W + BLEED; x += 3) ctx.fillRect(x, Math.round(y0 + 3 * Math.sin(x * 0.05 + layer * 1.7)), 3, 1);
  }
  // The light, pulled down in threads and swallowed before it reaches the bottom.
  const sink = { x: W / 2 + 4, y: 128 };
  for (let i = 0; i < 90; i++) {
    const phase = ((t.localMs / 1000) * (0.22 + hash01(i + 40) * 0.12) + hash01(i)) % 1;
    const k = phase * phase;
    const sx = W / 2 + (hash01(i + 7) - 0.5) * 150;
    const x = sx + (sink.x - sx) * k + Math.sin(phase * 9 + i) * 2 * (1 - k);
    const y = ground + (sink.y - ground) * k;
    ctx.globalAlpha = (1 - phase) * (0.9 - 0.5 * hash01(i + 70));
    ctx.fillStyle = hash01(i + 3) > 0.6 ? '#fff3c8' : '#ffc860';
    ctx.fillRect(Math.round(x), Math.round(y), 1, hash01(i + 9) > 0.5 ? 2 : 1);
  }
  ctx.globalAlpha = 1;
  // The dark where the light goes.
  glow(ctx, sink.x, sink.y + 6, 70, 'rgba(0, 0, 0, 1)', 0.95);
  // The crystal: a dark facet, barely there, and a glint that flashes every few seconds.
  if (t.localMs > 2500) {
    const cx = sink.x + 6;
    const cy = sink.y + 2;
    ctx.fillStyle = '#120e1c';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 3, cy);
    ctx.lineTo(cx, cy + 3);
    ctx.lineTo(cx - 2, cy);
    ctx.fill();
    ctx.fillStyle = '#2e2846';
    ctx.fillRect(cx, cy - 6, 1, 6);
    const flash = Math.max(0, 1 - Math.abs(((t.localMs - 2500) % 3000) - 260) / 180);
    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 255, 255, ${flash})`;
      ctx.fillRect(cx, cy - 10, 1, 7);
      ctx.fillRect(cx - 3, cy - 7, 7, 1);
      ctx.fillStyle = `rgba(200, 220, 255, ${flash * 0.6})`;
      ctx.fillRect(cx - 1, cy - 8, 3, 3);
    }
  }
}

const mix = (a: number, b: number, k: number) => Math.round(a + (b - a) * k);
const rgb = (from: readonly number[], to: readonly number[], k: number) => `rgb(${mix(from[0]!, to[0]!, k)}, ${mix(from[1]!, to[1]!, k)}, ${mix(from[2]!, to[2]!, k)})`;

/** The sun drained: the sky darkens to red and black while a dark disc slides over the sun. */
function dimming(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  const k = t.progress;
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, rgb([122, 58, 42], [0, 0, 0], k)], [0.7, rgb([214, 128, 70], [26, 6, 10], k)], [1, rgb([150, 70, 40], [30, 6, 10], k)]]));
  stars(ctx, t.localMs, Math.max(0, k * 1.4 - 0.4));
  const sx = W / 2;
  const sy = 62;
  const r = 20;
  glow(ctx, sx, sy, 110 - 50 * k, k < 0.6 ? 'rgba(255, 210, 140, 0.9)' : 'rgba(232, 60, 50, 0.9)', 0.85 - 0.3 * k);
  disc(ctx, sx, sy, r, rgb([255, 240, 200], [255, 110, 60], k));
  const cover = 0.12 + 0.88 * k;
  disc(ctx, sx + (1 - cover) * r * 2.1, sy - (1 - cover) * r * 0.5, r, rgb([60, 30, 24], [5, 0, 3], k));
  ruins(ctx, 150, 200, '#170a10', 0.1 + 0.25 * k);
  ruins(ctx, 166, 0, '#050204', 0.2 + 0.35 * k);
  embers(ctx, t.localMs, 30, k);
}

/** The Crimson Eclipse: black, then the red ring opens with a flash and stays, pulsing. */
function eclipse(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  fillAll(ctx, '#000000');
  const since = t.localMs - ECLIPSE_REVEAL_MS;
  if (since < 0) return;
  stars(ctx, t.localMs, Math.min(1, since / 2000), 90, 33);
  const cx = W / 2;
  const cy = 66;
  const open = Math.min(1, since / 900);
  const r = 22 + 4 * (1 - (1 - open) ** 3);
  const pulse = 0.75 + 0.25 * Math.sin(since / 1100);
  drawEclipse(ctx, cx, cy, r, pulse * (0.4 + 0.6 * open), W + BLEED, H + BLEED);
  ruins(ctx, 160, 51, '#030104', 0.2 + 0.2 * pulse);
  embers(ctx, t.localMs, 90, Math.min(1, since / 1500));
  // The flash of the reveal.
  const flash = Math.max(0, 1 - since / 700);
  if (flash > 0) fillAll(ctx, `rgba(255, 190, 170, ${flash * 0.85})`);
}

function arch(ctx: CanvasRenderingContext2D, x: number, base: number, width: number, height: number, breath: number): void {
  const r = width / 2;
  // Stone frame.
  ctx.fillStyle = '#1d1519';
  ctx.beginPath();
  ctx.moveTo(x - r - 4, base);
  ctx.lineTo(x - r - 4, base - height + r);
  ctx.arc(x, base - height + r, r + 4, Math.PI, 0);
  ctx.lineTo(x + r + 4, base);
  ctx.fill();
  // The opening, lit red from deep inside.
  const inner = ctx.createLinearGradient(0, base, 0, base - height);
  inner.addColorStop(0, `rgba(160, 20, 34, ${0.55 + 0.35 * breath})`);
  inner.addColorStop(0.5, '#140306');
  inner.addColorStop(1, '#000000');
  ctx.fillStyle = inner;
  ctx.beginPath();
  ctx.moveTo(x - r, base);
  ctx.lineTo(x - r, base - height + r);
  ctx.arc(x, base - height + r, r, Math.PI, 0);
  ctx.lineTo(x + r, base);
  ctx.fill();
  // Rim light on the stones and a few fallen blocks.
  ctx.fillStyle = `rgba(232, 40, 58, ${0.35 + 0.3 * breath})`;
  ctx.fillRect(x - r - 4, base - height + r, 1, height - r);
  ctx.fillRect(x + r + 3, base - height + r, 1, height - r);
  ctx.fillStyle = '#120b0e';
  for (let i = 0; i < 4; i++) ctx.fillRect(Math.round(x - r - 10 + hash01(i + x) * (width + 20)), base - 2, 3 + Math.round(hash01(i + x + 9) * 3), 2);
}

/** The Shadow Dungeons: stone mouths on a dead plain under the eclipse, breathing red light. */
function dungeons(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.55, '#14040a'], [1, '#060203']]));
  stars(ctx, t.localMs, 0.6, 50, 7);
  drawEclipse(ctx, W / 2, 30, 11, 0.8 + 0.2 * Math.sin(t.localMs / 1100), W + BLEED, H + BLEED);
  ruins(ctx, 112, 120, '#0b0410', 0.15);
  ctx.fillStyle = gradient(ctx, 110, H + BLEED, [[0, '#120609'], [1, '#030102']]);
  ctx.fillRect(-BLEED, 110, W + BLEED * 2, H);
  const breath = (i: number) => 0.5 + 0.5 * Math.sin(t.localMs / 900 + i * 2.1);
  arch(ctx, 72, 140, 28, 44, breath(0));
  arch(ctx, 248, 142, 30, 46, breath(1));
  arch(ctx, 160, 150, 44, 66, breath(2));
  embers(ctx, t.localMs, 45, 0.8);
}

/** The ones who went in: two walk into the dark; one comes back, a shadow of itself. */
function shadows(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  fillAll(ctx, gradient(ctx, -BLEED, H, [[0, '#000000'], [0.6, '#10040a'], [1, '#050203']]));
  ctx.fillStyle = gradient(ctx, 104, H + BLEED, [[0, '#14070b'], [1, '#020101']]);
  ctx.fillRect(-BLEED, 104, W + BLEED * 2, H);
  const breath = 0.5 + 0.5 * Math.sin(t.localMs / 800);
  glow(ctx, W / 2, 118, 70, 'rgba(160, 20, 34, 0.8)', 0.35 + 0.2 * breath);
  arch(ctx, W / 2, 124, 50, 76, breath);
  const p = t.progress;
  const walkIn = Math.min(1, p / 0.62);
  const fadeIn = 1 - Math.min(1, Math.max(0, (p - 0.5) / 0.14));
  const depth = (k: number) => ({ y: 152 - 30 * k, scale: 1 });
  const goer = depth(walkIn);
  silhouette(ctx, t.sheets, t.localMs, { sprite: SPRITE_KEYS.poochyena, anim: 'Walk', row: 4, x: 146 + 8 * walkIn, y: goer.y, scale: goer.scale, fill: '#0c080e', rim: '#5a1a26', alpha: fadeIn });
  silhouette(ctx, t.sheets, t.localMs + 300, { sprite: SPRITE_KEYS.gastly, anim: 'Walk', row: 4, x: 178 - 10 * walkIn, y: goer.y - 10, scale: goer.scale, fill: '#0c080e', rim: '#5a1a26', alpha: fadeIn });
  if (p > 0.6) {
    const back = Math.min(1, (p - 0.6) / 0.4);
    const ret = depth(1 - back);
    silhouette(ctx, t.sheets, t.localMs, { sprite: SPRITE_KEYS.poochyena, anim: 'Walk', row: 0, x: W / 2, y: ret.y, scale: ret.scale, fill: '#000000', rim: PALETTE.eclipse, alpha: Math.min(1, back * 3) });
  }
  embers(ctx, t.localMs, 25, 0.6);
}

/** The Sword King before the sealed door, deep in the crypt. */
function king(ctx: CanvasRenderingContext2D, t: SceneTime): void {
  fillAll(ctx, '#07050a');
  // Back wall of stone blocks.
  for (let row = 0; row < 12; row++) {
    const y = -BLEED + row * 12;
    for (let col = -1; col < 16; col++) {
      const x = col * 24 + (row % 2 ? 12 : 0);
      ctx.fillStyle = hash01(row * 31 + col) > 0.5 ? '#0e0b12' : '#110d16';
      ctx.fillRect(x + 1, y + 1, 22, 10);
    }
  }
  ctx.fillStyle = gradient(ctx, 142, H + BLEED, [[0, '#0b080d'], [1, '#020102']]);
  ctx.fillRect(-BLEED, 142, W + BLEED * 2, H);
  // Pillars.
  for (const x of [34, 286]) {
    ctx.fillStyle = '#050407';
    ctx.fillRect(x - 12, -BLEED, 24, H + BLEED);
    ctx.fillStyle = 'rgba(232, 40, 58, 0.25)';
    ctx.fillRect(x + (x < W / 2 ? 11 : -12), -BLEED, 1, H + BLEED);
  }
  // The door: iron leaves in a stone frame, a red seal and chains across it.
  const seal = 0.55 + 0.45 * Math.sin(t.localMs / 1300);
  glow(ctx, W / 2, 70, 90, 'rgba(200, 24, 40, 0.8)', 0.25 + 0.2 * seal);
  ctx.fillStyle = '#1a141d';
  ctx.fillRect(112, 14, 96, 128);
  ctx.fillStyle = '#0b080e';
  ctx.fillRect(118, 20, 41, 122);
  ctx.fillRect(161, 20, 41, 122);
  ctx.fillStyle = '#18121c';
  for (let y = 32; y < 140; y += 22) {
    ctx.fillRect(118, y, 41, 2);
    ctx.fillRect(161, y, 41, 2);
  }
  ctx.strokeStyle = `rgba(255, 70, 80, ${0.5 + 0.5 * seal})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(W / 2, 50, 18, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(W / 2, 50, 12, 0, Math.PI * 2);
  ctx.stroke();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + t.localMs / 9000;
    ctx.fillStyle = `rgba(255, 120, 110, ${0.4 + 0.6 * seal})`;
    ctx.fillRect(Math.round(W / 2 + Math.cos(a) * 15), Math.round(50 + Math.sin(a) * 15), 1, 1);
  }
  ctx.fillStyle = '#2a2230';
  for (let i = 0; i <= 24; i++) {
    const k = i / 24;
    ctx.fillRect(Math.round(114 + 92 * k), Math.round(26 + 70 * k), 2, 2);
    ctx.fillRect(Math.round(206 - 92 * k), Math.round(26 + 70 * k), 2, 2);
  }
  // A shaft of cold light from above, with dust in it.
  ctx.fillStyle = 'rgba(190, 200, 255, 0.035)';
  ctx.beginPath();
  ctx.moveTo(140, -BLEED);
  ctx.lineTo(180, -BLEED);
  ctx.lineTo(206, 170);
  ctx.lineTo(114, 170);
  ctx.fill();
  for (let i = 0; i < 30; i++) {
    const y = ((t.localMs / 1000) * (2 + hash01(i) * 3) + hash01(i + 5) * 200) % 200 - 20;
    ctx.fillStyle = `rgba(220, 225, 255, ${0.25 * hash01(i + 11)})`;
    ctx.fillRect(Math.round(130 + hash01(i + 2) * 60 + (y / 200) * 10), Math.round(y), 1, 1);
  }
  // The king.
  silhouette(ctx, t.sheets, t.localMs, { sprite: SPRITE_KEYS.aegislashShield, anim: 'Idle', row: 0, x: W / 2, y: 132, scale: 2, fill: '#0a0710', shade: 0.8, rim: `rgba(255, 90, 90, ${0.55 + 0.35 * seal})` });
  embers(ctx, t.localMs, 20, 0.5);
}

function voice(ctx: CanvasRenderingContext2D): void {
  fillAll(ctx, '#000000');
}

const SCENES: Record<PrologueScene, (ctx: CanvasRenderingContext2D, t: SceneTime) => void> = { light, hunger, dimming, eclipse, dungeons, shadows, king, voice };

/** Darker corners, so every tableau reads as lit from the middle. */
function vignette(ctx: CanvasRenderingContext2D): void {
  const g = ctx.createRadialGradient(W / 2, H / 2, H * 0.45, W / 2, H / 2, W * 0.62);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.6)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

/**
 * Draws one moment of the prologue on a STAGE-sized context: the scene seen
 * through the camera (centre as a fraction of the stage, zoom ≥ 1), the
 * vignette, then black over it as the panel fades (alpha 0 is black).
 */
export function drawPrologue(
  ctx: CanvasRenderingContext2D,
  scene: PrologueScene,
  time: SceneTime,
  camera: { x: number; y: number; zoom: number },
  alpha: number,
): void {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  ctx.setTransform(camera.zoom, 0, 0, camera.zoom, W / 2 - camera.x * W * camera.zoom, H / 2 - camera.y * H * camera.zoom);
  SCENES[scene](ctx, time);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  vignette(ctx);
  if (alpha < 1) {
    ctx.fillStyle = `rgba(0, 0, 0, ${1 - Math.max(0, alpha)})`;
    ctx.fillRect(0, 0, W, H);
  }
}
