import { cueKey, cueRequest, type FxCue } from './cues';
import type { FxStore, ReadyEffect } from './store';

/**
 * Plays baked effects. One-shots live here for their `playMs`, at most
 * `MAX_LIVE` at a time; looks tied to something that already moves (a shot, a
 * crystal) draw through `drawLoop` with no instance of their own.
 */

export const MAX_LIVE = 48;

export type FxLayer = 'ground' | 'top';

/**
 * How the art sits on its spot. `aim`: drawn pointing right, turned towards
 * the aim around its own middle. `body`: centred on the spot. `ground`: the
 * effect's floor on the spot.
 */
export type FxPlacement = 'aim' | 'body' | 'ground';

export interface FxSpawn {
  cue: FxCue;
  x: number;
  y: number;
  placement: FxPlacement;
  layer: FxLayer;
  /** Radians, for `aim`. */
  angle?: number;
  /** World pixels the art's reach should span; without it the art keeps its size. */
  fit?: number;
  /** World pixels of the art's height instead: a shot's size, whatever its trail's length. */
  fitHeight?: number;
}

interface Live extends FxSpawn {
  ageMs: number;
}

/** Scale that makes an effect span `fit` world pixels. */
export function fitScale(effect: Pick<ReadyEffect, 'bounds'>, placement: FxPlacement, fit: number | undefined, fitHeight?: number): number {
  const { left, right, top, bottom } = effect.bounds;
  if (fitHeight !== undefined) return bottom > top ? fitHeight / (bottom - top) : 1;
  if (fit === undefined) return 1;
  const reach = placement === 'aim' ? right : Math.max(-left, right, (bottom - top) / 2);
  return reach > 0 ? fit / reach : 1;
}

/** Frame of a one-shot at `progress` (0 to 1), or of a loop running at `playMs` per turn. */
export function frameAt(count: number, progress: number): number {
  return Math.min(count - 1, Math.max(0, Math.floor(progress * count)));
}

/** Draws one frame of a baked effect. The caller's transform maps world pixels. */
export function drawFxFrame(ctx: CanvasRenderingContext2D, effect: ReadyEffect, index: number, spawn: Pick<FxSpawn, 'x' | 'y' | 'placement' | 'angle'>, scale: number, alpha = 1): void {
  const f = effect.frames[index];
  if (!f || f.w === 0) return;
  const { top, bottom, left, right } = effect.bounds;
  const middleY = (top + bottom) / 2;
  const x = Math.round(spawn.x);
  const y = Math.round(spawn.y);
  const angle = spawn.placement === 'aim' ? spawn.angle ?? 0 : 0;
  ctx.save();
  if (alpha < 1) ctx.globalAlpha *= alpha;
  ctx.translate(x, y);
  if (angle !== 0) {
    ctx.rotate(angle);
    // Pointing left the art would be upside down: mirror it instead.
    if (Math.cos(angle) < 0) ctx.scale(1, -1);
  }
  if (scale !== 1) ctx.scale(scale, scale);
  const offsetX = spawn.placement === 'body' ? -(left + right) / 2 : 0;
  const offsetY = spawn.placement === 'ground' ? 0 : -middleY;
  ctx.drawImage(effect.image, f.x, f.y, f.w, f.h, f.dx + offsetX, f.dy + offsetY, f.w, f.h);
  ctx.restore();
}

export class FxSystem {
  private live: Live[] = [];

  constructor(readonly store: FxStore) {}

  get liveCount(): number {
    return this.live.length;
  }

  /** Plays a one-shot; false while its art is still baking (the first use of it, or its bake failed). */
  spawn(spawn: FxSpawn): boolean {
    if (!this.store.get(cueKey(spawn.cue), cueRequest(spawn.cue))) return false;
    if (this.live.length >= MAX_LIVE) this.live.shift();
    this.live.push({ ...spawn, ageMs: 0 });
    return true;
  }

  /** Queues the art a floor is about to need, so its first use already plays. */
  prepare(cues: readonly FxCue[]): void {
    for (const c of cues) this.store.want(cueKey(c), cueRequest(c));
  }

  /** Real time: effects keep moving through hitstop, like the juice. */
  update(frameMs: number): void {
    let kept = 0;
    for (const fx of this.live) {
      fx.ageMs += frameMs;
      if (fx.ageMs < fx.cue.playMs) this.live[kept++] = fx;
    }
    this.live.length = kept;
  }

  clear(): void {
    this.live.length = 0;
  }

  draw(ctx: CanvasRenderingContext2D, layer: FxLayer): void {
    for (const fx of this.live) {
      if (fx.layer !== layer) continue;
      const effect = this.store.get(cueKey(fx.cue), cueRequest(fx.cue));
      if (!effect) continue;
      drawFxFrame(ctx, effect, frameAt(effect.frames.length, fx.ageMs / fx.cue.playMs), fx, fitScale(effect, fx.placement, fx.fit, fx.fitHeight));
    }
  }

  /**
   * A looping look tied to game time (a shot in flight, a crystal). False while
   * it is not baked: the caller draws its hand-drawn look instead.
   */
  drawLoop(ctx: CanvasRenderingContext2D, cue: FxCue, spawn: Pick<FxSpawn, 'x' | 'y' | 'placement' | 'angle' | 'fit' | 'fitHeight'>, timeMs: number, alpha = 1): boolean {
    const effect = this.store.get(cueKey(cue), cueRequest(cue));
    if (!effect) return false;
    const turn = (((timeMs / cue.playMs) % 1) + 1) % 1;
    drawFxFrame(ctx, effect, frameAt(effect.frames.length, turn), spawn, fitScale(effect, spawn.placement, spawn.fit, spawn.fitHeight), alpha);
    return true;
  }
}
