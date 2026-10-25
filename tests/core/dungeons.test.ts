import { describe, expect, it } from 'vitest';
import { CRYPT_SPAWNS, RUN_PLAN, URGENT, type SpawnTuning } from '../../src/data/dungeon';
import { CRYPT, DUNGEONS, dungeonById, guardianOf, musicFor, type DungeonDef } from '../../src/data/dungeons';
import { generateFloor, spawnsPerRoom } from '../../src/core/dungeon';
import { dungeonChoices, isUnlocked, needsDungeonSelect, unlockedDungeons } from '../../src/core/dungeon-select';
import { deriveSeed, nextRandom } from '../../src/core/rng';
import { floorKind, floorPlanOf, isBossFloor, startRun } from '../../src/core/run';
import { floorMusic } from '../../src/adapters/audio';


describe('the Crypt as a DungeonDef', () => {
  it('runs the remastered plan: 1-2 generated, Sableye on 3, 4-5 generated, Aegislash on 6, collapse kept', () => {
    expect(CRYPT.plan).toBe(RUN_PLAN);
    expect(CRYPT.plan.map((p) => (p.kind === 'room' ? `${p.room}${p.role ? `:${p.role}` : ''}` : 'generated'))).toEqual([
      'generated',
      'generated',
      'vault:midboss',
      'generated',
      'generated',
      'boss',
    ]);
    expect(CRYPT.urgent).toEqual([{ kind: 'collapse', chance: URGENT.collapseChance }]);
    expect(CRYPT.spawns).toBe(CRYPT_SPAWNS);
    expect(guardianOf(CRYPT)).toBe('aegislash');
    expect(DUNGEONS[0]).toBe(CRYPT);
  });

  // Meaningful encounters (2026-10-25) deliberately changed floor 1: it no longer generates like the M2 table, but it stays the gentle entry.
  it('keeps floor 1 a gentle entry: only Poochyena and Gastly, at most two per room, a breather now and then', () => {
    let rest = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const floor = generateFloor(seed, 1, CRYPT.spawns);
      expect(floor.spawns.filter((s) => s.species !== 'poochyena' && s.species !== 'gastly')).toEqual([]);
      const rooms = floor.rooms.map((_, i) => floor.spawns.filter((s) => s.room === i).length);
      expect(Math.max(...rooms)).toBeLessThanOrEqual(2);
      rest += rooms.filter((n, i) => n === 0 && i !== floor.startRoom).length;
    }
    expect(rest).toBeGreaterThan(0);
  });

  it('ramps: deeper Crypt floors hold more enemies than floor 1', () => {
    const average = (depth: number) => [...Array(60).keys()].reduce((sum, seed) => sum + generateFloor(seed + 1, depth).spawns.length, 0) / 60;
    expect(average(2)).toBeGreaterThan(average(1));
    expect(average(5)).toBeGreaterThan(average(2));
  });

  it('generates the same floors with and without the explicit dungeon table', () => {
    for (let seed = 1; seed <= 60; seed++) {
      for (const depth of [1, 2, 3]) expect(generateFloor(seed, depth, CRYPT.spawns)).toEqual(generateFloor(seed, depth));
    }
  });

  it('rolls collapse floors exactly like the M2 formula (one draw against the depth chance)', () => {
    const SALT = 0x51ab;
    for (let seed = 1; seed <= 400; seed++) {
      for (const floor of [1, 2, 3, 4, 5, 6]) {
        const chance = RUN_PLAN[floor - 1]!.kind === 'generated' ? (URGENT.collapseChance[Math.min(floor, 5) - 1] ?? 0) : 0;
        const legacy = nextRandom(deriveSeed(seed, floor + SALT)).value < chance ? 'collapse' : 'normal';
        expect(floorKind(seed, floor, CRYPT)).toBe(legacy);
        expect(floorKind(seed, floor)).toBe(legacy);
      }
    }
  });

  it('starts runs in the Crypt by default and maps unknown ids to it', () => {
    expect(startRun(5, {}).run.dungeon).toBe('crypt-of-the-sword-king');
    expect(dungeonById('nope')).toBe(CRYPT);
    expect(dungeonById(undefined)).toBe(CRYPT);
    expect(dungeonById('__proto__')).toBe(CRYPT);
  });

  it('plays the crypt loop on its floors, the battle theme for Sableye and Aegislash', () => {
    const run = startRun(5, {}).run;
    for (const floor of [1, 2, 3, 4, 5, 6]) {
      const at = { ...run, floor };
      const fixed = floorPlanOf(at).kind === 'room';
      for (const kind of ['normal', 'collapse'] as const) expect(musicFor(CRYPT, floorPlanOf(at), kind)).toBe(floorMusic(fixed || isBossFloor(at), kind));
    }
  });
});

