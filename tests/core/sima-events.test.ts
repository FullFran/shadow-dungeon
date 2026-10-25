import { describe, expect, it } from 'vitest';
import { endlessSpawns } from '../../src/core/endless';
import type { Floor } from '../../src/core/dungeon';
import { floorKind, floorSeed, progressRun, startRun, type RunState } from '../../src/core/run';
import {
  acceptPact,
  applySimaSync,
  chooseSimaEvent,
  declinePact,
  descendPact,
  doorTiles,
  eatBought,
  merchantItem,
  nearSimaEvent,
  pactEffects,
  placeSimaEvent,
  rewardOffer,
  rewardsItems,
  simaSync,
  updateSimaEvent,
} from '../../src/core/sima-events';
import { enemyTimeScale } from '../../src/core/time';
import type { WorldState } from '../../src/core/state';
import { hitPlayer, step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { isWall } from '../../src/core/tiles';
import { vec } from '../../src/core/vec';
import { createPlayer } from '../../src/core/world';
import { ECLIPSE } from '../../src/data/dungeons';
import { ECLIPSE_HUNTER } from '../../src/data/enemies';
import { ENDLESS, isEchoFloor } from '../../src/data/endless';
import { SIMA_EVENTS, type SimaEventKind } from '../../src/data/sima';
import { TUNING } from '../../src/data/tuning';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import { IDLE, input } from './helpers';

const ECL = 'eclipse-chasm' as const;
const SEED = 4242;
const FLOOR = 12;
const DEF = SIMA_EVENTS;

/** A Sima floor with exactly this event, in its first room that is neither the start nor the stairs (the hunter: the start room). */
function withEvent(kind: SimaEventKind, floor = FLOOR, seed = SEED): { world: WorldState; run: RunState; floor: Floor } {
  const started = startRun(seed, {}, floor, ECL);
  const base = { ...started.world, simaEvent: undefined };
  const plan = base.arena.tiles as Floor;
  const room = kind === 'hunter' ? plan.startRoom : plan.rooms.findIndex((_, i) => i !== plan.startRoom && i !== plan.stairsRoom);
  const world = placeSimaEvent(base, { kind, room }, plan, seed, floor, DEF, endlessSpawns(ENDLESS, floor).pool);
  return { world, run: started.run, floor: plan };
}

const at = (w: WorldState, pos: { x: number; y: number }): WorldState => ({ ...w, player: { ...w.player, pos: vec(pos.x, pos.y) } });
const run = (w: WorldState, ms: number, playerInput = IDLE): WorldState => {
  let s = w;
  for (let t = 0; t < ms; t += FIXED_DT_MS) s = step(s, playerInput, FIXED_DT_MS);
  return s;
};
const tick = (w: WorldState, ms: number): WorldState => {
  let s = w;
  for (let t = 0; t < ms; t += FIXED_DT_MS) s = updateSimaEvent(s, FIXED_DT_MS, DEF, endlessSpawns(ENDLESS, FLOOR).pool);
  return s;
};
const killAll = (w: WorldState, only?: (id: string) => boolean): WorldState => ({ ...w, enemies: w.enemies.map((e) => (only && !only(e.id) ? e : { ...e, hp: 0, alive: false })) });

describe('Sima floor events: selection', () => {
  it('is seeded: the same seed and floor give the same event, never on floor 1, echo or urgent floors, never in the start room', () => {
    let seen = 0;
    const kinds = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      for (let floor = 1; floor <= 30; floor++) {
        if (isEchoFloor(ENDLESS, floor)) {
          expect(startRun(seed, {}, floor, ECL).world.simaEvent).toBeUndefined();
          continue;
        }
        const world = startRun(seed, {}, floor, ECL).world;
        const event = world.simaEvent;
        expect(startRun(seed, {}, floor, ECL).world.simaEvent?.kind).toBe(event?.kind);
        if (floor === 1 || floorKind(seed, floor, ECLIPSE) !== 'normal') expect(event).toBeUndefined();
        if (!event) continue;
        seen++;
        kinds.add(event.kind);
        const plan = world.arena.tiles as Floor;
        if (event.kind !== 'hunter') expect(event.room).not.toBe(plan.startRoom);
        const weight = DEF.kinds.find((k) => k.kind === event.kind)!;
        expect(floor, event.kind).toBeGreaterThanOrEqual(weight.minDepth);
      }
    }
    expect(seen).toBeGreaterThan(200);
    expect([...kinds].sort()).toEqual(DEF.kinds.map((k) => k.kind).sort());
  });

  it('the chance rises with depth up to its cap; at most one event a floor (one choice)', () => {
    const plan = startRun(SEED, {}, 3, ECL).world.arena.tiles as Floor;
    const rate = (floor: number) => {
      let n = 0;
      for (let s = 0; s < 1500; s++) if (chooseSimaEvent(s, floor, plan, 'normal', DEF)) n++;
      return n / 1500;
    };
    expect(rate(1)).toBe(0);
    expect(rate(30)).toBeGreaterThan(rate(3));
    expect(rate(30)).toBeLessThanOrEqual(DEF.max + 0.04);
    expect(chooseSimaEvent(SEED, 30, plan, 'collapse', DEF)).toBeNull();
  });
});

