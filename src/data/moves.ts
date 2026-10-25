import type { SlotKind } from './slots';
import type { PokemonType } from './types';

export type MoveId =
  | 'shadow-claw'
  | 'shadow-sneak'
  | 'play-rough'
  | 'shadow-ball'
  | 'fury-swipes'
  | 'feint-attack'
  | 'night-daze'
  | 'foul-play'
  | 'ember'
  | 'astonish'
  | 'hex'
  | 'inferno'
  | 'bone-club'
  | 'bone-rush'
  | 'bonemerang'
  | 'stomping-tantrum';

/** Hit shape of a move, relative to the attacker and its aim direction. */
export type HitboxDef =
  /** Melee swing: a circular sector in front of the attacker. */
  | { kind: 'arc'; range: number; arcDegrees: number }
  /** The attacker lunges `distance` along the aim during the active phase, hitting what it touches. */
  | { kind: 'dash'; distance: number; radius: number }
  /** Spawns a projectile at the start of the active phase. */
  | { kind: 'projectile'; speed: number; radius: number; lifetimeMs: number; boomerang?: boolean };

/**
 * Extra damage when a condition holds at the moment of the hit: the enemy is
 * mid-attack (telegraph or attack: Foul Play), the enemy is staggered (Hex),
 * or the player's previous move missed (Stomping Tantrum).
 */
export interface MoveBonus {
  when: 'attacking' | 'staggered' | 'afterMiss';
  multiplier: number;
}

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
  /** Melee: the active window splits into this many equal parts, each able to hit the same target again. */
  multiHit?: number;
  bonus?: MoveBonus;
  /**
   * Game-feel tier of a landed hit: 'heavy' always gets the long hitstop,
   * shake and heavy hit sound (adapters/juice.ts). Without it only strong
   * (JUICE.heavyDamage) or super-effective hits and the last part of a
   * multi-hit move feel heavy.
   */
  juice?: 'heavy';
}

const HEAVY_CHARGE: readonly ChargeLevel[] = [
  { holdMs: 0, damageMultiplier: 1, sizeMultiplier: 1, speedMultiplier: 1 },
  { holdMs: 450, damageMultiplier: 1.4, sizeMultiplier: 1.25, speedMultiplier: 1.3 },
  { holdMs: 900, damageMultiplier: 1.9, sizeMultiplier: 1.5, speedMultiplier: 1.6 },
];

