import { describe, expect, it } from 'vitest';
import type { SpawnEntry } from '../../src/data/dungeon';
import { CHALLENGES, CRYPT, DUNGEONS, ECLIPSE, SENDA_ROADS, TUTORIAL, type DungeonDef } from '../../src/data/dungeons';
import { atLeast, DIFFICULTIES } from '../../src/data/difficulty';
import { ENDLESS, ENDLESS_POOL } from '../../src/data/endless';
import { SIMA_BANDS } from '../../src/data/sima';
import type { SpeciesId } from '../../src/data/species';
import { tieredSpawns } from '../../src/core/difficulty';
import { generateFloor } from '../../src/core/dungeon';
import { bandWeight, endlessSpawns } from '../../src/core/endless';
import { floorEventPool, rareArrival } from '../../src/core/floor-spawns';
import { rareOnFloor } from '../../src/core/dungeon';

/** Every dungeon with its own (non-Sima) enemy pool: the main ones, every challenge and Senda road, the tutorial. */
const POOLED: readonly DungeonDef[] = [...DUNGEONS.filter((d) => !d.endless), ...CHALLENGES, ...SENDA_ROADS, TUTORIAL];
const allEntries = (): { dungeon: string; entry: SpawnEntry }[] => POOLED.flatMap((d) => d.spawns.pool.map((entry) => ({ dungeon: d.id, entry })));

describe('difficulty gates on pool entries (minDifficulty)', () => {
  it.each(POOLED.map((d) => [d.id, d] as const))('%s: each tier draws exactly the entries it reaches', (_, d) => {
    for (const tier of DIFFICULTIES) {
      const drawn = tieredSpawns(d.spawns, tier).pool;
      const expected = d.spawns.pool.filter((e) => !e.minDifficulty || atLeast(tier, e.minDifficulty));
      expect(drawn.map((e) => e.species)).toEqual(expected.map((e) => e.species));
    }
  });

  it('Hard and Nightmare meet 1 or 2 more species than Normal in the Crypt (owner option 2a)', () => {
    const at = (tier: (typeof DIFFICULTIES)[number]) => new Set(tieredSpawns(CRYPT.spawns, tier).pool.map((e) => e.species));
    const normal = at('normal');
    for (const tier of ['hard', 'nightmare'] as const) {
      const extra = [...at(tier)].filter((s) => !normal.has(s));
      expect(extra.length).toBeGreaterThanOrEqual(1);
      expect(extra.length).toBeLessThanOrEqual(2);
    }
  });
  it('the Sima pool and floor events follow the tier too', () => {
    for (const tier of DIFFICULTIES) {
      for (const floor of [1, 5, 15, 25, 35, 45]) {
        const drawn = new Set(tieredSpawns(endlessSpawns(ENDLESS, floor), tier).pool.map((e) => e.species));
        for (const e of ENDLESS_POOL) if (e.minDifficulty && !atLeast(tier, e.minDifficulty)) expect(drawn.has(e.species), `${e.species} on ${tier}`).toBe(false);
      }
      for (const d of [...POOLED, ECLIPSE]) {
        for (const floor of [1, 2, 4, 5]) {
          const gated = new Set(floorEventPool(d, floor, tier).map((e) => e.species));
          const pool = d.endless ? ENDLESS_POOL : d.spawns.pool;
          for (const e of pool) if (e.minDifficulty && !atLeast(tier, e.minDifficulty)) expect(gated.has(e.species), `${d.id} ${e.species} on ${tier}`).toBe(false);
        }
      }
    }
  });

});

describe('Sima strata (bands)', () => {
  const bandIds = new Set(SIMA_BANDS.map((b) => b.id));
  /** The band whose look borrows a main dungeon (palette = dungeon id). */
  const bandOfDungeon = new Map(SIMA_BANDS.filter((b) => !b.abyss).map((b) => [b.palette, b.id]));

  it('weighs an entry three times inside its bands, half outside, as is without bands', () => {
    expect(bandWeight({ bands: ['crypt'] }, 'crypt', 2)).toBe(6);
    expect(bandWeight({ bands: ['crypt'] }, 'forest', 2)).toBe(1);
    expect(bandWeight({}, 'forest', 2)).toBe(2);
  });

  it('every entry names real bands, and every main-dungeon species belongs to the bands of the dungeons that draw it', () => {
    for (const e of ENDLESS_POOL) {
      for (const b of e.bands ?? []) expect(bandIds.has(b), `${e.species}: ${b}`).toBe(true);
      const homes = DUNGEONS.filter((d) => !d.endless && d.spawns.pool.some((p) => p.species === e.species)).map((d) => bandOfDungeon.get(d.id)).filter((b) => b !== undefined);
      for (const home of homes) expect(e.bands ?? [], `${e.species} should belong to ${home}`).toContain(home);
    }
  });

  it.each(SIMA_BANDS.filter((b) => !b.abyss).map((b) => [b.id, b] as const))('the %s stratum draws mostly its own biome (at least 40 %% of the weight mid-band)', (id, band) => {
    const floor = band.fromFloor + 5;
    const pool = endlessSpawns(ENDLESS, floor).pool;
    const own = new Set(ENDLESS_POOL.filter((e) => e.bands?.includes(id)).map((e) => e.species));
    const total = pool.reduce((s, e) => s + e.weights[0]!, 0);
    const mine = pool.filter((e) => own.has(e.species)).reduce((s, e) => s + e.weights[0]!, 0);
    expect(mine / total).toBeGreaterThanOrEqual(0.4);
  });
});

