import { describe, expect, it } from 'vitest';
import { memoryStore, type KeyValueStore } from '../../src/adapters/storage';
import { addBackup, BACKUP_LIMIT, BACKUPS_KEY, backupProfile, exportText, findBackup, parseBackups, parseImport, readBackups } from '../../src/app/backups';
import { decodeCloud, encodeCloud, MAX_PAYLOAD_BYTES } from '../../src/app/cloud-payload';
import { EMPTY_PROFILE, isEmptyProfile, PROFILE_KEYS, profileHash, profileSummary, readProfile, sameProfile, writeProfile, type Profile } from '../../src/app/profile';
import { mergeAchievements, mergeBestiary, mergeBoard, mergeProfiles, mergeRecords, mergeShrine, SAVE_FIELD_RULES } from '../../src/app/profile-merge';
import { EMPTY_SAVE, SAVE_KEY, SAVE_VERSION, type SaveData } from '../../src/app/save';
import { BESTIARY_KEY, BESTIARY_SIZE } from '../../src/town/bestiary';
import { LEADERBOARD_KEY, LEADERBOARD_SIZE, type ScoreEntry } from '../../src/town/leaderboard';
import { EMPTY_RECORDS, RECORDS_KEY, type Records } from '../../src/town/records';
import { EMPTY_SHRINE, SHRINE_KEY, type ShrineRecords } from '../../src/town/shrine-records';

const save = (patch: Partial<SaveData> = {}): SaveData => ({ ...EMPTY_SAVE, ...patch });
const score = (floor: number, patch: Partial<ScoreEntry> = {}): ScoreEntry => ({ floor, clockMs: 1000, mode: 'free', date: '2026-10-01', seed: floor, species: 'mimikyu', level: 5, ...patch });
const records = (patch: Partial<Records> = {}): Records => ({ ...EMPTY_RECORDS, ...patch });

function sampleProfile(): Profile {
  return {
    save: save({ coins: 500, owned: ['kadabra'], achievements: { 'gacha-first-pull': '2026-10-02' }, earned: 900, pity: 3 }),
    records: records({ runs: 12, victories: 4, bestLevel: 9, lastSpecies: 'mimikyu', dungeons: { 'crypt-of-the-sword-king': { bestFloor: 4, cleared: true, tiers: { easy: { bestFloor: 4, clears: 3 } } } } }),
    shrine: { bosses: { aegislash: { easy: { clears: 2, bestMs: 90_000, captures: 3 } } }, gauntlets: {} },
    board: [score(7), score(3, { difficulty: 'hard' })],
    bestiary: [{ seed: 11, name: 'Umbra' }],
  };
}

describe('profile', () => {
  it('holds every local progress store, and only those', () => {
    expect([...PROFILE_KEYS].sort()).toEqual([BESTIARY_KEY, LEADERBOARD_KEY, RECORDS_KEY, SAVE_KEY, SHRINE_KEY].sort());
  });

  it('writes and reads back every part', () => {
    const store = memoryStore();
    writeProfile(store, sampleProfile());
    expect(sameProfile(readProfile(store), sampleProfile())).toBe(true);
    for (const key of PROFILE_KEYS) expect(store.get(key)).not.toBeNull();
  });

  it('an empty store is the empty profile; any progress is not', () => {
    expect(isEmptyProfile(readProfile(memoryStore()))).toBe(true);
    expect(isEmptyProfile({ ...EMPTY_PROFILE, bestiary: [{ seed: 1, name: 'x' }] })).toBe(false);
    expect(isEmptyProfile({ ...EMPTY_PROFILE, records: records({ runs: 1 }) })).toBe(false);
  });

  it('hash: same progress same hash, any change a different one', () => {
    const a = sampleProfile();
    expect(profileHash(a)).toBe(profileHash(sampleProfile()));
    expect(profileHash({ ...a, save: { ...a.save, coins: 501 } })).not.toBe(profileHash(a));
    expect(profileHash({ ...a, bestiary: [] })).not.toBe(profileHash(a));
  });

  it('a failing store reads empty and writes nothing without throwing', () => {
    const broken: KeyValueStore = {
      get: () => {
        throw new Error('x');
      },
      set: () => {
        throw new Error('quota');
      },
    };
    expect(isEmptyProfile(readProfile(broken))).toBe(true);
    expect(() => writeProfile(broken, sampleProfile())).not.toThrow();
  });

  it('summarizes coins, Pokémon, achievements and the best records', () => {
    expect(profileSummary(sampleProfile(), 42)).toEqual({ coins: 500, owned: 1, achievements: 1, bestFloor: 4, bestSima: 7, savedAt: 42 });
  });
});

