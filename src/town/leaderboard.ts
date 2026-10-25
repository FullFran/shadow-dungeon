import type { KeyValueStore } from '../adapters/storage';
import { clockText } from '../core/endless';
import { DEFAULT_DIFFICULTY, isDifficulty, type Difficulty } from '../data/difficulty';

/**
 * The endless dungeon's local leaderboard (docs/gdd.md §3 "La Sima del
 * Eclipse"): the best ten scores on this device, by deepest floor and then
 * by time left. Written at the end of every endless run of this peer (a
 * guest keeps its own), shown on the town notice board and the end screen.
 * Like the run records, a missing, broken or hostile value reads as an empty
 * board and a failing store never throws.
 */
export const LEADERBOARD_KEY = 'mazmorra-sombria.endless';
export const LEADERBOARD_SIZE = 10;

export type ScoreMode = 'daily' | 'free';

export interface ScoreEntry {
  floor: number;
  /** Time left when the run ended (0 when the eclipse took it). */
  clockMs: number;
  mode: ScoreMode;
  /** UTC date of the run, "YYYY-MM-DD" (the daily challenge's day). */
  date: string;
  seed: number;
  species: string;
  level: number;
  /** The run's tier; absent = easy (every score from before tiers). Each tier keeps its own top ten. */
  difficulty?: Difficulty;
}

/** A score's tier (old scores are easy). */
export const scoreTier = (entry: Pick<ScoreEntry, 'difficulty'>): Difficulty => entry.difficulty ?? DEFAULT_DIFFICULTY;

/** The board of one tier, best first. */
export const tierBoard = (board: readonly ScoreEntry[], d: Difficulty): ScoreEntry[] => board.filter((e) => scoreTier(e) === d);

/** Negative when `a` ranks above `b`: deeper first, then more time left. */
export const compareScores = (a: Pick<ScoreEntry, 'floor' | 'clockMs'>, b: Pick<ScoreEntry, 'floor' | 'clockMs'>): number => b.floor - a.floor || b.clockMs - a.clockMs;

/**
 * Pure: the board with one more score (a full tie keeps the older one ahead)
 * and its 1-based rank on its own tier's board, or null when it did not make
 * that tier's top. Other tiers' scores are kept as they are.
 */
export function recordScore(board: readonly ScoreEntry[], entry: ScoreEntry): { board: ScoreEntry[]; rank: number | null } {
  const d = scoreTier(entry);
  const mine = tierBoard(board, d);
  const others = board.filter((e) => scoreTier(e) !== d);
  const index = mine.findIndex((e) => compareScores(entry, e) < 0);
  const at = index === -1 ? mine.length : index;
  if (at >= LEADERBOARD_SIZE) return { board: [...board], rank: null };
  const next = [...mine.slice(0, at), entry, ...mine.slice(at)].slice(0, LEADERBOARD_SIZE);
  return { board: [...next, ...others], rank: at + 1 };
}

const ID = /^[a-z0-9-]{1,40}$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const whole = (v: unknown, min: number): v is number => typeof v === 'number' && Number.isSafeInteger(v) && v >= min;

function parseEntry(raw: unknown): ScoreEntry | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const e = raw as Record<string, unknown>;
  if (!whole(e.floor, 1) || !whole(e.clockMs, 0) || !whole(e.level, 1) || !whole(e.seed, -(2 ** 31))) return null;
  if ((e.mode !== 'daily' && e.mode !== 'free') || typeof e.date !== 'string' || !DATE.test(e.date) || typeof e.species !== 'string' || !ID.test(e.species)) return null;
  // A tier other than easy is kept; anything else (absent, unknown) reads as easy.
  const tier = isDifficulty(e.difficulty) && e.difficulty !== DEFAULT_DIFFICULTY ? { difficulty: e.difficulty } : {};
  return { floor: e.floor, clockMs: e.clockMs, mode: e.mode, date: e.date, seed: e.seed, species: e.species, level: e.level, ...tier };
}

export function parseBoard(raw: string | null): ScoreEntry[] {
  let data: unknown = null;
  try {
    data = JSON.parse(raw ?? 'null');
  } catch {
    data = null;
  }
  if (!Array.isArray(data)) return [];
  const entries = [...data.slice(0, 200).flatMap((e) => parseEntry(e) ?? [])].sort(compareScores);
  // The top ten of each tier.
  const kept = new Map<Difficulty, number>();
  return entries.filter((e) => {
    const n = kept.get(scoreTier(e)) ?? 0;
    kept.set(scoreTier(e), n + 1);
    return n < LEADERBOARD_SIZE;
  });
}

export function readBoard(store: KeyValueStore): ScoreEntry[] {
  try {
    return parseBoard(store.get(LEADERBOARD_KEY));
  } catch {
    return [];
  }
}

/** Adds a score to the stored board; returns the board and the score's rank (any storage failure is swallowed). */
export function saveScore(store: KeyValueStore, entry: ScoreEntry): { board: ScoreEntry[]; rank: number | null } {
  const result = recordScore(readBoard(store), entry);
  try {
    store.set(LEADERBOARD_KEY, JSON.stringify(result.board));
  } catch {
    // Not persisted; the board just shows older scores.
  }
  return result;
}

/** One score as a line ("1. P12 3:05 Reto diario 2026-10-25"), `tr` the i18n lookup. */
export const scoreLine = (entry: ScoreEntry, rank: number, tr: (key: string) => string): string =>
  tr('endless.board.entry')
    .replace('{rank}', String(rank))
    .replace('{floor}', String(entry.floor))
    .replace('{time}', clockText(entry.clockMs))
    .replace('{mode}', tr(`endless.mode.${entry.mode}`))
    .replace('{date}', entry.date);

/** Scores per notice board page: two keep the dialog box from overflowing. */
const PER_PAGE = 2;

/** The notice board's pages for the Sima: the best `max` scores, two per page, or a placeholder before the first one. */
export function leaderboardLines(all: readonly ScoreEntry[], tr: (key: string) => string, max = 5, tier?: { difficulty: Difficulty; name: string }): string[] {
  // With a tier: only that tier's scores, and the title names it.
  const board = tier ? tierBoard(all, tier.difficulty) : all;
  const title = tier ? `${tr('endless.board.title')} (${tier.name})` : tr('endless.board.title');
  if (board.length === 0) return [`${title} ${tr('endless.board.none')}`];
  const lines = board.slice(0, max).map((e, i) => scoreLine(e, i + 1, tr));
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += PER_PAGE) pages.push(lines.slice(i, i + PER_PAGE).join(' · '));
  pages[0] = `${title} ${pages[0]}`;
  return pages;
}
