import type { SlotKind } from './slots';
import type { PokemonType } from './types';
import { HEAVY_CHARGE } from './charge';
import { TUTOR_MOVES, type TutorMoveId } from './tutor-moves';

/** Every move: the starters' original kits and the move tutor's (data/tutor-moves.ts). */
export type MoveId = BaseMoveId | TutorMoveId;

export type BaseMoveId =
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
  | 'stomping-tantrum'
  // Boost slot (four-slots): self-buffs on a cooldown.
  | 'swords-dance'
  | 'nasty-plot'
  | 'will-o-wisp'
  | 'bulk-up'
  // Area slot (four-slots): cones, rings and a line wave on a cooldown and stamina.
  | 'dazzling-gleam'
  | 'shadow-force'
  | 'dark-pulse'
  | 'snarl'
  | 'flamethrower'
  | 'heat-wave'
  | 'earthquake'
  | 'bulldoze';

/** Hit shape of a move, relative to the attacker and its aim direction. */
export type HitboxDef =
  /** Melee swing: a circular sector in front of the attacker. */
  | { kind: 'arc'; range: number; arcDegrees: number }
  /** The attacker lunges `distance` along the aim during the active phase, hitting what it touches. */
  | { kind: 'dash'; distance: number; radius: number }
  /** No hitbox: a boost move acts on the user at the start of its active phase (`MoveDef.buff`). */
  | { kind: 'self' }
  /** Spawns a projectile at the start of the active phase. */
  | {
      kind: 'projectile';
      speed: number;
      radius: number;
      lifetimeMs: number;
      boomerang?: boolean;
      wave?: boolean;
      /** Bends towards the nearest enemy at up to this many degrees per second (Swift). */
      homing?: number;
      /**
       * A lingering zone (Fire Spin): it goes through what it hits and may
       * hit everything in it again every `linger` ms until it fades.
       */
      linger?: number;
    };

/**
 * Extra damage when a condition holds at the moment of the hit: the enemy is
 * mid-attack (telegraph or attack: Foul Play), the enemy is staggered (Hex),
 * or the player's previous move missed (Stomping Tantrum).
 */
export interface MoveBonus {
  when: 'attacking' | 'staggered' | 'afterMiss';
  multiplier: number;
}

/**
 * What a boost move does to its user (core/boosts.ts), for `durationMs`:
 * `power` multiplies the damage of the next `hits` hits (Swords Dance),
 * `haste` speeds up walking and adds crit chance (Nasty Plot), `guard`
 * scales the damage taken (Bulk Up); `kindle` lights Flash Fire at once
 * (Will-O-Wisp: the next heavy move is powered up).
 */
export type BuffDef =
  | { kind: 'power'; multiplier: number; hits: number; durationMs: number }
  | { kind: 'haste'; speed: number; critChance: number; durationMs: number }
  | { kind: 'guard'; damageTaken: number; durationMs: number }
  /** Calm Mind: every hit stronger and the damage taken scaled, for a while. */
  | { kind: 'focus'; multiplier: number; damageTaken: number; durationMs: number }
  | { kind: 'kindle' };

/** A damage over time a hit leaves on an enemy (burn, poison): see `DOTS`. */
export type DotKind = 'burn' | 'poison';

/**
 * Damage over time, simplified from the games' status: a hit with `dot`
 * leaves `share` of its damage on the enemy, dealt in `ticks` equal parts
 * every `everyMs` (core/afflictions.ts). A new one replaces the running one.
 */
export const DOTS: Record<DotKind, { share: number; ticks: number; everyMs: number }> = {
  burn: { share: 0.4, ticks: 4, everyMs: 750 },
  poison: { share: 0.5, ticks: 5, everyMs: 800 },
};

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
  /** Boost and area moves: time before the move can be used again, from its press (not scaled by Quick Claw). */
  cooldownMs?: number;
  /** Boost moves: the effect on the user (with a `self` hitbox). */
  buff?: BuffDef;
  /** Heals the user by this share of the damage dealt (Drain Punch). */
  drain?: number;
  /** Hurts the user by this share of the damage dealt, never below 1 HP (Wood Hammer). */
  recoil?: number;
  /** Leaves a damage over time on the enemy hit (Fire Punch burns, Sludge Bomb poisons). */
  dot?: DotKind;
  /** Extra crit chance of this move's hits (Slash, Night Slash). */
  critBonus?: number;
  /** Boost moves: share of max HP paid on the cast, never below 1 HP (Curse, Belly Drum). */
  hpCost?: number;
}

/**
 * Powers are the official ones; timings are provisional feel values. A
 * boomerang projectile turns back halfway through its lifetime and goes
 * through what it hits (once per pass); a `wave` goes through everything
 * in its line once and never comes back (Flamethrower). Area moves are
 * tap-only (no charge), slow to wind up, and gated by a cooldown and stamina.
 */