describe('cloud payload', () => {
  it('keeps the server rules: an object with a top-level version and whole coins', () => {
    const data = encodeCloud(sampleProfile(), { savedAt: 1000, device: 'Firefox' });
    expect(data.version).toBe(SAVE_VERSION);
    expect(data.coins).toBe(500);
    expect(Number.isInteger(data.coins)).toBe(true);
    expect(data.profile?.meta).toEqual({ savedAt: 1000, device: 'Firefox' });
  });

  it('round-trips the whole profile', () => {
    const { profile, meta } = decodeCloud(JSON.parse(JSON.stringify(encodeCloud(sampleProfile(), { savedAt: 7 }))));
    expect(sameProfile(profile, sampleProfile())).toBe(true);
    expect(meta).toEqual({ savedAt: 7 });
  });

  it('a payload from before profiles (a bare save) reads with empty records', () => {
    const { profile, meta } = decodeCloud({ version: 3, coins: 40, upgrades: {} });
    expect(profile.save.coins).toBe(40);
    expect(profile.records).toEqual(EMPTY_RECORDS);
    expect(meta).toBeNull();
  });

  it('hostile data reads as empty parts', () => {
    expect(isEmptyProfile(decodeCloud(null).profile)).toBe(true);
    const { profile } = decodeCloud({ version: 4, coins: -5, profile: { records: 'x', shrine: [1], board: {}, bestiary: [{ seed: 'a' }], meta: { savedAt: -1 } } });
    expect(isEmptyProfile(profile)).toBe(true);
  });

  it('stays under the size cap: the oldest heralds go first', () => {
    const many: Profile = { ...sampleProfile(), bestiary: Array.from({ length: BESTIARY_SIZE }, (_, i) => ({ seed: i, name: 'H'.repeat(40) })) };
    const data = encodeCloud(many, { savedAt: 1 }, 8000);
    expect(new TextEncoder().encode(JSON.stringify(data)).length).toBeLessThanOrEqual(8000);
    const kept = decodeCloud(data).profile.bestiary;
    expect(kept.length).toBeLessThan(BESTIARY_SIZE);
    expect(kept.at(-1)?.seed).toBe(BESTIARY_SIZE - 1);
  });

  it('the largest bestiary with the longest names fits the real cap untrimmed', () => {
    const p: Profile = { ...sampleProfile(), bestiary: Array.from({ length: BESTIARY_SIZE }, (_, i) => ({ seed: -(2 ** 31) + i, name: 'H'.repeat(40) })) };
    const data = encodeCloud(p, { savedAt: 1 });
    expect(new TextEncoder().encode(JSON.stringify(data)).length).toBeLessThanOrEqual(MAX_PAYLOAD_BYTES);
    expect(decodeCloud(data).profile.bestiary).toHaveLength(BESTIARY_SIZE);
  });
});

