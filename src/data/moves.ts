import type { SlotKind } from './slots';
import type { PokemonType } from './types';

export type MoveId = 'shadow-claw' | 'shadow-sneak' | 'play-rough' | 'shadow-ball';

/** Hit shape of a move, relative to the attacker and its aim direction. */
export type HitboxDef =
  /** Melee swing: a circular sector in front of the attacker. */
  | { kind: 'arc'; range: number; arcDegrees: number }
  /** The attacker lunges `distance` along the aim during the active phase, hitting what it touches. */
  | { kind: 'dash'; distance: number; radius: number }
  /** Spawns a projectile at the start of the active phase. */
  | { kind: 'projectile'; speed: number; radius: number; lifetimeMs: number };

/** One charge level, reached after holding the button for `holdMs`. Level 0 is a tap. */
export interface ChargeLevel {
  holdMs: number;
  damageMultiplier: number;
  /** Scales arc range, dash/projectile radius. */
  sizeMultiplier: number;
  /** Scales projectile speed. */
  speedMultiplier: number;
}

export interface MoveDef {
  id: MoveId;
  slot: SlotKind;
  type: PokemonType;
  power: number;
  windupMs: number;
  activeMs: number;
  recoveryMs: number;
  staminaCost: number;
  hitbox: HitboxDef;
  /** Enemy reaction to a hit. */
  hitstunMs: number;
  knockback: number;
  /** Heavy moves only: hold to charge, release to fire. Ordered by holdMs, first at 0. */
  charge?: readonly ChargeLevel[];
}

const HEAVY_CHARGE: readonly ChargeLevel[] = [
  { holdMs: 0, damageMultiplier: 1, sizeMultiplier: 1, speedMultiplier: 1 },
  { holdMs: 450, damageMultiplier: 1.4, sizeMultiplier: 1.25, speedMultiplier: 1.3 },
  { holdMs: 900, damageMultiplier: 1.9, sizeMultiplier: 1.5, speedMultiplier: 1.6 },
];

/** Powers are the official ones; timings are provisional feel values. */
export const MOVES: Record<MoveId, MoveDef> = {
  'shadow-claw': {
    id: 'shadow-claw',
    slot: 'fast',
    type: 'ghost',
    power: 70,
    windupMs: 90,
    activeMs: 80,
    recoveryMs: 160,
    staminaCost: 0,
    hitbox: { kind: 'arc', range: 34, arcDegrees: 110 },
    hitstunMs: 220,
    knockback: 30,
  },
  'shadow-sneak': {
    id: 'shadow-sneak',
    slot: 'fast',
    type: 'ghost',
    power: 40,
    windupMs: 70,
    activeMs: 140,
    recoveryMs: 200,
    staminaCost: 0,
    hitbox: { kind: 'dash', distance: 70, radius: 16 },
    hitstunMs: 200,
    knockback: 40,
  },
  'play-rough': {
    id: 'play-rough',
    slot: 'heavy',
    type: 'fairy',
    power: 90,
    windupMs: 280,
    activeMs: 120,
    recoveryMs: 360,
    staminaCost: 30,
    hitbox: { kind: 'arc', range: 42, arcDegrees: 140 },
    hitstunMs: 420,
    knockback: 80,
    charge: HEAVY_CHARGE,
  },
  'shadow-ball': {
    id: 'shadow-ball',
    slot: 'heavy',
    type: 'ghost',
    power: 80,
    windupMs: 300,
    activeMs: 60,
    recoveryMs: 320,
    staminaCost: 30,
    hitbox: { kind: 'projectile', speed: 150, radius: 9, lifetimeMs: 2600 },
    hitstunMs: 380,
    knockback: 60,
    charge: HEAVY_CHARGE,
  },
};
