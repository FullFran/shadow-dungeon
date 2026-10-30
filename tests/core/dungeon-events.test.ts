import { describe, expect, it } from 'vitest';
import en from '../../src/i18n/en.json';
import es from '../../src/i18n/es.json';
import { createMemory, minimapMarks, revealAround } from '../../src/adapters/minimap';
import { eventRulesOf, floorEventPool, floorEventRules } from '../../src/core/floor-spawns';
import { progressRun, startRun, type RunState } from '../../src/core/run';
import { acceptPact, eventBonusMs, rewardsItems, simaEventChance, type SimaEventState } from '../../src/core/sima-events';
import type { WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { DIFFICULTIES, type Difficulty } from '../../src/data/difficulty';
import { CHALLENGES, DUNGEONS, ECLIPSE, floorsOf, planAt, SENDA_ROADS, type DungeonDef } from '../../src/data/dungeons';
import { SIMA_EVENTS, type SimaEventKind } from '../../src/data/sima';
import { IDLE } from './helpers';

const NON_ENDLESS: readonly DungeonDef[] = [...DUNGEONS.filter((d) => !d.endless), ...CHALLENGES, ...SENDA_ROADS];
const BROUGHT: readonly SimaEventKind[] = ['vault', 'merchant', 'shrine', 'ambush', 'nest', 'monsterHouse', 'waves'];
const texts = es as Record<string, string>;
const textsEn = en as Record<string, string>;

/** The floors of `dungeon` with an event, over many seeds, until `found` says stop. */
function eachEvent(dungeon: DungeonDef, tier: Difficulty, visit: (run: RunState, world: WorldState, event: SimaEventState) => boolean | void, seeds = 80): void {
  for (let seed = 1; seed <= seeds; seed++) {
    for (let floor = 1; floor <= floorsOf(dungeon); floor++) {
      const { run, world } = startRun(seed, { difficulty: tier }, floor, dungeon.id);
      if (world.simaEvent && visit(run, world, world.simaEvent)) return;
    }
  }
}

function findEvent(dungeon: DungeonDef, kind: SimaEventKind, tier: Difficulty = 'easy'): { run: RunState; world: WorldState } {
  let out: { run: RunState; world: WorldState } | null = null;
  eachEvent(dungeon, tier, (run, world, event) => {
    if (event.kind !== kind) return false;
    out = { run, world };
    return true;
  }, 400);
  if (!out) throw new Error(`${kind} never drawn in ${dungeon.id}`);
  return out;
}

const steps = (w: WorldState, ms: number): WorldState => {
  let s = w;
  for (let t = 0; t < ms; t += FIXED_DT_MS) s = step(s, IDLE, FIXED_DT_MS);
  return s;
};

describe('floor events in every dungeon (S3, S4)', () => {
  it('every main dungeon, challenge and Senda road has its own event data; the Sima keeps its own', () => {
    for (const d of NON_ENDLESS) {
      const rules = floorEventRules(d);
      expect(rules, d.id).toBeDefined();
      expect(rules).not.toBe(SIMA_EVENTS);
    }
    expect(floorEventRules(ECLIPSE)).toBe(SIMA_EVENTS);
  });

  it('brings the kinds asked for and leaves out the crystal (the clock) and the hunter (its pressure), and any pact paid in time', () => {
    for (const d of NON_ENDLESS) {
      const rules = floorEventRules(d)!;
      const kinds = rules.kinds.map((k) => k.kind);
      expect(kinds, d.id).not.toContain('crystal');
      expect(kinds, d.id).not.toContain('hunter');
      expect(rules.shrine.pacts.some((p) => p.blessing.timeMs)).toBe(false);
      expect(rules.shrine.pacts.length).toBeGreaterThan(0);
    }
    for (const d of DUNGEONS.filter((x) => !x.endless)) for (const kind of BROUGHT) expect(floorEventRules(d)!.kinds.map((k) => k.kind), `${d.id} ${kind}`).toContain(kind);
  });

  it('shows up in every dungeon, only on normal generated floors, away from the start and the stairs', () => {
    for (const d of NON_ENDLESS) {
      let seen = 0;
      eachEvent(d, 'easy', (run, world, event) => {
        seen++;
        expect(planAt(d, run.floor)?.kind).toBe('generated');
        expect(run.kind).toBe('normal');
        const grid = world.arena.tiles as unknown as { startRoom: number; stairsRoom: number };
        expect(event.room).not.toBe(grid.startRoom);
        expect(event.room).not.toBe(grid.stairsRoom);
        expect(BROUGHT).toContain(event.kind);
      }, 30);
      expect(seen, d.id).toBeGreaterThan(0);
    }
  });

  it('boss floors and rooms have none, in any dungeon', () => {
    for (const d of [...NON_ENDLESS, ECLIPSE]) {
      for (let floor = 1; floor <= Math.min(floorsOf(d), 30); floor++) {
        if (planAt(d, floor)?.kind !== 'room') continue;
        for (const seed of [1, 2, 3]) expect(startRun(seed, {}, floor, d.id).world.simaEvent, `${d.id} ${floor}`).toBeUndefined();
      }
    }
  });

  it('its own enemies come from that dungeon\'s pool at that floor', () => {
    for (const d of NON_ENDLESS.slice(0, 6)) {
      const { run, world } = findEvent(d, 'ambush');
      const pool = floorEventPool(d, run.floor).map((e) => e.species);
      expect(pool.length).toBeGreaterThan(0);
      for (const species of world.simaEvent!.species!) expect(pool, d.id).toContain(species);
    }
    expect(floorEventPool(DUNGEONS[0]!, 1).every((e) => (e.weights[0] ?? 0) > 0)).toBe(true);
  });

  it('runs through the step: a vault\'s chest opens once its guards are down and offers the pick', () => {
    const { world } = findEvent(DUNGEONS[0]!, 'vault');
    const event = world.simaEvent!;
    const guarded = steps({ ...world, player: { ...world.player, pos: vec(event.pos.x, event.pos.y) } }, 50);
    expect(guarded.simaEvent!.done).toBe(false);
    const open = steps({ ...guarded, enemies: guarded.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) }, 50);
    expect(open.simaEvent).toMatchObject({ done: true, outcome: 'opened' });
    expect(rewardsItems(open.simaEvent)).toBe(true);
  });

  it('a wave room seals, sends its waves from the dungeon\'s rules and pays no time: there is no clock', () => {
    const { run, world } = findEvent(DUNGEONS[1]!, 'waves');
    const event = world.simaEvent!;
    let s = steps({ ...world, player: { ...world.player, pos: vec(event.pos.x, event.pos.y) } }, 50);
    expect(s.simaEvent!.sealed).toBe(true);
    expect(s.simaEvent!.wave).toBe(1);
    for (let i = 0; i < 40 && !s.simaEvent!.done; i++) s = steps({ ...s, player: { ...s.player, hp: s.player.maxHp }, enemies: s.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) }, 300);
    expect(s.simaEvent).toMatchObject({ done: true, outcome: 'cleared', sealed: false });
    expect(rewardsItems(s.simaEvent)).toBe(true);
    expect(run.clockMs).toBeUndefined();
    const after = progressRun(run, s);
    expect(after.bonusMs ?? 0).toBe(0);
    expect(after.run.clockMs).toBeUndefined();
    expect(eventBonusMs(s.simaEvent, floorEventRules(DUNGEONS[1]!)!)).toBe(0);
  });

  it('a pact gives what it says: its curse and its blessing, and no time', () => {
    const d = DUNGEONS[2]!;
    const { world } = findEvent(d, 'shrine');
    const taken = acceptPact(world, floorEventRules(d)!, 'easy');
    expect(taken.bonusMs).toBe(0);
    expect(taken.world.simaPact).toBeDefined();
    expect(taken.world.simaEvent).toMatchObject({ done: true, outcome: 'accepted' });
  });

  it('tiers bring events more often, within the dungeon\'s cap', () => {
    const rules = floorEventRules(DUNGEONS[3]!)!;
    for (const tier of DIFFICULTIES) expect(simaEventChance(rules, 6, tier)).toBeLessThanOrEqual(rules.cap!);
    expect(simaEventChance(rules, 6, 'hard')).toBeGreaterThanOrEqual(simaEventChance(rules, 6, 'easy'));
  });

  it('a guest places the same event and follows the host: its progress, and the wave room\'s doors', () => {
    const d = DUNGEONS[3]!;
    const { run, world } = findEvent(d, 'waves');
    const host = { ...world, role: 'host' as const };
    const guest = startRun(run.seed, { localId: 'p2', role: 'guest' }, run.floor, d.id).world;
    expect(guest.simaEvent).toEqual(host.simaEvent);
    const event = host.simaEvent!;
    const sealed = steps({ ...host, player: { ...host.player, pos: vec(event.pos.x, event.pos.y) } }, 50);
    const followed = applyHostSnapshot(guest, hostSnapshot(sealed));
    expect(followed.simaEvent).toMatchObject({ sealed: true, wave: 1 });
    for (const i of event.doors!) expect(followed.arena.tiles!.tiles[i]).toBe(0);
  });

  it('the rules of a live event are its dungeon\'s; a Sima event names none and stays on the Sima\'s', () => {
    const { world } = findEvent(DUNGEONS[0]!, 'vault');
    expect(world.simaEvent!.dungeon).toBe(DUNGEONS[0]!.id);
    expect(eventRulesOf(world.simaEvent!)).toBe(floorEventRules(DUNGEONS[0]!));
    const sima = findEvent(ECLIPSE, 'crystal').world.simaEvent!;
    expect(sima.dungeon).toBeUndefined();
    expect(eventRulesOf(sima)).toBe(SIMA_EVENTS);
  });

  it('the minimap marks it once seen', () => {
    const { world } = findEvent(DUNGEONS[0]!, 'merchant');
    const grid = world.arena.tiles!;
    const memory = createMemory(grid);
    revealAround(memory, grid, world.arena.rooms ?? [], { x: Math.floor(world.simaEvent!.pos.x / 32), y: Math.floor(world.simaEvent!.pos.y / 32) });
    expect(minimapMarks(world, memory, { x: 0, y: 0, width: 800, height: 600 }).event).toMatchObject({ done: false });
  });

  it('its texts exist in both languages and none of those shown in any dungeon says «Sima»', () => {
    const shared = ['sima.summary.title', 'sima.summary.line', 'sima.summary.more', 'sima.shrine.title', 'sima.shrine.hint', 'sima.shrine.decline', 'sima.shrine.declineText', 'sima.shrine.hostDecides', 'sima.merchant.title', 'sima.merchant.hint', 'sima.hud.wave', 'sima.hud.pact'];
    const perKind = BROUGHT.flatMap((k) => [`sima.event.${k}`, ...Object.keys(texts).filter((key) => key.startsWith(`sima.log.${k}.`))]);
    for (const key of [...shared, ...perKind]) {
      expect(texts[key], key).toBeTruthy();
      expect(textsEn[key], key).toBeTruthy();
      expect(texts[key], key).not.toMatch(/sima/i);
      expect(textsEn[key], key).not.toMatch(/sima|chasm/i);
    }
  });
});

