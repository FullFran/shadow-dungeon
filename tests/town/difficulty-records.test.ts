import { describe, expect, it } from 'vitest';
import { boardLines, EMPTY_RECORDS, parseRecords, recordRun, tierRecord, type RunRecord } from '../../src/town/records';
import { leaderboardLines, LEADERBOARD_SIZE, parseBoard, recordScore, tierBoard, type ScoreEntry } from '../../src/town/leaderboard';

const crypt = 'crypt-of-the-sword-king';
const run = (over: Partial<RunRecord> = {}): RunRecord => ({ dungeon: crypt, floor: 2, level: 4, species: 'zorua', victory: false, ...over });
const entry = (over: Partial<ScoreEntry> = {}): ScoreEntry => ({ floor: 7, clockMs: 61_000, mode: 'free', date: '2026-10-25', seed: 99, species: 'mimikyu', level: 6, ...over });

describe('records per difficulty tier', () => {
  it('keeps best floor and clears per dungeon per tier, and the overall record that unlocks dungeons', () => {
    const records = [run({ floor: 3, difficulty: 'hard' }), run({ floor: 6, victory: true, difficulty: 'hard' }), run({ floor: 5, difficulty: 'easy' })].reduce(recordRun, EMPTY_RECORDS);
    const crypt6 = records.dungeons[crypt]!;
    expect(crypt6.bestFloor).toBe(6);
    expect(crypt6.cleared).toBe(true);
    expect(tierRecord(crypt6, 'hard')).toEqual({ bestFloor: 6, clears: 1 });
    expect(tierRecord(crypt6, 'easy')).toEqual({ bestFloor: 5, clears: 0 });
    expect(tierRecord(crypt6, 'nightmare')).toBeNull();
  });

  it('reads records from before tiers as easy, and carries them over on the first tiered run', () => {
    const old = parseRecords(JSON.stringify({ runs: 3, victories: 1, dungeons: { [crypt]: { bestFloor: 6, cleared: true } } }));
    expect(tierRecord(old.dungeons[crypt], 'easy')).toEqual({ bestFloor: 6, clears: 1 });
    expect(tierRecord(old.dungeons[crypt], 'hard')).toBeNull();
    const after = recordRun(old, run({ floor: 2, difficulty: 'hard' }));
    expect(after.dungeons[crypt]!.tiers).toEqual({ easy: { bestFloor: 6, clears: 1 }, hard: { bestFloor: 2, clears: 0 } });
    // Round trip through the stored text; broken tier entries are dropped.
    expect(parseRecords(JSON.stringify(after)).dungeons[crypt]).toEqual(after.dungeons[crypt]);
    const hostile = parseRecords(JSON.stringify({ runs: 1, dungeons: { [crypt]: { bestFloor: 2, tiers: { hard: { bestFloor: 'x', clears: 1 }, legendary: { bestFloor: 9, clears: 9 }, easy: { bestFloor: 2, clears: 0 } } } } }));
    expect(hostile.dungeons[crypt]!.tiers).toEqual({ easy: { bestFloor: 2, clears: 0 } });
  });

  it('the notice board shows the picked tier: its best floor and clears', () => {
    const tr = (key: string) => ({ 'town.board.title': 'Records:', 'town.board.best': 'Best floor: {floor}', 'town.board.runs': 'Runs: {runs}', 'town.board.victories': 'Wins: {wins}', 'town.board.level': 'Best level: {level}', 'town.board.tier': '{tier}', 'town.board.clears': 'Clears: {clears}' })[key] ?? key;
    const records = [run({ floor: 6, victory: true, difficulty: 'hard' }), run({ floor: 3, difficulty: 'easy' })].reduce(recordRun, EMPTY_RECORDS);
    expect(boardLines(records, crypt, tr, [], { difficulty: 'hard', name: 'Hard' })).toEqual(['Records: Hard · Clears: 1 · Best floor: 6 · Runs: 2 · Wins: 1 · Best level: 4']);
    expect(boardLines(records, crypt, tr, [], { difficulty: 'nightmare', name: 'Nightmare' })).toEqual(['Records: Nightmare · Clears: 0 · Best floor: - · Runs: 2 · Wins: 1 · Best level: 4']);
  });
});

describe('Sima leaderboard per difficulty tier', () => {
  it('ranks each tier on its own board of ten', () => {
    let board: ScoreEntry[] = [];
    for (let i = 1; i <= LEADERBOARD_SIZE; i++) board = recordScore(board, entry({ floor: 20 + i })).board;
    const hard = recordScore(board, entry({ floor: 3, difficulty: 'hard' }));
    expect(hard.rank).toBe(1);
    expect(tierBoard(hard.board, 'easy')).toHaveLength(LEADERBOARD_SIZE);
    expect(tierBoard(hard.board, 'hard').map((e) => e.floor)).toEqual([3]);
    expect(recordScore(hard.board, entry({ floor: 1 })).rank).toBeNull();
  });

  it('reads old scores (no tier) as easy, keeps a valid tier and drops an unknown one to easy', () => {
    const raw = JSON.stringify([entry({ floor: 9 }), { ...entry({ floor: 5 }), difficulty: 'nightmare' }, { ...entry({ floor: 4 }), difficulty: 'legendary' }]);
    const board = parseBoard(raw);
    expect(tierBoard(board, 'easy').map((e) => e.floor)).toEqual([9, 4]);
    expect(tierBoard(board, 'nightmare').map((e) => e.floor)).toEqual([5]);
    const many = JSON.stringify([...Array.from({ length: 15 }, (_, i) => entry({ floor: i + 1 })), ...Array.from({ length: 15 }, (_, i) => ({ ...entry({ floor: i + 1 }), difficulty: 'hard' }))]);
    expect(parseBoard(many)).toHaveLength(2 * LEADERBOARD_SIZE);
  });

  it('the town board names the tier and lists only its scores', () => {
    const t = (key: string) => ({ 'endless.board.title': 'Sima:', 'endless.board.none': 'none', 'endless.board.entry': '{rank}. F{floor}', 'endless.mode.free': 'free' })[key] ?? key;
    const board = [entry({ floor: 9 }), entry({ floor: 4, difficulty: 'hard' })];
    expect(leaderboardLines(board, t, 5, { difficulty: 'hard', name: 'Hard' })).toEqual(['Sima: (Hard) 1. F4']);
    expect(leaderboardLines(board, t, 5, { difficulty: 'nightmare', name: 'Nightmare' })).toEqual(['Sima: (Nightmare) none']);
  });
});
