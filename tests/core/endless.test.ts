import { describe, expect, it } from 'vitest';
import { coinBreakdown, emptyTally, tallyFloor } from '../../src/core/coins';
import { generateFloor } from '../../src/core/dungeon';
import { unlockedDungeons, needsDungeonSelect } from '../../src/core/dungeon-select';
import {
  addTime,
  clockPaused,
  clockText,
  dailySeed,
  depthScale,
  endlessSeed,
  modeOfSeed,
  descendBonusMs,
  endlessSpawns,
  runUpgrades,
  scaleCoins,
  tickClock,
  utcDateKey,
} from '../../src/core/endless';
import { floorKind, floorSeed, isBossFloor, progressRun, setClock, startRun, tickRunClock, type RunProgress } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { hitPlayer } from '../../src/core/step';
import { vec } from '../../src/core/vec';
import { createPlayer } from '../../src/core/world';
import { CRYPT, dungeonById, ECLIPSE, FOREST, musicFor, planAt } from '../../src/data/dungeons';
import { EXPERIMENTAL_ENEMIES } from '../../src/data/enemies';
import { ENDLESS, ENDLESS_POOL, echoAt, isEchoFloor } from '../../src/data/endless';
import { SPECIES } from '../../src/data/species';

const SEED = 4242;
const ECL = 'eclipse-chasm' as const;

const toStairs = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
const killAll = (w: WorldState): WorldState => ({ ...w, enemies: w.enemies.map((e) => ({ ...e, hp: 0, alive: false })) });
const toEchoExit = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(w.arena.width / 2, 10) } });

/** Takes the way down of the current floor (stairs, or the echo's exit once it fell). */
function down(p: RunProgress): RunProgress {
  const plan = planAt(ECLIPSE, p.run.floor)!;
  if (plan.kind === 'generated') return progressRun(p.run, toStairs(p.world));
  const cleared = progressRun(p.run, killAll(p.world));
  return progressRun(cleared.run, toEchoExit(cleared.world));
}

