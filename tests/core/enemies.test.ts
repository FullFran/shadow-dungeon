import { describe, expect, it } from 'vitest';
import { GASTLY, POOCHYENA } from '../../src/data/enemies';
import { ROOMS } from '../../src/data/rooms';
import { TUNING } from '../../src/data/tuning';
import { confineCircle } from '../../src/core/geometry';
import { atExit, loadRoom, roomCleared } from '../../src/core/rooms';
import type { EnemyState, GameEvent, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { distance, vec, type Vec2 } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE, input, ticksFor } from './helpers';

const PLAYER = vec(400, 300);
const OBSTACLE = { x: 500, y: 280, width: 40, height: 40 };

function arena(enemies: [EnemyState['species'], Vec2][], obstacles = [OBSTACLE]): WorldState {
  let state = createWorld({ seed: 1, arena: { width: 800, height: 600, obstacles }, playerPos: PLAYER });
  for (const [species, pos] of enemies) state = spawnEnemy(state, species, pos);
  return state;
}

const first = (state: WorldState) => state.enemies[0]!;

/** Steps with the same input until `until` holds (or `maxTicks`), collecting events. */
function stepUntil(state: WorldState, until: (s: WorldState) => boolean, maxTicks = 600, playerInput: PlayerInput = IDLE) {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < maxTicks && !until(current); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

function advance(state: WorldState, ms: number, playerInput: PlayerInput = IDLE) {
  let ticks = ticksFor(ms);
  return stepUntil(state, () => ticks-- <= 0, Number.POSITIVE_INFINITY, playerInput);
}

const playerDamaged = (events: GameEvent[]) => events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');
const inMode = (mode: EnemyState['ai']['mode']) => (s: WorldState) => first(s).ai.mode === mode;

describe('dormant enemies', () => {
  it('never act', () => {
    const state = spawnEnemy(arena([]), 'poochyena', vec(450, 300), { dormant: true });
    const after = advance(state, 3000).state;
    expect(first(after).pos).toEqual(vec(450, 300));
    expect(first(after).ai.mode).toBe('dormant');
  });
});

describe('Poochyena', () => {
  it('hunts the player from afar', () => {
    const start = arena([['poochyena', vec(100, 300)]]);
    const after = advance(start, 1000).state;
    expect(first(after).ai.mode).toBe('approach');
    expect(distance(first(after).pos, PLAYER)).toBeLessThan(distance(first(start).pos, PLAYER) - 50);
  });

  it('telegraphs the lunge standing still for the data-driven wind-up', () => {
    const start = arena([['poochyena', vec(320, 300)]]);
    const { state, events } = stepUntil(start, inMode('telegraph'));
    expect(events).toContainEqual({ type: 'enemyTelegraph', enemyId: first(state).id, attack: 'lunge', durationMs: POOCHYENA.telegraphMs });
    const held = advance(state, POOCHYENA.telegraphMs - 50).state;
    expect(first(held).ai.mode).toBe('telegraph');
    expect(first(held).pos).toEqual(first(state).pos);
  });

  it('lunges in a straight line and hurts a player who stays put, then recovers briefly', () => {
    const start = arena([['poochyena', vec(320, 300)]]);
    const telegraph = stepUntil(start, inMode('telegraph')).state;
    const { state, events } = stepUntil(telegraph, inMode('recover'));
    expect(events.some((e) => e.type === 'enemyAttack')).toBe(true);
    expect(playerDamaged(events)).toBe(true);
    expect(first(state).ai.contact).toBe('hit');
    expect(first(state).ai.modeDurationMs).toBe(POOCHYENA.hitRecoverMs);
    expect(first(state).pos.y).toBeCloseTo(300);
  });

  it('stays exposed for longer when the player rolls through the lunge', () => {
    const start = arena([['poochyena', vec(320, 300)]]);
    const telegraph = stepUntil(start, inMode('telegraph')).state;
    // Roll towards it right as the lunge starts: i-frames cover the contact.
    const lunging = stepUntil(telegraph, inMode('attack')).state;
    const rolled = step(lunging, input({ move: vec(-1, 0), roll: true }), FIXED_DT_MS);
    const { state, events } = stepUntil(rolled, inMode('recover'));
    const all = [...rolled.events, ...events];
    expect(playerDamaged(all)).toBe(false);
    expect(all.some((e) => e.type === 'hitDodged' || e.type === 'perfectDodge')).toBe(true);
    expect(first(state).ai.contact).toBe('dodged');
    expect(first(state).ai.modeDurationMs).toBe(POOCHYENA.missRecoverMs);
    expect(POOCHYENA.missRecoverMs).toBeGreaterThan(POOCHYENA.hitRecoverMs);
  });

  it('does not act while staggered, and a stagger cancels its wind-up', () => {
    const start = arena([['poochyena', vec(320, 300)]]);
    const telegraph = stepUntil(start, inMode('telegraph')).state;
    expect(first(telegraph).ai.mode).toBe('telegraph');
    const staggered = { ...telegraph, enemies: [{ ...first(telegraph), hitstunMs: 400 }] };
    const after = advance(staggered, 300).state;
    expect(first(after).pos).toEqual(first(telegraph).pos);
    expect(first(after).ai.mode).not.toBe('telegraph');
    expect(first(after).ai.mode).not.toBe('attack');
  });

  it('cannot walk through obstacles', () => {
    const start = arena([['poochyena', vec(600, 300)]]);
    const { state } = stepUntil(start, () => false, ticksFor(2500));
    const pos = first(state).pos;
    // It makes its way around the block towards the player instead of standing still.
    expect(distance(pos, PLAYER)).toBeLessThan(140);
    const r = first(state).radius;
    const overlaps =
      pos.x + r > OBSTACLE.x && pos.x - r < OBSTACLE.x + OBSTACLE.width && pos.y + r > OBSTACLE.y && pos.y - r < OBSTACLE.y + OBSTACLE.height;
    expect(overlaps).toBe(false);
  });
});

describe('Gastly', () => {
  it('backs away when the player is too close', () => {
    const start = arena([['gastly', vec(430, 230)]], []);
    const before = distance(first(start).pos, PLAYER);
    expect(before).toBeLessThan(GASTLY.minDistance);
    const after = advance(start, 600).state;
    expect(distance(first(after).pos, PLAYER)).toBeGreaterThan(before + 10);
  });

  it('closes in when the player is too far', () => {
    const start = arena([['gastly', vec(400, 20)]], []);
    const after = advance(start, 600).state;
    expect(distance(first(after).pos, PLAYER)).toBeLessThan(280 - 10);
  });

  it('telegraphs, then fires a slow readable ball that hurts on arrival', () => {
    const start = arena([['gastly', vec(400, 130)]], []);
    const telegraph = stepUntil(start, inMode('telegraph'));
    expect(telegraph.events).toContainEqual({
      type: 'enemyTelegraph',
      enemyId: first(start).id,
      attack: 'ball',
      durationMs: GASTLY.telegraphMs,
    });
    const fired = stepUntil(telegraph.state, (s) => s.projectiles.length > 0).state;
    const ball = fired.projectiles[0]!;
    expect(ball.owner).toBe('enemy');
    expect(Math.hypot(ball.vel.x, ball.vel.y)).toBeCloseTo(GASTLY.projectile.speed);
    expect(GASTLY.projectile.speed).toBeLessThan(TUNING.player.moveSpeed);
    const landed = stepUntil(fired, (s) => s.projectiles.length === 0);
    expect(playerDamaged(landed.events)).toBe(true);
  });

  it('floats over obstacles', () => {
    const inside = vec(OBSTACLE.x + 20, OBSTACLE.y + 20);
    const arenaDef = { width: 800, height: 600, obstacles: [OBSTACLE] };
    expect(confineCircle(arenaDef, inside, 12, false)).toEqual(inside);
    expect(confineCircle(arenaDef, inside, 12, true)).not.toEqual(inside);
  });
});

describe('rooms', () => {
  it('loads the sandbox: arena, player start, its enemies and a fresh Disguise', () => {
    const base = createWorld({ seed: 1, arena: { width: 10, height: 10 }, playerPos: vec(5, 5) });
    const broken = { ...base, player: { ...base.player, disguiseBroken: true } };
    const room = loadRoom(broken, 'sandbox');
    const def = ROOMS.sandbox;
    expect(room.arena).toEqual({ width: def.width, height: def.height, obstacles: def.obstacles });
    expect(room.player.pos).toEqual(vec(def.playerStart.x, def.playerStart.y));
    expect(room.player.disguiseBroken).toBe(false);
    expect(room.enemies.map((e) => e.species).sort()).toEqual(def.spawns.map((s) => s.species).sort());
    expect(room.enemies.filter((e) => e.species === 'poochyena').length).toBeGreaterThanOrEqual(2);
    expect(room.enemies.some((e) => e.species === 'gastly')).toBe(true);
  });

  it('opens the exit only once every enemy is down', () => {
    const room = loadRoom(createWorld({ seed: 1, arena: { width: 10, height: 10 }, playerPos: vec(5, 5) }), 'sandbox');
    const exit = ROOMS.sandbox.exit!;
    const onExit = { ...room, player: { ...room.player, pos: vec(exit.x + exit.width / 2, exit.y + exit.height / 2) } };
    expect(roomCleared(onExit)).toBe(false);
    expect(atExit(onExit, 'sandbox')).toBe(false);
    const cleared = { ...onExit, enemies: onExit.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) };
    expect(roomCleared(cleared)).toBe(true);
    expect(atExit(cleared, 'sandbox')).toBe(true);
  });
});
