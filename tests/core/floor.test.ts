import { describe, expect, it } from 'vitest';
import { DUNGEON } from '../../src/data/dungeon';
import { wakeEnemies } from '../../src/core/activation';
import { generateFloor, roomRect, type Floor } from '../../src/core/dungeon';
import { floorArena, loadFloor, onStairs } from '../../src/core/floor';
import type { Arena, ProjectileState, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { isWall, lineOfSight, TILE, tileCenter, tileOf, wallAt, type TileGrid } from '../../src/core/tiles';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { input, run } from './helpers';

/**
 * A hand-made 12x8 map: room A (x 1-4), a solid wall column at x 5-6
 * except a one-row gap at y 4, room B (x 7-10). Rows 1-6 are floor.
 */
const MAP = [
  '############',
  '#....##....#',
  '#....##....#',
  '#....##....#',
  '#..........#',
  '#....##....#',
  '#....##....#',
  '############',
];
const GRID: TileGrid = { cols: MAP[0]!.length, rows: MAP.length, tiles: MAP.join('').split('').map((c) => (c === '#' ? 0 : 1)) };
const ARENA: Arena = { width: GRID.cols * TILE, height: GRID.rows * TILE, tiles: GRID };
const ROOM_B = { x: 7 * TILE, y: 1 * TILE, width: 4 * TILE, height: 6 * TILE };

const at = (x: number, y: number): Vec2 => tileCenter({ x, y });

function tiled(playerPos: Vec2, arena: Arena = ARENA): WorldState {
  return createWorld({ seed: 1, arena, playerPos });
}

function enemyProjectile(pos: Vec2, vel: Vec2): ProjectileState {
  return {
    id: 'p99',
    owner: 'enemy',
    type: 'poison',
    attackerTypes: ['ghost'],
    power: 10,
    damageMultiplier: 1,
    pos,
    vel,
    radius: 6,
    remainingMs: 5000,
    hitstunMs: 0,
    knockback: 0,
    hitIds: [],
  };
}

describe('tile collision', () => {
  it('stops the player at a wall instead of walking through it', () => {
    const start = tiled(at(3, 2));
    const pushed = run(start, input({ move: vec(1, 0) }), 120);
    expect(pushed.player.pos.x).toBeLessThanOrEqual(5 * TILE - 10 + 0.01);
    expect(tileOf(pushed.player.pos).x).toBeLessThan(5);
  });

  it('lets the player through the corridor gap', () => {
    const through = run(tiled(at(2, 4)), input({ move: vec(1, 0) }), 180);
    expect(tileOf(through.player.pos).x).toBeGreaterThanOrEqual(7);
  });

  it('does not let a roll tunnel through a wall', () => {
    let state = tiled(at(4, 2));
    for (let i = 0; i < 10; i++) state = run(state, input({ move: vec(1, 0), roll: true }), 30);
    expect(tileOf(state.player.pos).x).toBeLessThan(5);
  });

  it('kills projectiles that hit a wall', () => {
    const state = { ...tiled(at(9, 6)), projectiles: [enemyProjectile(at(3, 2), vec(300, 0))] };
    const later = run(state, input(), 30);
    expect(later.projectiles).toHaveLength(0);
    const open = { ...tiled(at(9, 6)), projectiles: [enemyProjectile(at(1, 4), vec(60, 0))] };
    expect(run(open, input(), 30).projectiles).toHaveLength(1);
  });

  it('stops a Gastly at the walls too (always on usable floor) and keeps it inside the map', () => {
    let state = spawnEnemy(tiled(at(1, 1)), 'gastly', at(9, 2), { dormant: true });
    // A dormant ghost does not act; a knockback towards the wall column stops at it.
    state = { ...state, enemies: state.enemies.map((e) => ({ ...e, knockback: vec(-6 * TILE, 0) })) };
    const later = run(state, input(), 60);
    const ghost = later.enemies[0]!;
    expect(tileOf(ghost.pos).x).toBeGreaterThanOrEqual(7);
    const outward = { ...state, enemies: state.enemies.map((e) => ({ ...e, knockback: vec(0, -20 * TILE) })) };
    const clamped = run(outward, input(), 60).enemies[0]!;
    expect(clamped.pos.y).toBeGreaterThanOrEqual(clamped.radius);
  });

  it('blocks a walking Poochyena knocked into a wall', () => {
    let state = spawnEnemy(tiled(at(1, 1)), 'poochyena', at(8, 2), { dormant: true });
    state = { ...state, enemies: state.enemies.map((e) => ({ ...e, knockback: vec(-4 * TILE, 0) })) };
    const later = run(state, input(), 60);
    expect(tileOf(later.enemies[0]!.pos).x).toBeGreaterThanOrEqual(7);
  });
});

describe('line of sight', () => {
  it('is clear across open floor and blocked by walls', () => {
    expect(lineOfSight(GRID, at(1, 4), at(10, 4))).toBe(true);
    expect(lineOfSight(GRID, at(3, 2), at(8, 2))).toBe(false);
    expect(lineOfSight(GRID, at(2, 2), at(3, 5))).toBe(true);
  });
});

describe('enemy activation', () => {
  const sleeping = (playerPos: Vec2, enemyPos: Vec2) =>
    spawnEnemy(tiled(playerPos), 'poochyena', enemyPos, { sleepIn: ROOM_B });

  it('sleeps: does not move or attack while the player is away', () => {
    const state = sleeping(at(1, 1), at(9, 3));
    const later = run(state, input(), 120);
    expect(later.enemies[0]!.ai.mode).toBe('asleep');
    expect(later.enemies[0]!.pos).toEqual(at(9, 3));
  });

  it('wakes when the player enters its room', () => {
    const state = sleeping(at(7, 6), at(10, 1));
    expect(distance(state.player.pos, state.enemies[0]!.pos)).toBeGreaterThan(DUNGEON.wakeRadius);
    expect(wakeEnemies(state).enemies[0]!.ai.mode).not.toBe('asleep');
  });

  it('wakes within the radius only with line of sight', () => {
    // 3 tiles apart through the solid column: inside the radius, but no line of sight.
    const blocked = sleeping(at(4, 2), at(7, 2));
    expect(distance(blocked.player.pos, blocked.enemies[0]!.pos)).toBeLessThanOrEqual(DUNGEON.wakeRadius);
    expect(wakeEnemies(blocked).enemies[0]!.ai.mode).toBe('asleep');
    // Same distance along the open row: wakes.
    const seen = sleeping(at(4, 4), at(7, 4));
    expect(wakeEnemies({ ...seen, enemies: seen.enemies.map((e) => ({ ...e, wakeRoom: undefined })) }).enemies[0]!.ai.mode).not.toBe('asleep');
  });

  it('wakes when hit and stays awake once the player leaves', () => {
    const state = sleeping(at(1, 1), at(9, 3));
    const hurt = { ...state, enemies: state.enemies.map((e) => ({ ...e, hp: e.hp - 1 })) };
    expect(wakeEnemies(hurt).enemies[0]!.ai.mode).not.toBe('asleep');

    const awake = wakeEnemies(sleeping(at(8, 3), at(9, 3)));
    const away = { ...awake, player: { ...awake.player, pos: at(1, 1) } };
    const later = run(away, input(), 60);
    expect(later.enemies[0]!.ai.mode).not.toBe('asleep');
  });

  it('runs inside the step: the sleeping enemy starts acting once the player walks in', () => {
    let state = sleeping(at(5, 4), at(9, 4));
    state = run(state, input({ move: vec(1, 0) }), 40);
    expect(state.enemies[0]!.ai.mode).not.toBe('asleep');
  });
});

describe('floors in the world', () => {
  const floor: Floor = generateFloor(42, 1);

  it('builds a tiled arena with the stairs tile', () => {
    const arena = floorArena(floor);
    expect(arena.width).toBe(floor.cols * TILE);
    expect(arena.height).toBe(floor.rows * TILE);
    expect(arena.tiles).toBe(floor);
    expect(arena.stairs).toEqual({ x: floor.stairs.x * TILE, y: floor.stairs.y * TILE, width: TILE, height: TILE });
  });

  it('puts the player on the start tile and every spawn asleep in its room', () => {
    const state = loadFloor(tiled(at(1, 1)), floor);
    expect(state.player.pos).toEqual(tileCenter(floor.start));
    expect(state.enemies).toHaveLength(floor.spawns.length);
    state.enemies.forEach((enemy, i) => {
      const spawn = floor.spawns[i]!;
      expect(enemy.species).toBe(spawn.species);
      expect(enemy.pos).toEqual(tileCenter(spawn.tile));
      expect(enemy.ai.mode).toBe('asleep');
      expect(enemy.wakeRoom).toEqual(roomRect(floor.rooms[spawn.room]!));
    });
    expect(state.projectiles).toHaveLength(0);
  });

  it('detects the player standing on the stairs', () => {
    const state = loadFloor(tiled(at(1, 1)), floor);
    expect(onStairs(state)).toBe(false);
    expect(onStairs({ ...state, player: { ...state.player, pos: tileCenter(floor.stairs) } })).toBe(true);
    expect(onStairs(tiled(at(1, 1)))).toBe(false);
  });

  it('never spawns or starts inside a wall', () => {
    for (let seed = 0; seed < 50; seed++) {
      const generated = generateFloor(seed, 3);
      const state = loadFloor(tiled(at(1, 1)), generated);
      expect(wallAt(generated, state.player.pos)).toBe(false);
      for (const e of state.enemies) expect(isWall(generated, tileOf(e.pos).x, tileOf(e.pos).y)).toBe(false);
    }
  });

  it('keeps the existing rect-obstacle arenas working (boss room)', () => {
    const state = createWorld({ seed: 1, arena: { width: 400, height: 300, obstacles: [{ x: 200, y: 100, width: 40, height: 100 }] }, playerPos: vec(150, 150) });
    const pushed = run(state, input({ move: vec(1, 0) }), 60);
    expect(pushed.player.pos.x).toBeLessThanOrEqual(190.01);
    expect(step(state, input(), FIXED_DT_MS).arena.tiles).toBeUndefined();
  });
});
