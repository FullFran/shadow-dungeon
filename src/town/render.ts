import { SPRITES } from '../data/sprites';
import { GROUND_SHEETS, GROUND_TUFTS, TOWN_GROUND, TOWN_PROPS, type TownPropKind } from '../data/town';
import type { MapLook } from '../data/world';
import type { Rect } from '../core/state';
import { TILE } from '../core/tiles';
import type { Vec2 } from '../core/vec';
import { sheetKey, type SheetStore } from '../adapters/assets';
import { directionRow, frameAtTime } from '../adapters/sprite-anim';
import { visibleTiles } from '../adapters/view';
import { emberAt, hash01 } from '../ui/eclipse';
import { drawPanel, pixelText } from '../ui/canvas';
import { canvasFont, PALETTE } from '../ui/tokens';
import { groundAt, isFloorGround, pathPatchCell, type MapShape } from './map';

/**
 * Draws the town in view pixels: ground tiles (16 px source at 2x), props
 * and characters sorted by their feet, a red eclipse multiply over the
 * world, the sky band with the eclipse at the top of the view, and embers.
 * The caller applies the integer pixel scale; this module keeps no state.
 */
export type TownImages = ReadonlyMap<string, HTMLImageElement>;

/** Height of the sky band at the top of the view, in view px (the camera may scroll up under it). */
export const SKY_BAND = 64;
const SRC = 16;
const EMBERS = 36;

export interface TownCharacter {
  sprite: string;
  pos: Vec2;
  facing: Vec2;
  moving: boolean;
  /** Floaters (Gastly) bob and cast a smaller shadow. */
  floats?: boolean;
}

/** The town's own light, for maps without a look. */
export const DEFAULT_LOOK: MapLook = { ground: 'light', tint: ['#ffc4b4', '#c47f86'], eclipse: 1 };

export interface TownFrame {
  map: MapShape;
  /** Ground sheet, eclipse light and size (the town's when absent). */
  look?: MapLook;
  view: Rect;
  timeMs: number;
  characters: readonly TownCharacter[];
}

