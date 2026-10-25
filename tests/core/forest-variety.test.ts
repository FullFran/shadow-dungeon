import { describe, expect, it } from 'vitest';
import { CRYPT, FOREST } from '../../src/data/dungeons';
import { DRIFLOON, IMPIDIMP, SHROOMISH } from '../../src/data/enemies';
import { TUNING } from '../../src/data/tuning';
import type { SpawnTuning } from '../../src/data/dungeon';
import { generateFloor } from '../../src/core/dungeon';
import { floorSeed, followToFloor, progressRun, startRun, type RunProgress } from '../../src/core/run';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { tileOf } from '../../src/core/tiles';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { guestEnemyContacts } from '../../src/core/victim';
import { WISP_BERRY, wispCache } from '../../src/core/wisp';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE, ticksFor } from './helpers';

const PLAYER = vec(400, 300);
const arena = (species: EnemyState['species'], pos: Vec2, playerPos = PLAYER): WorldState =>
  spawnEnemy(createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos }), species, pos);
const first = (state: WorldState) => state.enemies[0]!;
const hurt = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');

function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 900, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

describe('new forest species', () => {
  it('Impidimp feints a lunge, sidesteps without hurting, then lunges for real from the side', () => {
    const start = arena('impidimp', vec(480, 300));
    const feinted = stepUntil(start, (s) => first(s).ai.attack === 'sidestep', ticksFor(5000));
    const feint = feinted.events.find((e) => e.type === 'enemyTelegraph' && e.attack === 'feint');
    expect(feint && feint.type === 'enemyTelegraph' ? feint.durationMs : 0).toBe(IMPIDIMP.telegraphMs);
    expect(hurt(feinted.events)).toBe(false);
    const before = first(feinted.state).pos;
    const stepped = stepUntil(feinted.state, (s) => first(s).ai.mode === 'telegraph', ticksFor(2000));
    expect(hurt(stepped.events)).toBe(false);
    // The sidestep goes across the line to the player, not along it.
    expect(Math.abs(first(stepped.state).pos.y - before.y)).toBeGreaterThan(IMPIDIMP.feint!.sidestepDistance * 0.6);
    expect(stepped.events.some((e) => e.type === 'enemyTelegraph' && e.attack === 'lunge' && e.durationMs === IMPIDIMP.feint!.telegraphMs)).toBe(true);
    const struck = stepUntil(stepped.state, (s) => first(s).ai.mode === 'recover', ticksFor(2000));
    expect(hurt(struck.events)).toBe(true);
  });

  it('a guest is never hurt by the sidestep, only by the real lunge', () => {
    const base = arena('impidimp', vec(410, 300));
    const as = (attack: string) => ({ ...base, role: 'guest' as const, enemies: [{ ...first(base), ai: { ...first(base).ai, mode: 'attack' as const, attack, contact: 'none' as const } }] });
    const sidestep: GameEvent[] = [];
    guestEnemyContacts(as('sidestep'), sidestep);
    expect(hurt(sidestep)).toBe(false);
    const lunge: GameEvent[] = [];
    guestEnemyContacts(as('lunge'), lunge);
    expect(hurt(lunge)).toBe(true);
  });

  it('Shroomish marks where it will land, leaps there and hits only on landing', () => {
    const start = arena('shroomish', vec(540, 300));
    const aiming = stepUntil(start, (s) => first(s).ai.mode === 'telegraph' && first(s).ai.aimPoint !== undefined, ticksFor(4000)).state;
    const aim = first(aiming).ai.aimPoint!;
    expect(distance(aim, PLAYER)).toBeLessThanOrEqual(SHROOMISH.radius);
    expect(SHROOMISH.telegraphMs).toBeGreaterThanOrEqual(500);
    const leaping = stepUntil(aiming, (s) => first(s).ai.mode === 'attack', ticksFor(3000)).state;
    // In the air: nothing yet.
    const air = stepUntil(leaping, (s) => first(s).ai.modeMs >= SHROOMISH.leap!.airMs - FIXED_DT_MS * 2, ticksFor(2000));
    expect(hurt(air.events)).toBe(false);
    const landed = stepUntil(air.state, (s) => first(s).ai.mode === 'recover', ticksFor(2000));
    expect(hurt(landed.events)).toBe(true);
    expect(distance(first(landed.state).pos, aim)).toBeLessThan(4);
  });

  it('Shroomish: leaving the marked circle once the aim locks dodges the landing', () => {
    const start = arena('shroomish', vec(540, 300));
    const aiming = stepUntil(start, (s) => first(s).ai.mode === 'telegraph', ticksFor(4000)).state;
    const locked = stepUntil(aiming, (s) => first(s).ai.modeDurationMs - first(s).ai.modeMs <= SHROOMISH.leap!.lockMs, ticksFor(3000)).state;
    const moved = { ...locked, player: { ...locked.player, pos: vec(PLAYER.x, PLAYER.y - SHROOMISH.radius - 40) } };
    const done = stepUntil(moved, (s) => first(s).ai.mode === 'recover', ticksFor(3000));
    expect(hurt(done.events)).toBe(false);
  });

  it('Drifloon releases a ring of slow wisps whose gaps fit the player, turned half a step on the next cast', () => {
    const start = arena('drifloon', vec(520, 300));
    const one = stepUntil(start, (s) => s.projectiles.length > 0, ticksFor(6000)).state;
    const count = DRIFLOON.ring!.count;
    expect(one.projectiles).toHaveLength(count);
    const angles = (ps: WorldState['projectiles']) => ps.map((p) => Math.atan2(p.vel.y, p.vel.x)).sort((a, b) => a - b);
    const a = angles(one.projectiles);
    // Every gap between neighbouring wisps, at the closest distance it keeps, leaves room for the player's body.
    const gapPx = ((2 * Math.PI) / count) * DRIFLOON.minDistance - 2 * DRIFLOON.projectile.radius;
    expect(gapPx).toBeGreaterThan(2 * TUNING.player.radius + 8);
    const cleared = { ...one, projectiles: [] };
    const two = stepUntil(cleared, (s) => s.projectiles.length > 0, ticksFor(8000)).state;
    const b = angles(two.projectiles);
    const half = Math.PI / count;
    const offset = (x: number) => ((x % (2 * half)) + 2 * half) % (2 * half);
    // Compared with the aim of each cast: the second ring sits half a step over.
    const aimA = Math.atan2(PLAYER.y - first(one).pos.y, PLAYER.x - first(one).pos.x);
    const aimB = Math.atan2(two.player.pos.y - first(two).pos.y, two.player.pos.x - first(two).pos.x);
    expect(Math.abs(offset(a[0]! - aimA) - offset(b[0]! - aimB))).toBeCloseTo(half, 1);
  });
});