describe('rare spawns', () => {
  it('every rare entry weighs at most 0.25 wherever it shows up, and shows up somewhere', () => {
    const rare = [...allEntries().map((x) => x.entry), ...ENDLESS_POOL.map((e) => ({ ...e, weights: [e.weight] }))].filter((e) => e.rare);
    expect(rare.length).toBeGreaterThan(0);
    for (const e of rare) {
      expect(Math.max(...e.weights)).toBeGreaterThan(0);
      expect(Math.max(...e.weights)).toBeLessThanOrEqual(0.25);
    }
  });

  it('a rare pick is marked on the floor so every peer can cue its arrival', () => {
    const pool: SpawnEntry[] = [{ species: 'gastly' as SpeciesId, weights: [1], rare: true }];
    const floor = generateFloor(42, 2, { ...CRYPT.spawns, pool });
    expect(floor.spawns.length).toBeGreaterThan(0);
    expect(floor.spawns.every((s) => s.rare)).toBe(true);
    expect(rareOnFloor(floor)).toBe('gastly');
    const plain = generateFloor(42, 2, { ...CRYPT.spawns, pool: [{ species: 'gastly' as SpeciesId, weights: [1] }] });
    expect(rareOnFloor(plain)).toBeNull();
  });
});

describe('the Crypt\'s second wave reaches every pool it belongs to', () => {
  const WAVE: readonly SpeciesId[] = ['honedge', 'bronzor', 'yamask', 'murkrow', 'klefki'];
  const cryptBand = new Set(ENDLESS_POOL.filter((e) => e.bands?.includes('crypt')).map((e) => e.species));

  it('the main Crypt and the Sima\'s Crypt stratum draw all five', () => {
    const crypt = new Set(CRYPT.spawns.pool.map((e) => e.species));
    for (const s of WAVE) {
      expect(crypt.has(s), s).toBe(true);
      expect(cryptBand.has(s), s).toBe(true);
    }
  });

  it.each([...CHALLENGES, ...SENDA_ROADS].map((d) => [d.id, d] as const))('%s: a road through the Crypt meets Honedge, Yamask and Bronzor', (_, d) => {
    const pool = new Set(d.spawns.pool.map((e) => e.species));
    const crypt = d.palette === CRYPT.palette;
    for (const s of ['honedge', 'yamask', 'bronzor'] as const) expect(pool.has(s), `${d.id} ${s}`).toBe(crypt);
  });
});

describe('rare arrival cue', () => {
  const rareSpecies = new Set([...POOLED.flatMap((d) => d.spawns.pool), ...ENDLESS_POOL].filter((e) => e.rare).map((e) => e.species));

  it('every rare species has its arrival line in both languages', async () => {
    const es = (await import('../../src/i18n/es.json')).default as Record<string, string>;
    const en = (await import('../../src/i18n/en.json')).default as Record<string, string>;
    for (const s of rareSpecies) {
      expect(es[`floor.rare.${s}`], s).toBeTruthy();
      expect(en[`floor.rare.${s}`], s).toBeTruthy();
    }
  });

  it('names the rare species standing on the floor, and nothing otherwise', () => {
    const [species] = [...rareSpecies];
    expect(rareArrival(CRYPT, 4, [{ species: 'gastly', alive: true }, { species: species!, alive: true }])).toBe(species);
    expect(rareArrival(CRYPT, 4, [{ species: species!, alive: false }])).toBeNull();
    expect(rareArrival(CRYPT, 4, [{ species: 'gastly', alive: true }])).toBeNull();
    expect(rareArrival(ECLIPSE, 6, [{ species: species!, alive: true }])).toBe(species);
  });
});