describe('the Sima del Eclipse (data)', () => {
  it('is open from the start, so the select and the town list it beside the Crypt', () => {
    expect(ECLIPSE.unlockedBy).toBeNull();
    expect(unlockedDungeons(new Set()).map((d) => d.id)).toEqual(['crypt-of-the-sword-king', ECL]);
    expect(needsDungeonSelect(new Set())).toBe(true);
    expect(dungeonById(ECL)).toBe(ECLIPSE);
  });

  it('puts a guardian echo on every 5th floor, rotating Aegislash, Trevenant and Decidueye', () => {
    expect([1, 2, 3, 4, 5, 6, 9, 10, 15, 20].map((f) => isEchoFloor(ENDLESS, f))).toEqual([false, false, false, false, true, false, false, true, true, true]);
    expect([5, 10, 15, 20].map((f) => echoAt(ENDLESS, f).room)).toEqual(['boss', 'hollow', 'roost', 'boss']);
    expect(planAt(ECLIPSE, 7)).toEqual({ kind: 'generated' });
    expect(planAt(ECLIPSE, 55)).toEqual({ kind: 'room', room: 'hollow', role: 'echo' });
  });

  it('the pool is one appendable list: an entry shows up from its min depth with its weight', () => {
    const at1 = endlessSpawns(ENDLESS, 1).pool.map((e) => e.species);
    expect(at1).toEqual(ENDLESS_POOL.filter((e) => e.minDepth <= 1).map((e) => e.species));
    expect(at1).not.toContain('pumpkaboo-super');
    expect(endlessSpawns(ENDLESS, 30).pool.map((e) => e.species)).toEqual(ENDLESS_POOL.map((e) => e.species));
    const appended = endlessSpawns({ ...ENDLESS, pool: [...ENDLESS_POOL, { species: 'trevenant', minDepth: 12, weight: 1 }] }, 12);
    expect(appended.pool.at(-1)).toEqual({ species: 'trevenant', weights: [1] });
    expect(endlessSpawns(ENDLESS, 1).pool.find((e) => e.species === 'pumpkaboo-small')?.pack).toBe(3);
    // Every species in the pool exists.
    expect(ENDLESS_POOL.filter((e) => !SPECIES[e.species])).toEqual([]);
  });

  it('holds every species of the experimental roster, never before its suggested min depth', () => {
    for (const roster of EXPERIMENTAL_ENEMIES) {
      const entry = ENDLESS_POOL.find((e) => e.species === roster.species);
      expect(entry, roster.species).toBeDefined();
      // Tougher, not more (2026-10-25): the tough ones may come up to two floors earlier than suggested.
      expect(entry!.minDepth, roster.species).toBeGreaterThanOrEqual(roster.minDepth - 2);
      expect(entry!.weight, roster.species).toBeGreaterThan(0);
      if (roster.pack) expect(entry!.pack, roster.species).toBe(roster.pack);
      expect(endlessSpawns(ENDLESS, entry!.minDepth - 1).pool.map((e) => e.species)).not.toContain(roster.species);
    }
    expect(ENDLESS_POOL.find((e) => e.species === 'zubat')?.pack).toBe(3);
    expect(ENDLESS_POOL.find((e) => e.species === 'stunky')?.pack).toBe(2);
  });

  it("holds the Crypt's new enemies: Duskull and a Pawniard pair from 2 as in the Crypt, Golett a floor earlier (tougher, not more)", () => {
    const entry = (species: string) => ENDLESS_POOL.find((e) => e.species === species);
    expect(entry('duskull')).toMatchObject({ minDepth: 2 });
    expect(entry('pawniard')).toMatchObject({ minDepth: 2, pack: 2 });
    expect(entry('golett')).toMatchObject({ minDepth: 3 });
    for (const species of ['duskull', 'pawniard', 'golett']) {
      const first = entry(species)!.minDepth;
      const cryptFirst = CRYPT.spawns.pool.find((p) => p.species === species)!.weights.findIndex((w) => w > 0) + 1;
      expect(first, species).toBe(species === 'golett' ? cryptFirst - 1 : cryptFirst);
      expect(entry(species)!.weight, species).toBeGreaterThan(0);
      expect(endlessSpawns(ENDLESS, first - 1).pool.map((e) => e.species)).not.toContain(species);
      expect(endlessSpawns(ENDLESS, first).pool.map((e) => e.species)).toContain(species);
    }
    // The mid-boss stays in its vault.
    expect(entry('sableye')).toBeUndefined();
  });

  it("seeded floors bring the Crypt's new enemies, Pawniard two at a time, never before their min depth", () => {
    const minDepth = new Map(ENDLESS_POOL.map((e) => [e.species, e.minDepth]));
    const seen = new Map<string, number>();
    let pairs = 0;
    for (const seed of [SEED, 7, 99, 2024]) {
      for (let floor = 1; floor <= 9; floor++) {
        if (isEchoFloor(ENDLESS, floor)) continue;
        const spawns = generateFloor(floorSeed(seed, floor), floor, endlessSpawns(ENDLESS, floor)).spawns;
        expect(spawns).toEqual(generateFloor(floorSeed(seed, floor), floor, endlessSpawns(ENDLESS, floor)).spawns);
        for (const s of spawns) {
          expect(minDepth.get(s.species), `${s.species} on floor ${floor}`).toBeLessThanOrEqual(floor);
          if (['duskull', 'pawniard', 'golett'].includes(s.species)) seen.set(s.species, (seen.get(s.species) ?? 0) + 1);
        }
        const byRoom = new Map<number, number>();
        for (const s of spawns) if (s.species === 'pawniard') byRoom.set(s.room, (byRoom.get(s.room) ?? 0) + 1);
        for (const n of byRoom.values()) if (n >= 2) pairs++;
      }
    }
    expect([...seen.keys()].sort()).toEqual(['duskull', 'golett', 'pawniard']);
    expect(pairs).toBeGreaterThan(0);
  });

  it('mixes old and new: neither the dungeon regulars nor the roster outweighs the other twice over by floor 5', () => {
    const roster = new Set<string>(EXPERIMENTAL_ENEMIES.map((e) => e.species));
    const weight = (fresh: boolean) => endlessSpawns(ENDLESS, 5).pool.filter((e) => roster.has(e.species) === fresh).reduce((sum, e) => sum + e.weights[0]!, 0);
    const ratio = weight(true) / weight(false);
    expect(ratio).toBeGreaterThan(0.5);
    expect(ratio).toBeLessThan(2);
  });

  it('seeded floors are deterministic and show roster species by floor 5, each only from its min depth', () => {
    const minDepth = new Map(ENDLESS_POOL.map((e) => [e.species, e.minDepth]));
    const roster = new Set<string>(EXPERIMENTAL_ENEMIES.map((e) => e.species));
    const seen = new Set<string>();
    for (let floor = 1; floor <= 4; floor++) {
      const floorSpawns = generateFloor(floorSeed(SEED, floor), floor, endlessSpawns(ENDLESS, floor)).spawns;
      expect(floorSpawns).toEqual(generateFloor(floorSeed(SEED, floor), floor, endlessSpawns(ENDLESS, floor)).spawns);
      for (const s of floorSpawns) {
        expect(minDepth.get(s.species), `${s.species} on floor ${floor}`).toBeLessThanOrEqual(floor);
        if (roster.has(s.species)) seen.add(s.species);
      }
    }
    // Floor 5 is an echo; floors 1-4 of one seed already bring several new species.
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  it('urgent floors from every dungeon (collapse, Niebla) with weights that rise with depth', () => {
    const rate = (floor: number, kind: string) => {
      let n = 0;
      for (let s = 0; s < 2000; s++) if (floorKind(s, floor, ECLIPSE) === kind) n++;
      return n / 2000;
    };
    expect(rate(1, 'collapse') + rate(1, 'fog')).toBe(0);
    expect(rate(14, 'collapse')).toBeGreaterThan(rate(3, 'collapse'));
    expect(rate(14, 'fog')).toBeGreaterThan(rate(3, 'fog'));
    // Echo floors are never urgent.
    expect(Array.from({ length: 200 }, (_, s) => floorKind(s, 10, ECLIPSE)).every((k) => k === 'normal')).toBe(true);
  });

  it('rotates the floor tracks by depth band; echoes play their guardian track', () => {
    const music = (floor: number) => musicFor(ECLIPSE, planAt(ECLIPSE, floor)!, 'normal', floor);
    expect([1, 4, 6, 9, 11].map(music)).toEqual(['crypt', 'crypt', 'forest', 'forest', 'crypt']);
    expect([5, 15].map(music)).toEqual(['guardian', 'forest-guardian']);
    // The other dungeons are untouched.
    expect(musicFor(FOREST, FOREST.plan[0]!, 'normal')).toBe('forest');
  });
});

describe('depth scaling', () => {
  it('is 1 on floor 1, rises every floor and stops at its caps; echoes take part of the HP', () => {
    expect(depthScale(ENDLESS.scaling, 1)).toEqual({ hp: 1, damage: 1 });
    const scales = Array.from({ length: 200 }, (_, i) => depthScale(ENDLESS.scaling, i + 1));
    for (let i = 1; i < scales.length; i++) {
      expect(scales[i]!.hp).toBeGreaterThanOrEqual(scales[i - 1]!.hp);
      expect(scales[i]!.damage).toBeGreaterThanOrEqual(scales[i - 1]!.damage);
    }
    expect(scales[10]!.hp).toBeGreaterThan(1);
    expect(scales.at(-1)).toEqual({ hp: ENDLESS.scaling.maxHp, damage: ENDLESS.scaling.maxDamage });
    expect(depthScale(ENDLESS.scaling, 10, true).hp).toBeCloseTo(depthScale(ENDLESS.scaling, 10).hp * ENDLESS.scaling.echoHp);
  });

  it('enemies of a deep floor spawn with more HP and hit harder; other dungeons are unscaled', () => {
    const deep = startRun(SEED, {}, 12, ECL).world;
    const enemy = deep.enemies[0]!;
    const scale = depthScale(ENDLESS.scaling, 12);
    expect(enemy.maxHp).toBeCloseTo(SPECIES[enemy.species].maxHp * scale.hp);
    expect(enemy.hp).toBe(enemy.maxHp);
    const plain = { ...deep, enemyScale: undefined };
    const hurt = (w: WorldState) => 1000 - hitPlayer({ ...w, player: { ...createPlayer(vec(0, 0), 'cubone'), hp: 1000, maxHp: 1000 } }, { damage: 20 }).player.hp;
    expect(hurt(deep)).toBe(Math.round(20 * scale.damage));
    expect(hurt(plain)).toBe(20);
    expect(startRun(SEED, {}, 3, CRYPT.id).world.enemyScale).toBeUndefined();
  });

  it('an echo is its guardian, scaled, with the way on at the top once it falls', () => {
    const { run, world } = startRun(SEED, {}, 5, ECL);
    expect(world.enemies.map((e) => e.species)).toEqual(['aegislash']);
    expect(world.enemies[0]!.maxHp).toBeCloseTo(SPECIES.aegislash.maxHp * depthScale(ENDLESS.scaling, 5, true).hp);
    // Not the guardian's own floor: no cinematic, only the echo's name card (the app reads `isBossFloor`).
    expect(isBossFloor(run)).toBe(false);
    expect(isBossFloor(startRun(SEED, {}, CRYPT.plan.length).run)).toBe(true);
    // Standing at the top does nothing while it stands.
    expect(progressRun(run, toEchoExit(world)).entered).toBe(false);
    const next = down({ run, world, entered: false, outcome: null });
    expect(next.entered).toBe(true);
    expect(next.run.floor).toBe(6);
  });
});

describe('endless run', () => {
  it('never runs out of floors: 60 floors down, no victory, every floor generated from the run seed', () => {
    let p: RunProgress = { ...startRun(SEED, {}, 1, ECL), entered: false, outcome: null };
    for (let floor = 2; floor <= 60; floor++) {
      p = down(p);
      expect(p.outcome).toBeNull();
      expect(p.run.floor).toBe(floor);
      // The map is the generator's; the Sima may swap a room's enemies for a squad, so only the grid is compared.
      if (planAt(ECLIPSE, floor)!.kind === 'generated') expect(p.world.arena.tiles!.tiles).toEqual(generateFloor(floorSeed(SEED, floor), floor, endlessSpawns(ENDLESS, floor)).tiles);
    }
  });

  it('modo puro: starts at level 1 with no held items and without shop upgrades', () => {
    const upgrades = { vitality: 3 };
    expect(runUpgrades(ECLIPSE, upgrades)).toBeUndefined();
    expect(runUpgrades(CRYPT, upgrades)).toBe(upgrades);
    expect(runUpgrades(FOREST, upgrades)).toBe(upgrades);
    const { world } = startRun(SEED, { upgrades: runUpgrades(ECLIPSE, upgrades) }, 1, ECL);
    expect(world.player.level).toBe(1);
    expect(world.player.items).toEqual([]);
    expect(world.player.upgrades).toBeUndefined();
  });
});

describe('the run clock', () => {
  it('starts at 8:00 and counts down, never below 0', () => {
    const { run } = startRun(SEED, {}, 1, ECL);
    expect(run.clockMs).toBe(480_000);
    expect(tickRunClock(run, 1000).clockMs).toBe(479_000);
    expect(tickClock(500, 2000)).toBe(0);
    expect(tickClock(500, -100)).toBe(500);
    expect(startRun(SEED, {}).run.clockMs).toBeUndefined();
    expect(tickRunClock(startRun(SEED, {}).run, 1000).clockMs).toBeUndefined();
  });

  it('descending adds time, shrinking with depth to a minimum; nothing once it ran out', () => {
    expect(descendBonusMs(ENDLESS.clock, 2)).toBe(40_000);
    expect(descendBonusMs(ENDLESS.clock, 5)).toBe(34_000);
    expect(descendBonusMs(ENDLESS.clock, 40)).toBe(15_000);
    expect(addTime(1000, 5000)).toBe(6000);
    expect(addTime(0, 5000)).toBe(0);
    expect(addTime(1000, -5000)).toBe(1000);
    const start = startRun(SEED, {}, 1, ECL);
    const p = progressRun(tickRunClock(start.run, 10_000), toStairs(start.world));
    expect(p.run.clockMs).toBe(480_000 - 10_000 + 40_000);
    expect(p.bonusMs).toBe(40_000);
  });

  it('felling an echo adds the echo bonus once, then the way down adds the descend bonus', () => {
    const { run, world } = startRun(SEED, {}, 5, ECL);
    const fell = progressRun(run, killAll(world));
    expect(fell.run.clockMs).toBe(480_000 + ENDLESS.clock.echoMs);
    expect(fell.bonusMs).toBe(ENDLESS.clock.echoMs);
    const again = progressRun(fell.run, fell.world);
    expect(again.run.clockMs).toBe(fell.run.clockMs);
    expect(again.bonusMs ?? 0).toBe(0);
    const on = progressRun(again.run, toEchoExit(again.world));
    expect(on.run.clockMs).toBe(480_000 + ENDLESS.clock.echoMs + descendBonusMs(ENDLESS.clock, 6));
  });

  it('at 0 the eclipse swallows the floor: an eclipse end, not a defeat; a guest waits for the host', () => {
    const { run, world } = startRun(SEED, {}, 1, ECL);
    const out = tickRunClock(run, 480_000);
    expect(progressRun(out, world).outcome).toBe('eclipse');
    expect(progressRun(out, { ...world, role: 'guest' }).outcome).toBeNull();
    expect(setClock(run, 0).clockMs).toBe(0);
    expect(setClock(run, -40).clockMs).toBe(0);
    // Every player down still is a defeat.
    expect(progressRun(out, { ...world, player: { ...world.player, hp: 0 } }).outcome).toBe('defeat');
  });

  it('stands still only in a paused solo run', () => {
    expect(clockPaused({ shared: false, menuOpen: true, pickOpen: false })).toBe(true);
    expect(clockPaused({ shared: false, menuOpen: false, pickOpen: true })).toBe(true);
    expect(clockPaused({ shared: false, menuOpen: false, pickOpen: false })).toBe(false);
    expect(clockPaused({ shared: true, menuOpen: true, pickOpen: true, cinematic: true })).toBe(false);
  });

  it('reads as m:ss, rounded up', () => {
    expect([480_000, 479_001, 59_000, 5_000, 1, 0, -10].map(clockText)).toEqual(['8:00', '8:00', '0:59', '0:05', '0:01', '0:00', '0:00']);
  });
});

describe('daily challenge seed', () => {
  it('depends only on the UTC date, whatever the time of day or the zone of the viewer', () => {
    const morning = Date.UTC(2026, 9, 25, 0, 0, 1);
    const night = Date.UTC(2026, 9, 25, 23, 59, 59);
    expect(utcDateKey(morning)).toBe('2026-10-25');
    expect(utcDateKey(night)).toBe('2026-10-25');
    expect(utcDateKey(Date.parse('2026-10-25T23:30:00-05:00'))).toBe('2026-10-26');
    expect(dailySeed(utcDateKey(morning))).toBe(dailySeed(utcDateKey(night)));
    expect(dailySeed('2026-10-25')).not.toBe(dailySeed('2026-10-26'));
    const seed = dailySeed('2026-10-25');
    expect(Number.isSafeInteger(seed) && seed >= 0 && seed < 2 ** 31).toBe(true);
  });

  it('daily mode plays the day seed, free mode the random one; a received seed tells its mode', () => {
    expect(endlessSeed('daily', '2026-10-25', 123)).toBe(dailySeed('2026-10-25'));
    expect(endlessSeed('free', '2026-10-25', 123)).toBe(123);
    expect(modeOfSeed(dailySeed('2026-10-25'), '2026-10-25')).toBe('daily');
    expect(modeOfSeed(dailySeed('2026-10-25'), '2026-10-26')).toBe('free');
    expect(modeOfSeed(123, '2026-10-25')).toBe('free');
  });
});

describe('endless Pokémonedas', () => {
  it('pay by the normal rules, halved, shown as the multiplier', () => {
    const tally = tallyFloor(tallyFloor(emptyTally(), 1, null), 2, null);
    const normal = coinBreakdown(tally, 'eclipse');
    expect(normal.share).toBe(1);
    const scaled = scaleCoins(normal, ENDLESS.coinScale);
    expect(scaled.multiplier).toBe(0.5);
    expect(scaled.total).toBe(Math.floor(normal.subtotal * 0.5));
    expect(scaleCoins(normal, 1)).toBe(normal);
    // A defeat keeps its share cut on top.
    const lost = scaleCoins(coinBreakdown(tally, 'defeat'), 0.5);
    expect(lost.total).toBe(Math.floor(lost.subtotal * 0.75 * 0.5));
  });
});
