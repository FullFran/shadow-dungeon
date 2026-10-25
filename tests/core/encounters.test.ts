import { describe, expect, it } from 'vitest';
import { CRYPT_SPAWNS } from '../../src/data/dungeon';
import { CAVES, CRYPT, DUNGEONS, ECLIPSE, FOREST, planAt, SWAMP, type DungeonDef } from '../../src/data/dungeons';
import { ENDLESS } from '../../src/data/endless';
import { ROLE_COST, ROLE_LINE, roleOf, ROLES_PER_ROOM, SPECIES_ROLE, threatOf } from '../../src/data/encounters';
import { SIMA_EVENTS, SIMA_SQUADS } from '../../src/data/sima';
import type { SpeciesId } from '../../src/data/species';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { tieredSpawns } from '../../src/core/difficulty';
import { generateFloor, roomBudget, tileDistances } from '../../src/core/dungeon';
import { endlessSpawns } from '../../src/core/endless';
import { xpFor } from '../../src/core/progression';
import { startRun } from '../../src/core/run';

const SEEDS = Array.from({ length: 150 }, (_, i) => i * 7919 + 13);

/** Generated floors of a dungeon (the Sima's first 24 floors). */
const generatedFloors = (d: DungeonDef): number[] =>
  Array.from({ length: d.endless ? 24 : d.plan.length }, (_, i) => i + 1).filter((f) => planAt(d, f)?.kind === 'generated');

/** Average enemies and experience per generated floor at Easy, over SEEDS (the nest and the hunter are not enemies to farm). */
function floorAverages(d: DungeonDef): { enemies: number; xp: number } {
  let enemies = 0;
  let xp = 0;
  const floors = generatedFloors(d);
  for (const floor of floors) {
    for (const seed of SEEDS) {
      const { world } = startRun(seed, { difficulty: 'easy' }, floor, d.id);
      const real = world.enemies.filter((e) => e.species !== 'eclipse-hunter' && e.species !== 'eclipse-nest');
      enemies += real.length / SEEDS.length;
      xp += real.reduce((sum, e) => sum + xpFor(e.species, floor), 0) / SEEDS.length;
    }
  }
  return { enemies: enemies / floors.length, xp: xp / floors.length };
}

/**
 * Measured on main be4e833 (before meaningful encounters) with the same
 * seeds and the same averaging: enemies and experience per generated floor
 * at Easy (the Sima over floors 1-24, its events included).
 */
const BASELINE: Readonly<Record<string, { enemies: number; xp: number }>> = {
  [CRYPT.id]: { enemies: 9.06, xp: 236 },
  [FOREST.id]: { enemies: 10.93, xp: 306 },
  [CAVES.id]: { enemies: 11.63, xp: 459 },
  [SWAMP.id]: { enemies: 10.88, xp: 438 },
  [ECLIPSE.id]: { enemies: 9.48, xp: 924 },
};

describe('meaningful encounters: roles', () => {
  it('gives every species that can spawn a role (pools, escorts, squads, event broods)', () => {
    const spawnable = new Set<SpeciesId>();
    for (const d of DUNGEONS) for (const e of d.spawns.pool) [e.species, ...(e.escort ? [e.escort.species] : [])].forEach((s) => spawnable.add(s));
    for (const e of ENDLESS.pool) spawnable.add(e.species);
    for (const s of SIMA_SQUADS) s.members.forEach((m) => spawnable.add(m));
    SIMA_EVENTS.nest.brood.forEach((s) => spawnable.add(s));
    const missing = [...spawnable].filter((s) => SPECIES_ROLE[s] === undefined);
    expect(missing).toEqual([]);
  });

  it('costs more for the roles that matter more; a swarm unit is the cheapest', () => {
    expect(ROLE_COST.swarm).toBeLessThan(ROLE_COST.skirmisher);
    expect(ROLE_COST.skirmisher).toBeLessThan(ROLE_COST.brute);
    expect(ROLE_COST.controller).toBeGreaterThan(ROLE_COST.ranged);
    expect(threatOf('golett')).toBe(ROLE_COST.brute);
  });
});

