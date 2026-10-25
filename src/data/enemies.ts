import type { SpeciesId } from './species';
import type { PokemonType } from './types';

/**
 * Enemy behaviour tuning (docs/gdd.md §4, "Contenido del primer prototipo").
 * Telegraph durations are data on purpose: difficulty can scale them later
 * without touching the state machines. Distances in world pixels, times in ms,
 * speeds in px/s.
 */

/** An enemy attack that damages the player, resolved with the normal damage formula. */
export interface EnemyAttackDef {
  power: number;
  type: PokemonType;
}

/** How an enemy reacts to the player's hits. */
export interface PoiseDef {
  /** Scales the hitstun of incoming hits (0 = never staggered). */
  hitstunScale: number;
  /** Scales the knockback of incoming hits. */
  knockbackScale: number;
}

export interface PoochyenaDef {
  kind: 'lunger';
  poise: PoiseDef;
  /** Starts hunting when the player comes this close. */
  aggroRange: number;
  walkSpeed: number;
  /** While the lunge is on cooldown it circles the player at this distance. */
  stalkRange: number;
  /** Starts the telegraph when the player is this close and the cooldown is over. */
  lungeRange: number;
  /** Wind-up ("Charge" animation): tracks the player, then commits the lunge direction. */
  telegraphMs: number;
  lungeMs: number;
  lungeDistance: number;
  attack: EnemyAttackDef;
  /** Recovery after the lunge connects. */
  hitRecoverMs: number;
  /** Recovery after a missed or dodged lunge: the punish window. */
  missRecoverMs: number;
  cooldownMs: number;
}

export interface GastlyDef {
  kind: 'caster';
  poise: PoiseDef;
  /** Floats over obstacles (only the room bounds confine it). */
  floats: true;
  aggroRange: number;
  speed: number;
  /** Preferred distance band to the player. */
  minDistance: number;
  maxDistance: number;
  telegraphMs: number;
  /** Time spent in the cast animation after the ball leaves. */
  castMs: number;
  recoverMs: number;
  cooldownMs: number;
  projectile: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number };
}

export const POOCHYENA: PoochyenaDef = {
  kind: 'lunger',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  aggroRange: 600,
  walkSpeed: 75,
  stalkRange: 130,
  lungeRange: 115,
  telegraphMs: 550,
  lungeMs: 260,
  lungeDistance: 150,
  attack: { power: 40, type: 'dark' },
  hitRecoverMs: 450,
  missRecoverMs: 1100,
  cooldownMs: 900,
};

export const GASTLY: GastlyDef = {
  kind: 'caster',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  floats: true,
  aggroRange: 700,
  speed: 55,
  minDistance: 120,
  maxDistance: 230,
  telegraphMs: 650,
  castMs: 250,
  recoverMs: 500,
  cooldownMs: 1800,
  projectile: { power: 40, type: 'poison', speed: 95, radius: 7, lifetimeMs: 4500 },
};

/** One blow of the Blade-stance combo. */
export interface ComboHitDef {
  telegraphMs: number;
  strikeMs: number;
  /** Forward step during the strike. */
  lungeDistance: number;
  /** Frontal sector hit by the blow. */
  range: number;
  arcDegrees: number;
  attack: EnemyAttackDef;
}

export interface AegislashDef {
  kind: 'boss';
  poise: PoiseDef;
  aggroRange: number;
  /** Telegraphed stance change; it neither blocks nor attacks meanwhile (an opening). */
  transformMs: number;
  shield: {
    walkSpeed: number;
    /** Slow turning is what makes flanking work. */
    turnRateDegPerSec: number;
    /** Hits arriving from inside this frontal sector are blocked. */
    blockArcDegrees: number;
    /** Fraction of the damage a blocked hit still deals (0 = none). */
    chipFactor: number;
    bashRange: number;
    bashTelegraphMs: number;
    bashMs: number;
    bashDistance: number;
    bashRecoverMs: number;
    bashCooldownMs: number;
    bash: EnemyAttackDef;
    /** Changes to Blade after this long in Shield... */
    maxMs: number;
    /** ...or after taking this much damage (flank hits) in Shield. */
    damageToBreak: number;
  };
  blade: {
    walkSpeed: number;
    turnRateDegPerSec: number;
    /** Starts a combo when the player is this close. */
    engageRange: number;
    combo: readonly ComboHitDef[];
    /** Recovery after the last blow of a combo: the clear opening. */
    recoverMs: number;
    comboCooldownMs: number;
    /** Back to Shield after this many combos, or after `maxMs`. */
    combosPerStance: number;
    maxMs: number;
  };
}

export const AEGISLASH: AegislashDef = {
  kind: 'boss',
  poise: { hitstunScale: 0, knockbackScale: 0.15 },
  aggroRange: 900,
  transformMs: 900,
  shield: {
    walkSpeed: 35,
    turnRateDegPerSec: 75,
    blockArcDegrees: 130,
    chipFactor: 0,
    bashRange: 85,
    bashTelegraphMs: 700,
    bashMs: 220,
    bashDistance: 110,
    bashRecoverMs: 700,
    bashCooldownMs: 2200,
    bash: { power: 35, type: 'steel' },
    maxMs: 10000,
    damageToBreak: 120,
  },
  blade: {
    walkSpeed: 100,
    turnRateDegPerSec: 540,
    engageRange: 90,
    combo: [
      { telegraphMs: 480, strikeMs: 140, lungeDistance: 40, range: 52, arcDegrees: 130, attack: { power: 22, type: 'ghost' } },
      { telegraphMs: 260, strikeMs: 140, lungeDistance: 40, range: 52, arcDegrees: 130, attack: { power: 22, type: 'ghost' } },
      { telegraphMs: 420, strikeMs: 180, lungeDistance: 70, range: 60, arcDegrees: 160, attack: { power: 30, type: 'ghost' } },
    ],
    recoverMs: 1400,
    comboCooldownMs: 700,
    combosPerStance: 2,
    maxMs: 9000,
  },
};

export type EnemyDef = PoochyenaDef | GastlyDef | AegislashDef;

/** Behaviour per enemy species; species without an entry never act. */
export const ENEMY_BEHAVIOUR: Partial<Record<SpeciesId, EnemyDef>> = {
  poochyena: POOCHYENA,
  gastly: GASTLY,
  aegislash: AEGISLASH,
};

const DEFAULT_POISE: PoiseDef = { hitstunScale: 1, knockbackScale: 1 };

export const poiseOf = (species: SpeciesId): PoiseDef => ENEMY_BEHAVIOUR[species]?.poise ?? DEFAULT_POISE;

/** Floaters ignore obstacles (walls still confine them). */
export const floatsOf = (species: SpeciesId): boolean => {
  const def = ENEMY_BEHAVIOUR[species];
  return def !== undefined && 'floats' in def && def.floats;
};
