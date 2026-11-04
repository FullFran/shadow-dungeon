import type { BakedEffect, BakedFrame, BakeRequest } from './bake';
import type { BakeMessage, BakeReply } from './bake.worker';
import { appError, reportError } from '../net-error';

/**
 * Baked effects ready to draw. Asking for one that is not ready returns null
 * and queues its bake, and the caller keeps its hand-drawn look until then.
 * Decoded pixels are capped (`FX_MEMORY_BYTES`): the least recently drawn
 * effects go first and are baked again if they come back.
 */

export const FX_MEMORY_BYTES = 32 * 1024 * 1024;
/** A failed bake is asked again after this long (a dropped server or network recovers), */
export const FX_RETRY_MS = 8000;
/** up to this many attempts in all; a bake that keeps failing is broken, not unlucky. */
export const FX_MAX_ATTEMPTS = 3;
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
  /** Called when the baking worker died: whatever it was baking will never answer. */
  onLost?: (() => void) | null;
  toImage(baked: BakedEffect): Promise<CanvasImageSource>;
  release(image: CanvasImageSource): void;
}

export class FxStore {
  private readonly ready = new Map<string, ReadyEffect>();
  private readonly pending = new Set<string>();
  /** Effects that failed to bake: the hand-drawn look until their cooldown ends (FX_RETRY_MS), FX_MAX_ATTEMPTS in all. */
  private readonly failed = new Map<string, { atMs: number; attempts: number }>();
  private bytes = 0;
  private nowMs = 0;

  constructor(private readonly backend: FxBackend | null, private readonly capBytes = FX_MEMORY_BYTES) {
    if (backend) {
      backend.onReply = (reply) => void this.receive(reply);
      // A dead worker never answers: its bakes go back to being askable (the backend starts a new worker).
      backend.onLost = () => this.pending.clear();
    }
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
    if (!this.backend || this.ready.has(key) || this.pending.has(key)) return;
    const failure = this.failed.get(key);
    if (failure && (failure.attempts >= FX_MAX_ATTEMPTS || this.nowMs - failure.atMs < FX_RETRY_MS)) return;
    this.pending.add(key);
    this.backend.post({ key, ...request });
  }

  private async receive(reply: BakeReply): Promise<void> {
    if ('error' in reply) {
      this.pending.delete(reply.key);
      this.fail(reply.key);
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
      this.failed.delete(key);
      this.ready.set(key, { image, frames: baked.frames, loop: baked.loop, bounds: baked.bounds, bytes, usedAtMs: this.nowMs });
      this.bytes += bytes;
    } catch {
      this.pending.delete(key);
      this.fail(key);
    }
  }

  private fail(key: string): void {
    const attempts = (this.failed.get(key)?.attempts ?? 0) + 1;
    this.failed.set(key, { atMs: this.nowMs, attempts });
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

/**
 * The browser's backend, or null where module workers are missing (the game keeps its hand-drawn effects).
 * A worker that dies (its module failed to load while the server was down, a crash) is replaced on the next
 * bake, and the store is told so its pending bakes are asked again: effects never vanish for the rest of a page.
 */
export function browserFxBackend(): FxBackend | null {
  if (typeof Worker === 'undefined' || typeof createImageBitmap === 'undefined') return null;
  let worker: Worker | null = null;
  const backend: FxBackend = {
    onReply: null,
    onLost: null,
    post: (message) => {
      try {
        worker ??= spawn();
        worker.postMessage(message);
      } catch {
        lose();
      }
    },
    toImage: (baked) => createImageBitmap(new ImageData(new Uint8ClampedArray(baked.pixels), baked.width, baked.height)),
    release: (image) => {
      if (image instanceof ImageBitmap) image.close();
    },
  };
  const lose = (): void => {
    worker?.terminate();
    worker = null;
    reportError(appError('asset'), 'fx');
    backend.onLost?.();
  };
  const spawn = (): Worker => {
    const next = new Worker(new URL('./bake.worker.ts', import.meta.url), { type: 'module' });
    next.onmessage = (event: MessageEvent<BakeReply>) => backend.onReply?.(event.data);
    next.onerror = (event) => {
      event.preventDefault();
      if (worker === next) lose();
    };
    return next;
  };
  try {
    worker = spawn();
  } catch {
    return null;
  }
  return backend;
}

let shared: FxStore | null = null;

/** One worker and one memory cap per page, however many runs start. */
export function sharedFxStore(): FxStore {
  shared ??= new FxStore(browserFxBackend());
  return shared;
}
