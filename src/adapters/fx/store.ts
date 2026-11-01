import type { BakedEffect, BakedFrame, BakeRequest } from './bake';
import type { BakeMessage, BakeReply } from './bake.worker';

/**
 * Baked effects ready to draw. Asking for one that is not ready returns null
 * and queues its bake, and the caller keeps its hand-drawn look until then.
 * Decoded pixels are capped (`FX_MEMORY_BYTES`): the least recently drawn
 * effects go first and are baked again if they come back.
 */

export const FX_MEMORY_BYTES = 32 * 1024 * 1024;
/** An effect drawn this recently is on screen or about to be: never evicted. */
const EVICT_AFTER_MS = 5000;

export interface ReadyEffect {
  image: CanvasImageSource;
  frames: readonly BakedFrame[];
  loop: boolean;
  bounds: BakedEffect['bounds'];
  bytes: number;
  usedAtMs: number;
}

/** What the store needs from the outside world, swapped for a fake in tests. */
export interface FxBackend {
  post(message: BakeMessage): void;
  onReply: ((reply: BakeReply) => void) | null;
  toImage(baked: BakedEffect): Promise<CanvasImageSource>;
  release(image: CanvasImageSource): void;
}

export class FxStore {
  private readonly ready = new Map<string, ReadyEffect>();
  private readonly pending = new Set<string>();
  /** Effects that failed to bake: asked for once, then left to the hand-drawn look. */
  private readonly failed = new Set<string>();
  private bytes = 0;
  private nowMs = 0;

  constructor(private readonly backend: FxBackend | null, private readonly capBytes = FX_MEMORY_BYTES) {
    if (backend) backend.onReply = (reply) => void this.receive(reply);
  }

  /** The renderer's clock, read to tell which effects are in use. */
  tick(nowMs: number): void {
    this.nowMs = nowMs;
  }

  get decodedBytes(): number {
    return this.bytes;
  }

  /** The baked effect, or null while it is not ready (its bake is then queued). */
  get(key: string, request: BakeRequest): ReadyEffect | null {
    const found = this.ready.get(key);
    if (found) {
      found.usedAtMs = this.nowMs;
      return found;
    }
    this.want(key, request);
    return null;
  }

  /** Queues a bake without asking to draw it: what a floor is about to need. */
  want(key: string, request: BakeRequest): void {
    if (!this.backend || this.ready.has(key) || this.pending.has(key) || this.failed.has(key)) return;
    this.pending.add(key);
    this.backend.post({ key, ...request });
  }

  private async receive(reply: BakeReply): Promise<void> {
    if ('error' in reply) {
      this.pending.delete(reply.key);
      this.failed.add(reply.key);
      return;
    }
    const { key, baked } = reply;
    const backend = this.backend;
    if (!backend) return;
    try {
      const image = await backend.toImage(baked);
      const bytes = baked.width * baked.height * 4;
      this.pending.delete(key);
      this.evictFor(bytes);
      this.ready.set(key, { image, frames: baked.frames, loop: baked.loop, bounds: baked.bounds, bytes, usedAtMs: this.nowMs });
      this.bytes += bytes;
    } catch {
      this.pending.delete(key);
      this.failed.add(key);
    }
  }

  private evictFor(incoming: number): void {
    if (this.bytes + incoming <= this.capBytes) return;
    const idle = [...this.ready.entries()].filter(([, e]) => this.nowMs - e.usedAtMs >= EVICT_AFTER_MS).sort(([, a], [, b]) => a.usedAtMs - b.usedAtMs);
    for (const [key, effect] of idle) {
      if (this.bytes + incoming <= this.capBytes) return;
      this.ready.delete(key);
      this.bytes -= effect.bytes;
      this.backend?.release(effect.image);
    }
  }
}

/** The browser's backend, or null where module workers are missing (the game keeps its hand-drawn effects). */
export function browserFxBackend(): FxBackend | null {
  if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  try {
    const worker = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
    const backend: FxBackend = {
      onReply: null,
      post: (message) => worker.postMessage(message),
      toImage: (baked) => createImageBitmap(new ImageData(new Uint8ClampedArray(baked.pixels), baked.width, baked.height)),
      release: (image) => {
        if (image instanceof ImageBitmap) image.close();
      },
    };
    worker.onmessage = (event: MessageEvent<BakeReply>) => backend.onReply?.(event.data);
    worker.onerror = () => worker.terminate();
    return backend;
  } catch {
    return null;
  }
}
