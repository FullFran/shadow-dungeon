import { describe, expect, it } from 'vitest';
import { dungeonById, DUNGEONS, ECLIPSE, planAt, type DungeonId } from '../../src/data/dungeons';
import { ENDLESS_POOL } from '../../src/data/endless';
import { roleOf, SPECIES_ROLE, threatOf } from '../../src/data/encounters';
import { EVOLUTIONS, isEvolved, lineRoot } from '../../src/data/evolutions';
import { SIMA_BANDS } from '../../src/data/sima';
import { weightAt, type Floor, type FloorSpawn } from '../../src/core/dungeon';
import { generatedFloor } from '../../src/core/floor-spawns';
import { assignLeaders } from '../../src/core/leaders';
import { deriveSeed } from '../../src/core/rng';

/** The generated floors of a fixed dungeon, in order. */
const generatedFloors = (id: DungeonId): number[] => {
  const def = dungeonById(id);
  return def.plan.flatMap((p, i) => (p.kind === 'generated' ? [i + 1] : []));
};

/** The Sima stratum of each home dungeon (the Sima's own species: the Forest stratum, after Houndour's first floors). */
const HOME_BAND: Readonly<Partial<Record<DungeonId, string>>> = {
  'crypt-of-the-sword-king': 'crypt',
  'misty-forest': 'forest',
  'flooded-caves': 'caves',
  'toxic-swamp': 'swamp',
  'eclipse-chasm': 'forest',
};

describe('evolved forms: roles and threat', () => {
  for (const { species, from } of EVOLUTIONS) {
    it(`${species}: has a role and costs more threat than ${from} (it replaces basics in the budget)`, () => {
      expect(SPECIES_ROLE[species], species).toBeDefined();
      expect(threatOf(species)).toBeGreaterThanOrEqual(threatOf(from));
      expect(threatOf(species)).toBeGreaterThan(threatOf(lineRoot(species)));
    });
  }
  it('base forms keep their role costs', () => {
    expect(threatOf('poochyena')).toBe(2);
    expect(threatOf('gastly')).toBe(3);
    expect(threatOf('zubat')).toBe(1);
  });
});

describe('evolved forms: where they walk', () => {
  for (const { species, home } of EVOLUTIONS.filter((e) => e.home !== 'eclipse-chasm')) {
    it(`${species}: only in ${home}, never in the first half of its generated floors, present in the second`, () => {
      for (const def of DUNGEONS.filter((d) => !d.endless && d.id !== home)) expect(def.spawns.pool.some((e) => e.species === species || e.escort?.species === species), `${species} in ${def.id}`).toBe(false);
      const floors = generatedFloors(home);
      const half = Math.ceil(floors.length / 2);
      const entry = dungeonById(home).spawns.pool.find((e) => e.species === species);
      expect(entry, species).toBeDefined();
      for (const floor of floors.slice(0, floors.length - half)) expect(weightAt(entry!, floor), `${species} floor ${floor}`).toBe(0);
      expect(floors.slice(floors.length - half).some((f) => weightAt(entry!, f) > 0)).toBe(true);
    });
  }

  for (const { species, home } of EVOLUTIONS) {
    it(`${species}: in the Sima from the late floors of its stratum`, () => {
      const entry = ENDLESS_POOL.find((e) => e.species === species);
      expect(entry, species).toBeDefined();
      const band = SIMA_BANDS.find((b) => b.id === HOME_BAND[home])!;
      expect(entry!.minDepth).toBeGreaterThanOrEqual(band.fromFloor + 5);
      expect(entry!.minDepth).toBeLessThanOrEqual(band.fromFloor + 8);
      expect(entry!.pack ?? 1).toBe(1);
    });
  }

  it('deep floors of every dungeon field evolutions, shallow ones never do', () => {
    for (const def of DUNGEONS.filter((d) => !d.endless)) {
      const floors = generatedFloors(def.id);
      const shallow = floors.slice(0, floors.length - Math.ceil(floors.length / 2));
      let deep = 0;
      for (let seed = 1; seed <= 30; seed++) {
        for (const floor of floors) {
          const spawned = generatedFloor(def, floor, deriveSeed(seed, floor), 'normal').spawns.filter((s) => isEvolved(s.species)).length;
          if (shallow.includes(floor)) expect(spawned, `${def.id} floor ${floor}`).toBe(0);
          else deep += spawned;
        }
      }
      expect(deep, def.id).toBeGreaterThan(0);
    }
    // The Sima: none before floor 6, some on its late Crypt floors.
    let sima = 0;
    for (let seed = 1; seed <= 30; seed++) {
      for (let floor = 1; floor <= 5; floor++) expect(generatedFloor(ECLIPSE, floor, deriveSeed(seed, floor), 'normal').spawns.some((s) => isEvolved(s.species))).toBe(false);
      for (let floor = 6; floor <= 9; floor++) if (planAt(ECLIPSE, floor)?.kind === 'generated') sima += generatedFloor(ECLIPSE, floor, deriveSeed(seed, floor), 'normal').spawns.filter((s) => isEvolved(s.species)).length;
    }
    expect(sima).toBeGreaterThan(0);
  });
});

describe('evolved forms: they lead their line', () => {
  it('some deep pools bring an evolution with its base form at its side (a mixed pack)', () => {
    const escorted = DUNGEONS.flatMap((d) => d.spawns.pool).filter((e) => isEvolved(e.species) && e.escort && lineRoot(e.species) === lineRoot(e.escort.species));
    expect(escorted.map((e) => e.species).sort()).toEqual(['bisharp', 'gengar', 'golbat', 'mightyena', 'morgrem', 'skuntank']);
  });

  it('a crowned group with an evolution and its base forms is led by the evolution (the highest threat)', () => {
    const tile = { x: 1, y: 1 };
    const spawns: FloorSpawn[] = [
      { species: 'poochyena', tile, room: 1 },
      { species: 'mightyena', tile, room: 1 },
      { species: 'poochyena', tile, room: 1 },
    ];
    const floor = { spawns } as unknown as Floor;
    const crowned = assignLeaders(floor, 1, 5, { fromFloor: 1, start: 1, perFloor: 0, max: 1 });
    expect(crowned.spawns.filter((s) => s.leader).map((s) => s.species)).toEqual(['mightyena']);
    expect(roleOf('mightyena')).toBe(roleOf('poochyena'));
  });
});
