import type { EncounterBudget } from './encounters';
import type { MusicContext } from './music';
import type { RoomId } from './rooms';
import type { SpeciesId } from './species';
import { SIMA_BANDS, SIMA_ELITES, SIMA_EVENTS, SIMA_SQUADS, type SimaBand, type SimaElites, type SimaEvents, type SimaSquad } from './sima';

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
  /** Weight change per floor past `minDepth` (tough species grow, weak ones fade to a quarter, never out). */
  perDepth?: number;
}

export const ENDLESS_POOL: readonly EndlessPoolEntry[] = [
  // Tougher, not more (2026-10-25): the weak regulars fade with depth and the
  // tough species come earlier and grow (`perDepth`); counts per room stay low.
  // Crypt of the Sword King
  { species: 'poochyena', minDepth: 1, weight: 3, perDepth: -0.15 },
  { species: 'gastly', minDepth: 1, weight: 2, perDepth: -0.05 },
  // The remastered Crypt's new enemies, from the floors they first walk
  // there (CRYPT_SPAWNS): Duskull and a Pawniard pair from 2, Golett from 3.
  // Sableye stays the Crypt's mid-boss (no vault echo).
  { species: 'duskull', minDepth: 2, weight: 2 },
  { species: 'pawniard', minDepth: 2, weight: 1, pack: 2, perDepth: 0.05 },
  { species: 'golett', minDepth: 3, weight: 1, perDepth: 0.1 },
  // Misty Forest
  { species: 'pumpkaboo-small', minDepth: 1, weight: 2, pack: 3, perDepth: -0.1 },
  { species: 'phantump', minDepth: 2, weight: 2 },
  { species: 'spinarak', minDepth: 2, weight: 2 },
  { species: 'foongus', minDepth: 3, weight: 1 },
  { species: 'hoothoot', minDepth: 3, weight: 2 },
  { species: 'pumpkaboo-super', minDepth: 4, weight: 1, perDepth: 0.1 },
  // Experimental roster (EXPERIMENTAL_ENEMIES in data/enemies.ts): the
  // suggested min depths and packs (the tough ones a floor or two earlier),
  // with lighter weights so the regulars stay about half of every early floor.
  { species: 'zubat', minDepth: 1, weight: 2, pack: 3, perDepth: -0.1 },
  { species: 'stunky', minDepth: 1, weight: 1, pack: 2, perDepth: -0.05 },
  { species: 'ekans', minDepth: 2, weight: 1 },
  { species: 'litleo', minDepth: 2, weight: 1 },
  { species: 'tentacool', minDepth: 2, weight: 1 },
  { species: 'corphish', minDepth: 3, weight: 1 },
  { species: 'chinchou', minDepth: 3, weight: 1 },
  { species: 'houndour', minDepth: 3, weight: 1, perDepth: 0.06 },
  { species: 'koffing', minDepth: 3, weight: 1 },
  { species: 'grimer', minDepth: 3, weight: 1, perDepth: 0.06 },
  { species: 'wooper', minDepth: 4, weight: 1 },
  { species: 'slugma', minDepth: 3, weight: 1, perDepth: 0.06 },
  { species: 'clauncher', minDepth: 4, weight: 1, perDepth: 0.08 },
  { species: 'croagunk', minDepth: 4, weight: 1, perDepth: 0.08 },
  // Flooded Caves (integration 2026-10-25): its regulars a little deeper than
  // in their own dungeon, the Sima being harder per floor; Krabby the tank,
  // Remoraid the gunner, Shellos the mortar. Lanturn stays the caves' mid-boss.
  { species: 'krabby', minDepth: 6, weight: 1, perDepth: 0.06 },
  { species: 'remoraid', minDepth: 7, weight: 1, perDepth: 0.04 },
  { species: 'shellos', minDepth: 8, weight: 1, perDepth: 0.06 },
  // Toxic Swamp: Venipede rolls in pairs, Salandit dashes, Skrelp snipes.
  // Salazzle stays the swamp's mid-boss.
  { species: 'venipede', minDepth: 9, weight: 1, pack: 2, perDepth: 0.02 },
  { species: 'salandit', minDepth: 10, weight: 1, perDepth: 0.06 },
  { species: 'skrelp', minDepth: 11, weight: 1, perDepth: 0.05 },
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
  /** Every `eclipseEvery`th floor (a multiple of `echoEvery`) holds the dungeon's own boss instead of a guardian echo. */
  eclipseEvery?: number;
  eclipseEcho?: EchoDef;
  /** The way on that opens at the top centre of an echo's arena once it falls (px). */
  echoExit: { width: number; height: number };
  pool: readonly EndlessPoolEntry[];
  /** Enemies per room: `base` on floor 1, plus `perDepth` (rounded down) per deeper floor, plus up to `jitter`, at most `maxPerRoom`. */
  spawns: { base: number; perDepth: number; jitter: number; maxPerRoom: number; budget?: EncounterBudget };
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
    /** Breathing room: the clock waits this long on every new floor (the floor card, a first look around). */
    graceMs?: number;
  };
  /** Floor tracks rotated by depth band (`bandFloors` floors each). */
  musicBands: readonly MusicContext[];
  bandFloors: number;
  /** Pokémonedas paid by the normal rules, times this (not the best farm). */
  coinScale: number;
  /** Modo puro: permanent shop upgrades do not apply (scores stay comparable). */
  pure: boolean;
  /** The Sima's depth bands (data/sima.ts): its look changes as you descend. */
  bands?: readonly SimaBand[];
  /** Sima elites by depth (data/sima.ts): tougher enemies instead of more of them. */
  elites?: SimaElites;
  /** Sima mixed squads (data/sima.ts). */
  squads?: readonly SimaSquad[];
  /** Sima floor events (data/sima.ts). */
  events?: SimaEvents;
}