describe('dungeon spawn tables', () => {
  const tuning: SpawnTuning = {
    base: 1,
    perDepth: 0.5,
    jitter: 1,
    maxPerRoom: 4,
    pool: [
      { species: 'gastly', weights: [0, 1] },
      { species: 'poochyena', weights: [1], pack: 3 },
    ],
  };

  it('ramps the count by the rounded-down per-depth step', () => {
    expect([1, 2, 3, 4, 5, 9].map((d) => spawnsPerRoom(d, tuning))).toEqual([
      { min: 1, max: 2 },
      { min: 1, max: 2 },
      { min: 2, max: 3 },
      { min: 2, max: 3 },
      { min: 3, max: 4 },
      { min: 4, max: 4 },
    ]);
    expect(spawnsPerRoom(2, CRYPT_SPAWNS)).toEqual(spawnsPerRoom(2));
  });

  it('never spawns a species whose weight is zero at that depth', () => {
    for (let seed = 1; seed <= 60; seed++) expect(generateFloor(seed, 1, tuning).spawns.every((s) => s.species === 'poochyena')).toBe(true);
  });

  it('places a pack as one pick: a room holds the pack before another draw', () => {
    // With packs of 3 and at most 4 per room, a room never holds two gastly unless a whole pack came first.
    let sawPack = false;
    for (let seed = 1; seed <= 200; seed++) {
      const floor = generateFloor(seed, 5, tuning);
      for (let room = 0; room < floor.rooms.length; room++) {
        const here = floor.spawns.filter((s) => s.room === room).map((s) => s.species);
        const first = here.indexOf('poochyena');
        if (first >= 0) {
          const run = here.slice(first, first + 3);
          expect(run.every((s) => s === 'poochyena')).toBe(true);
          if (run.length === 3) sawPack = true;
        }
      }
    }
    expect(sawPack).toBe(true);
  });
});

describe('dungeon unlocks', () => {
  const first = CRYPT;
  const second = { ...CRYPT, id: 'second', unlockedBy: 'crypt-of-the-sword-king' } as unknown as DungeonDef;
  const third = { ...CRYPT, id: 'third', unlockedBy: 'second' } as unknown as DungeonDef;
  const all = [first, second, third];

  it('opens the first dungeon from the start and each next one when the one it names is cleared', () => {
    expect(isUnlocked(first, new Set())).toBe(true);
    expect(unlockedDungeons(new Set(), all).map((d) => d.id)).toEqual(['crypt-of-the-sword-king']);
    expect(unlockedDungeons(new Set(['crypt-of-the-sword-king']), all).map((d) => d.id)).toEqual(['crypt-of-the-sword-king', 'second']);
    expect(unlockedDungeons(new Set(['second']), all).map((d) => d.id)).toEqual(['crypt-of-the-sword-king', 'third']);
    expect(dungeonChoices(new Set(), all).map((c) => c.unlocked)).toEqual([true, false, false]);
  });

  it('only asks for a dungeon when more than one is open', () => {
    expect(needsDungeonSelect(new Set(), all)).toBe(false);
    expect(needsDungeonSelect(new Set(['crypt-of-the-sword-king']), all)).toBe(true);
  });
});

describe('guardian of a dungeon (end screen text)', () => {
  it('is the species in the last arena: Aegislash for the Crypt, Decidueye for the forest', () => {
    expect(guardianOf(CRYPT)).toBe('aegislash');
    expect(guardianOf(dungeonById('misty-forest'))).toBe('decidueye');
  });
});