describe('how many items a run holds (S5, provisional numbers)', () => {
  /** Per run, over seeds: floors with an event, picks from chests and wave rooms, merchants; plus a pick per boss the run goes on after. */
  function perRun(d: DungeonDef, tier: Difficulty, seeds = 120): { eventFloors: number; picks: number; merchants: number; bosses: number; floors: number } {
    const floors = floorsOf(d);
    const bosses = d.plan.filter((p, i) => p.kind === 'room' && i + 1 < floors).length;
    let eventFloors = 0;
    let picks = 0;
    let merchants = 0;
    for (let seed = 1; seed <= seeds; seed++) {
      for (let floor = 1; floor <= floors; floor++) {
        const kind = startRun(seed * 97 + 11, { difficulty: tier }, floor, d.id).world.simaEvent?.kind;
        if (!kind) continue;
        eventFloors++;
        if (kind === 'vault' || kind === 'waves') picks++;
        if (kind === 'merchant') merchants++;
      }
    }
    return { eventFloors: eventFloors / seeds, picks: picks / seeds, merchants: merchants / seeds, bosses, floors };
  }

  for (const d of NON_ENDLESS.filter((x, i) => DUNGEONS.includes(x) || i % 6 === 4)) {
    it(`${d.id}: half the floors or more stay plain, on every tier, with 3 to 5 items to be had (the Crypt, 6 floors, about 3)`, () => {
      for (const tier of DIFFICULTIES) {
        const m = perRun(d, tier);
        expect(1 - m.eventFloors / m.floors, `${tier} plain`).toBeGreaterThanOrEqual(0.5);
        const items = m.bosses + m.picks + m.merchants;
        expect(items, `${tier} items`).toBeGreaterThanOrEqual(2.5);
        expect(items, `${tier} items`).toBeLessThanOrEqual(5);
      }
    });
  }
});

describe('the Sima keeps its events (S3)', () => {
  it('its data is untouched: chance, kinds, crystal and hunter', () => {
    expect(ECLIPSE.endless!.events).toBe(SIMA_EVENTS);
    expect(SIMA_EVENTS).toMatchObject({ fromFloor: 2, start: 0.35, perFloor: 0.01, max: 0.6 });
    expect(SIMA_EVENTS.kinds.map((k) => k.kind)).toEqual(['crystal', 'vault', 'merchant', 'shrine', 'ambush', 'nest', 'monsterHouse', 'waves', 'hunter']);
    expect(SIMA_EVENTS.cap).toBeUndefined();
  });
});
