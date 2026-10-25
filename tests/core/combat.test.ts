import { describe, expect, it } from 'vitest';
import { MOVES, type MoveId } from '../../src/data/moves';
import { TUNING } from '../../src/data/tuning';
import { computeDamage } from '../../src/core/damage';
import type { PlayerInput, WorldState } from '../../src/core/state';
import { hitPlayer, step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { createWorld, enterRoom, spawnEnemy } from '../../src/core/world';
import { vec, type Vec2 } from '../../src/core/vec';
import type { SpeciesId } from '../../src/data/species';
import { ticksFor } from './helpers';

const PLAYER = vec(400, 300);
const RIGHT = vec(600, 300);

function arena(loadout: [MoveId, MoveId], enemies: [SpeciesId, Vec2][] = []): WorldState {
  let state = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: PLAYER, loadout });
  // Dormant: these tests isolate the player's moves from enemy behaviour (enemies.test.ts).
  for (const [species, pos] of enemies) state = spawnEnemy(state, species, pos, { dormant: true });
  return state;
}

const held = (slots: boolean[], aim = RIGHT, extra: Partial<PlayerInput> = {}): PlayerInput => ({
  move: vec(0, 0),
  aim,
  roll: false,
  slots,
  lock: false,
  wheel: 0,
  view: { x: 0, y: 0, width: 800, height: 600 },
  ...extra,
});