describe('meaningful encounters: a threat budget per room', () => {
  const budgeted = DUNGEONS.map((d) => ({ d, tuning: d.endless ? endlessSpawns(ENDLESS, 6) : d.spawns }));

  it('budgets every dungeon (the Sima too)', () => {
    for (const { tuning } of budgeted) expect(tuning.budget).toBeDefined();
  });

  it('never puts more than three enemies in a room, never spends past the budget, never mixes more roles than the tier allows', () => {
    for (const d of DIFFICULTIES) {
      for (const { d: dungeon } of budgeted) {
        for (const depth of [1, 2, 4, 6, 9]) {
          const tuning = tieredSpawns(dungeon.endless ? endlessSpawns(ENDLESS, depth) : dungeon.spawns, d);
          const budget = tuning.budget!;
          for (let seed = 1; seed <= 25; seed++) {
            const floor = generateFloor(seed, depth, tuning);
            floor.rooms.forEach((_, room) => {
              const here = floor.spawns.filter((s) => s.room === room);
              expect(here.length).toBeLessThanOrEqual(budget.maxEnemies);
              expect(here.reduce((sum, s) => sum + threatOf(s.species), 0)).toBeLessThanOrEqual(roomBudget(budget, depth) + budget.jitter);
              expect(new Set(here.map((s) => roleOf(s.species))).size).toBeLessThanOrEqual(ROLES_PER_ROOM[d]);
              if (room === floor.startRoom) expect(here).toEqual([]);
            });
          }
        }
      }
    }
  });

  it('leaves some rooms empty (breathers) and fills most of them with one to three enemies', () => {
    let empty = 0;
    let filled = 0;
    let combos = 0;
    for (let seed = 1; seed <= 80; seed++) {
      const floor = generateFloor(seed, 4, CRYPT_SPAWNS);
      floor.rooms.forEach((_, room) => {
        if (room === floor.startRoom) return;
        const n = floor.spawns.filter((s) => s.room === room).length;
        if (n === 0) empty++;
        else filled++;
        if (new Set(floor.spawns.filter((s) => s.room === room).map((s) => roleOf(s.species))).size >= 2) combos++;
      });
    }
    expect(empty).toBeGreaterThan(0);
    expect(filled).toBeGreaterThan(empty * 2);
    // Most groups of a mid floor mix two roles (a readable combo), not a queue of one kind.
    expect(combos).toBeGreaterThan(filled * 0.4);
  });

  it('puts the back line (gunners, controllers) farther from the way in than the front line', () => {
    let front = 0;
    let back = 0;
    let pairs = 0;
    for (let seed = 1; seed <= 120; seed++) {
      const floor = generateFloor(seed, 5, CRYPT_SPAWNS);
      const dist = tileDistances(floor, floor.start);
      floor.rooms.forEach((_, room) => {
        const here = floor.spawns.filter((s) => s.room === room);
        const f = here.filter((s) => ROLE_LINE[roleOf(s.species)] === 'front');
        const b = here.filter((s) => ROLE_LINE[roleOf(s.species)] === 'back');
        if (f.length === 0 || b.length === 0) return;
        const at = (s: (typeof here)[number]) => dist[s.tile.y * floor.cols + s.tile.x]!;
        front += f.reduce((sum, s) => sum + at(s), 0) / f.length;
        back += b.reduce((sum, s) => sum + at(s), 0) / b.length;
        pairs++;
      });
    }
    expect(pairs).toBeGreaterThan(20);
    expect(back / pairs).toBeGreaterThan(front / pairs + 1);
  });

  it('is deterministic: the same seed makes the same rooms', () => {
    for (const seed of [3, 8, 21]) expect(generateFloor(seed, 4, CRYPT_SPAWNS)).toEqual(generateFloor(seed, 4, CRYPT_SPAWNS));
  });
});

describe('meaningful encounters: fewer enemies, the same experience', () => {
  for (const d of DUNGEONS) {
    it(`${d.id}: 35-45 % fewer enemies per floor, experience per floor within 15 % of before`, () => {
      const now = floorAverages(d);
      const before = BASELINE[d.id]!;
      expect(now.enemies / before.enemies).toBeGreaterThanOrEqual(0.55);
      expect(now.enemies / before.enemies).toBeLessThanOrEqual(0.65);
      expect(Math.abs(now.xp / before.xp - 1)).toBeLessThanOrEqual(0.15);
    });
  }
});
