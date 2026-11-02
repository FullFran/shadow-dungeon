import type { TownService } from './town-menu';

/**
 * The quick wheel on Tab (odd/tasks/menu-redesign.md S8, S9: a discreet souls
 * quick menu, not a gacha hub): the eight services a player reaches for most,
 * clockwise from the top. Hold Tab, point with the mouse, arrows or a stick,
 * release to open; a click opens too.
 */
export const QUICK_WHEEL: readonly TownService[] = ['dungeons', 'pokemon', 'shop', 'tutor', 'evolve', 'gacha', 'board', 'settings'];

/** The wheel's services wired here (`available`), in wheel order. */
export function wheelServices(available: ReadonlySet<TownService>): TownService[] {
  return QUICK_WHEEL.filter((s) => available.has(s));
}

/** Pointer or stick nearer the centre than this (of a unit radius) picks nothing. */
export const WHEEL_DEAD_ZONE = 0.35;

/**
 * The sector a direction points at on a wheel of `count` sectors: 0 is
 * straight up, then clockwise (screen y grows downwards); null inside the
 * dead zone or on an empty wheel.
 */
export function wheelSector(dir: { x: number; y: number }, count: number): number | null {
  if (count <= 0 || Math.hypot(dir.x, dir.y) < WHEEL_DEAD_ZONE) return null;
  const angle = Math.atan2(dir.x, -dir.y);
  const turn = (angle / (2 * Math.PI) + 1) % 1;
  return Math.round(turn * count) % count;
}