function drawCharacter(ctx: CanvasRenderingContext2D, sheets: SheetStore, c: TownCharacter, timeMs: number): void {
  const anim = c.moving ? 'Walk' : 'Idle';
  const meta = SPRITES.sprites[c.sprite]?.anims[anim] ?? SPRITES.sprites[c.sprite]?.anims.Idle;
  const image = meta && sheets.get(sheetKey(c.sprite, meta.file));
  const bob = c.floats ? Math.round(Math.sin(timeMs / 400) * 2) - 6 : 0;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
  ctx.beginPath();
  ctx.ellipse(Math.round(c.pos.x), Math.round(c.pos.y), c.floats ? 7 : 10, c.floats ? 3 : 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  if (!meta || !image) {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(Math.round(c.pos.x - 6), Math.round(c.pos.y - 16), 12, 16);
    return;
  }
  const frame = frameAtTime(meta.durations, timeMs, true);
  const row = Math.min(directionRow(c.facing), meta.rows - 1);
  const anchor = meta.anchor ?? { x: meta.frameWidth / 2, y: meta.frameHeight * 0.75 };
  ctx.drawImage(
    image,
    frame * meta.frameWidth,
    row * meta.frameHeight,
    meta.frameWidth,
    meta.frameHeight,
    Math.round(c.pos.x - anchor.x),
    Math.round(c.pos.y - anchor.y + bob),
    meta.frameWidth,
    meta.frameHeight,
  );
}

/** Run of `=` tiles through (x, y) along one axis. */
function bridgeRun(map: MapShape, x: number, y: number, dx: number, dy: number): number {
  let n = 1;
  for (let i = 1; groundAt(map, x + dx * i, y + dy * i) === 'bridge'; i++) n++;
  for (let i = 1; groundAt(map, x - dx * i, y - dy * i) === 'bridge'; i++) n++;
  return n;
}

/** Water, chasm, rock and bridge tiles: drawn by code in the pack's palette, darkened by the eclipse. */
function drawSpecial(ctx: CanvasRenderingContext2D, map: MapShape, kind: 'water' | 'chasm' | 'rock' | 'bridge', tx: number, ty: number, timeMs: number): void {
  const x = tx * TILE;
  const y = ty * TILE;
  const at = (dx: number, dy: number) => groundAt(map, tx + dx, ty + dy);
  if (kind === 'water') {
    ctx.fillStyle = '#0b0c1a';
    ctx.fillRect(x, y, TILE, TILE);
    // Shore: the bank's dark lip and a pale foam line where the land meets the water.
    if (at(0, -1) !== 'water' && at(0, -1) !== 'bridge') {
      ctx.fillStyle = '#2b2132';
      ctx.fillRect(x, y, TILE, 5);
      ctx.fillStyle = 'rgba(255, 190, 170, 0.25)';
      ctx.fillRect(x, y + 5, TILE, 1);
    }
    // Shimmer: the eclipse's red glinting on slow ripples.
    for (let i = 0; i < 2; i++) {
      const seed = tx * 13 + ty * 7 + i * 5;
      const phase = timeMs / (1400 + hash01(seed) * 900) + hash01(seed + 1) * 6.28;
      const alpha = Math.max(0, Math.sin(phase)) * 0.55;
      if (alpha < 0.05) continue;
      const len = 5 + Math.floor(hash01(seed + 2) * 8);
      const sx = x + Math.floor(hash01(seed + 3) * (TILE - len));
      const sy = y + 9 + Math.floor(hash01(seed + 4) * (TILE - 12));
      ctx.fillStyle = `rgba(255, 110, 90, ${alpha})`;
      ctx.fillRect(sx + Math.round(Math.sin(phase * 0.7) * 2), sy, len, 1);
    }
    return;
  }
  if (kind === 'chasm') {
    ctx.fillStyle = '#030105';
    ctx.fillRect(x, y, TILE, TILE);
    const pulse = 0.6 + 0.4 * Math.sin(timeMs / 1100 + tx * 0.7 + ty);
    ctx.fillStyle = `rgba(200, 30, 50, ${0.07 * pulse})`;
    ctx.fillRect(x, y, TILE, TILE);
    if (at(0, -1) !== 'chasm') {
      // The near cliff face: rock strata falling into the dark.
      ctx.fillStyle = '#3a2a36';
      ctx.fillRect(x, y, TILE, 10);
      ctx.fillStyle = '#251a24';
      ctx.fillRect(x, y + 10, TILE, 6);
      ctx.fillStyle = '#5a4552';
      ctx.fillRect(x, y, TILE, 2);
    }
    if (at(-1, 0) !== 'chasm' && at(-1, 0) !== 'bridge') {
      ctx.fillStyle = '#1a1018';
      ctx.fillRect(x, y, 3, TILE);
    }
    if (at(1, 0) !== 'chasm' && at(1, 0) !== 'bridge') {
      ctx.fillStyle = '#1a1018';
      ctx.fillRect(x + TILE - 3, y, 3, TILE);
    }
    return;
  }
  if (kind === 'rock') {
    ctx.fillStyle = '#3b3140';
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = '#2c2432';
    for (let i = 0; i < 3; i++) {
      const seed = tx * 31 + ty * 17 + i;
      ctx.fillRect(x + Math.floor(hash01(seed) * 26), y + Math.floor(hash01(seed + 9) * 26), 4 + Math.floor(hash01(seed + 3) * 6), 2);
    }
    if (at(0, -1) !== 'rock') {
      ctx.fillStyle = '#62506a';
      ctx.fillRect(x, y, TILE, 3);
    }
    if (at(0, 1) !== 'rock') {
      ctx.fillStyle = '#1b1420';
      ctx.fillRect(x, y + TILE - 4, TILE, 4);
    }
    return;
  }
  // Bridge or pier: what lies below shows at the rails, planks run across the way it is walked.
  const along = bridgeRun(map, tx, ty, 1, 0) >= bridgeRun(map, tx, ty, 0, 1);
  ctx.fillStyle = '#05030a';
  ctx.fillRect(x, y, TILE, TILE);
  ctx.fillStyle = '#7a4a30';
  if (along) ctx.fillRect(x, y + 2, TILE, TILE - 4);
  else ctx.fillRect(x + 2, y, TILE - 4, TILE);
  ctx.fillStyle = '#4a2a1c';
  for (let i = 0; i < TILE; i += 8) {
    if (along) ctx.fillRect(x + i, y + 2, 1, TILE - 4);
    else ctx.fillRect(x + 2, y + i, TILE - 4, 1);
  }
  ctx.fillStyle = '#9a6a48';
  if (along) ctx.fillRect(x, y + 3, TILE, 1);
  else ctx.fillRect(x + 3, y, 1, TILE);
  const rail = (dx: number, dy: number) => !isFloorGround(at(dx, dy));
  ctx.fillStyle = '#2e1a10';
  if (along) {
    if (rail(0, -1)) ctx.fillRect(x, y, TILE, 3);
    if (rail(0, 1)) ctx.fillRect(x, y + TILE - 3, TILE, 3);
  } else {
    if (rail(-1, 0)) ctx.fillRect(x, y, 3, TILE);
    if (rail(1, 0)) ctx.fillRect(x + TILE - 3, y, 3, TILE);
  }
}

function ground(ctx: CanvasRenderingContext2D, images: TownImages, map: MapShape, view: Rect, look: MapLook, timeMs: number): void {
  const sheet = images.get(GROUND_SHEETS[look.ground]) ?? images.get(TOWN_GROUND.file);
  const cols = map.rows[0]?.length ?? 0;
  const { x0, y0, x1, y1 } = visibleTiles(view, { cols, rows: map.rows.length, tiles: [] });
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const kind = groundAt(map, tx, ty);
      if (kind === 'sky') continue;
      if (kind === 'water' || kind === 'chasm' || kind === 'rock' || kind === 'bridge') {
        drawSpecial(ctx, map, kind, tx, ty, timeMs);
        continue;
      }
      const x = tx * TILE;
      const y = ty * TILE;
      if (!sheet) {
        ctx.fillStyle = kind === 'path' ? '#b07a52' : '#7d9a3a';
        ctx.fillRect(x, y, TILE, TILE);
        continue;
      }
      let src: { x: number; y: number } = TOWN_GROUND.grass;
      if (kind === 'path') {
        const cell = pathPatchCell(map, tx, ty);
        src = { x: TOWN_GROUND.path.x + cell.col * SRC, y: TOWN_GROUND.path.y + cell.row * SRC };
      } else if (hash01(tx * 7919 + ty * 104729) < 0.18) {
        const tufts = sheet === images.get(GROUND_SHEETS[look.ground]) ? GROUND_TUFTS[look.ground] : TOWN_GROUND.grassTufts;
        src = tufts[Math.floor(hash01(tx * 31 + ty * 17 + 5) * tufts.length)]!;
      }
      ctx.drawImage(sheet, src.x, src.y, SRC, SRC, x, y, TILE, TILE);
    }
  }
}

