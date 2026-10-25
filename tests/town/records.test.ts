import { describe, expect, it } from 'vitest';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { boardLines, clearedDungeons, EMPTY_RECORDS, parseRecords, readRecords, recordRun, RECORDS_KEY, saveRun, type RunRecord } from '../../src/town/records';

const crypt = 'crypt-of-the-sword-king';
const run = (over: Partial<RunRecord> = {}): RunRecord => ({ dungeon: crypt, floor: 2, level: 4, species: 'zorua', victory: false, ...over });

describe('run records reducer', () => {
  it('counts the first run from empty records', () => {
    expect(recordRun(EMPTY_RECORDS, run())).toEqual({ runs: 1, victories: 0, bestLevel: 4, lastSpecies: 'zorua', dungeons: { [crypt]: { bestFloor: 2 } } });
  });

  it('keeps the best floor and level, counts victories and remembers the last species', () => {
    const after = [run({ floor: 3, level: 6 }), run({ floor: 4, level: 5, victory: true, species: 'cubone' }), run({ floor: 1, level: 2, species: 'litwick' })].reduce(recordRun, EMPTY_RECORDS);
    expect(after).toEqual({ runs: 3, victories: 1, bestLevel: 6, lastSpecies: 'litwick', dungeons: { [crypt]: { bestFloor: 4, cleared: true } } });
  });

  it('tracks each dungeon on its own and does not mutate its input', () => {
    const one = recordRun(EMPTY_RECORDS, run({ floor: 3 }));
    const two = recordRun(one, run({ dungeon: 'other-dungeon', floor: 1 }));
    expect(one.dungeons).toEqual({ [crypt]: { bestFloor: 3 } });
    expect(two.dungeons).toEqual({ [crypt]: { bestFloor: 3 }, 'other-dungeon': { bestFloor: 1 } });
  });
});

describe('records storage', () => {
  it('round-trips through the store under the game namespace', () => {
    const store = memoryStore();
    saveRun(store, run({ floor: 3, victory: true }));
    saveRun(store, run({ floor: 2 }));
    expect(RECORDS_KEY.startsWith('mazmorra-sombria.')).toBe(true);
    expect(readRecords(store)).toEqual({ runs: 2, victories: 1, bestLevel: 4, lastSpecies: 'zorua', dungeons: { [crypt]: { bestFloor: 3, cleared: true } } });
  });

  it('treats missing, broken or hostile values as empty records', () => {
    for (const raw of [null, 'not json', '[1,2]', '{"runs":-3,"victories":"9","bestLevel":2.5,"lastSpecies":"<b>x</b>","dungeons":[]}']) {
      expect(parseRecords(raw)).toEqual(EMPTY_RECORDS);
    }
    expect(parseRecords('{"runs":2,"dungeons":{"__proto__":{"bestFloor":9},"crypt-of-the-sword-king":{"bestFloor":"3"},"ok":{"bestFloor":2}}}')).toEqual({ ...EMPTY_RECORDS, runs: 2, dungeons: { ok: { bestFloor: 2 } } });
  });

  it('never throws when the store fails', () => {
    const broken: KeyValueStore = {
      get: () => {
        throw new Error('denied');
      },
      set: () => {
        throw new Error('quota');
      },
    };
    expect(() => saveRun(broken, run())).not.toThrow();
    expect(readRecords(broken)).toEqual(EMPTY_RECORDS);
  });
});

describe('notice board lines', () => {
  const tr = (key: string) => `[${key}]`;

  it('says there are no records before the first run', () => {
    expect(boardLines(EMPTY_RECORDS, crypt, tr)).toEqual(['[town.board.title]', '[town.board.none]']);
  });

  it('shows best floor in the dungeon, runs, victories and best level', () => {
    const records = recordRun(EMPTY_RECORDS, run({ floor: 3, level: 7, victory: true }));
    const t = (key: string) => ({ 'town.board.title': 'Records:', 'town.board.best': 'Best floor: {floor}', 'town.board.runs': 'Runs: {runs}', 'town.board.victories': 'Wins: {wins}', 'town.board.level': 'Best level: {level}' })[key] ?? key;
    expect(boardLines(records, crypt, t)).toEqual(['Records: Best floor: 3 · Runs: 1 · Wins: 1 · Best level: 7']);
    expect(boardLines(records, 'other-dungeon', t)).toEqual(['Records: Best floor: - · Runs: 1 · Wins: 1 · Best level: 7']);
  });
});

describe('cleared dungeons', () => {
  it('marks a dungeon cleared on a victory and keeps it cleared after later defeats', () => {
    const after = [run({ floor: 4, victory: true }), run({ floor: 2 }), run({ dungeon: 'other-dungeon', floor: 3 })].reduce(recordRun, EMPTY_RECORDS);
    expect(after.dungeons[crypt]).toEqual({ bestFloor: 4, cleared: true });
    expect(after.dungeons['other-dungeon']).toEqual({ bestFloor: 3 });
    expect([...clearedDungeons(after)]).toEqual([crypt]);
  });

  it('reads `cleared` back only when it is exactly true', () => {
    const raw = '{"runs":3,"victories":1,"dungeons":{"crypt-of-the-sword-king":{"bestFloor":4,"cleared":true},"other":{"bestFloor":2,"cleared":"yes"}}}';
    expect(parseRecords(raw).dungeons).toEqual({ [crypt]: { bestFloor: 4, cleared: true }, other: { bestFloor: 2 } });
  });

  it('counts an old victory (records without any cleared flag) as clearing the first dungeon', () => {
    const legacy = parseRecords('{"runs":2,"victories":1,"dungeons":{"crypt-of-the-sword-king":{"bestFloor":4}}}');
    expect([...clearedDungeons(legacy)]).toEqual([crypt]);
    expect([...clearedDungeons(parseRecords('{"runs":2,"victories":0,"dungeons":{"crypt-of-the-sword-king":{"bestFloor":4}}}'))]).toEqual([]);
    expect([...clearedDungeons(EMPTY_RECORDS)]).toEqual([]);
  });
});

describe('board lines for later dungeons', () => {
  it('adds a best floor line for each other dungeon once a run went there', () => {
    const tr = (key: string) => ({ 'town.board.title': 'Records:', 'town.board.best': 'Best floor: {floor}', 'town.board.bestIn': 'Best in {dungeon}: {floor}', 'town.board.runs': 'Runs: {runs}', 'town.board.victories': 'Wins: {wins}', 'town.board.level': 'Best level: {level}' })[key] ?? key;
    const records = [run({ floor: 4, victory: true }), run({ dungeon: 'misty-forest', floor: 3 })].reduce(recordRun, EMPTY_RECORDS);
    const others = [{ id: 'misty-forest', name: 'Forest' }];
    expect(boardLines(records, crypt, tr, others)).toEqual(['Records: Best floor: 4 · Best in Forest: 3 · Runs: 2 · Wins: 1 · Best level: 4']);
    expect(boardLines(recordRun(EMPTY_RECORDS, run()), crypt, tr, others)).toEqual(['Records: Best floor: 2 · Runs: 1 · Wins: 0 · Best level: 4']);
  });
});