export const ENDLESS: EndlessDef = {
  echoEvery: 5,
  echoes: [
    { room: 'boss', music: 'guardian' },
    { room: 'hollow', music: 'guardian' },
    { room: 'roost', music: 'forest-guardian' },
    // The Flooded Caves' and Toxic Swamp's guardians (integration); phase 1 only, as every echo.
    { room: 'wreck', music: 'caves-guardian' },
    { room: 'rift', music: 'forest-guardian' },
  ],
  // The Sima's own boss on 10, 20, 30...; the guardian echoes keep 5, 15, 25... in turn.
  eclipseEvery: 10,
  eclipseEcho: { room: 'eclipse', music: 'guardian' },
  echoExit: { width: 80, height: 50 },
  pool: ENDLESS_POOL,
  spawns: { base: 1, perDepth: 0.15, jitter: 1, maxPerRoom: 3, budget: { base: 2, perDepth: 0.2, jitter: 1, maxEnemies: 3, rest: [0.2], repeatWeight: 0.4, leaders: { fromFloor: 3, start: 0.15, perFloor: 0.02, max: 0.6 } } },
  scaling: { hpPerFloor: 0.05, damagePerFloor: 0.035, maxHp: 3, maxDamage: 2.5, echoHp: 0.6 },
  urgent: [
    { kind: 'collapse', fromFloor: 2, start: 0.08, perFloor: 0.01, max: 0.22 },
    { kind: 'fog', fromFloor: 3, start: 0.08, perFloor: 0.01, max: 0.22 },
  ],
  clock: { startMs: 480_000, descendMs: 40_000, descendShrinkMs: 2_000, descendMinMs: 15_000, echoMs: 60_000, lowMs: 30_000, graceMs: 3000 },
  musicBands: ['crypt', 'forest'],
  bandFloors: 5,
  coinScale: 0.5,
  pure: true,
  bands: SIMA_BANDS,
  elites: SIMA_ELITES,
  squads: SIMA_SQUADS,
  events: SIMA_EVENTS,
};

/** True on the floors that hold a guardian echo (5, 10, 15...). */
export const isEchoFloor = (endless: Pick<EndlessDef, 'echoEvery'>, floor: number): boolean => floor > 0 && floor % endless.echoEvery === 0;

/**
 * The echo of an echo floor: the Eclipse Echo on every `eclipseEvery`th floor
 * (when the dungeon has one), otherwise the guardian echoes in turn (the first
 * on floor 5, the next on the next guardian echo floor, and round again).
 */
export function echoAt(endless: Pick<EndlessDef, 'echoEvery' | 'echoes' | 'eclipseEvery' | 'eclipseEcho'>, floor: number): EchoDef {
  const { eclipseEvery, eclipseEcho } = endless;
  if (eclipseEvery && eclipseEcho && floor > 0 && floor % eclipseEvery === 0) return eclipseEcho;
  const echoes = Math.floor(floor / endless.echoEvery);
  const eclipses = eclipseEvery && eclipseEcho ? Math.floor(floor / eclipseEvery) : 0;
  return endless.echoes[(echoes - eclipses - 1 + endless.echoes.length * 1000) % endless.echoes.length]!;
}
