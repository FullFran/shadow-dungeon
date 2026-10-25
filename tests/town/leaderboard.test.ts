import { describe, expect, it } from 'vitest';
import {
  LEADERBOARD_KEY,
  LEADERBOARD_SIZE,
  leaderboardLines,
  parseBoard,
  readBoard,
  recordScore,
  saveScore,
  type ScoreEntry,
} from '../../src/town/leaderboard';

const entry = (over: Partial<ScoreEntry> = {}): ScoreEntry => ({ floor: 7, clockMs: 61_000, mode: 'free', date: '2026-10-25', seed: 99, species: 'mimikyu', level: 6, ...over });

/** An in-memory store (no browser storage). */
function memoryStore(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { get: (key: string) => data.get(key) ?? null, set: (key: string, value: string) => void data.set(key, value), data };
}

describe('endless leaderboard', () => {
  it('ranks by deepest floor, then by time left', () => {
    let board: ScoreEntry[] = [];
    for (const e of [entry({ floor: 5 }), entry({ floor: 9, clockMs: 1000 }), entry({ floor: 9, clockMs: 30_000 }), entry({ floor: 2 })]) board = recordScore(board, e).board;
    expect(board.map((e) => [e.floor, e.clockMs])).toEqual([
      [9, 30_000],
      [9, 1000],
      [5, 61_000],
      [2, 61_000],
    ]);
  });

  it('gives the rank of the new score, or null when it did not make the board', () => {
    let board: ScoreEntry[] = [];
    for (let i = 1; i <= LEADERBOARD_SIZE; i++) board = recordScore(board, entry({ floor: i + 10 })).board;
    expect(board).toHaveLength(LEADERBOARD_SIZE);
    const low = recordScore(board, entry({ floor: 1 }));
    expect(low.rank).toBeNull();
    expect(low.board).toEqual(board);
    const top = recordScore(board, entry({ floor: 99 }));
    expect(top.rank).toBe(1);
    expect(top.board).toHaveLength(LEADERBOARD_SIZE);
    expect(top.board.at(-1)!.floor).toBe(12);
  });

  it('a full tie keeps the older score ahead', () => {
    const first = entry({ seed: 1 });
    const second = entry({ seed: 2 });
    const { board, rank } = recordScore(recordScore([], first).board, second);
    expect(board.map((e) => e.seed)).toEqual([1, 2]);
    expect(rank).toBe(2);
  });

  it('reads a broken or hostile value as an empty board and drops bad entries', () => {
    for (const raw of [null, '', 'nope', '{}', '[1,2]', '{"__proto__":[]}']) expect(parseBoard(raw)).toEqual([]);
    const raw = JSON.stringify([entry(), { ...entry(), floor: -3 }, { ...entry(), mode: 'cheat' }, { ...entry(), species: '<img>' }, { ...entry(), date: 'today' }, entry({ floor: 3 })]);
    expect(parseBoard(raw).map((e) => e.floor)).toEqual([7, 3]);
    const many = JSON.stringify(Array.from({ length: 40 }, (_, i) => entry({ floor: i + 1 })));
    expect(parseBoard(many)).toHaveLength(LEADERBOARD_SIZE);
    expect(parseBoard(many)[0]!.floor).toBe(40);
  });

  it('persists through the store and never throws when it fails', () => {
    const store = memoryStore();
    expect(saveScore(store, entry({ floor: 4 })).rank).toBe(1);
    expect(saveScore(store, entry({ floor: 8 })).rank).toBe(1);
    expect(readBoard(store).map((e) => e.floor)).toEqual([8, 4]);
    expect(JSON.parse(store.data.get(LEADERBOARD_KEY)!)).toHaveLength(2);
    const broken = { get: () => { throw new Error('denied'); }, set: () => { throw new Error('full'); } };
    expect(readBoard(broken)).toEqual([]);
    expect(saveScore(broken, entry()).rank).toBe(1);
  });

  it('board lines: a placeholder when empty, else the best few with floor, time, mode and date', () => {
    const tr = (key: string) => `[${key}]`;
    expect(leaderboardLines([], tr)).toEqual(['[endless.board.title] [endless.board.none]']);
    const t = (key: string) =>
      ({ 'endless.board.title': 'Sima:', 'endless.board.entry': '{rank}. F{floor} {time} {mode} {date}', 'endless.mode.daily': 'daily', 'endless.mode.free': 'free' })[key] ?? key;
    const board = [entry({ floor: 9, clockMs: 5_000, mode: 'daily' }), entry({ floor: 3 })];
    expect(leaderboardLines(board, t)).toEqual(['Sima: 1. F9 0:05 daily 2026-10-25 · 2. F3 1:01 free 2026-10-25']);
    // Two scores per page so the dialog box never overflows; the title opens the first page.
    const pages = leaderboardLines(Array.from({ length: 10 }, () => entry()), t, 5);
    expect(pages).toHaveLength(3);
    expect(pages.flatMap((p) => p.split(' · '))).toHaveLength(5);
    expect(pages[0]!.startsWith('Sima: 1.')).toBe(true);
    expect(pages[2]).toBe('5. F7 1:01 free 2026-10-25');
  });
});
