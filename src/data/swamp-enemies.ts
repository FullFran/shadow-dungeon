import type { Difficulty } from './difficulty';
import type { EnemyAttackDef, HazardDef, PoiseDef } from './enemies';

/*
 * The Toxic Swamp's new enemies (docs/gdd.md §3, Pantano Tóxico). Same souls
 * contract as the rest: a telegraph that shows where it lands, a dodge
 * window (the locked part of the aim) and a punish window after it. On hard
 * and above each one has one extra trick (`minDifficulty`, read with
 * `atLeast`). Values are provisional.
 */

/**
 * Venipede: curls up (the lane shows, its aim locks for the last part),
 * then rolls down it fast and bounces off the first wall it meets, then
 * lies dizzy for a while (the punish window). Comes in packs of three.
 */
export interface RollerDef {
  kind: 'roller';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  /** Starts curling when the player is this close and the cooldown is over. */
  engageRange: number;
  telegraphMs: number;
  /** The lane stops following the player this long before the roll. */
  lockMs: number;
  rollMs: number;
  rollSpeed: number;
  /** Walls it bounces off before it stops. */
  bounces: number;
  attack: EnemyAttackDef;
  recoverMs: number;
  cooldownMs: number;
  /** Hard and above: one more bounce. */
  extraBounce: { minDifficulty: Difficulty };
}

/**
 * Salandit: circles fast, then dashes straight past the player down a
 * locked lane, leaving a line of toxic smoke puffs behind it (do not roll
 * along its lane). On hard and above it turns and dashes back once.
 */
export interface DasherDef {
  kind: 'dasher';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  circleRange: number;
  engageRange: number;
  telegraphMs: number;
  lockMs: number;
  dashMs: number;
  dashDistance: number;
  attack: EnemyAttackDef;
  /** A puff left every `everyPx` along the dash. */
  smoke: { everyPx: number; puff: HazardDef };
  recoverMs: number;
  cooldownMs: number;
  returnDash: { minDifficulty: Difficulty; telegraphMs: number };
}

/**
 * Skrelp: keeps far, aims a thin line of ink at the player that locks a
 * moment before it spits one fast ink bolt, then hops back. On hard and
 * above it spits a narrow fan of three.
 */
export interface SniperDef {
  kind: 'sniper';
  poise: PoiseDef;
  aggroRange: number;
  walkSpeed: number;
  minDistance: number;
  maxDistance: number;
  telegraphMs: number;
  lockMs: number;
  bolt: EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number };
  /** The hop back after spitting. */
  hop: { ms: number; distance: number };
  recoverMs: number;
  cooldownMs: number;
  fan: { minDifficulty: Difficulty; count: number; degrees: number };
}

export const VENIPEDE: RollerDef = {
  kind: 'roller',
  poise: { hitstunScale: 1.2, knockbackScale: 1.3 },
  aggroRange: 600,
  walkSpeed: 70,
  engageRange: 170,
  telegraphMs: 700,
  lockMs: 280,
  rollMs: 1100,
  rollSpeed: 250,
  bounces: 1,
  attack: { power: 22, type: 'bug' },
  recoverMs: 1100,
  cooldownMs: 1400,
  extraBounce: { minDifficulty: 'hard' },
};

export const SALANDIT: DasherDef = {
  kind: 'dasher',
  poise: { hitstunScale: 1, knockbackScale: 1.1 },
  aggroRange: 650,
  walkSpeed: 105,
  circleRange: 150,
  engageRange: 140,
  telegraphMs: 600,
  lockMs: 220,
  dashMs: 300,
  dashDistance: 230,
  attack: { power: 26, type: 'poison' },
  smoke: { everyPx: 55, puff: { power: 14, type: 'poison', radius: 18, lifetimeMs: 2600 } },
  recoverMs: 950,
  cooldownMs: 1700,
  returnDash: { minDifficulty: 'hard', telegraphMs: 360 },
};

export const SKRELP: SniperDef = {
  kind: 'sniper',
  poise: { hitstunScale: 1, knockbackScale: 1 },
  aggroRange: 700,
  walkSpeed: 45,
  minDistance: 190,
  maxDistance: 300,
  telegraphMs: 1000,
  lockMs: 350,
  bolt: { power: 30, type: 'poison', speed: 290, radius: 6, lifetimeMs: 1600 },
  hop: { ms: 260, distance: 70 },
  recoverMs: 1100,
  cooldownMs: 2200,
  fan: { minDifficulty: 'hard', count: 3, degrees: 22 },
};
