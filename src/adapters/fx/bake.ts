import { clearFrame, composite, createFrame, createFx } from '../../vendor/pixelfx/core/index.js';

/**
 * Turns a pixelfx effect into a small atlas once, so playing it afterwards is
 * one `drawImage` per frame: a live simulation costs milliseconds per effect
 * on a desktop, far too much on a phone (odd/tasks/pixelfx-vfx.md). Runs in the
 * bake worker, and under node in tests: no DOM here.
 */

export interface BakeRequest {
  effect: string;
  /** Frames sampled evenly over the effect's duration. */
  frames: number;
  /** Share of the effect's duration to sample, cutting a long tail of smoke. */
  span?: number;
  /** The effect's own options, for example a `palette` ramp. */
  options?: Record<string, unknown>;
}

/** One frame in the atlas; `dx, dy` place its top-left relative to the effect's origin. */
export interface BakedFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  dx: number;
  dy: number;
}

export interface BakedEffect {
  width: number;
  height: number;
  pixels: Uint8ClampedArray;
  frames: BakedFrame[];
  loop: boolean;
  /** Bounds of every frame relative to the origin, for fitting an effect to a hitbox. */
  bounds: { left: number; top: number; right: number; bottom: number };
}

export interface EffectModule {
  meta?: { size?: number[]; origin?: number[]; duration?: number; loop?: boolean; options?: Record<string, unknown> };
}

/** Atlas rows wrap at this width. */
const ATLAS_WIDTH = 512;

function trimmedBox(rgba: Uint8ClampedArray, w: number, h: number): { x: number; y: number; w: number; h: number } | null {
  let left = w;
  let top = h;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (rgba[(y * w + x) * 4 + 3] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
  }
  return right < 0 ? null : { x: left, y: top, w: right - left + 1, h: bottom - top + 1 };
}

export function bakeEffect(mod: EffectModule, request: BakeRequest): BakedEffect {
  const meta = mod.meta ?? {};
  const [w = 64, h = 64] = meta.size ?? [];
  const [originX = 0, originY = 0] = meta.origin ?? [];
  const duration = (meta.duration ?? 1) * (request.span ?? 1);
  const loop = Boolean(meta.loop);
  const count = Math.max(1, request.frames);
  // A loop's last frame must not repeat its first; a one-shot ends on its last moment.
  const step = duration / (loop ? count : Math.max(1, count - 1));

  const fx = createFx(mod, { x: originX, y: originY, ...request.options });
  const frame = createFrame(w, h);
  const rgba = new Uint8ClampedArray(w * h * 4);
  const shots: { pixels: Uint8ClampedArray; box: { x: number; y: number; w: number; h: number } | null }[] = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) fx.update(step);
    clearFrame(frame);
    fx.draw(frame);
    composite(frame, rgba, null);
    const box = trimmedBox(rgba, w, h);
    shots.push({ pixels: box ? rgba.slice() : rgba, box });
  }

  // Shelf packing: frames of one effect are all about the same size.
  let cursorX = 0;
  let cursorY = 0;
  let shelf = 0;
  let width = 1;
  const placed: BakedFrame[] = shots.map(({ box }) => {
    if (!box) return { x: 0, y: 0, w: 0, h: 0, dx: 0, dy: 0 };
    if (cursorX + box.w > ATLAS_WIDTH && cursorX > 0) {
      cursorX = 0;
      cursorY += shelf;
      shelf = 0;
    }
    const at = { x: cursorX, y: cursorY, w: box.w, h: box.h, dx: box.x - originX, dy: box.y - originY };
    cursorX += box.w;
    shelf = Math.max(shelf, box.h);
    width = Math.max(width, cursorX);
    return at;
  });
  const height = Math.max(1, cursorY + shelf);

  const pixels = new Uint8ClampedArray(width * height * 4);
  const bounds = { left: 0, top: 0, right: 0, bottom: 0 };
  shots.forEach(({ pixels: src, box }, i) => {
    const at = placed[i];
    if (!box || !at) return;
    for (let row = 0; row < box.h; row++) {
      const from = ((box.y + row) * w + box.x) * 4;
      pixels.set(src.subarray(from, from + box.w * 4), ((at.y + row) * width + at.x) * 4);
    }
    bounds.left = Math.min(bounds.left, at.dx);
    bounds.top = Math.min(bounds.top, at.dy);
    bounds.right = Math.max(bounds.right, at.dx + at.w);
    bounds.bottom = Math.max(bounds.bottom, at.dy + at.h);
  });
  return { width, height, pixels, frames: placed, loop, bounds };
}
