import { describe, expect, it } from 'vitest';
import { endlessSpawns } from '../../src/core/endless';
import type { Floor } from '../../src/core/dungeon';
import { confineCircle, insideRect, sweepCircle } from '../../src/core/geometry';
import { startRun } from '../../src/core/run';
import { doorTiles, placeSimaEvent } from '../../src/core/sima-events';
import type { EnemyState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { isWall, TILE, tileCenter, tileOf, type TileGrid } from '../../src/core/tiles';
import { add, scale, vec, type Vec2 } from '../../src/core/vec';
import { spawnEnemy } from '../../src/core/world';
import { ENDLESS } from '../../src/data/endless';
import { SIMA_EVENTS } from '../../src/data/sima';
import { TUNING } from '../../src/data/tuning';
import type { SpeciesId } from '../../src/data/species';
import { IDLE } from './helpers';

/**
 * The wave-room soft-lock (odd/tasks/out-of-bounds-fix.md): a Spinarak knocked
 * through the wall into the void while the doors were sealed. Every walker must
 * always end on a walkable tile reachable from the player.
 */

const ECL = 'eclipse-chasm' as const;
const FLOOR = 26;
const NEIGHBOURS = [vec(1, 0), vec(-1, 0), vec(0, 1), vec(0, -1), vec(1, 1), vec(-1, -1), vec(1, -1), vec(-1, 1)];

const floorWorld = (seed: number): WorldState => {
  const started = startRun(seed, {}, FLOOR, ECL).world;
  return { ...started, simaEvent: undefined, enemies: [] };
};

/** The wave room's world: the event placed in the first room that is neither start nor stairs. */
function waveWorld(seed: number): { world: WorldState; floor: Floor } {
  const base = floorWorld(seed);
  const plan = base.arena.tiles as Floor;
  const room = plan.rooms.findIndex((_, i) => i !== plan.startRoom && i !== plan.stairsRoom);
  const world = placeSimaEvent(base, { kind: 'waves', room }, plan, seed, FLOOR, SIMA_EVENTS, endlessSpawns(ENDLESS, FLOOR).pool);
  return { world, floor: plan };
}

const at = (w: WorldState, pos: Vec2): WorldState => ({ ...w, player: { ...w.player, pos } });
const play = (w: WorldState, ms: number): WorldState => {
  let s = w;
  for (let t = 0; t < ms; t += FIXED_DT_MS) s = step(s, IDLE, FIXED_DT_MS);
  return s;
};

/** Tiles reachable on foot (4-connected) from `from`. */
function reachable(grid: TileGrid, from: Vec2): Set<number> {
  const start = tileOf(from);
  const seen = new Set<number>([start.y * grid.cols + start.x]);
  const queue = [start];
  while (queue.length > 0) {
    const t = queue.shift()!;
    for (const d of NEIGHBOURS.slice(0, 4)) {
      const x = t.x + d.x;
      const y = t.y + d.y;
      if (isWall(grid, x, y) || seen.has(y * grid.cols + x)) continue;
      seen.add(y * grid.cols + x);
      queue.push({ x, y });
    }
  }
  return seen;
}

const tileIndex = (grid: TileGrid, pos: Vec2): number => tileOf(pos).y * grid.cols + tileOf(pos).x;

/** Floor tiles touching a wall (sides or corners), every `every`-th one. */
function wallHuggers(grid: TileGrid, every = 1, within?: (x: number, y: number) => boolean): Vec2[] {
  const out: Vec2[] = [];
  let n = 0;
  for (let y = 0; y < grid.rows; y++)
    for (let x = 0; x < grid.cols; x++) {
      if (isWall(grid, x, y) || (within && !within(x, y))) continue;
      if (!NEIGHBOURS.some((d) => isWall(grid, x + d.x, y + d.y))) continue;
      if (n++ % every === 0) out.push(tileCenter({ x, y }));
    }
  return out;
}

function withDormant(w: WorldState, species: SpeciesId, spots: readonly Vec2[], knockback: Vec2): WorldState {
  let s = w;
  for (const spot of spots) {
    s = spawnEnemy(s, species, spot, { dormant: true });
    const e = s.enemies[s.enemies.length - 1]!;
    // Hugging the wall it is pushed towards: the worst case.
    const hug = confineCircle(s.arena, add(spot, scale(knockback, (TILE / 2) / Math.hypot(knockback.x, knockback.y))), e.radius);
    s = { ...s, enemies: s.enemies.map((x) => (x.id === e.id ? { ...x, pos: hug, knockback } : x)) };
  }
  return s;
}

const strays = (w: WorldState, ok: (e: EnemyState) => boolean): string[] =>
  w.enemies.filter((e) => e.alive && !ok(e)).map((e) => `${e.id}@${e.pos.x.toFixed(1)},${e.pos.y.toFixed(1)}`);

describe('out-of-bounds enemies: knockback never tunnels a walker out of the map', () => {
  it('sweep: every walker knocked hard in any direction next to a wall, corner or seal ends on a floor tile reachable from the player', () => {
    for (const seed of [4242, 7]) {
      const w0 = floorWorld(seed);
      const grid = w0.arena.tiles!;
      const region = reachable(grid, w0.player.pos);
      const spots = wallHuggers(grid, 3);
      for (let a = 0; a < 16; a++) {
        const dir = vec(Math.cos((a * Math.PI) / 8), Math.sin((a * Math.PI) / 8));
        for (const magnitude of [45, 90, 160, 400]) {
          const w = play(withDormant(w0, 'spinarak', spots, scale(dir, magnitude)), 700);
          const bad = strays(w, (e) => !isWall(grid, tileOf(e.pos).x, tileOf(e.pos).y) && region.has(tileIndex(grid, e.pos)));
          expect(bad, `seed ${seed} dir ${a} kb ${magnitude}`).toEqual([]);
        }
      }
    }
  });

  it('inside a sealed wave room, walkers knocked at the walls and the sealed doors stay in the room', () => {
    const { world, floor } = waveWorld(4242);
    const event = world.simaEvent!;
    const room = floor.rooms[event.room]!;
    const sealedWorld = play(at(world, add(tileCenter({ x: room.x + 1, y: room.y + 1 }), vec(0, 0))), 50);
    expect(sealedWorld.simaEvent!.sealed).toBe(true);
    const grid = sealedWorld.arena.tiles!;
    const inRoom = (x: number, y: number) => x >= room.x && y >= room.y && x < room.x + room.width && y < room.y + room.height;
    const spots = wallHuggers(grid, 1, inRoom);
    for (let a = 0; a < 16; a++) {
      const dir = vec(Math.cos((a * Math.PI) / 8), Math.sin((a * Math.PI) / 8));
      for (const magnitude of [90, 160, 400]) {
        const w = play(withDormant({ ...sealedWorld, enemies: [] }, 'spinarak', spots, scale(dir, magnitude)), 700);
        const bad = strays(w, (e) => !isWall(grid, tileOf(e.pos).x, tileOf(e.pos).y) && insideRect(e.pos, event.rect));
        expect(bad, `dir ${a} kb ${magnitude}`).toEqual([]);
      }
    }
  });

  it('collision alone (no safety net): the eased knockback, swept, never leaves a centre in a wall tile', () => {
    // The root cause, apart from core/bounds.ts: 16 917 of these 230 400 samples ended in rock before the fix.
    const w0 = floorWorld(4242);
    const grid = w0.arena.tiles!;
    const bad: string[] = [];
    for (const spot of wallHuggers(grid, 2))
      for (const radius of [10, 14, 20])
        for (let a = 0; a < 16; a++)
          for (const magnitude of [30, 90, 160]) {
            const dir = vec(Math.cos((a * Math.PI) / 8), Math.sin((a * Math.PI) / 8));
            let pos = confineCircle(w0.arena, add(spot, scale(dir, TILE / 2)), radius);
            let kb = scale(dir, magnitude);
            for (let t = 0; t < 40; t++) {
              const push = scale(kb, TUNING.combat.knockbackPerTick);
              kb = scale(kb, 1 - TUNING.combat.knockbackPerTick);
              pos = sweepCircle(w0.arena, pos, push, radius);
            }
            if (isWall(grid, tileOf(pos).x, tileOf(pos).y)) bad.push(`${spot.x},${spot.y} r${radius} a${a} kb${magnitude}`);
          }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('sweepCircle sub-steps: a long push into a thin wall stops at the wall instead of passing it', () => {
    const grid: TileGrid = { cols: 5, rows: 3, tiles: [1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1] };
    const arena = { width: 5 * TILE, height: 3 * TILE, tiles: grid };
    const end = sweepCircle(arena, vec(TILE * 1.5, TILE * 1.5), vec(TILE * 3, 0), 10);
    expect(end.x).toBeLessThanOrEqual(2 * TILE - 10 + 0.001);
  });
});

describe('out-of-bounds enemies: wave room sealing and the safety net', () => {
  it('an enemy standing in a doorway when the doors slam is moved inside the room, not left in the new wall', () => {
    const { world, floor } = waveWorld(4242);
    const event = world.simaEvent!;
    const room = floor.rooms[event.room]!;
    const door = doorTiles(floor, room)[0]!;
    const doorPos = tileCenter({ x: door % floor.cols, y: Math.floor(door / floor.cols) });
    let w = spawnEnemy(world, 'spinarak', doorPos, { dormant: true });
    const id = w.enemies.at(-1)!.id;
    w = play(at(w, tileCenter({ x: room.x + 1, y: room.y + 1 })), 50);
    expect(w.simaEvent!.sealed).toBe(true);
    const e = w.enemies.find((x) => x.id === id)!;
    expect(isWall(w.arena.tiles!, tileOf(e.pos).x, tileOf(e.pos).y)).toBe(false);
    expect(insideRect(e.pos, event.rect)).toBe(true);
  });

  it('a walker buried in solid rock (an older bug, a bad teleport) is snapped back to the nearest reachable floor tile at once', () => {
    const w0 = floorWorld(4242);
    const grid = w0.arena.tiles!;
    let buried: Vec2 | null = null;
    for (let y = 1; y < grid.rows - 1 && !buried; y++)
      for (let x = 1; x < grid.cols - 1 && !buried; x++)
        if (isWall(grid, x, y) && NEIGHBOURS.every((d) => isWall(grid, x + d.x, y + d.y))) buried = tileCenter({ x, y });
    expect(buried).not.toBeNull();
    const w = play(spawnEnemy(w0, 'spinarak', buried!, { dormant: true }), FIXED_DT_MS);
    const e = w.enemies.at(-1)!;
    expect(isWall(grid, tileOf(e.pos).x, tileOf(e.pos).y)).toBe(false);
    expect(reachable(grid, w.player.pos).has(tileIndex(grid, e.pos))).toBe(true);
  });

  for (const species of ['spinarak', 'gastly'] as const) {
    it(`a wave ${species} outside the sealed room for more than 3 s is brought back to a free tile inside it (with a poof)`, () => {
      const { world, floor } = waveWorld(4242);
      const event = world.simaEvent!;
      const room = floor.rooms[event.room]!;
      let w = play(at(world, tileCenter({ x: room.x + 1, y: room.y + 1 })), 50);
      expect(w.simaEvent!.sealed).toBe(true);
      // The wave's enemies hold still (dormant); one is outside: on the floor of the start room, or (a floater) in the rock.
      const plan = w.arena.tiles as Floor;
      const outside = tileCenter(plan.start);
      w = spawnEnemy(w, species, outside, { dormant: true });
      const id = w.enemies.at(-1)!.id;
      w = { ...w, enemies: w.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'dormant' as const } })), simaEvent: { ...w.simaEvent!, ids: [...w.simaEvent!.ids!, id] } };
      const centre = vec(event.rect.x + event.rect.width / 2, event.rect.y + event.rect.height / 2);
      const before = play(w, 2800);
      const waiting = before.enemies.find((e) => e.id === id)!;
      // A walker waits where it is; a floater drifts back on its own over the walls.
      if (species === 'gastly') expect(Math.hypot(waiting.pos.x - centre.x, waiting.pos.y - centre.y)).toBeLessThan(Math.hypot(outside.x - centre.x, outside.y - centre.y));
      else expect(insideRect(waiting.pos, event.rect)).toBe(false);
      const after = play(before, 400);
      const back = after.enemies.find((e) => e.id === id)!;
      expect(insideRect(back.pos, event.rect)).toBe(true);
      expect(isWall(after.arena.tiles!, tileOf(back.pos).x, tileOf(back.pos).y)).toBe(false);
      expect(back.warpMs ?? 0).toBeGreaterThan(0);
    });
  }

  it('failsafe: 60 s sealed with the player inside and no damage dealt to the wave ends the wave room (no rewards from the stuck enemies)', () => {
    const { world, floor } = waveWorld(4242);
    const event = world.simaEvent!;
    const room = floor.rooms[event.room]!;
    let w = play(at(world, tileCenter({ x: room.x + 1, y: room.y + 1 })), 50);
    const ids = w.simaEvent!.ids!;
    expect(ids.length).toBeGreaterThan(0);
    // Out of reach and harmless: every wave enemy holds still (a stand-in for one nobody can get to).
    const freeze = (s: WorldState): WorldState => ({ ...s, enemies: s.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'dormant' as const } })) });
    w = freeze(w);
    const stalled = play(w, 55_000);
    expect(stalled.simaEvent!.done).toBe(false);
    // A blow lands: the clock starts over.
    const hurt: WorldState = { ...stalled, enemies: stalled.enemies.map((e) => (e.id === ids[0] ? { ...e, hp: e.hp - 1 } : e)) };
    expect(play(hurt, 10_000).simaEvent!.done).toBe(false);
    const ended = play(stalled, 6_000);
    expect(ended.simaEvent).toMatchObject({ done: true, sealed: false });
    for (const i of ended.simaEvent!.doors!) expect(isWall(ended.arena.tiles!, i % floor.cols, Math.floor(i / floor.cols))).toBe(false);
    for (const id of ids) expect(ended.enemies.find((e) => e.id === id)).toMatchObject({ alive: false, spent: true });
  });

  it('knockback is clamped: no hit (or guest claim) can push further than the cap', () => {
    expect(TUNING.combat.maxKnockbackPx).toBeGreaterThanOrEqual(120);
    const w0 = floorWorld(4242);
    const start = w0.player.pos;
    const w = play(withDormant(w0, 'spinarak', [start], vec(100_000, 0)), 1500);
    const e = w.enemies.at(-1)!;
    expect(Math.abs(e.pos.x - start.x)).toBeLessThanOrEqual(TUNING.combat.maxKnockbackPx + TILE);
  });
});