describe('merge rules', () => {
  it('every save field is classified, and only achievements merge', () => {
    const merged = Object.entries(SAVE_FIELD_RULES).filter(([, rule]) => rule === 'merged').map(([k]) => k);
    expect(merged).toEqual(['achievements']);
    expect(SAVE_FIELD_RULES.coins).toBe('economy');
  });

  it('economy comes whole from the kept side', () => {
    const device: Profile = { ...EMPTY_PROFILE, save: save({ coins: 10, owned: ['kadabra'], pity: 2, upgrades: { hp: 1 } as SaveData['upgrades'], missions: { accepted: [], claimed: [] } }) };
    const cloud: Profile = { ...EMPTY_PROFILE, save: save({ coins: 999, pity: 7, earned: 2000 }) };
    const kept = mergeProfiles(cloud, device);
    expect(kept.save.coins).toBe(999);
    expect(kept.save.owned).toBeUndefined();
    expect(kept.save.pity).toBe(7);
    expect(kept.save.earned).toBe(2000);
    expect(mergeProfiles(device, cloud).save.coins).toBe(10);
  });

  it('achievements: union with the earliest day, no Pokémonedas paid', () => {
    expect(mergeAchievements({ a: '2026-10-05', b: '2026-10-01' }, { a: '2026-10-03', c: '2026-10-09' })).toEqual({ a: '2026-10-03', b: '2026-10-01', c: '2026-10-09' });
    const kept: Profile = { ...EMPTY_PROFILE, save: save({ coins: 100 }) };
    const other: Profile = { ...EMPTY_PROFILE, save: save({ coins: 300, achievements: { 'gacha-first-pull': '2026-10-02' } }) };
    const merged = mergeProfiles(kept, other);
    expect(merged.save.achievements).toEqual({ 'gacha-first-pull': '2026-10-02' });
    expect(merged.save.coins).toBe(100);
    expect(merged.save.earned).toBeUndefined();
  });

  it('records: per dungeon and tier the max; counts are not added', () => {
    const a = records({ runs: 10, victories: 2, bestLevel: 5, lastSpecies: 'mimikyu', dungeons: { d1: { bestFloor: 3, tiers: { easy: { bestFloor: 3, clears: 1 }, hard: { bestFloor: 1, clears: 0 } } } } });
    const b = records({ runs: 4, victories: 3, bestLevel: 8, lastSpecies: 'zorua', dungeons: { d1: { bestFloor: 5, cleared: true }, d2: { bestFloor: 2 } } });
    expect(mergeRecords(a, b)).toEqual({
      runs: 10,
      victories: 3,
      bestLevel: 8,
      lastSpecies: 'mimikyu',
      dungeons: {
        // b's d1 is from before tiers: it counts as easy.
        d1: { bestFloor: 5, cleared: true, tiers: { easy: { bestFloor: 5, clears: 1 }, hard: { bestFloor: 1, clears: 0 } } },
        d2: { bestFloor: 2 },
      },
    });
  });

  it('shrine: best time with its species, most clears and captures, no-hit if either; group apart', () => {
    const a: ShrineRecords = { bosses: { aegislash: { easy: { clears: 1, bestMs: 50_000, captures: 1, species: 'mimikyu' } } }, gauntlets: {} };
    const b: ShrineRecords = {
      bosses: { aegislash: { easy: { clears: 4, bestMs: 40_000, captures: 0, noHit: true, species: 'zorua' } }, sableye: { hard: { clears: 1, bestMs: 9, captures: 2 } } },
      gauntlets: {},
      group: { bosses: {}, gauntlets: { guardians: { easy: { clears: 1, bestMs: 5, captures: 0 } } } },
    };
    const m = mergeShrine(a, b);
    expect(m.bosses.aegislash?.easy).toEqual({ clears: 4, bestMs: 40_000, captures: 1, noHit: true, species: 'zorua' });
    expect(m.bosses.sableye?.hard?.clears).toBe(1);
    expect(m.group?.gauntlets.guardians?.easy?.clears).toBe(1);
    expect(mergeShrine(EMPTY_SHRINE, EMPTY_SHRINE)).toEqual(EMPTY_SHRINE);
  });

  it('leaderboard: one copy of a shared score, top ten per tier', () => {
    const a = Array.from({ length: 8 }, (_, i) => score(i + 1));
    const b = [score(20), score(1), score(4, { difficulty: 'hard' }), ...Array.from({ length: 5 }, (_, i) => score(30 + i))];
    const m = mergeBoard(a, b);
    const easy = m.filter((e) => !e.difficulty);
    expect(easy).toHaveLength(LEADERBOARD_SIZE);
    expect(easy[0]!.floor).toBe(34);
    expect(new Set(easy.map((e) => e.floor)).size).toBe(easy.length);
    expect(m.filter((e) => e.difficulty === 'hard')).toHaveLength(1);
  });

  it('bestiary: union by seed, the newest kept', () => {
    expect(mergeBestiary([{ seed: 1, name: 'a' }], [{ seed: 1, name: 'z' }, { seed: 2, name: 'b' }])).toEqual([
      { seed: 1, name: 'a' },
      { seed: 2, name: 'b' },
    ]);
    const full = Array.from({ length: BESTIARY_SIZE }, (_, i) => ({ seed: i, name: 'h' }));
    expect(mergeBestiary(full, [{ seed: -1, name: 'new' }]).at(-1)).toEqual({ seed: -1, name: 'new' });
  });

  it('is the same whichever side is kept for everything but the economy', () => {
    const a = sampleProfile();
    const b: Profile = { save: save({ coins: 3, achievements: { 'coop-clear': '2026-10-04' } }), records: records({ runs: 30, dungeons: { d9: { bestFloor: 1 } } }), shrine: EMPTY_SHRINE, board: [score(50)], bestiary: [{ seed: 99, name: 'Nox' }] };
    const ab = mergeProfiles(a, b);
    const ba = mergeProfiles(b, a);
    expect(ab.save.achievements).toEqual(ba.save.achievements);
    expect(ab.shrine).toEqual(ba.shrine);
    expect(ab.board).toEqual(ba.board);
    expect(new Set(ab.bestiary.map((e) => e.seed))).toEqual(new Set(ba.bestiary.map((e) => e.seed)));
    expect(ab.records.dungeons).toEqual(ba.records.dungeons);
    // Merging is idempotent.
    expect(sameProfile(mergeProfiles(ab, b), ab)).toBe(true);
  });
});

