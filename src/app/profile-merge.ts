import type { BestiaryEntry } from '../town/bestiary';
import { BESTIARY_SIZE } from '../town/bestiary';
import { parseBoard, type ScoreEntry } from '../town/leaderboard';
import { tierRecord, type DungeonRecord, type Records, type TierRecord } from '../town/records';
import type { ShrineRecords, TrialBest } from '../town/shrine-records';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { cleanProfile, hashText, type Profile } from './profile';
import { sanitize } from './save';
import type { SaveData } from './save';

/**
 * Merge rules for two profiles of one player (docs/gdd.md, Cuentas), pure.
 *
 * The economy is never merged: when two profiles diverge the player keeps
 * one side's save whole (coins, upgrades, moves, Pokémon, materials, pity,
 * missions, shinies...), so nothing can be spent twice or duplicated.
 * Everything that only records what the player did is always merged, whatever
 * side is kept: achievements (union), run records (max), shrine records
 * (best), the Sima leaderboard (top ten per tier) and the bestiary (union).
 *
 * Achievements: the merge pays no reward. Rewards already paid live in the
 * kept save's Pokémonedas; an achievement unlocked only on the other side is
 * marked unlocked here without paying it again (its reward stayed with the
 * discarded economy). Each keeps its earliest day.
 */
export type FieldRule = 'meta' | 'economy' | 'merged';

/** How a merge treats every save field (a new SaveData field fails typecheck until it is classified here). */
export const SAVE_FIELD_RULES = {
  version: 'meta',
  coins: 'economy',
  upgrades: 'economy',
  learned: 'economy',
  ranks: 'economy',
  owned: 'economy',
  awakened: 'economy',
  materials: 'economy',
  pity: 'economy',
  achievements: 'merged',
  earned: 'economy',
  missions: 'economy',
  shinies: 'economy',
  shinyWorn: 'economy',
  shinyPity: 'economy',
} as const satisfies Record<keyof SaveData, FieldRule>;

/** Union of unlocked achievements, each with its earliest day. */
export function mergeAchievements(a: Readonly<Record<string, string>> | undefined, b: Readonly<Record<string, string>> | undefined): Record<string, string> {
  const out: Record<string, string> = { ...(a ?? {}) };
  for (const [id, day] of Object.entries(b ?? {})) if (out[id] === undefined || day < out[id]!) out[id] = day;
  return out;
}

const mergeTier = (a: TierRecord | null, b: TierRecord | null): TierRecord | null =>
  a && b ? { bestFloor: Math.max(a.bestFloor, b.bestFloor), clears: Math.max(a.clears, b.clears) } : (a ?? b);

function mergeDungeon(a: DungeonRecord | undefined, b: DungeonRecord | undefined): DungeonRecord {
  if (!a) return b!;
  if (!b) return a;
  const cleared = a.cleared === true || b.cleared === true;
  let tiers: Partial<Record<Difficulty, TierRecord>> | undefined;
  if (a.tiers || b.tiers) {
    tiers = {};
    // A record from before tiers counts as easy (records.ts `tierRecord`).
    for (const d of DIFFICULTIES) {
      const merged = mergeTier(tierRecord(a, d), tierRecord(b, d));
      if (merged) tiers[d] = merged;
    }
  }
  return { bestFloor: Math.max(a.bestFloor, b.bestFloor), ...(cleared ? { cleared: true as const } : {}), ...(tiers ? { tiers } : {}) };
}

/**
 * Run records: per dungeon the best floor and clears of each tier, cleared
 * if either cleared; the run and victory counts and the best level are the
 * larger of the two (both sides usually share history, so they are not
 * added); the last species is the kept side's.
 */
export function mergeRecords(kept: Records, other: Records): Records {
  const dungeons: Record<string, DungeonRecord> = {};
  for (const id of new Set([...Object.keys(kept.dungeons), ...Object.keys(other.dungeons)])) dungeons[id] = mergeDungeon(kept.dungeons[id], other.dungeons[id]);
  const bestLevel = Math.max(kept.bestLevel ?? 0, other.bestLevel ?? 0);
  return {
    runs: Math.max(kept.runs, other.runs),
    victories: Math.max(kept.victories, other.victories),
    bestLevel: bestLevel > 0 ? bestLevel : null,
    lastSpecies: kept.lastSpecies ?? other.lastSpecies,
    dungeons,
  };
}

