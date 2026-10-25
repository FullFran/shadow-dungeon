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

export type EnemyDef = PoochyenaDef | GastlyDef;

/** Behaviour per enemy species; species without an entry never act. */
export const ENEMY_BEHAVIOUR: Partial<Record<SpeciesId, EnemyDef>> = {
  poochyena: POOCHYENA,
  gastly: GASTLY,
};

const DEFAULT_POISE: PoiseDef = { hitstunScale: 1, knockbackScale: 1 };

export const poiseOf = (species: SpeciesId): PoiseDef => ENEMY_BEHAVIOUR[species]?.poise ?? DEFAULT_POISE;

/** Floaters ignore obstacles (walls still confine them). */
export const floatsOf = (species: SpeciesId): boolean => {
  const def = ENEMY_BEHAVIOUR[species];
  return def !== undefined && 'floats' in def && def.floats;
};
