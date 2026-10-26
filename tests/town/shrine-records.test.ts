import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { bossStop } from '../../src/core/shrine';
import { EMPTY_RECORDS, parseRecords, recordRun, type Records } from '../../src/town/records';
import {
  beatenBosses,
  EMPTY_SHRINE,
  gauntletReward,
  gauntletUnlocked,
  parseShrine,
  readShrine,
  recordTrial,
  saveTrial,
  SHRINE_KEY,
  shrineBoardLine,
  trialBest,
  type TrialResult,
} from '../../src/town/shrine-records';

const crypt = 'crypt-of-the-sword-king';
const vaultFloor = bossStop('sableye')!.floor;
const throneFloor = bossStop('aegislash')!.floor;
const result = (over: Partial<TrialResult> = {}): TrialResult => ({ kind: 'boss', id: 'aegislash', difficulty: 'normal', victory: true, ms: 90_000, noHit: false, captures: 2, ...over });
const allCleared = (): Records =>
  ['crypt-of-the-sword-king', 'misty-forest', 'flooded-caves', 'toxic-swamp'].reduce(
    (r, dungeon) => recordRun(r, { dungeon, floor: 9, level: 6, species: 'zorua', victory: true, difficulty: 'easy' }),
    EMPTY_RECORDS,
  );

describe('bosses beaten (from the dungeon records, no migration needed)', () => {
  it('knows none on empty records', () => {
    expect([...beatenBosses(EMPTY_RECORDS)]).toEqual([]);
  });

  it('counts a mid-boss once a run went past its floor, on any tier, and not when it only reached it', () => {
    const reached = recordRun(EMPTY_RECORDS, { dungeon: crypt, floor: vaultFloor, level: 3, species: 'zorua', victory: false, difficulty: 'hard' });
    expect(beatenBosses(reached).has('sableye')).toBe(false);
    const past = recordRun(reached, { dungeon: crypt, floor: vaultFloor + 1, level: 4, species: 'zorua', victory: false, difficulty: 'nightmare' });
    expect([...beatenBosses(past)]).toEqual(['sableye']);
  });

  it('counts a guardian only once its dungeon was cleared (losing on its floor is not enough)', () => {
    const lost = recordRun(EMPTY_RECORDS, { dungeon: crypt, floor: throneFloor, level: 5, species: 'zorua', victory: false });
    expect(beatenBosses(lost).has('aegislash')).toBe(false);
    const won = recordRun(lost, { dungeon: crypt, floor: throneFloor, level: 5, species: 'zorua', victory: true });
    expect([...beatenBosses(won)].sort()).toEqual(['aegislash', 'sableye']);
  });

  it('reads old records (before `cleared`, before tiers): a victory in the first dungeon beat its bosses', () => {
    const old = parseRecords(JSON.stringify({ runs: 2, victories: 1, dungeons: { [crypt]: { bestFloor: throneFloor } } }));
    expect([...beatenBosses(old)].sort()).toEqual(['aegislash', 'sableye']);
  });

  it('unlocks a gauntlet only when every boss of it was beaten', () => {
    const beaten = beatenBosses(allCleared());
    expect(beaten.size).toBe(8);
    expect(gauntletUnlocked('guardians', beaten)).toBe(true);
    expect(gauntletUnlocked('oaths', beaten)).toBe(true);
    const some = new Set([...beaten].filter((b) => b !== 'trevenant'));
    expect(gauntletUnlocked('guardians', some)).toBe(true);
    expect(gauntletUnlocked('oaths', some)).toBe(false);
    expect(gauntletUnlocked('guardians', new Set(['aegislash']))).toBe(false);
  });
});

