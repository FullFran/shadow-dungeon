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

/** An enemy shot (shape, speed, life). */
type Shot = EnemyAttackDef & { speed: number; radius: number; lifetimeMs: number };

/** Salazzle's spell cards (Toxic Swamp mid-boss); `escort` only on nightmare. */
export type QueenCard = 'dance' | 'spiral' | 'haze' | 'escort';

/**
 * Salazzle, "la reina de la ponzoña" (Toxic Swamp mid-boss), cards in order:
 * Dance: dashes at the player down locked lanes, three times, leaving smoke
 * puffs (four on hard and above). Spiral: from the middle of the den, arms
 * of poison flame turning slowly (the gaps between arms are the way out).
 * Haze: a pheromone haze fills the den except two safe pockets, marked long
 * enough to walk to one; rolling does not help (`pierceRoll`). Escort
 * (nightmare only): calls two Salandit. It rests between cards.
 */
export interface QueenDef {
  kind: 'queen';
  poise: PoiseDef;
  bar: true;
  aggroRange: number;
  walkSpeed: number;
  keepDistance: number;
  restMs: number;
  cards: readonly QueenCard[];
  cardNames: Readonly<Record<QueenCard, string>>;
  dance: {
    telegraphMs: number;
    lockMs: number;
    dashMs: number;
    dashDistance: number;
    dashes: number;
    attack: EnemyAttackDef;
    smoke: { everyPx: number; puff: HazardDef };
    recoverMs: number;
    extraDash: { minDifficulty: Difficulty };
  };
  spiral: { telegraphMs: number; arms: number; everyMs: number; durationMs: number; degPerSec: number; flame: Shot; recoverMs: number };
  haze: { telegraphMs: number; activeMs: number; pocketRadius: number; attack: EnemyAttackDef; recoverMs: number };
  escort: { minDifficulty: Difficulty; telegraphMs: number; count: number; species: 'salandit'; recoverMs: number };
}

/** Nihilego's spell cards and its awakening (phase 2). */
export type UltraCard = 'tendrils' | 'spores' | 'shards' | 'wormhole' | 'flood' | 'downpour' | 'ultra';

/**
 * Nihilego «La que cayó por la grieta del cielo» (Toxic Swamp guardian), an
 * Ultra Beast. Phase 1 plays Tendrils, Spores and Shards in turn; at half HP
 * it awakens (a long, harmless transform) and phase 2 adds the Ultra
 * wormhole and the neurotoxin flood, with faster patterns. On nightmare a
 * poison downpour joins the rotation. Every card leaves a safe path (tests).
 *
 * - Tendrils: the arena splits into lanes; every other lane is marked and
 *   then lashed by neurotoxin tendrils, then the other set (three waves on
 *   hard and above; in phase 2 the waves alternate rows and columns).
 * - Spores: a spiral of spores turning from its body; the gaps between arms
 *   are the safe lanes (phase 2: one more arm, and the spin reverses halfway).
 * - Shards: rings of rock shards, every other ring turned by half a gap
 *   (one more ring on hard and above).
 * - Wormhole: an Ultra wormhole opens near the player and pulls gently; it
 *   vanishes and bursts out of it with a ring of shards; the mouth itself
 *   bites whoever is still inside (`pierceRoll`: walk out, a roll inside
 *   does not save you). Three times.
 * - Flood: neurotoxin floods the rift except three safe pockets, marked long
 *   enough to walk to one (`pierceRoll`).
 * - Downpour (nightmare): poison rain marks a checkerboard of circles, then
 *   the other half.
 */
export interface UltraDef {
  kind: 'ultra';
  poise: PoiseDef;
  aggroRange: number;
  floats: true;
  walkSpeed: number;
  keepDistance: number;
  restMs: number;
  cardNames: Readonly<Record<UltraCard, string>>;
  phase1: readonly UltraCard[];
  phase2: { threshold: number; awakenMs: number; restMs: number; cards: readonly UltraCard[] };
  /** Joins the rotation (after every full turn) on this difficulty and above. */
  nightmareCard: { minDifficulty: Difficulty; card: UltraCard };
  tendrils: { lanes: number; telegraphMs: number; strikeMs: number; waves: number; attack: EnemyAttackDef; recoverMs: number; extraWave: { minDifficulty: Difficulty } };
  spores: { telegraphMs: number; arms: number; arms2: number; everyMs: number; durationMs: number; degPerSec: number; spore: Shot; recoverMs: number };
  shards: { telegraphMs: number; rings: number; perRing: number; gapMs: number; shard: Shot; recoverMs: number; extraRing: { minDifficulty: Difficulty } };
  wormhole: {
    telegraphMs: number;
    radius: number;
    pullRange: number;
    pullSpeed: number;
    jumps: number;
    burst: { count: number; shot: Shot };
    attack: EnemyAttackDef;
    strikeMs: number;
    recoverMs: number;
  };
  flood: { telegraphMs: number; activeMs: number; pocketRadius: number; attack: EnemyAttackDef; recoverMs: number };
  downpour: { telegraphMs: number; strikeMs: number; cols: number; rows: number; radius: number; attack: EnemyAttackDef; recoverMs: number };
}