describe('backups ring', () => {
  const p = (coins: number): Profile => ({ ...EMPTY_PROFILE, save: save({ coins }) });

  it('keeps the last three, newest first', () => {
    const store = memoryStore();
    for (const coins of [1, 2, 3, 4]) addBackup(store, p(coins), 'pull', coins * 1000);
    const ring = readBackups(store);
    expect(ring).toHaveLength(BACKUP_LIMIT);
    expect(ring.map((b) => backupProfile(b).save.coins)).toEqual([4, 3, 2]);
    expect(ring.map((b) => b.at)).toEqual([4000, 3000, 2000]);
  });

  it('skips an empty profile and one equal to the newest backup', () => {
    const store = memoryStore();
    expect(addBackup(store, EMPTY_PROFILE, 'pull', 1)).toBeNull();
    const id = addBackup(store, p(5), 'pull', 2);
    expect(addBackup(store, p(5), 'choice', 3)).toBe(id);
    expect(readBackups(store)).toHaveLength(1);
  });

  it('finds one by id with its whole profile', () => {
    const store = memoryStore();
    const id = addBackup(store, sampleProfile(), 'download', 5)!;
    expect(sameProfile(backupProfile(findBackup(store, id)!), sampleProfile())).toBe(true);
    expect(findBackup(store, 'nope')).toBeNull();
  });

  it('a full store drops older backups until it fits', () => {
    const inner = memoryStore();
    const limited: KeyValueStore = {
      get: (k) => inner.get(k),
      set(k, v) {
        if (k === BACKUPS_KEY && v.length > 900) throw new Error('quota');
        inner.set(k, v);
      },
    };
    addBackup(limited, p(1), 'pull', 1);
    addBackup(limited, p(2), 'pull', 2);
    expect(addBackup(limited, p(3), 'pull', 3)).not.toBeNull();
    expect(backupProfile(readBackups(limited)[0]!).save.coins).toBe(3);
  });

  it('broken or hostile stored backups read as none', () => {
    expect(parseBackups('nope')).toEqual([]);
    expect(parseBackups(JSON.stringify([{ id: 'x y', at: 1, reason: 'pull', data: {} }, { id: 'ok', at: 1, reason: 'evil', data: {} }]))).toEqual([]);
  });

  it('exports to a file and imports it back; junk is refused', () => {
    const text = exportText(sampleProfile(), 9);
    expect(sameProfile(parseImport(text)!, sampleProfile())).toBe(true);
    expect(sameProfile(parseImport(JSON.stringify(encodeCloud(sampleProfile(), { savedAt: 1 })))!, sampleProfile())).toBe(true);
    expect(parseImport('{not json')).toBeNull();
    expect(parseImport('{"kind":"other"}')).toBeNull();
    expect(parseImport(exportText(EMPTY_PROFILE, 1))).toBeNull();
  });
});
