import type { Vec2 } from '../core/vec';
import type { PokemonType } from '../data/types';
import { bakedRadiusOf, BULLET_DIRS, BULLET_ANIMS, bulletSprite, cellSize, HANG_STEPS, paintBullet, paintHangRing, type BulletPose } from './bullet-art';

/**
 * The enemy bullets' one baked atlas (bullet-art.ts paints the cells). A
 * type at a hitbox radius is baked the first time it is drawn (every
 * direction, animation frame and hanging ring step, about a millisecond),
 * then each bullet is one `drawImage` from the atlas: drawing cost does not
 * grow with how many types or frames there are. Blocks are packed in rows on
 * 1024 px pages; a page is added only if one fills.
 */

const PAGE = 1024;
/** Cells per block row: the flight frames, then the ring steps. */
const COLS = 8;
const FLIGHT_FRAMES = BULLET_DIRS * BULLET_ANIMS;
const CELLS = FLIGHT_FRAMES + HANG_STEPS;

/** Where a block of `w` × `h` goes: rows of blocks, a new row when one is full, a new page when a page is. */
export function packBlock(shelf: { page: number; x: number; y: number; rowHeight: number }, w: number, h: number): { page: number; x: number; y: number } {
  if (shelf.x + w > PAGE) {
    shelf.x = 0;
    shelf.y += shelf.rowHeight;
    shelf.rowHeight = 0;
  }
  if (shelf.y + h > PAGE) {
    shelf.page += 1;
    shelf.x = 0;
    shelf.y = 0;
    shelf.rowHeight = 0;
  }
  const at = { page: shelf.page, x: shelf.x, y: shelf.y };
  shelf.x += w;
  shelf.rowHeight = Math.max(shelf.rowHeight, h);
  return at;
}

/** The atlas position of cell `index` (flight frames first, then ring steps) of a block of `size` px cells. */
export function cellOrigin(block: { x: number; y: number }, size: number, index: number): { x: number; y: number } {
  return { x: block.x + (index % COLS) * size, y: block.y + Math.floor(index / COLS) * size };
}

interface Block {
  page: HTMLCanvasElement;
  x: number;
  y: number;
  size: number;
}

export interface BulletAtlas {
  /** Draws a bullet of `type` and hitbox `radius` centred on `pos` (world units). */
  draw(ctx: CanvasRenderingContext2D, type: PokemonType, radius: number, pos: Vec2, timeMs: number, pose: BulletPose): void;
  /** Bakes a type at a radius now (the gallery, or a fight warming up its bullets). */
  warm(type: PokemonType, radius: number): void;
  /** How many type × radius blocks are baked, and how long baking took in total (ms). */
  stats(): { blocks: number; pages: number; bakeMs: number };
}

export function createBulletAtlas(makeCanvas: (w: number, h: number) => HTMLCanvasElement = defaultCanvas): BulletAtlas {
  const pages: HTMLCanvasElement[] = [];
  const blocks = new Map<string, Block>();
  const shelf = { page: 0, x: 0, y: 0, rowHeight: 0 };
  let bakeMs = 0;

  function bake(type: PokemonType, bakedRadius: number): Block {
    const key = `${type}:${bakedRadius}`;
    const known = blocks.get(key);
    if (known) return known;
    const started = performance.now();
    const size = cellSize(bakedRadius);
    const at = packBlock(shelf, COLS * size, Math.ceil(CELLS / COLS) * size);
    while (pages.length <= at.page) pages.push(makeCanvas(PAGE, PAGE));
    const page = pages[at.page]!;
    const g = page.getContext('2d')!;
    const put = (cell: { rgba: Uint8ClampedArray; size: number }, index: number): void => {
      const o = cellOrigin(at, size, index);
      g.putImageData(new ImageData(cell.rgba as Uint8ClampedArray<ArrayBuffer>, cell.size, cell.size), o.x, o.y);
    };
    for (let f = 0; f < FLIGHT_FRAMES; f++) put(paintBullet(type, bakedRadius, f), f);
    for (let s = 0; s < HANG_STEPS; s++) put(paintHangRing(type, bakedRadius, s), FLIGHT_FRAMES + s);
    const block = { page, x: at.x, y: at.y, size };
    blocks.set(key, block);
    bakeMs += performance.now() - started;
    return block;
  }

  return {
    draw(ctx, type, radius, pos, timeMs, pose) {
      const sprite = bulletSprite(type, radius, pos, timeMs, pose);
      const block = bake(type, sprite.bakedRadius);
      const o = cellOrigin(block, block.size, sprite.frame);
      ctx.drawImage(block.page, o.x, o.y, block.size, block.size, sprite.dx, sprite.dy, sprite.dw, sprite.dh);
      if (sprite.ring) {
        const r = cellOrigin(block, block.size, FLIGHT_FRAMES + sprite.ring.step);
        ctx.drawImage(block.page, r.x, r.y, block.size, block.size, sprite.ring.dx, sprite.ring.dy, sprite.ring.dw, sprite.ring.dh);
      }
    },
    warm(type, radius) {
      bake(type, bakedRadiusOf(radius));
    },
    stats() {
      return { blocks: blocks.size, pages: pages.length, bakeMs };
    },
  };
}

function defaultCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}