/**
 * Powers are the official ones; timings are provisional feel values. A
 * boomerang projectile turns back halfway through its lifetime and goes
 * through what it hits (once per pass).
 */
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
  'fury-swipes': {
    id: 'fury-swipes',
    slot: 'fast',
    type: 'normal',
    power: 25,
    windupMs: 70,
    activeMs: 200,
    recoveryMs: 150,
    staminaCost: 0,
    hitbox: { kind: 'arc', range: 30, arcDegrees: 100 },
    hitstunMs: 120,
    knockback: 8,
    multiHit: 5,
  },
  'feint-attack': {
    id: 'feint-attack',
    slot: 'fast',
    type: 'dark',
    power: 60,
    windupMs: 80,
    activeMs: 120,
    recoveryMs: 180,
    staminaCost: 0,
    hitbox: { kind: 'dash', distance: 60, radius: 16 },
    hitstunMs: 220,
    knockback: 35,
    juice: 'heavy',
  },
  'night-daze': {
    id: 'night-daze',
    slot: 'heavy',
    type: 'dark',
    power: 85,
    windupMs: 260,
    activeMs: 100,
    recoveryMs: 340,
    staminaCost: 30,
    hitbox: { kind: 'arc', range: 40, arcDegrees: 360 },
    hitstunMs: 380,
    knockback: 70,
    charge: HEAVY_CHARGE,
    juice: 'heavy',
  },
  'foul-play': {
    id: 'foul-play',
    slot: 'heavy',
    type: 'dark',
    power: 95,
    windupMs: 300,
    activeMs: 160,
    recoveryMs: 380,
    staminaCost: 30,
    hitbox: { kind: 'dash', distance: 80, radius: 16 },
    hitstunMs: 420,
    knockback: 80,
    charge: HEAVY_CHARGE,
    bonus: { when: 'attacking', multiplier: 1.5 },
    juice: 'heavy',
  },
  ember: {
    id: 'ember',
    slot: 'fast',
    type: 'fire',
    power: 50,
    windupMs: 80,
    activeMs: 60,
    recoveryMs: 160,
    staminaCost: 0,
    hitbox: { kind: 'projectile', speed: 230, radius: 7, lifetimeMs: 900 },
    hitstunMs: 180,
    knockback: 20,
  },
  astonish: {
    id: 'astonish',
    slot: 'fast',
    type: 'ghost',
    power: 30,
    windupMs: 60,
    activeMs: 80,
    recoveryMs: 140,
    staminaCost: 0,
    hitbox: { kind: 'arc', range: 30, arcDegrees: 120 },
    hitstunMs: 400,
    knockback: 70,
    juice: 'heavy',
  },
  hex: {
    id: 'hex',
    slot: 'heavy',
    type: 'ghost',
    power: 65,
    windupMs: 280,
    activeMs: 60,
    recoveryMs: 320,
    staminaCost: 30,
    hitbox: { kind: 'projectile', speed: 140, radius: 8, lifetimeMs: 2400 },
    hitstunMs: 360,
    knockback: 50,
    charge: HEAVY_CHARGE,
    bonus: { when: 'staggered', multiplier: 2 },
    juice: 'heavy',
  },
  inferno: {
    id: 'inferno',
    slot: 'heavy',
    type: 'fire',
    power: 100,
    windupMs: 380,
    activeMs: 60,
    recoveryMs: 420,
    staminaCost: 35,
    hitbox: { kind: 'projectile', speed: 130, radius: 12, lifetimeMs: 2600 },
    hitstunMs: 460,
    knockback: 90,
    charge: HEAVY_CHARGE,
    juice: 'heavy',
  },
  'bone-club': {
    id: 'bone-club',
    slot: 'fast',
    type: 'ground',
    power: 65,
    windupMs: 90,
    activeMs: 80,
    recoveryMs: 170,
    staminaCost: 0,
    hitbox: { kind: 'arc', range: 36, arcDegrees: 100 },
    hitstunMs: 320,
    knockback: 45,
    juice: 'heavy',
  },
  'bone-rush': {
    id: 'bone-rush',
    slot: 'fast',
    type: 'ground',
    power: 30,
    windupMs: 80,
    activeMs: 240,
    recoveryMs: 200,
    staminaCost: 0,
    hitbox: { kind: 'dash', distance: 60, radius: 18 },
    hitstunMs: 160,
    knockback: 12,
    multiHit: 3,
  },
  bonemerang: {
    id: 'bonemerang',
    slot: 'heavy',
    type: 'ground',
    power: 50,
    windupMs: 280,
    activeMs: 60,
    recoveryMs: 300,
    staminaCost: 30,
    hitbox: { kind: 'projectile', speed: 200, radius: 8, lifetimeMs: 1100, boomerang: true },
    hitstunMs: 300,
    knockback: 40,
    charge: HEAVY_CHARGE,
    juice: 'heavy',
  },
  'stomping-tantrum': {
    id: 'stomping-tantrum',
    slot: 'heavy',
    type: 'ground',
    power: 75,
    windupMs: 300,
    activeMs: 100,
    recoveryMs: 360,
    staminaCost: 30,
    hitbox: { kind: 'arc', range: 44, arcDegrees: 360 },
    hitstunMs: 420,
    knockback: 80,
    charge: HEAVY_CHARGE,
    bonus: { when: 'afterMiss', multiplier: 2 },
    juice: 'heavy',
  },
};