function mergeTrial(a: TrialBest | undefined, b: TrialBest | undefined): TrialBest | undefined {
  if (!a || !b) return a ?? b;
  const faster = b.bestMs < a.bestMs ? b : a;
  return {
    clears: Math.max(a.clears, b.clears),
    bestMs: Math.min(a.bestMs, b.bestMs),
    captures: Math.max(a.captures, b.captures),
    ...(a.noHit || b.noHit ? { noHit: true as const } : {}),
    ...(faster.species ? { species: faster.species } : {}),
  };
}

type Table = Readonly<Record<string, Partial<Record<Difficulty, TrialBest>>>>;
function mergeTable(a: Table, b: Table): Record<string, Partial<Record<Difficulty, TrialBest>>> {
  const out: Record<string, Partial<Record<Difficulty, TrialBest>>> = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const tiers: Partial<Record<Difficulty, TrialBest>> = {};
    for (const d of DIFFICULTIES) {
      const merged = mergeTrial(a[id]?.[d], b[id]?.[d]);
      if (merged) tiers[d] = merged;
    }
    out[id] = tiers;
  }
  return out;
}

/** Shrine records: per trial and tier the most clears, the best time (with its species), the most captures, no-hit if either. Solo and group apart. */
export function mergeShrine(kept: ShrineRecords, other: ShrineRecords): ShrineRecords {
  const group = kept.group || other.group ? { bosses: mergeTable(kept.group?.bosses ?? {}, other.group?.bosses ?? {}), gauntlets: mergeTable(kept.group?.gauntlets ?? {}, other.group?.gauntlets ?? {}) } : null;
  return { bosses: mergeTable(kept.bosses, other.bosses), gauntlets: mergeTable(kept.gauntlets, other.gauntlets), ...(group ? { group } : {}) };
}

const scoreId = (e: ScoreEntry): string => JSON.stringify([e.floor, e.clockMs, e.mode, e.date, e.seed, e.species, e.level, e.difficulty ?? null, e.build ?? null]);

/** Sima leaderboard: both boards, the same score once, then the top ten of each tier. */
export function mergeBoard(kept: readonly ScoreEntry[], other: readonly ScoreEntry[]): ScoreEntry[] {
  const seen = new Set<string>();
  const all = [...kept, ...other].filter((e) => {
    const id = scoreId(e);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  return parseBoard(JSON.stringify(all));
}

/** Bestiary: every herald met on either side, once per seed (the kept side's order first), the newest BESTIARY_SIZE kept. */
export function mergeBestiary(kept: readonly BestiaryEntry[], other: readonly BestiaryEntry[]): BestiaryEntry[] {
  const seeds = new Set(kept.map((e) => e.seed));
  return [...kept, ...other.filter((e) => !seeds.has(e.seed) && (seeds.add(e.seed), true))].slice(-BESTIARY_SIZE);
}

/** The profile kept after a divergence: `kept`'s economy, everything else merged with `other`. */
export function mergeProfiles(kept: Profile, other: Profile): Profile {
  const achievements = mergeAchievements(kept.save.achievements, other.save.achievements);
  const { achievements: _drop, ...save } = kept.save;
  return cleanProfile({
    save: Object.keys(achievements).length > 0 ? { ...save, achievements } : save,
    records: mergeRecords(kept.records, other.records),
    shrine: mergeShrine(kept.shrine, other.shrine),
    board: mergeBoard(kept.board, other.board),
    bestiary: mergeBestiary(kept.bestiary, other.bestiary),
  });
}

/**
 * Hash of a profile's economy only (the save fields `SAVE_FIELD_RULES` marks
 * economy). When the device's economy did not move since its last sync, its
 * other changes merge without loss, so a newer cloud is pulled (and merged)
 * instead of asking.
 */
export function economyHash(profile: Profile): string {
  const save = sanitize(profile.save) as unknown as Record<string, unknown>;
  const economy = Object.entries(SAVE_FIELD_RULES)
    .filter(([, rule]) => rule === 'economy')
    .map(([field]) => [field, save[field] ?? null]);
  return hashText(JSON.stringify(economy));
}