export const SALAZZLE: QueenDef = {
  kind: 'queen',
  poise: { hitstunScale: 0, knockbackScale: 0.15 },
  bar: true,
  aggroRange: 900,
  walkSpeed: 80,
  keepDistance: 180,
  restMs: 1300,
  cards: ['dance', 'spiral', 'haze', 'escort'],
  cardNames: { dance: 'spell.salazzle.dance', spiral: 'spell.salazzle.spiral', haze: 'spell.salazzle.haze', escort: 'spell.salazzle.escort' },
  dance: {
    telegraphMs: 650,
    lockMs: 250,
    dashMs: 280,
    dashDistance: 260,
    dashes: 3,
    attack: { power: 30, type: 'poison' },
    smoke: { everyPx: 60, puff: { power: 14, type: 'poison', radius: 20, lifetimeMs: 3000 } },
    recoverMs: 1300,
    extraDash: { minDifficulty: 'hard' },
  },
  spiral: { telegraphMs: 900, arms: 4, everyMs: 160, durationMs: 2600, degPerSec: 60, flame: { power: 18, type: 'fire', speed: 115, radius: 6, lifetimeMs: 5000 }, recoverMs: 1400 },
  haze: { telegraphMs: 1700, activeMs: 500, pocketRadius: 72, attack: { power: 32, type: 'poison', pierceRoll: true }, recoverMs: 1300 },
  escort: { minDifficulty: 'nightmare', telegraphMs: 900, count: 2, species: 'salandit', recoverMs: 900 },
};

export const NIHILEGO: UltraDef = {
  kind: 'ultra',
  poise: { hitstunScale: 0, knockbackScale: 0.1 },
  aggroRange: 900,
  floats: true,
  walkSpeed: 45,
  keepDistance: 190,
  restMs: 1200,
  cardNames: {
    tendrils: 'spell.nihilego.tendrils',
    spores: 'spell.nihilego.spores',
    shards: 'spell.nihilego.shards',
    wormhole: 'spell.nihilego.wormhole',
    flood: 'spell.nihilego.flood',
    downpour: 'spell.nihilego.downpour',
    ultra: 'spell.nihilego.ultra',
  },
  phase1: ['tendrils', 'spores', 'shards'],
  phase2: { threshold: 0.5, awakenMs: 1800, restMs: 950, cards: ['wormhole', 'tendrils', 'spores', 'flood', 'shards'] },
  nightmareCard: { minDifficulty: 'nightmare', card: 'downpour' },
  tendrils: { lanes: 7, telegraphMs: 950, strikeMs: 260, waves: 2, attack: { power: 30, type: 'poison' }, recoverMs: 1100, extraWave: { minDifficulty: 'hard' } },
  spores: { telegraphMs: 800, arms: 3, arms2: 4, everyMs: 170, durationMs: 2700, degPerSec: 55, spore: { power: 18, type: 'poison', speed: 95, radius: 7, lifetimeMs: 5200 }, recoverMs: 1200 },
  shards: { telegraphMs: 850, rings: 3, perRing: 14, gapMs: 700, shard: { power: 20, type: 'rock', speed: 115, radius: 6, lifetimeMs: 5000 }, recoverMs: 1200, extraRing: { minDifficulty: 'hard' } },
  wormhole: {
    telegraphMs: 1100,
    radius: 78,
    pullRange: 220,
    pullSpeed: 38,
    jumps: 3,
    burst: { count: 10, shot: { power: 18, type: 'rock', speed: 105, radius: 6, lifetimeMs: 4500 } },
    attack: { power: 30, type: 'poison', pierceRoll: true },
    strikeMs: 220,
    recoverMs: 1300,
  },
  flood: { telegraphMs: 1900, activeMs: 500, pocketRadius: 66, attack: { power: 36, type: 'poison', pierceRoll: true }, recoverMs: 1300 },
  downpour: { telegraphMs: 1100, strikeMs: 220, cols: 5, rows: 4, radius: 50, attack: { power: 26, type: 'poison' }, recoverMs: 1200 },
};

/** The most enemy projectiles the swamp's bosses let into the air at once (spawns past it are skipped). */
export const SWAMP_SHOT_CAP = 140;
