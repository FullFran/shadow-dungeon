import type { Rect } from '../core/state';
import type { Vec2 } from '../core/vec';
import { hash01 } from '../ui/eclipse';

/**
 * Figuraciones (docs/sima-redesign.md §3, owner 2026-10-26): with the Sima's
 * lucidity low, now and then the silhouette of someone who is not there
 * shows at the edge of the view, still or walking towards you, and comes
 * apart as you near it or after a moment. Pure presentation: each client
 * works them out from its own clock and real time, never from or into the
 * simulation (no hitbox, no bullet, no AI, no seed of the run's). The shapes
 * are those who did not come back (the Sendas' shadows) and your own.
 * Accessibility: off, or reduced (rarer, fainter, still); reduced motion
 * asks for reduced.
 */
export type FigurationMode = 'on' | 'reduced' | 'off';

export const FIGURATIONS = {
  /** Under this much lucidity they start (ms). */
  belowMs: 60_000,
  /** One chance every `periodMs` (twice as long when reduced). */
  periodMs: 3500,
  /** How long one lasts at most, and its fades (ms). */
  lifeMs: 2000,
  fadeInMs: 450,
  fadeOutMs: 600,
  /** It comes apart this close to the player (px). */
  nearPx: 90,
  /** Walking pace towards the player (px/s); still when reduced. */
  walkPx: 14,
  /** Peak opacity (reduced: half). */
  alpha: 0.55,
} as const;

export interface Figuration {
  sprite: string;
  /** World position (on the edge of the view). */
  pos: Vec2;
  alpha: number;
  walking: boolean;
  /** Facing towards the player. */
  facing: Vec2;
}

export interface FigurationInput {
  mode: FigurationMode;
  /** The run clock (lucidity) left, ms. */
  clockMs: number;
  /** Real time, ms (the client's own clock, not the simulation's). */
  timeMs: number;
  /** The view in world px and the player's position. */
  view: Rect;
  player: Vec2;
  /** The shapes it may take (sheet keys): the shadows of the lost and the player's own. */
  sprites: readonly string[];
  /** A per-floor salt so two floors do not repeat (the floor number is enough). */
  salt: number;
}

/** A point on the edge of the view, `inset` px inside it. */
function edgePoint(view: Rect, u: number, side: number, inset: number): Vec2 {
  const { x, y, width, height } = view;
  if (side === 0) return { x: x + inset + u * (width - inset * 2), y: y + inset + 10 };
  if (side === 1) return { x: x + width - inset, y: y + inset + u * (height - inset * 2) };
  if (side === 2) return { x: x + inset + u * (width - inset * 2), y: y + height - inset };
  return { x: x + inset, y: y + inset + u * (height - inset * 2) };
}

/** The figuraciones to draw now (at most one at a time). */
export function figurationsAt(input: FigurationInput): Figuration[] {
  const { mode, clockMs, timeMs, view, player, sprites } = input;
  if (mode === 'off' || clockMs >= FIGURATIONS.belowMs || clockMs <= 0 || sprites.length === 0) return [];
  const reduced = mode === 'reduced';
  const period = FIGURATIONS.periodMs * (reduced ? 2 : 1);
  const slot = Math.floor(timeMs / period);
  const age = timeMs - slot * period;
  if (age > FIGURATIONS.lifeMs) return [];
  const key = slot * 7 + input.salt * 131;
  // The lower the lucidity, the likelier: from none at the mark to most slots near 0.
  const chance = 0.25 + 0.65 * (1 - clockMs / FIGURATIONS.belowMs);
  if (hash01(key) >= chance) return [];
  const sprite = sprites[Math.floor(hash01(key + 1) * sprites.length) % sprites.length]!;
  const start = edgePoint(view, hash01(key + 2), Math.floor(hash01(key + 3) * 4), 26);
  const walking = !reduced && hash01(key + 4) < 0.5;
  const toPlayer = { x: player.x - start.x, y: player.y - start.y };
  const dist = Math.hypot(toPlayer.x, toPlayer.y) || 1;
  const step = walking ? (FIGURATIONS.walkPx * age) / 1000 : 0;
  const pos = { x: start.x + (toPlayer.x / dist) * step, y: start.y + (toPlayer.y / dist) * step };
  const fadeIn = Math.min(1, age / FIGURATIONS.fadeInMs);
  const fadeOut = Math.min(1, (FIGURATIONS.lifeMs - age) / FIGURATIONS.fadeOutMs);
  // It comes apart as you near it.
  const near = Math.hypot(player.x - pos.x, player.y - pos.y);
  const apart = Math.min(1, Math.max(0, (near - FIGURATIONS.nearPx * 0.5) / (FIGURATIONS.nearPx * 0.5)));
  const alpha = FIGURATIONS.alpha * (reduced ? 0.5 : 1) * Math.max(0, Math.min(fadeIn, fadeOut)) * apart;
  if (alpha <= 0.01) return [];
  return [{ sprite, pos, alpha, walking, facing: { x: toPlayer.x / dist, y: toPlayer.y / dist } }];
}

/** The mode in effect: the setting, turned down to reduced when the system asks for reduced motion. */
export const figurationMode = (setting: FigurationMode, reducedMotion: boolean): FigurationMode => (setting === 'on' && reducedMotion ? 'reduced' : setting);