/** Steps tick by tick, collecting every event. */
function advance(state: WorldState, playerInput: PlayerInput, ms: number) {
  let current = state;
  const events: WorldState['events'] = [];
  for (let i = 0; i < ticksFor(ms); i++) {
    current = step(current, playerInput, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

/** Holds a slot for `holdMs` (at least one tick), releases it and lets `afterMs` pass. */
function use(state: WorldState, slot: number, holdMs: number, afterMs: number, aim = RIGHT) {
  const pressed = [false, false];
  pressed[slot] = true;
  const a = advance(state, held(pressed, aim), Math.max(holdMs, FIXED_DT_MS));
  const b = advance(a.state, held([false, false], aim), afterMs);
  return { state: b.state, events: [...a.events, ...b.events] };
}

const totalMs = (id: MoveId) => MOVES[id].windupMs + MOVES[id].activeMs + MOVES[id].recoveryMs;
const enemyHits = (events: WorldState['events']) => events.filter((e) => e.type === 'enemyHit');

describe('fast move phases (Shadow Claw)', () => {
  const claw = MOVES['shadow-claw'];

  it('winds up without hitting, hits once while active, then recovers back to idle', () => {
    const start = arena(['shadow-claw', 'play-rough'], [['gastly', vec(425, 300)]]);
    const duringWindup = use(start, 0, FIXED_DT_MS, claw.windupMs - 2 * FIXED_DT_MS);
    expect(duringWindup.state.player.action?.phase).toBe('windup');
    expect(enemyHits(duringWindup.events)).toHaveLength(0);

    const afterActive = advance(duringWindup.state, held([false, false]), claw.activeMs + 3 * FIXED_DT_MS);
    expect(enemyHits(afterActive.events)).toHaveLength(1);
    expect(afterActive.state.player.action?.phase).toBe('recovery');

    const done = advance(afterActive.state, held([false, false]), claw.recoveryMs);
    expect(done.state.player.action).toBeNull();
    expect(done.state.player.stamina).toBe(TUNING.stamina.max);
  });

  it('only hits inside the arc in front of the aim', () => {
    const start = arena(['shadow-claw', 'play-rough'], [
      ['gastly', vec(425, 300)], // in front
      ['gastly', vec(375, 300)], // behind
      ['gastly', vec(520, 300)], // too far
    ]);
    const { events } = use(start, 0, FIXED_DT_MS, totalMs('shadow-claw'));
    expect(enemyHits(events).map((e) => e.enemyId)).toEqual([start.enemies[0]!.id]);
  });

  it('cannot start while rolling, and the roll cannot start mid-move', () => {
    const rolling = advance(arena(['shadow-claw', 'play-rough']), held([false, false], RIGHT, { roll: true }), FIXED_DT_MS);
    const tried = advance(rolling.state, held([true, false]), FIXED_DT_MS);
    expect(tried.state.player.action).toBeNull();

    const attacking = advance(arena(['shadow-claw', 'play-rough']), held([true, false]), FIXED_DT_MS);
    const rollTry = advance(attacking.state, held([true, false], RIGHT, { roll: true }), FIXED_DT_MS);
    expect(rollTry.state.player.roll).toBeNull();
  });
});

describe('type effectiveness in combat', () => {
  it('Shadow Claw hurts Gastly twice as much as base and Poochyena half', () => {
    const vsGastly = use(arena(['shadow-claw', 'play-rough'], [['gastly', vec(425, 300)]]), 0, FIXED_DT_MS, totalMs('shadow-claw'));
    const vsPoochyena = use(arena(['shadow-claw', 'play-rough'], [['poochyena', vec(425, 300)]]), 0, FIXED_DT_MS, totalMs('shadow-claw'));
    const [gastlyHit] = enemyHits(vsGastly.events);
    const [poochHit] = enemyHits(vsPoochyena.events);
    expect(gastlyHit).toMatchObject({ effectiveness: 2 });
    expect(poochHit).toMatchObject({ effectiveness: 0.5 });
    if (gastlyHit?.type !== 'enemyHit' || poochHit?.type !== 'enemyHit') throw new Error('expected both hits');
    // 4x apart, up to integer rounding of each hit.
    expect(gastlyHit.damage / poochHit.damage).toBeCloseTo(4, 0);
  });
});

describe('hit reactions', () => {
  it('staggers the enemy and pushes it away from the attacker', () => {
    // A regular enemy: the boss has super armour (boss.test.ts).
    const { state } = use(arena(['shadow-claw', 'play-rough'], [['poochyena', vec(425, 300)]]), 0, FIXED_DT_MS, MOVES['shadow-claw'].windupMs + 40);
    const enemy = state.enemies[0]!;
    expect(enemy.hitstunMs).toBeGreaterThan(0);
    expect(enemy.hp).toBeLessThan(enemy.maxHp);
    const later = advance(state, held([false, false]), 300).state.enemies[0]!;
    expect(later.pos.x).toBeGreaterThan(425 + MOVES['shadow-claw'].knockback * 0.8);
  });

  it('defeats an enemy at 0 HP', () => {
    let state = arena(['shadow-claw', 'play-rough'], [['gastly', vec(425, 300)]]);
    state = { ...state, enemies: state.enemies.map((e) => ({ ...e, hp: 1 })) };
    const { state: after, events } = use(state, 0, FIXED_DT_MS, totalMs('shadow-claw'));
    expect(after.enemies[0]!.alive).toBe(false);
    expect(events).toContainEqual({ type: 'enemyDefeated', enemyId: state.enemies[0]!.id });
  });
});

describe('heavy moves and charge', () => {
  const rough = MOVES['play-rough'];
  const levels = rough.charge!;

  it('spends stamina on press, and is denied without enough', () => {
    const pressed = advance(arena(['shadow-claw', 'play-rough']), held([false, true]), FIXED_DT_MS);
    expect(pressed.state.player.action?.phase).toBe('charging');
    expect(pressed.state.player.stamina).toBe(TUNING.stamina.max - rough.staminaCost);

    const base = arena(['shadow-claw', 'play-rough']);
    const tired = { ...base, player: { ...base.player, stamina: rough.staminaCost - 1 } };
    const denied = advance(tired, held([false, true]), FIXED_DT_MS);
    expect(denied.state.player.action).toBeNull();
    expect(denied.events).toContainEqual({ type: 'moveDenied', moveId: 'play-rough' });
  });

  it('a full charge deals more damage than a tap', () => {
    const target: [SpeciesId, Vec2][] = [['aegislash', vec(430, 300)]];
    const tap = use(arena(['shadow-claw', 'play-rough'], target), 1, FIXED_DT_MS, totalMs('play-rough'));
    const full = use(arena(['shadow-claw', 'play-rough'], target), 1, levels.at(-1)!.holdMs + 50, totalMs('play-rough'));
    expect(tap.events).toContainEqual({ type: 'moveReleased', moveId: 'play-rough', chargeLevel: 0 });
    expect(full.events).toContainEqual({ type: 'moveReleased', moveId: 'play-rough', chargeLevel: levels.length - 1 });
    const damageOf = (events: WorldState['events']) => {
      const hit = enemyHits(events)[0];
      return hit?.type === 'enemyHit' ? hit.damage : 0;
    };
    expect(damageOf(full.events)).toBeGreaterThan(damageOf(tap.events) * 1.5);
  });

  it('charged Shadow Ball flies bigger and faster, hits the first enemy and disappears', () => {
    const ball = MOVES['shadow-ball'];
    const firedAfter = (holdMs: number) => use(arena(['shadow-claw', 'shadow-ball']), 1, holdMs, ball.windupMs + 2 * FIXED_DT_MS);
    const small = firedAfter(FIXED_DT_MS).state.projectiles[0]!;
    const big = firedAfter(ball.charge!.at(-1)!.holdMs + 50).state.projectiles[0]!;
    expect(small.owner).toBe('player');
    expect(big.radius).toBeGreaterThan(small.radius);
    expect(Math.hypot(big.vel.x, big.vel.y)).toBeGreaterThan(Math.hypot(small.vel.x, small.vel.y));

    const hit = use(arena(['shadow-claw', 'shadow-ball'], [['gastly', vec(520, 300)], ['gastly', vec(560, 300)]]), 1, FIXED_DT_MS, 1500);
    expect(enemyHits(hit.events)).toHaveLength(1);
    expect(hit.state.projectiles).toHaveLength(0);
  });

  it('projectiles expire after their lifetime', () => {
    const ball = MOVES['shadow-ball'];
    if (ball.hitbox.kind !== 'projectile') throw new Error('shadow-ball must be a projectile');
    const fired = use(arena(['shadow-claw', 'shadow-ball']), 1, FIXED_DT_MS, ball.windupMs + 2 * FIXED_DT_MS);
    expect(fired.state.projectiles).toHaveLength(1);
    const later = advance(fired.state, held([false, false]), ball.hitbox.lifetimeMs + 50);
    expect(later.state.projectiles).toHaveLength(0);
  });
});

describe('dash strike (Shadow Sneak)', () => {
  it('lunges along the aim and hits what it passes through', () => {
    const sneak = MOVES['shadow-sneak'];
    if (sneak.hitbox.kind !== 'dash') throw new Error('shadow-sneak must be a dash');
    const start = arena(['shadow-sneak', 'play-rough'], [['gastly', vec(455, 300)]]);
    const { state, events } = use(start, 0, FIXED_DT_MS, totalMs('shadow-sneak'));
    expect(state.player.pos.x - PLAYER.x).toBeCloseTo(sneak.hitbox.distance, 0);
    expect(enemyHits(events)).toHaveLength(1);
  });
});

describe('perfect-dodge damage buff', () => {
  it('multiplies the next hit and is consumed by it', () => {
    const target: [SpeciesId, Vec2][] = [['aegislash', vec(425, 300)]];
    const base = arena(['shadow-claw', 'play-rough'], target);
    const buffed = { ...base, player: { ...base.player, nextHitBuff: { multiplier: 1.5, remainingMs: 3000 } } };
    const normal = use(base, 0, FIXED_DT_MS, totalMs('shadow-claw'));
    const boosted = use(buffed, 0, FIXED_DT_MS, totalMs('shadow-claw'));
    const dmg = (events: WorldState['events']) => {
      const hit = enemyHits(events)[0];
      return hit?.type === 'enemyHit' ? hit.damage : 0;
    };
    const claw = MOVES['shadow-claw'];
    const expected = computeDamage({ power: claw.power, moveType: claw.type, attackerTypes: ['ghost', 'fairy'], defenderTypes: ['steel', 'ghost'], multiplier: 1.5 });
    expect(dmg(boosted.events)).toBe(expected.damage);
    expect(dmg(boosted.events)).toBeGreaterThan(dmg(normal.events));
    expect(boosted.state.player.nextHitBuff).toBeNull();
  });
});

describe('Disguise passive', () => {
  it('absorbs the first damaging hit of a room and breaks', () => {
    const start = arena(['shadow-claw', 'play-rough']);
    const first = hitPlayer(start, { damage: 20 });
    expect(first.player.hp).toBe(start.player.maxHp);
    expect(first.player.disguiseBroken).toBe(true);
    expect(first.events).toContainEqual({ type: 'disguiseBroken' });

    const second = hitPlayer(first, { damage: 20 });
    expect(second.player.hp).toBe(start.player.maxHp - 20);
  });

  it('is not spent by dodged hits and resets when entering a room', () => {
    const rolling = advance(arena(['shadow-claw', 'play-rough']), held([false, false], RIGHT, { roll: true, move: vec(1, 0) }), 150);
    const dodged = hitPlayer(rolling.state, { damage: 20 });
    expect(dodged.player.disguiseBroken).toBe(false);

    const broken = hitPlayer(arena(['shadow-claw', 'play-rough']), { damage: 20 });
    expect(enterRoom(broken).player.disguiseBroken).toBe(false);
  });
});

describe('enemy projectiles', () => {
  it('hit the player and are slowed by perfect-dodge slow-mo', () => {
    const start = arena(['shadow-claw', 'play-rough']);
    const projectile = {
      id: 'p-test',
      owner: 'enemy' as const,
      type: 'poison' as const,
      attackerTypes: ['poison', 'ghost'] as const,
      power: 40,
      damageMultiplier: 1,
      pos: vec(300, 300),
      vel: vec(100, 0),
      radius: 6,
      remainingMs: 5000,
      hitstunMs: 0,
      knockback: 0,
      hitIds: [],
    };
    const withShot = { ...start, projectiles: [projectile] };
    const slowed = advance({ ...withShot, slowMoMs: 10_000 }, held([false, false]), 500).state.projectiles[0]!;
    const normal = advance(withShot, held([false, false]), 500).state.projectiles[0]!;
    expect(slowed.pos.x - 300).toBeCloseTo((normal.pos.x - 300) * TUNING.perfectDodge.slowMoScale, 0);

    const landed = advance(withShot, held([false, false]), 1200);
    expect(landed.state.projectiles).toHaveLength(0);
    expect(landed.events.some((e) => e.type === 'disguiseBroken')).toBe(true);
  });
});