interface Sprite {
  /** Feet line, for sorting. */
  base: number;
  draw: () => void;
}

/** Forest tiles are covered by small trees, one per 2x2 block. */
function forestTrees(map: MapShape, view: Rect): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  const cols = map.rows[0]?.length ?? 0;
  const { x0, y0, x1, y1 } = visibleTiles({ x: view.x - TILE * 2, y: view.y - TILE * 2, width: view.width + TILE * 2, height: view.height + TILE * 2 }, { cols, rows: map.rows.length, tiles: [] });
  for (let ty = y0 - (y0 % 2); ty <= y1; ty += 2) {
    for (let tx = x0 - (x0 % 2); tx <= x1; tx += 2) if (groundAt(map, tx, ty) === 'forest' && ty >= 0 && tx >= 0) out.push({ x: tx, y: ty });
  }
  return out;
}

function propSprite(ctx: CanvasRenderingContext2D, images: TownImages, kind: TownPropKind, x: number, y: number): Sprite {
  const spec = TOWN_PROPS[kind];
  return {
    base: (y + spec.height) * TILE,
    draw: () => {
      const image = images.get(spec.file);
      if (image) ctx.drawImage(image, x * TILE, y * TILE, image.width * 2, image.height * 2);
    },
  };
}

/** A prop's rectangle (px) meets the view, with a margin. */
function propVisible(kind: TownPropKind, x: number, y: number, view: Rect): boolean {
  const spec = TOWN_PROPS[kind];
  return x * TILE < view.x + view.width + TILE && (x + spec.width) * TILE > view.x - TILE && y * TILE < view.y + view.height + TILE && (y + spec.height) * TILE > view.y - TILE;
}

/**
 * The sky band: dark sky, the eclipse with a pulsing corona (bigger than
 * the band where the map looks at it), a far ruined skyline in front of it
 * and a soft fade into the town.
 */