const BASE_MOVES: Record<BaseMoveId, MoveDef> = {
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
  // Boost slot: no damage, no stamina; a short cast that roots the user, then a long cooldown.
  'swords-dance': {
    id: 'swords-dance',
    slot: 'boost',
    type: 'normal',
    power: 0,
    windupMs: 160,
    activeMs: 60,
    recoveryMs: 220,
    staminaCost: 0,
    hitbox: { kind: 'self' },
    hitstunMs: 0,
    knockback: 0,
    cooldownMs: 15000,
    buff: { kind: 'power', multiplier: 1.5, hits: 3, durationMs: 9000 },
  },
  'nasty-plot': {
    id: 'nasty-plot',
    slot: 'boost',
    type: 'dark',
    power: 0,
    windupMs: 140,
    activeMs: 60,
    recoveryMs: 200,
    staminaCost: 0,
    hitbox: { kind: 'self' },
    hitstunMs: 0,
    knockback: 0,
    cooldownMs: 14000,
    buff: { kind: 'haste', speed: 1.3, critChance: 0.35, durationMs: 5000 },
  },
  'will-o-wisp': {
    id: 'will-o-wisp',
    slot: 'boost',
    type: 'fire',
    power: 0,
    windupMs: 180,
    activeMs: 60,
    recoveryMs: 240,
    staminaCost: 0,
    hitbox: { kind: 'self' },
    hitstunMs: 0,
    knockback: 0,
    cooldownMs: 16000,
    buff: { kind: 'kindle' },
  },
  'bulk-up': {
    id: 'bulk-up',
    slot: 'boost',
    type: 'fighting',
    power: 0,
    windupMs: 200,
    activeMs: 60,
    recoveryMs: 240,
    staminaCost: 0,
    hitbox: { kind: 'self' },
    hitstunMs: 0,
    knockback: 0,
    cooldownMs: 16000,
    buff: { kind: 'guard', damageTaken: 0.6, durationMs: 6000 },
  },
  // Area slot: tap-only, slow wind-up, stamina and a cooldown; every landed hit feels heavy.
  'dazzling-gleam': {
    id: 'dazzling-gleam',
    slot: 'area',
    type: 'fairy',
    power: 80,
    windupMs: 320,
    activeMs: 120,
    recoveryMs: 400,
    staminaCost: 35,
    hitbox: { kind: 'arc', range: 58, arcDegrees: 360 },
    hitstunMs: 380,
    knockback: 70,
    juice: 'heavy',
    cooldownMs: 8000,
  },
  'shadow-force': {
    id: 'shadow-force',
    slot: 'area',
    type: 'ghost',
    power: 120,
    windupMs: 520,
    activeMs: 120,
    recoveryMs: 420,
    staminaCost: 40,
    hitbox: { kind: 'arc', range: 70, arcDegrees: 120 },
    hitstunMs: 460,
    knockback: 90,
    juice: 'heavy',
    cooldownMs: 10000,
  },
  'dark-pulse': {
    id: 'dark-pulse',
    slot: 'area',
    type: 'dark',
    power: 80,
    windupMs: 300,
    activeMs: 120,
    recoveryMs: 380,
    staminaCost: 35,
    hitbox: { kind: 'arc', range: 60, arcDegrees: 360 },
    hitstunMs: 380,
    knockback: 70,
    juice: 'heavy',
    cooldownMs: 8000,
  },
  snarl: {
    id: 'snarl',
    slot: 'area',
    type: 'dark',
    power: 55,
    windupMs: 220,
    activeMs: 140,
    recoveryMs: 320,
    staminaCost: 30,
    hitbox: { kind: 'arc', range: 72, arcDegrees: 150 },
    hitstunMs: 300,
    knockback: 45,
    juice: 'heavy',
    cooldownMs: 6000,
  },
  flamethrower: {
    id: 'flamethrower',
    slot: 'area',
    type: 'fire',
    power: 90,
    windupMs: 300,
    activeMs: 60,
    recoveryMs: 380,
    staminaCost: 35,
    hitbox: { kind: 'projectile', speed: 260, radius: 13, lifetimeMs: 520, wave: true },
    hitstunMs: 360,
    knockback: 50,
    juice: 'heavy',
    cooldownMs: 8000,
  },
  'heat-wave': {
    id: 'heat-wave',
    slot: 'area',
    type: 'fire',
    power: 95,
    windupMs: 360,
    activeMs: 140,
    recoveryMs: 400,
    staminaCost: 40,
    hitbox: { kind: 'arc', range: 66, arcDegrees: 130 },
    hitstunMs: 400,
    knockback: 70,
    juice: 'heavy',
    cooldownMs: 9000,
  },
  earthquake: {
    id: 'earthquake',
    slot: 'area',
    type: 'ground',
    power: 100,
    windupMs: 460,
    activeMs: 140,
    recoveryMs: 440,
    staminaCost: 40,
    hitbox: { kind: 'arc', range: 74, arcDegrees: 360 },
    hitstunMs: 460,
    knockback: 90,
    juice: 'heavy',
    cooldownMs: 10000,
  },
  bulldoze: {
    id: 'bulldoze',
    slot: 'area',
    type: 'ground',
    power: 60,
    windupMs: 260,
    activeMs: 120,
    recoveryMs: 340,
    staminaCost: 30,
    hitbox: { kind: 'arc', range: 54, arcDegrees: 360 },
    hitstunMs: 340,
    knockback: 60,
    juice: 'heavy',
    cooldownMs: 6000,
  },
};

export const MOVES: Record<MoveId, MoveDef> = { ...BASE_MOVES, ...TUTOR_MOVES };

/** The original kits' moves (free and known from the start; the tutor's Mejoras rank them up). */
export const BASE_MOVE_IDS = Object.keys(BASE_MOVES) as BaseMoveId[];
