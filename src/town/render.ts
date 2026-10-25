import { SPRITES } from '../data/sprites';
import { TOWN_GROUND, TOWN_PROPS, type TownMap, type TownPropKind } from '../data/town';
import type { Rect } from '../core/state';
import { TILE } from '../core/tiles';
import type { Vec2 } from '../core/vec';
import { sheetKey, type SheetStore } from '../adapters/assets';
import { directionRow, frameAtTime } from '../adapters/sprite-anim';
import { visibleTiles } from '../adapters/view';
import { emberAt, hash01 } from '../ui/eclipse';
import { PALETTE } from '../ui/tokens';
import { groundAt, pathPatchCell } from './map';

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

export interface TownFrame {
  map: TownMap;
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

function ground(ctx: CanvasRenderingContext2D, images: TownImages, map: TownMap, view: Rect): void {
  const sheet = images.get(TOWN_GROUND.file);
  const cols = map.rows[0]?.length ?? 0;
  const { x0, y0, x1, y1 } = visibleTiles(view, { cols, rows: map.rows.length, tiles: [] });
  for (let ty = y0; ty <= y1; ty++) {
    for (let tx = x0; tx <= x1; tx++) {
      const kind = groundAt(map, tx, ty);
      if (kind === 'sky') continue;
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
        const tufts = TOWN_GROUND.grassTufts;
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
function forestTrees(map: TownMap, view: Rect): { x: number; y: number }[] {
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

/** The sky band: dark sky, the eclipse with a pulsing corona, a far ruined skyline and a soft fade into the town. */
function sky(ctx: CanvasRenderingContext2D, view: Rect, timeMs: number): void {
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
  const cy = 22;
  const r = 11;
  const pulse = 0.82 + 0.18 * Math.sin(timeMs / 1400);
  const corona = ctx.createRadialGradient(cx, cy, r * 0.9, cx, cy, r * 3.4);
  corona.addColorStop(0, `rgba(255, 106, 61, ${0.85 * pulse})`);
  corona.addColorStop(0.2, `rgba(232, 40, 58, ${0.5 * pulse})`);
  corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = corona;
  ctx.fillRect(cx - r * 4, 0, r * 8, h);
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
function tint(ctx: CanvasRenderingContext2D, view: Rect, timeMs: number): void {
  const pulse = 0.9 + 0.1 * Math.sin(timeMs / 1400);
  ctx.globalCompositeOperation = 'multiply';
  const light = ctx.createLinearGradient(0, 0, 0, view.height);
  light.addColorStop(0, '#ffc4b4');
  light.addColorStop(1, '#c47f86');
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
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#05060d';
  ctx.fillRect(0, 0, view.width, view.height);
  ctx.save();
  ctx.translate(-Math.round(view.x), -Math.round(view.y));
  ground(ctx, images, map, view);
  const sprites: Sprite[] = [
    ...forestTrees(map, view).map((t) => propSprite(ctx, images, 'tree-small', t.x, t.y)),
    ...map.props.map((p) => propSprite(ctx, images, p.kind, p.x, p.y)),
    ...frame.characters.map((c) => ({ base: c.pos.y, draw: () => drawCharacter(ctx, sheets, c, timeMs) })),
  ];
  sprites.sort((a, b) => a.base - b.base);
  for (const s of sprites) s.draw();
  ctx.restore();
  tint(ctx, view, timeMs);
  sky(ctx, view, timeMs);
  embers(ctx, view, timeMs);
}