function sky(ctx: CanvasRenderingContext2D, view: Rect, timeMs: number, size = 1): void {
  const w = view.width;
  const h = SKY_BAND;
  const gradient = ctx.createLinearGradient(0, 0, 0, h);
  gradient.addColorStop(0, '#000000');
  gradient.addColorStop(0.55, 'rgba(20, 2, 10, 0.97)');
  gradient.addColorStop(1, 'rgba(40, 4, 14, 0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(220, 225, 255, ${0.15 + 0.35 * hash01(i + 900) * (0.5 + 0.5 * Math.sin(timeMs / 900 + i))})`;
    ctx.fillRect(Math.floor(hash01(i + 100) * w), Math.floor(hash01(i + 300) * h * 0.5), 1, 1);
  }
  // Slight parallax: the eclipse drifts against the camera.
  const cx = Math.round(w * 0.68 - view.x * 0.04);
  const cy = Math.round(22 + (size - 1) * 9);
  const r = Math.round(11 * size);
  const pulse = 0.82 + 0.18 * Math.sin(timeMs / 1400);
  const corona = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 3.4);
  corona.addColorStop(0, `rgba(255, 106, 61, ${0.85 * pulse})`);
  corona.addColorStop(0.2, `rgba(232, 40, 58, ${0.5 * pulse})`);
  corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = corona;
  ctx.fillRect(cx - r * 4, 0, r * 8, Math.max(h, cy + r * 3.4));
  ctx.fillStyle = PALETTE.eclipseGlow;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffd0a0';
  ctx.beginPath();
  ctx.arc(cx + 1, cy + 1, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#050003';
  ctx.beginPath();
  ctx.arc(cx - 1, cy - 1, r, 0, Math.PI * 2);
  ctx.fill();
  // Far ruins on the horizon, rim-lit red, scrolling slower than the town.
  const shift = Math.floor(view.x * 0.15);
  ctx.fillStyle = '#0b0410';
  for (let x = -40; x < w + 40; x += 6) {
    const seg = Math.floor((x + shift) / 6);
    const tower = hash01(seg + 50) > 0.85;
    const tall = tower ? 10 + Math.floor(hash01(seg + 70) * 10) : 2 + Math.floor(hash01(seg + 90) * 5);
    const left = x - ((x + shift) % 6);
    ctx.fillStyle = '#0b0410';
    ctx.fillRect(left, h - 22 - tall, 6, tall + 4);
    ctx.fillStyle = `rgba(232, 40, 58, ${0.35 * pulse})`;
    ctx.fillRect(left, h - 22 - tall, 5, 1);
  }
  const fade = ctx.createLinearGradient(0, h - 22, 0, h);
  fade.addColorStop(0, 'rgba(11, 4, 16, 1)');
  fade.addColorStop(1, 'rgba(11, 4, 16, 0)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, h - 22, w, 22);
}

/** Eclipse light: a red multiply over everything, darker towards the bottom, and a warm glow from above. */
function tint(ctx: CanvasRenderingContext2D, view: Rect, timeMs: number, colours: readonly [string, string]): void {
  const pulse = 0.9 + 0.1 * Math.sin(timeMs / 1400);
  ctx.globalCompositeOperation = 'multiply';
  const light = ctx.createLinearGradient(0, 0, 0, view.height);
  light.addColorStop(0, colours[0]);
  light.addColorStop(1, colours[1]);
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.globalCompositeOperation = 'source-over';
  const glow = ctx.createRadialGradient(view.width * 0.68, 0, 10, view.width * 0.68, 0, view.width * 0.7);
  glow.addColorStop(0, `rgba(255, 90, 50, ${0.16 * pulse})`);
  glow.addColorStop(1, 'rgba(255, 90, 50, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, view.width, view.height);
}

function embers(ctx: CanvasRenderingContext2D, view: Rect, timeMs: number): void {
  for (let i = 0; i < EMBERS; i++) {
    const e = emberAt(i + 7, timeMs, view.width, view.height);
    ctx.globalAlpha = e.alpha * 0.8;
    ctx.fillStyle = e.hot ? PALETTE.cursor : PALETTE.eclipseGlow;
    ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, e.hot ? 1 : 2);
  }
  ctx.globalAlpha = 1;
}

/** World, tint, sky and embers, in view pixels (call with the pixel scale applied). */
export function drawTownWorld(ctx: CanvasRenderingContext2D, images: TownImages, sheets: SheetStore, frame: TownFrame): void {
  const { map, view, timeMs } = frame;
  const look = frame.look ?? DEFAULT_LOOK;
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#05060d';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  ctx.translate(-Math.round(view.x), -Math.round(view.y));
  ground(ctx, images, map, view, look, timeMs);
  const props = map.props.filter((p) => propVisible(p.kind, p.x, p.y, view));
  for (const p of props) if (TOWN_PROPS[p.kind].decal) propSprite(ctx, images, p.kind, p.x, p.y).draw();
  const sprites: Sprite[] = [
    ...forestTrees(map, view).map((t) => propSprite(ctx, images, 'tree-small', t.x, t.y)),
    ...props.filter((p) => !TOWN_PROPS[p.kind].decal).map((p) => propSprite(ctx, images, p.kind, p.x, p.y)),
    ...frame.characters.map((c) => ({ base: c.pos.y, draw: () => drawCharacter(ctx, sheets, c, timeMs) })),
  ];
  sprites.sort((a, b) => a.base - b.base);
  for (const s of sprites) s.draw();
  ctx.restore();
  tint(ctx, view, timeMs, look.tint);
  sky(ctx, view, timeMs, look.eclipse);
  embers(ctx, view, timeMs);
}

export interface TownOverlay {
  /** "E / Enter: talk" over the target in range. */
  prompt: { text: string; pos: Vec2 } | null;
  dialog: { speaker: string; text: string; done: boolean } | null;
  /** The map's name on arrival, fading out. */
  banner?: { text: string; alpha: number } | null;
  /** Black over everything while changing maps (0..1). */
  fade?: number;
}

/** Greedy word wrap to `maxWidth` view px in the current font. */
export function wrapText(text: string, maxWidth: number, measure: (s: string) => number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next) > maxWidth) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Interaction prompt and the dialog box (Mystery Dungeon window language), in view pixels. */
export function drawTownOverlay(ctx: CanvasRenderingContext2D, view: Rect, overlay: TownOverlay, timeMs: number): void {
  ctx.font = canvasFont();
  if (overlay.prompt && !overlay.dialog) {
    const width = Math.ceil(ctx.measureText(overlay.prompt.text).width) + 12;
    const x = Math.round(Math.min(view.width - width - 4, Math.max(4, overlay.prompt.pos.x - view.x - width / 2)));
    const y = Math.round(Math.max(SKY_BAND - 8, overlay.prompt.pos.y - view.y - 52));
    drawPanel(ctx, x, y, width, 16, { fill: 0.9 });
    pixelText(ctx, overlay.prompt.text, x + 6, y + 12, PALETTE.text);
  }
  if (overlay.banner && overlay.banner.alpha > 0) {
    const text = overlay.banner.text;
    const width = Math.ceil(ctx.measureText(text).width) + 28;
    const x = Math.round((view.width - width) / 2);
    drawPanel(ctx, x, SKY_BAND - 4, width, 20, { alpha: overlay.banner.alpha });
    ctx.globalAlpha = overlay.banner.alpha;
    pixelText(ctx, text, view.width / 2, SKY_BAND + 10, PALETTE.cursor, 'center');
    ctx.globalAlpha = 1;
  }
  drawDialog(ctx, view, overlay, timeMs);
  if (overlay.fade && overlay.fade > 0) {
    ctx.fillStyle = `rgba(0, 0, 0, ${overlay.fade})`;
    ctx.fillRect(0, 0, view.width, view.height);
  }
}

function drawDialog(ctx: CanvasRenderingContext2D, view: Rect, overlay: TownOverlay, timeMs: number): void {
  const dialog = overlay.dialog;
  if (!dialog) return;
  const x = 16;
  const w = view.width - 32;
  const h = 70;
  // Clear of the fan-project notice at the bottom of the page.
  const y = view.height - h - 24;
  drawPanel(ctx, x, y, w, h);
  pixelText(ctx, dialog.speaker, x + 10, y + 15, PALETTE.cursor);
  const lines = wrapText(dialog.text, w - 24, (s) => ctx.measureText(s).width);
  lines.slice(0, 3).forEach((line, i) => pixelText(ctx, line, x + 10, y + 31 + i * 13, PALETTE.text));
  if (dialog.done && Math.floor(timeMs / 400) % 2 === 0) {
    // "More" marker: a small down-pointing triangle (the pixel font has no glyph for it).
    ctx.fillStyle = PALETTE.cursor;
    for (let row = 0; row < 3; row++) ctx.fillRect(x + w - 16 + row, y + h - 12 + row, 5 - row * 2, 1);
  }
}