describe('forest spawns', () => {
  it('a mixed pack places its escorts right after the leader in the same room, drawing like a pack of the same size', () => {
    const tuning: SpawnTuning = { base: 4, perDepth: 0, jitter: 0, maxPerRoom: 4, pool: [{ species: 'impidimp', weights: [1], escort: { species: 'pumpkaboo-small', count: 2 } }] };
    for (let seed = 1; seed <= 20; seed++) {
      const floor = generateFloor(seed, 1, tuning);
      const plain = generateFloor(seed, 1, { ...tuning, pool: [{ species: 'impidimp', weights: [1], pack: 3 }] });
      expect(floor.spawns.map((s) => s.tile)).toEqual(plain.spawns.map((s) => s.tile));
      const rooms = new Map<number, string[]>();
      for (const s of floor.spawns) rooms.set(s.room, [...(rooms.get(s.room) ?? []), s.species]);
      for (const list of rooms.values()) {
        expect(list[0]).toBe('impidimp');
        expect(list.slice(1, 3).every((s) => s === 'pumpkaboo-small')).toBe(true);
      }
    }
  });

  it('keeps forest floor 1 gentle: no Impidimp, Drifloon, Hoothoot or Pumpkaboo Super; all three new species show up deeper', () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      const species = generateFloor(floorSeed(seed, 1), 1, FOREST.spawns).spawns.map((s) => s.species);
      for (const banned of ['impidimp', 'drifloon', 'hoothoot', 'pumpkaboo-super']) expect(species).not.toContain(banned);
      for (const depth of [5, 6, 7]) for (const s of generateFloor(floorSeed(seed, depth), depth, FOREST.spawns).spawns) seen.add(s.species);
    }
    for (const fresh of ['impidimp', 'shroomish', 'drifloon']) expect(seen.has(fresh)).toBe(true);
  });
});

describe('the wandering light (forest event)', () => {
  it('on some forest floors a spirit light leads to a berry cache in a side room, never on the Crypt', () => {
    let lit = 0;
    for (let seed = 1; seed <= 60; seed++) {
      for (const depth of [2, 3, 5, 6, 7]) {
        const fs = floorSeed(seed, depth);
        const floor = generateFloor(fs, depth, FOREST.spawns);
        const cache = wispCache(floor, fs, depth, FOREST);
        expect(wispCache(floor, fs, depth, FOREST)).toEqual(cache);
        expect(wispCache(floor, fs, depth, CRYPT)).toBeNull();
        if (!cache) continue;
        lit++;
        expect(cache.berries).toHaveLength(FOREST.wisp!.berries);
        const room = floor.rooms[cache.room]!;
        expect(cache.room).not.toBe(floor.startRoom);
        if (floor.rooms.length > 2) expect(cache.room).not.toBe(floor.stairsRoom);
        for (const b of cache.berries) {
          expect(b.id).toContain(WISP_BERRY);
          const t = tileOf(b.pos);
          expect(t.x >= room.x && t.x < room.x + room.width && t.y >= room.y && t.y < room.y + room.height).toBe(true);
        }
      }
    }
    expect(lit).toBeGreaterThan(30);
    expect(lit).toBeLessThan(250);
  });

  it('a forest floor with the light carries it in the world, and a guest that follows gets the same cache', () => {
    for (let seed = 1; seed <= 40; seed++) {
      let progress: RunProgress = { ...startRun(seed, {}, 1, 'misty-forest'), entered: false, outcome: null };
      const toStairs = (w: WorldState): WorldState => ({ ...w, player: { ...w.player, pos: vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16) } });
      progress = progressRun(progress.run, toStairs(progress.world));
      if (!progress.world.wisp) continue;
      const cacheIds = progress.world.berries.filter((b) => b.id.includes(WISP_BERRY)).map((b) => b.id);
      expect(cacheIds).toHaveLength(FOREST.wisp!.berries);
      const guest = startRun(seed, {}, 1, 'misty-forest');
      const followed = followToFloor(guest.run, { ...guest.world, role: 'guest' }, 2).world;
      expect(followed.wisp).toEqual(progress.world.wisp);
      expect(followed.berries.map((b) => b.id)).toEqual(progress.world.berries.map((b) => b.id));
      return;
    }
    throw new Error('no lit floor 2 in 40 seeds');
  });
});
