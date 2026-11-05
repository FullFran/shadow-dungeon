import type { KeyValueStore } from '../adapters/storage';
import { CHALLENGES, DUNGEONS, TUTORIAL, type ChallengeLine } from '../data/dungeons';
import { DIFFICULTIES } from '../data/difficulty';
import { WORLD } from '../data/world';
import { lineRoot } from '../data/player-evolutions';
import { PLAYABLE_SPECIES, type SpeciesId } from '../data/species';
import { MAX_RANK, tutorOffer } from '../data/tutor';
import { UPGRADES, type UpgradeId } from '../data/upgrades';
import { SHINY_LINES } from '../core/shiny';
import type { LearnedMoves, RankedMoves } from '../core/tutor';
import { readRecords, RECORDS_KEY, type DungeonRecord, type Records } from '../town/records';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * Development server only (`?unlock=all`): a save with everything open, to try
 * content without earning it. Lines stay on their first form, with materials to
 * evolve them at the stall. Never reachable in a build: main.ts checks DEV first.
 */

const PLENTY = 999_999;
const FLOORS = 99;

export function unlockedSave(save: SaveData): SaveData {
  const lines = [...new Set(PLAYABLE_SPECIES.map(lineRoot))];
  const learned: Partial<Record<SpeciesId, readonly string[]>> = {};
  const ranks: Partial<Record<SpeciesId, Record<string, number>>> = {};
  for (const species of PLAYABLE_SPECIES) {
    const offer = tutorOffer(species);
    learned[species] = offer;
    ranks[species] = Object.fromEntries(offer.map((id) => [id, MAX_RANK]));
  }
  const story: Partial<Record<ChallengeLine, number>> = {};
  for (const dungeon of CHALLENGES) if (dungeon.challenge) story[dungeon.challenge.line] = 3;
  const upgrades = Object.fromEntries((Object.keys(UPGRADES) as UpgradeId[]).map((id) => [id, UPGRADES[id].costs.length]));
  return {
    ...save,
    coins: PLENTY,
    upgrades,
    learned: learned as LearnedMoves,
    ranks: ranks as RankedMoves,
    owned: lines,
    materials: Object.fromEntries(lines.map((line) => [line, { normal: 99, hard: 99, nightmare: 99 }])),
    shinies: SHINY_LINES,
    story,
  };
}

export function unlockedRecords(records: Records): Records {
  const cleared: DungeonRecord = {
    bestFloor: FLOORS,
    cleared: true,
    tiers: Object.fromEntries(DIFFICULTIES.map((d) => [d, { bestFloor: FLOORS, clears: 1 }])),
  };
  const dungeons = Object.fromEntries([...DUNGEONS, ...CHALLENGES].map((d) => [d.id, cleared]));
  return { ...records, runs: Math.max(records.runs, 1), victories: Math.max(records.victories, 1), dungeons: { ...records.dungeons, ...dungeons } };
}

export function unlockEverything(store: KeyValueStore): void {
  writeSave(store, unlockedSave(loadSave(store)));
  store.set(RECORDS_KEY, JSON.stringify(unlockedRecords(readRecords(store))));
  // town/travel.ts's key: only the town scene imports that module (tests/town/travel.test.ts); the unlock's test reads it back.
  store.set('mazmorra-sombria.visitedMaps', JSON.stringify(Object.keys(WORLD)));
}

/**
 * Development server only (`?unlock=veteran`): an advanced, believable profile for
 * reviewing the game as a long-time player sees it (owner, 2026-11-03): everything the
 * town offers is open, every guardian has fallen, the chasm reached floor 37, a few
 * shiny skins, coins to spend but not infinite. Built on `unlockedSave` so every move,
 * line and upgrade is there; only the numbers read like real play.
 */
export function veteranSave(save: SaveData): SaveData {
  const open = unlockedSave(save);
  return { ...open, coins: 18_450, earned: 96_210, shinies: SHINY_LINES.slice(0, 4), shinyWorn: [] };
}

export function veteranRecords(records: Records): Records {
  const clearedAt = (floors: number, tiers: number): DungeonRecord => ({
    bestFloor: floors,
    cleared: true,
    tiers: Object.fromEntries(DIFFICULTIES.slice(0, tiers).map((d, i) => [d, { bestFloor: floors, clears: Math.max(1, 6 - i * 2) }])),
  });
  const dungeons: Record<string, DungeonRecord> = { [TUTORIAL.id]: clearedAt(3, 1) };
  for (const d of DUNGEONS) dungeons[d.id] = d.endless ? { bestFloor: 37, tiers: { [DIFFICULTIES[1]!]: { bestFloor: 37, clears: 0 } } } : clearedAt(d.plan.length, 3);
  for (const d of CHALLENGES) dungeons[d.id] = clearedAt(d.plan.length || 6, 2);
  return { ...records, runs: 128, victories: 19, bestLevel: 41, lastSpecies: 'zorua', dungeons: { ...records.dungeons, ...dungeons } };
}

export function veteranProfile(store: KeyValueStore): void {
  writeSave(store, veteranSave(loadSave(store)));
  store.set(RECORDS_KEY, JSON.stringify(veteranRecords(readRecords(store))));
  store.set('mazmorra-sombria.visitedMaps', JSON.stringify(Object.keys(WORLD)));
}
