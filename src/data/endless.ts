import type { MusicContext } from './music';
import type { RoomId } from './rooms';
import type { SpeciesId } from './species';

/**
 * The endless dungeon (Sima del Eclipse, docs/gdd.md §3 "La Sima del
 * Eclipse"): a Zero Isle-style challenge with no last floor and a run clock.
 * Every value is provisional. The core reads it through `ECLIPSE.endless`
 * (data/dungeons.ts) and core/endless.ts.
 */

/**
 * One species of the endless pool: it shows up from `minDepth` on with this
 * weight (`pack`: swarmers placed several to a pick). The pool is one flat
 * list on purpose: new enemies join the Sima by appending an entry here,
 * nothing else to change.
 */
export interface EndlessPoolEntry {
  species: SpeciesId;
  minDepth: number;
  weight: number;
  pack?: number;
}

export const ENDLESS_POOL: readonly EndlessPoolEntry[] = [
  // Crypt of the Sword King
  { species: 'poochyena', minDepth: 1, weight: 3 },
  { species: 'gastly', minDepth: 1, weight: 2 },
  // Misty Forest
  { species: 'pumpkaboo-small', minDepth: 1, weight: 2, pack: 3 },
  { species: 'phantump', minDepth: 2, weight: 2 },
  { species: 'spinarak', minDepth: 2, weight: 2 },
  { species: 'foongus', minDepth: 3, weight: 1 },
  { species: 'hoothoot', minDepth: 4, weight: 2 },
  { species: 'pumpkaboo-super', minDepth: 6, weight: 1 },
  // Experimental roster (EXPERIMENTAL_ENEMIES in data/enemies.ts): the
  // suggested min depths and packs, with lighter weights so the regulars
  // stay about half of every floor.
  { species: 'zubat', minDepth: 1, weight: 2, pack: 3 },
  { species: 'stunky', minDepth: 1, weight: 1, pack: 2 },
  { species: 'ekans', minDepth: 2, weight: 1 },
  { species: 'litleo', minDepth: 2, weight: 1 },
  { species: 'tentacool', minDepth: 2, weight: 1 },
  { species: 'corphish', minDepth: 3, weight: 1 },
  { species: 'chinchou', minDepth: 3, weight: 1 },
  { species: 'houndour', minDepth: 3, weight: 1 },
  { species: 'koffing', minDepth: 3, weight: 1 },
  { species: 'grimer', minDepth: 4, weight: 1 },
  { species: 'wooper', minDepth: 4, weight: 1 },
  { species: 'slugma', minDepth: 4, weight: 1 },
  { species: 'clauncher', minDepth: 5, weight: 1 },
  { species: 'croagunk', minDepth: 5, weight: 1 },
];

/** A guardian echo: the arena of a guardian (or mid-boss) and the track it fights to. */
export interface EchoDef {
  room: RoomId;
  music: MusicContext;
}

export interface EndlessDef {
  /** Every `echoEvery`th floor is a guardian echo; the echoes rotate in this order. */
  echoEvery: number;
  echoes: readonly EchoDef[];
  /** The way on that opens at the top centre of an echo's arena once it falls (px). */
  echoExit: { width: number; height: number };
  pool: readonly EndlessPoolEntry[];
  /** Enemies per room: `base` on floor 1, plus `perDepth` (rounded down) per deeper floor, plus up to `jitter`, at most `maxPerRoom`. */
  spawns: { base: number; perDepth: number; jitter: number; maxPerRoom: number };
  /** Enemy HP and damage multipliers: +perFloor per floor past the first, capped; echoes take `echoHp` of that HP. */
  scaling: { hpPerFloor: number; damagePerFloor: number; maxHp: number; maxDamage: number; echoHp: number };
  /** Urgent floor chances: `start` from `fromFloor`, + `perFloor` per deeper floor, at most `max` (each). */
  urgent: readonly { kind: 'collapse' | 'fog'; fromFloor: number; start: number; perFloor: number; max: number }[];
  clock: {
    startMs: number;
    /** Entering floor n adds max(descendMinMs, descendMs - descendShrinkMs * (n - 2)). */
    descendMs: number;
    descendShrinkMs: number;
    descendMinMs: number;
    /** Felling an echo adds this much more. */
    echoMs: number;
    /** Under this the HUD clock turns red, pulses and ticks. */
    lowMs: number;
  };
  /** Floor tracks rotated by depth band (`bandFloors` floors each). */
  musicBands: readonly MusicContext[];
  bandFloors: number;
  /** Pokémonedas paid by the normal rules, times this (not the best farm). */
  coinScale: number;
  /** Modo puro: permanent shop upgrades do not apply (scores stay comparable). */
  pure: boolean;
}

export const ENDLESS: EndlessDef = {
  echoEvery: 5,
  echoes: [
    { room: 'boss', music: 'guardian' },
    { room: 'hollow', music: 'guardian' },
    { room: 'roost', music: 'forest-guardian' },
  ],
  echoExit: { width: 80, height: 50 },
  pool: ENDLESS_POOL,
  spawns: { base: 1, perDepth: 0.34, jitter: 1, maxPerRoom: 5 },
  scaling: { hpPerFloor: 0.08, damagePerFloor: 0.05, maxHp: 4, maxDamage: 3, echoHp: 0.6 },
  urgent: [
    { kind: 'collapse', fromFloor: 2, start: 0.08, perFloor: 0.01, max: 0.22 },
    { kind: 'fog', fromFloor: 3, start: 0.08, perFloor: 0.01, max: 0.22 },
  ],
  clock: { startMs: 480_000, descendMs: 40_000, descendShrinkMs: 2_000, descendMinMs: 15_000, echoMs: 60_000, lowMs: 30_000 },
  musicBands: ['crypt', 'forest'],
  bandFloors: 5,
  coinScale: 0.5,
  pure: true,
};

/** True on the floors that hold a guardian echo (5, 10, 15...). */
export const isEchoFloor = (endless: Pick<EndlessDef, 'echoEvery'>, floor: number): boolean => floor > 0 && floor % endless.echoEvery === 0;

/** The echo of an echo floor: the first on floor 5, the next on floor 10, and round again. */
export const echoAt = (endless: Pick<EndlessDef, 'echoEvery' | 'echoes'>, floor: number): EchoDef =>
  endless.echoes[(Math.floor(floor / endless.echoEvery) - 1 + endless.echoes.length * 1000) % endless.echoes.length]!;
