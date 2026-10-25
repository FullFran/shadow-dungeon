import { COLLAPSE } from '../data/dungeon';
import type { GameEvent } from '../core/state';
import type { Vec2 } from '../core/vec';

/**
 * Game feel driven by core events (docs/gdd.md §4 "Que se sienta bien"):
 * hitstop, screen shake, floating damage numbers and the perfect-dodge
 * flash. Pure: the game loop feeds events and real frame time.
 */
export const JUICE = {
  /** Simulation freeze on a landed hit; a few 60 Hz frames. */
  hitstopMs: 50,
  heavyHitstopMs: 90,
  hurtHitstopMs: 70,
  /** A hit at least this strong, or super effective, counts as heavy (shake). */
  heavyDamage: 18,
  shakeMs: 220,
  shakePx: 4,
  numberLifeMs: 800,
  /** Pixels a damage number rises over its life. */
  numberRisePx: 22,
  flashMs: 900,
  /** Peak screen rumble next to (or on) the collapse front; it fades out `COLLAPSE.rumbleTiles` away. */
  rumblePx: 1.5,
} as const;

export type NumberStyle = 'super' | 'normal' | 'weak' | 'blocked' | 'hurt';

export interface FloatingNumber {
  pos: Vec2;
  /** Damage shown; 0 with style 'blocked' shows the blocked label. */
  value: number;
  style: NumberStyle;
  big: boolean;
  ageMs: number;
}

export type FlashKind = 'perfectDodge' | 'disguiseBroken' | 'levelUp';

export interface JuiceState {
  hitstopMs: number;
  shakeMs: number;
  shakePx: number;
  numbers: readonly FloatingNumber[];
  /** `level`: the level reached, for the level-up text. */
  flash: { kind: FlashKind; ageMs: number; level?: number } | null;
}

export const initialJuice = (): JuiceState => ({ hitstopMs: 0, shakeMs: 0, shakePx: 0, numbers: [], flash: null });

/** Colour class of a damage number from the type effectiveness. */
export function effectivenessStyle(effectiveness: number): NumberStyle {
  if (effectiveness > 1) return 'super';
  if (effectiveness < 1) return 'weak';
  return 'normal';
}

function shake(juice: JuiceState, px: number): JuiceState {
  return { ...juice, shakeMs: JUICE.shakeMs, shakePx: Math.max(px, juice.shakeMs > 0 ? juice.shakePx : 0) };
}

/** Folds one step's events into the juice state. `playerPos` places the player's own numbers. */
export function applyEvents(juice: JuiceState, events: readonly GameEvent[], playerPos: Vec2): JuiceState {
  let next = juice;
  for (const event of events) {
    switch (event.type) {
      case 'enemyHit': {
        const heavy = event.damage >= JUICE.heavyDamage || event.effectiveness > 1;
        next = {
          ...next,
          hitstopMs: Math.max(next.hitstopMs, heavy ? JUICE.heavyHitstopMs : JUICE.hitstopMs),
          numbers: [...next.numbers, { pos: event.pos, value: event.damage, style: effectivenessStyle(event.effectiveness), big: heavy, ageMs: 0 }],
        };
        if (heavy) next = shake(next, JUICE.shakePx);
        break;
      }
      case 'hitBlocked':
        next = { ...next, numbers: [...next.numbers, { pos: event.pos, value: 0, style: 'blocked', big: false, ageMs: 0 }] };
        next = shake(next, 1.5);
        break;
      case 'playerHurt':
        next = shake({ ...next, hitstopMs: Math.max(next.hitstopMs, JUICE.hurtHitstopMs) }, JUICE.shakePx + 2);
        next = { ...next, numbers: [...next.numbers, { pos: playerPos, value: event.damage, style: 'hurt', big: true, ageMs: 0 }] };
        break;
      case 'collapseHurt':
        // The ground, not a blow: a number and a light shake, no hitstop.
        next = shake({ ...next, numbers: [...next.numbers, { pos: playerPos, value: event.damage, style: 'hurt', big: false, ageMs: 0 }] }, 2);
        break;
      case 'disguiseBroken':
        next = shake({ ...next, hitstopMs: Math.max(next.hitstopMs, JUICE.hurtHitstopMs), flash: { kind: 'disguiseBroken', ageMs: 0 } }, JUICE.shakePx);
        break;
      case 'perfectDodge':
        next = { ...next, flash: { kind: 'perfectDodge', ageMs: 0 } };
        break;
      case 'levelUp':
        next = { ...next, flash: { kind: 'levelUp', ageMs: 0, level: event.level } };
        break;
      default:
        break;
    }
  }
  return next;
}

/** Ages everything by real frame time. */
export function tickJuice(juice: JuiceState, frameMs: number): JuiceState {
  const flash = juice.flash && juice.flash.ageMs + frameMs < JUICE.flashMs ? { ...juice.flash, ageMs: juice.flash.ageMs + frameMs } : null;
  return {
    hitstopMs: Math.max(0, juice.hitstopMs - frameMs),
    shakeMs: Math.max(0, juice.shakeMs - frameMs),
    shakePx: juice.shakeMs - frameMs > 0 ? juice.shakePx : 0,
    numbers: juice.numbers.map((n) => ({ ...n, ageMs: n.ageMs + frameMs })).filter((n) => n.ageMs < JUICE.numberLifeMs),
    flash,
  };
}

/**
 * Strength (0..1) of the collapse rumble from the player's distance to the
 * front in tiles (`collapseProximity`): full on rubble or at the front, none
 * `COLLAPSE.rumbleTiles` ahead or when no front is moving. Drives both the
 * rumble loop's volume and the screen rumble.
 */
export function rumbleLevel(proximityTiles: number | null): number {
  if (proximityTiles === null) return 0;
  return Math.min(1, Math.max(0, 1 - proximityTiles / COLLAPSE.rumbleTiles));
}

/** Small continuous camera offset for the rumble, on top of the event shake. */
export function rumbleOffset(level: number, random: () => number): Vec2 {
  if (level <= 0) return { x: 0, y: 0 };
  const strength = JUICE.rumblePx * level;
  return { x: (random() * 2 - 1) * strength, y: (random() * 2 - 1) * strength };
}

/** Camera offset for the current shake, decaying with its remaining time. `random` returns [0, 1). */
export function shakeOffset(juice: JuiceState, random: () => number): Vec2 {
  if (juice.shakeMs <= 0) return { x: 0, y: 0 };
  const strength = juice.shakePx * (juice.shakeMs / JUICE.shakeMs);
  return { x: (random() * 2 - 1) * strength, y: (random() * 2 - 1) * strength };
}
