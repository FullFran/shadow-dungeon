import type { Vec2 } from '../core/vec';
import type { PokemonType } from '../data/types';
import { bakedRadiusOf, BULLET_DIRS, BULLET_ANIMS, bulletSprite, cellSize, HANG_STEPS, paintBullet, paintHangRing, type BulletPose } from './bullet-art';

/**
 * The enemy bullets' one baked atlas (bullet-art.ts paints the cells). A
 * type at a hitbox radius is queued the first time it is drawn and baked in
 * the background, a few cells per idle callback, so no frame ever pays for a
 * whole block: until its block is ready, `draw` returns false and the caller
 * draws its plain orb instead. Each ready bullet is one `drawImage` from the
 * atlas: drawing cost does not grow with how many types or frames there are.
 * Blocks are packed in rows on 512 px pages (the biggest block, radius 16,
 * fits); a page is added only if one fills. Allocating a page's canvas is
 * the costliest single step, so it is a bake step of its own and runs ahead
 * of need: pages 0 and 1 when the atlas is made (at boot), then a spare page
 * as soon as the last one gets its first block.
 */

/** Side of an atlas page, px. */
export const ATLAS_PAGE = 512;
const PAGE = ATLAS_PAGE;
/** Cells per block row: the flight frames, then the ring steps. */
const COLS = 8;
const FLIGHT_FRAMES = BULLET_DIRS * BULLET_ANIMS;
const CELLS = FLIGHT_FRAMES + HANG_STEPS;
const ROWS = Math.ceil(CELLS / COLS);

/** Where a block of `w` × `h` goes (`w` and `h` at most a page): rows of blocks, a new row when one is full, a new page when a page is. */
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

/** Most milliseconds one bake call may spend painting: it stops before a cell that would likely end past it (always painting at least one). */
export const BAKE_BUDGET_MS = 4;

interface Block {
  key: string;
  type: PokemonType;
  bakedRadius: number;
  page: HTMLCanvasElement;
  x: number;
  y: number;
  size: number;
  /** The next cell to paint; `CELLS` once ready. */
  next: number;
  /** The block's pixels while it is being painted, put on its page in one go when the last cell is done. */
  pixels: ImageData | null;
}

export interface BulletAtlas {
  /**
   * Draws a bullet of `type` and hitbox `radius` centred on `pos` (world
   * units) and returns true, or, while its block is not baked yet, queues it
   * and returns false (the caller draws its fallback). Never bakes.
   */
  draw(ctx: CanvasRenderingContext2D, type: PokemonType, radius: number, pos: Vec2, timeMs: number, pose: BulletPose): boolean;
  /** Queues a type at a radius for baking (a fight warming up its bullets). */
  warm(type: PokemonType, radius: number): void;
  /** Bakes queued cells for up to `budgetMs` (at least one cell); returns whether any are left. */
  pump(budgetMs?: number): boolean;
  /** Bakes everything queued now (the gallery, tests). */
  flush(): void;
  /** Ready blocks, queued ones, pages, cells painted, total bake time and the longest single bake call (ms). */
  stats(): { blocks: number; pending: number; pages: number; cells: number; bakeMs: number; longestCallMs: number };
}

export interface BulletAtlasOptions {
  makeCanvas?: (w: number, h: number) => HTMLCanvasElement;
  makeImageData?: (w: number, h: number) => ImageData;
  /** Runs `bake(budgetMs)` later, off the frame (an idle callback by default). */
  schedule?: (bake: (budgetMs: number) => void) => void;
  now?: () => number;
}