describe('Sima floor events: rules', () => {
  it('treasure vault: tougher guards; the chest opens only once they are down and a player reaches it, and it offers items', () => {
    const { world } = withEvent('vault');
    const event = world.simaEvent!;
    const guards = world.enemies.filter((e) => e.wakeRoom?.x === event.rect.x && e.wakeRoom?.y === event.rect.y);
    expect(guards.length).toBeGreaterThanOrEqual(DEF.vault.guards);
    const fresh = startRun(SEED, {}, FLOOR, ECL).world;
    expect(world.enemies.length).toBe(fresh.enemies.length + DEF.vault.guards);
    expect(tick(at(world, event.pos), 50).simaEvent!.done).toBe(false);
    const opened = tick(at(killAll(world), event.pos), 50).simaEvent!;
    expect(opened).toMatchObject({ done: true, outcome: 'opened' });
    expect(rewardsItems(opened)).toBe(true);
    expect(rewardOffer(SEED, FLOOR, 'p1', [])).toHaveLength(3);
    expect(rewardOffer(SEED, FLOOR, 'p1', [])).toEqual(rewardOffer(SEED, FLOOR, 'p1', []));
  });

  it('eclipse shrine: the pact blesses and curses for 3 floors, then it is gone; declining changes nothing', () => {
    const { world } = withEvent('shrine');
    expect(nearSimaEvent(at(world, world.simaEvent!.pos), DEF, 'shrine')).toBe(true);
    expect(nearSimaEvent(world, DEF, 'shrine')).toBe(false);
    const declined = declinePact(world);
    expect(declined.simaPact).toBeUndefined();
    expect(declined.simaEvent).toMatchObject({ done: true, outcome: 'declined' });
    const edge = { ...world, simaEvent: { ...world.simaEvent!, pact: 'edge' as const } };
    const { world: blessed } = acceptPact(edge, DEF, 'easy');
    expect(blessed.simaPact).toMatchObject({ id: 'edge', floorsLeft: 3, playerDamage: 1.3, enemySpeed: 1.2 });
    expect(enemyTimeScale(blessed)).toBeCloseTo(1.2);
    expect(acceptPact(blessed, DEF, 'easy').world).toBe(blessed);
    let w = blessed;
    for (let i = 0; i < 2; i++) {
      w = descendPact(w);
      expect(w.simaPact).toBeDefined();
    }
    expect(descendPact(w).simaPact).toBeUndefined();
  });

  it('shrine: the blood pact hurts harder while it lasts, the sand pact pays time; on nightmare the curse bites harder', () => {
    const { world } = withEvent('shrine');
    const blood = acceptPact({ ...world, simaEvent: { ...world.simaEvent!, pact: 'blood' } }, DEF, 'easy').world;
    const hurt = (w: WorldState) => 1000 - hitPlayer({ ...w, enemyScale: undefined, player: { ...createPlayer(vec(0, 0), 'cubone'), hp: 1000, maxHp: 1000 } }, { damage: 20 }).player.hp;
    expect(hurt(blood)).toBe(26);
    expect(acceptPact({ ...world, simaEvent: { ...world.simaEvent!, pact: 'sand' } }, DEF, 'easy').bonusMs).toBe(30_000);
    const edge = DEF.shrine.pacts.find((p) => p.id === 'edge')!;
    expect(pactEffects(edge, 'easy', DEF).enemySpeed).toBeCloseTo(1.2);
    expect(pactEffects(edge, 'hard', DEF).enemySpeed).toBeCloseTo(1.2);
    expect(pactEffects(edge, 'nightmare', DEF).enemySpeed).toBeCloseTo(1.3);
  });

  it('monster house: a room full of sleepers that all wake as soon as a player walks in', () => {
    const { world } = withEvent('monsterHouse');
    const event = world.simaEvent!;
    const sleepers = (w: WorldState) => w.enemies.filter((e) => e.wakeRoom?.x === event.rect.x && e.wakeRoom?.y === event.rect.y);
    expect(sleepers(world).length).toBeGreaterThanOrEqual(DEF.monsterHouse.extra);
    expect(sleepers(world).every((e) => e.ai.mode === 'asleep')).toBe(true);
    const inside = step(at(world, { x: event.rect.x + 40, y: event.rect.y + 40 }), IDLE, FIXED_DT_MS);
    expect(sleepers(inside).every((e) => e.ai.mode !== 'asleep')).toBe(true);
    expect(inside.simaEvent!.woke).toBe(true);
  });

  it('time crystal: +20 s once if touched before it fades; nothing once it has faded', () => {
    const { world, run: r } = withEvent('crystal');
    const event = world.simaEvent!;
    const taken = tick(at(world, event.pos), 50);
    expect(taken.simaEvent).toMatchObject({ done: true, outcome: 'taken' });
    const paid = progressRun(r, taken);
    expect(paid.run.clockMs).toBe(r.clockMs! + DEF.crystal.bonusMs);
    expect(paid.bonusMs).toBe(DEF.crystal.bonusMs);
    expect(progressRun(paid.run, taken).run.clockMs).toBe(paid.run.clockMs);
    const faded = tick(world, DEF.crystal.fadeMs + 50);
    expect(faded.simaEvent).toMatchObject({ done: true, outcome: 'faded' });
    expect(tick(at(faded, event.pos), 50).simaEvent!.outcome).toBe('faded');
    expect(progressRun(r, faded).run.clockMs).toBe(r.clockMs);
  });

  it('merchant echo: an Oran Berry heals a share of max HP; the item on sale is seeded per floor and player', () => {
    const p = { ...createPlayer(vec(0, 0), 'cubone'), hp: 10 };
    expect(eatBought(p, DEF.merchant.berryHeal).hp).toBeCloseTo(10 + p.maxHp * DEF.merchant.berryHeal);
    expect(eatBought({ ...p, hp: p.maxHp }, 0.4).hp).toBe(p.maxHp);
    expect(merchantItem(SEED, FLOOR, 'p1', [])).toBe(merchantItem(SEED, FLOOR, 'p1', []));
    expect(merchantItem(SEED, FLOOR, 'p1', [])).not.toBeNull();
  });

  it('monster nest: hatches a weak enemy on a timer while stirred, at most 3 alive, pays nothing, stops once destroyed', () => {
    const { world } = withEvent('nest');
    const event = world.simaEvent!;
    const nest = world.enemies.find((e) => e.id === event.nestId)!;
    expect(nest.species).toBe(DEF.nest.species);
    expect(tick(world, DEF.nest.spawnEveryMs * 2).enemies.length).toBe(world.enemies.length);
    const near = at(world, { x: event.rect.x + 40, y: event.rect.y + 40 });
    const once = tick(near, DEF.nest.spawnEveryMs + 20);
    expect(once.enemies.length).toBe(world.enemies.length + 1);
    const hatched = once.enemies.at(-1)!;
    expect(DEF.nest.brood).toContain(hatched.species);
    expect(hatched.spent).toBe(true);
    expect(hatched.ai.mode).not.toBe('asleep');
    const many = tick(near, DEF.nest.spawnEveryMs * 6);
    expect(many.enemies.length - world.enemies.length).toBe(DEF.nest.maxAlive);
    const broken = tick(killAll(once, (id) => id === event.nestId), DEF.nest.spawnEveryMs * 2);
    expect(broken.simaEvent).toMatchObject({ done: true, outcome: 'destroyed' });
    expect(broken.enemies.length).toBe(once.enemies.length);
  });

  it('wave room: walking in locks the doors, waves come one after another, clearing opens the doors and pays time and items', () => {
    const { world, run: r, floor } = withEvent('waves');
    const event = world.simaEvent!;
    const doors = doorTiles(floor, floor.rooms[event.room]!);
    expect(doors.length).toBeGreaterThan(0);
    const inside = at(world, { x: event.rect.x + 40, y: event.rect.y + 40 });
    let w = tick(inside, 20);
    expect(w.simaEvent).toMatchObject({ wave: 1, sealed: true });
    for (const i of doors) expect(isWall(w.arena.tiles!, i % floor.cols, Math.floor(i / floor.cols))).toBe(true);
    expect(w.simaEvent!.ids).toHaveLength(DEF.waves.waves[0]!);
    for (let wave = 2; wave <= DEF.waves.waves.length; wave++) {
      w = tick(killAll(w, (id) => w.simaEvent!.ids!.includes(id)), 20);
      expect(w.simaEvent!.wave).toBe(wave - 1);
      w = tick(w, DEF.waves.pauseMs + 20);
      expect(w.simaEvent!.wave).toBe(wave);
      expect(w.simaEvent!.ids).toHaveLength(DEF.waves.waves[wave - 1]!);
    }
    w = tick(killAll(w, (id) => w.simaEvent!.ids!.includes(id)), 20);
    expect(w.simaEvent).toMatchObject({ done: true, outcome: 'cleared', sealed: false });
    for (const i of doors) expect(isWall(w.arena.tiles!, i % floor.cols, Math.floor(i / floor.cols))).toBe(false);
    expect(rewardsItems(w.simaEvent)).toBe(true);
    expect(progressRun(r, w).run.clockMs).toBe(r.clockMs! + DEF.waves.bonusMs);
  });

  it('ambush: nothing until a player crosses into the room, then a tell, then the hidden enemies burst out awake', () => {
    const { world } = withEvent('ambush');
    const event = world.simaEvent!;
    expect(event.spots).toHaveLength(DEF.ambush.count);
    expect(tick(world, 3000).enemies.length).toBe(world.enemies.length);
    const crossed = tick(at(world, { x: event.rect.x + 40, y: event.rect.y + 40 }), 20);
    expect(crossed.simaEvent).toMatchObject({ woke: true, done: false });
    expect(crossed.enemies.length).toBe(world.enemies.length);
    const sprung = tick(crossed, DEF.ambush.tellMs + 40);
    expect(sprung.simaEvent).toMatchObject({ done: true, outcome: 'sprung' });
    const fresh = sprung.enemies.slice(world.enemies.length);
    expect(fresh).toHaveLength(DEF.ambush.count);
    expect(fresh.every((e) => e.ai.mode !== 'asleep' && e.ai.mode !== 'dormant')).toBe(true);
  });

  it('hunter: comes out after its delay, cannot be felled, and is slower than a walking (let alone rolling) player with a long wind-up', () => {
    const { world } = withEvent('hunter');
    expect(tick(world, DEF.hunter.delayMs - 100).enemies.length).toBe(world.enemies.length);
    const loosed = tick(world, DEF.hunter.delayMs + 40);
    const hunter = loosed.enemies.at(-1)!;
    expect(hunter.species).toBe('eclipse-hunter');
    expect(loosed.simaEvent!.outcome).toBe('loosed');
    expect(ECLIPSE_HUNTER.walkSpeed).toBeLessThan(TUNING.player.moveSpeed);
    expect(ECLIPSE_HUNTER.telegraphMs).toBeGreaterThanOrEqual(600);
    // A swing at it: shrugged off.
    let w: WorldState = { ...loosed, enemies: loosed.enemies.map((e) => (e.id === hunter.id ? { ...e, ai: { ...e.ai, mode: 'dormant' as const } } : { ...e, alive: false, hp: 0 })) };
    w = at(w, { x: hunter.pos.x - 30, y: hunter.pos.y });
    w = run(w, 600, input({ aim: hunter.pos, slots: [true, false], slotMouse: [true, false] }));
    expect(w.enemies.find((e) => e.id === hunter.id)!.hp).toBe(hunter.hp);
  });
});