describe('shrine records reducer', () => {
  it('keeps clears, best time, best captures and the no-hit flag per boss per tier', () => {
    const one = recordTrial(EMPTY_SHRINE, result({ ms: 90_000, captures: 2 }));
    expect(one.firstClear).toBe(true);
    const two = recordTrial(one.records, result({ ms: 70_000, captures: 1, noHit: true }));
    expect(two.firstClear).toBe(false);
    const three = recordTrial(two.records, result({ ms: 80_000, captures: 3 }));
    expect(trialBest(three.records, 'boss', 'aegislash', 'normal')).toEqual({ clears: 3, bestMs: 70_000, captures: 3, noHit: true });
    expect(trialBest(three.records, 'boss', 'aegislash', 'hard')).toBeNull();
    expect(trialBest(three.records, 'boss', 'sableye', 'normal')).toBeNull();
  });

  it('records nothing for a defeat and does not mutate its input', () => {
    const lost = recordTrial(EMPTY_SHRINE, result({ victory: false }));
    expect(lost).toEqual({ records: EMPTY_SHRINE, firstClear: false });
    const won = recordTrial(EMPTY_SHRINE, result());
    expect(EMPTY_SHRINE).toEqual({ bosses: {}, gauntlets: {} });
    expect(won.records).not.toBe(EMPTY_SHRINE);
  });

  it('keeps gauntlets apart from bosses, each tier on its own: the first clear per tier is first', () => {
    const a = recordTrial(EMPTY_SHRINE, result({ kind: 'gauntlet', id: 'guardians', difficulty: 'easy' }));
    const b = recordTrial(a.records, result({ kind: 'gauntlet', id: 'guardians', difficulty: 'hard' }));
    const c = recordTrial(b.records, result({ kind: 'gauntlet', id: 'guardians', difficulty: 'hard' }));
    expect([a.firstClear, b.firstClear, c.firstClear]).toEqual([true, true, false]);
    expect(trialBest(c.records, 'gauntlet', 'guardians', 'hard')?.clears).toBe(2);
    expect(trialBest(c.records, 'boss', 'guardians', 'hard')).toBeNull();
  });

  it('round-trips through the store and reads broken or hostile data as empty', () => {
    const store = memoryStore();
    expect(saveTrial(store, result({ noHit: true }))).toBe(true);
    expect(saveTrial(store, result({ kind: 'gauntlet', id: 'oaths', ms: 900_000 }))).toBe(true);
    expect(saveTrial(store, result())).toBe(false);
    const read = readShrine(store);
    expect(trialBest(read, 'boss', 'aegislash', 'normal')).toEqual({ clears: 2, bestMs: 90_000, captures: 2, noHit: true });
    expect(trialBest(read, 'gauntlet', 'oaths', 'normal')?.bestMs).toBe(900_000);
    expect(parseShrine(store.get(SHRINE_KEY))).toEqual(read);
    for (const raw of [null, '', '{', '[]', '"x"', JSON.stringify({ bosses: { aegislash: { normal: { clears: -1, bestMs: 'x', captures: 0 } }, 'BAD ID': { easy: { clears: 1, bestMs: 1, captures: 0 } } }, gauntlets: { nope: { easy: { clears: 1, bestMs: 1, captures: 0 } } } })])
      expect(parseShrine(raw)).toEqual(EMPTY_SHRINE);
    const broken = { get: () => { throw new Error('denied'); }, set: () => { throw new Error('denied'); }, remove: () => undefined };
    expect(readShrine(broken)).toEqual(EMPTY_SHRINE);
    expect(saveTrial(broken, result())).toBe(false);
  });

  it('keeps the species of the best time, and only of the best time', () => {
    const one = recordTrial(EMPTY_SHRINE, result({ ms: 90_000, species: 'zorua' }));
    expect(trialBest(one.records, 'boss', 'aegislash', 'normal')?.species).toBe('zorua');
    // Slower: the best stays Zorua's.
    const two = recordTrial(one.records, result({ ms: 95_000, species: 'cubone' }));
    expect(trialBest(two.records, 'boss', 'aegislash', 'normal')?.species).toBe('zorua');
    // Faster: the best is now Litwick's.
    const three = recordTrial(two.records, result({ ms: 60_000, species: 'litwick' }));
    expect(trialBest(three.records, 'boss', 'aegislash', 'normal')).toMatchObject({ bestMs: 60_000, species: 'litwick', clears: 3 });
    // A faster clear without a species (an older caller) leaves no stale species on the new best.
    const four = recordTrial(three.records, result({ ms: 50_000 }));
    expect(trialBest(four.records, 'boss', 'aegislash', 'normal')?.species).toBeUndefined();
  });

  it('keeps online room («En grupo») bests apart from solo ones, and round-trips them', () => {
    const solo = recordTrial(EMPTY_SHRINE, result({ ms: 90_000, species: 'zorua' }));
    const group = recordTrial(solo.records, result({ ms: 40_000, species: 'cubone', group: true }));
    expect(group.firstClear).toBe(true);
    expect(trialBest(group.records, 'boss', 'aegislash', 'normal')).toMatchObject({ bestMs: 90_000, species: 'zorua' });
    expect(trialBest(group.records, 'boss', 'aegislash', 'normal', true)).toMatchObject({ bestMs: 40_000, species: 'cubone', clears: 1 });
    const store = memoryStore();
    saveTrial(store, result({ ms: 40_000, group: true }));
    saveTrial(store, result({ kind: 'gauntlet', id: 'guardians', ms: 5, group: true }));
    const read = readShrine(store);
    expect(trialBest(read, 'boss', 'aegislash', 'normal')).toBeNull();
    expect(trialBest(read, 'boss', 'aegislash', 'normal', true)?.bestMs).toBe(40_000);
    expect(trialBest(read, 'gauntlet', 'guardians', 'normal', true)?.bestMs).toBe(5);
    expect(parseShrine(JSON.stringify({ bosses: {}, gauntlets: {}, group: 'x' }))).toEqual(EMPTY_SHRINE);
  });

  it('reads records with or without a species (back-compatible), and drops an unknown one', () => {
    const store = memoryStore();
    saveTrial(store, result({ species: 'cubone' }));
    expect(trialBest(readShrine(store), 'boss', 'aegislash', 'normal')?.species).toBe('cubone');
    const old = JSON.stringify({ bosses: { aegislash: { normal: { clears: 1, bestMs: 5, captures: 0 } } }, gauntlets: {} });
    expect(trialBest(parseShrine(old), 'boss', 'aegislash', 'normal')).toEqual({ clears: 1, bestMs: 5, captures: 0 });
    const hostile = JSON.stringify({ bosses: { aegislash: { normal: { clears: 1, bestMs: 5, captures: 0, species: 'arceus' } } }, gauntlets: {} });
    expect(trialBest(parseShrine(hostile), 'boss', 'aegislash', 'normal')).toEqual({ clears: 1, bestMs: 5, captures: 0 });
  });
});

describe('gauntlet rewards', () => {
  it('pays each gauntlet once per tier, more on harder tiers', () => {
    expect(gauntletReward('guardians', 'easy')).toBe(150);
    expect(gauntletReward('oaths', 'easy')).toBe(300);
    expect(gauntletReward('oaths', 'nightmare')).toBeGreaterThan(gauntletReward('oaths', 'hard'));
  });
});

describe('notice board line', () => {
  const tr = (key: string) => (key === 'shrine.board' ? 'S {open}/{total} {won}/{gauntlets}' : key);
  it('says nothing before any boss falls', () => {
    expect(shrineBoardLine(EMPTY_SHRINE, new Set(), tr)).toEqual([]);
  });
  it('counts reflections open and gauntlets beaten', () => {
    const won = recordTrial(EMPTY_SHRINE, result({ kind: 'gauntlet', id: 'guardians' })).records;
    const line = shrineBoardLine(won, beatenBosses(allCleared()), tr);
    expect(line).toEqual(['S 8/8 1/2']);
  });
});