export function createBulletAtlas(options: BulletAtlasOptions = {}): BulletAtlas {
  const makeCanvas = options.makeCanvas ?? defaultCanvas;
  const makeImageData = options.makeImageData ?? ((w, h) => new ImageData(w, h));
  const schedule = options.schedule ?? idleSchedule;
  const now = options.now ?? (() => performance.now());
  const pages: HTMLCanvasElement[] = [];
  const blocks = new Map<string, Block>();
  const queue: Block[] = [];
  const shelf = { page: 0, x: 0, y: 0, rowHeight: 0 };
  let bakeMs = 0;
  let longestCallMs = 0;
  let cells = 0;
  let scheduled = false;
  /** Pages whose canvas is not allocated yet (a first put allocates it). */
  const untouched: HTMLCanvasElement[] = [];

  function blockOf(type: PokemonType, bakedRadius: number): Block {
    const key = `${type}:${bakedRadius}`;
    const known = blocks.get(key);
    if (known) return known;
    const size = cellSize(bakedRadius);
    const at = packBlock(shelf, COLS * size, ROWS * size);
    addPages(at.page + 2);
    const block: Block = { key, type, bakedRadius, page: pages[at.page]!, x: at.x, y: at.y, size, next: 0, pixels: null };
    blocks.set(key, block);
    queue.push(block);
    wake();
    return block;
  }

  /** Makes pages up to `count`, each queued for its first touch. */
  function addPages(count: number): void {
    while (pages.length < count) {
      const page = makeCanvas(PAGE, PAGE);
      pages.push(page);
      untouched.push(page);
    }
  }

  function wake(): void {
    if (scheduled || (queue.length === 0 && untouched.length === 0)) return;
    scheduled = true;
    schedule((budgetMs) => {
      scheduled = false;
      pump(budgetMs);
    });
  }

  /** Allocates a page's canvas with a 1 px put. */
  function touch(page: HTMLCanvasElement): void {
    page.getContext('2d')!.putImageData(makeImageData(1, 1), PAGE - 1, PAGE - 1);
  }

  /** Paints the next cell of `block` into its pixels; on the last one, puts them on its page. */
  function paintNext(block: Block): void {
    const size = block.size;
    block.pixels ??= makeImageData(COLS * size, ROWS * size);
    const index = block.next;
    const cell = index < FLIGHT_FRAMES ? paintBullet(block.type, block.bakedRadius, index) : paintHangRing(block.type, block.bakedRadius, index - FLIGHT_FRAMES);
    const o = cellOrigin({ x: 0, y: 0 }, size, index);
    const width = COLS * size;
    for (let row = 0; row < size; row++) block.pixels.data.set(cell.rgba.subarray(row * size * 4, (row + 1) * size * 4), ((o.y + row) * width + o.x) * 4);
    block.next += 1;
    cells += 1;
    if (block.next === CELLS) {
      block.page.getContext('2d')!.putImageData(block.pixels, block.x, block.y);
      block.pixels = null;
    }
  }

  function pump(budgetMs = BAKE_BUDGET_MS): boolean {
    const started = now();
    let last = started;
    for (;;) {
      // A page a block is waiting on first, then cells; a spare page last.
      const block = queue[0];
      const page = untouched.find((p) => p === block?.page) ?? (block ? undefined : untouched[0]);
      if (page) {
        untouched.splice(untouched.indexOf(page), 1);
        touch(page);
      } else if (block) {
        paintNext(block);
        if (block.next === CELLS) queue.shift();
      } else break;
      const at = now();
      const stepMs = at - last;
      last = at;
      // Stop before a step that would likely end past the budget (the next one costs about what this one did).
      if (at - started + stepMs > budgetMs) break;
    }
    const spent = last - started;
    bakeMs += spent;
    longestCallMs = Math.max(longestCallMs, spent);
    wake();
    return queue.length > 0 || untouched.length > 0;
  }

  addPages(2);
  wake();

  return {
    draw(ctx, type, radius, pos, timeMs, pose) {
      const sprite = bulletSprite(type, radius, pos, timeMs, pose);
      const block = blockOf(type, sprite.bakedRadius);
      if (block.next < CELLS) return false;
      const o = cellOrigin(block, block.size, sprite.frame);
      ctx.drawImage(block.page, o.x, o.y, block.size, block.size, sprite.dx, sprite.dy, sprite.dw, sprite.dh);
      if (sprite.ring) {
        const r = cellOrigin(block, block.size, FLIGHT_FRAMES + sprite.ring.step);
        ctx.drawImage(block.page, r.x, r.y, block.size, block.size, sprite.ring.dx, sprite.ring.dy, sprite.ring.dw, sprite.ring.dh);
      }
      return true;
    },
    warm(type, radius) {
      blockOf(type, bakedRadiusOf(radius));
    },
    pump,
    flush() {
      while (pump(Number.POSITIVE_INFINITY)) {
        // Every queued block, cell by cell.
      }
    },
    stats() {
      return { blocks: blocks.size - queue.length, pending: queue.length, pages: pages.length, cells, bakeMs, longestCallMs };
    },
  };
}

/**
 * An idle callback with what is left of the idle period (capped at the
 * budget), or a timer where there is none (Safari). A busy page (a phone in a
 * bullet storm) may never be idle: after 50 ms the callback runs anyway with
 * the whole budget, so a block is ready in well under a second.
 */
function idleSchedule(bake: (budgetMs: number) => void): void {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback((deadline) => bake(deadline.didTimeout ? BAKE_BUDGET_MS : Math.max(1, Math.min(BAKE_BUDGET_MS, deadline.timeRemaining()))), { timeout: 50 });
  } else {
    setTimeout(() => bake(BAKE_BUDGET_MS), 0);
  }
}

function defaultCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  return canvas;
}