describe('Sima floor events: co-op', () => {
  it('the host owns the event: its progress, the pact and the wave room doors reach a guest through the snapshot and the wire', () => {
    const host = withEvent('waves');
    const guestWorld: WorldState = { ...host.world, role: 'guest', localId: 'p2' };
    let h = tick(at(host.world, { x: host.world.simaEvent!.rect.x + 40, y: host.world.simaEvent!.rect.y + 40 }), 20);
    h = { ...h, simaPact: { id: 'edge', floorsLeft: 2, playerDamage: 1.3, enemySpeed: 1.2, enemyDamage: 1 } };
    const wire = decodeMessage(encodeMessage({ t: 'snap', at: 0, floor: FLOOR, s: hostSnapshot(h) }));
    const snap = wire && wire.t === 'snap' ? wire.s : null;
    expect(snap?.sima).toEqual(simaSync(h));
    const g = applyHostSnapshot(guestWorld, snap!);
    expect(g.simaEvent).toMatchObject({ wave: 1, sealed: true, done: false });
    expect(g.simaPact).toEqual(h.simaPact);
    const door = h.simaEvent!.doors![0]!;
    expect(isWall(g.arena.tiles!, door % host.floor.cols, Math.floor(door / host.floor.cols))).toBe(true);
    // A guest never runs the event itself.
    const stepped = step(at(guestWorld, { x: guestWorld.simaEvent!.rect.x + 40, y: guestWorld.simaEvent!.rect.y + 40 }), IDLE, FIXED_DT_MS);
    expect(stepped.simaEvent!.wave).toBe(0);
    // Without an event or pact on the host, the guest's pact goes too.
    expect(applySimaSync({ ...g }, undefined).simaPact).toBeUndefined();
  });
});
