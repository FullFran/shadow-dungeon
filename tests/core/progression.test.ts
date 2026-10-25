import { describe, expect, it } from 'vitest';
import { PROGRESSION } from '../../src/data/progression';
import { TUNING } from '../../src/data/tuning';
import { creditDefeats, levelDamage, levelForXp, levelMaxHp, levelProgress, xpFor } from '../../src/core/progression';
import { startRun } from '../../src/core/run';
import type { GameEvent, HitClaim, PlayerInput, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHitClaims, applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { IDLE, ticksFor } from './helpers';

const ARENA = { width: 800, height: 600 };
const PLAYER = vec(400, 300);

function arena(role: 'host' | 'guest' = 'host', localId = 'p1', enemyHp = 1): WorldState {
  let state = createWorld({ seed: 1, arena: ARENA, playerPos: PLAYER, role, localId });
  state = spawnEnemy(state, 'poochyena', vec(425, 300), { dormant: true });
  return { ...state, enemies: state.enemies.map((e) => ({ ...e, hp: enemyHp })) };
}

/** Swings the fast move to the right and lets it finish, collecting events. */
function swing(state: WorldState, ms = 600): { state: WorldState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  const press: PlayerInput = { ...IDLE, aim: vec(600, 300), slots: [true, false], slotMouse: [true, false] };
  for (let i = 0; i < ticksFor(ms); i++) {
    current = step(current, i === 0 ? press : { ...press, slots: [false, false], slotMouse: [false, false] }, FIXED_DT_MS);
    events.push(...current.events);
  }
  return { state: current, events };
}

describe('experience and level curve', () => {
  it('gives experience by species, growing with depth', () => {
    expect(xpFor('poochyena', 1)).toBe(PROGRESSION.xpBySpecies.poochyena);
    expect(xpFor('poochyena', 3)).toBeCloseTo(PROGRESSION.xpBySpecies.poochyena * (1 + 2 * PROGRESSION.xpPerDepth));
    expect(xpFor('gastly', 2)).toBeGreaterThan(xpFor('gastly', 1));
  });

  it('maps total experience to levels, capped at the end of the table', () => {
    const table = PROGRESSION.levelXp;
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(table[1]! - 1)).toBe(1);
    expect(levelForXp(table[1]!)).toBe(2);
    expect(levelForXp(1e9)).toBe(table.length);
  });

  it('reports progress inside the current level for the XP bar', () => {
    const table = PROGRESSION.levelXp;
    const half = (table[1]! + table[2]!) / 2;
    expect(levelProgress(half)).toEqual({ level: 2, fill: 0.5 });
    expect(levelProgress(1e9).fill).toBe(1);
  });

  it('adds max HP and damage per level', () => {
    expect(levelMaxHp(1)).toBe(TUNING.player.maxHp);
    expect(levelMaxHp(3)).toBe(TUNING.player.maxHp + 2 * PROGRESSION.hpPerLevel);
    expect(levelDamage(1)).toBe(1);
    expect(levelDamage(5)).toBeCloseTo(1 + 4 * PROGRESSION.damagePerLevel);
  });
});

describe('defeated enemies give experience', () => {
  it('a kill gives the experience once, however long the enemy stays down', () => {
    const { state } = swing(arena());
    expect(state.enemies[0]!.alive).toBe(false);
    expect(state.player.xp).toBe(xpFor('poochyena', 1));
    expect(state.player.level).toBe(1);
  });

  it('levelling up raises max HP, heals the gained HP and says so', () => {
    const start = arena();
    const hurt = { ...start, player: { ...start.player, hp: 50, xp: PROGRESSION.levelXp[1]! - 1 } };
    const { state, events } = swing(hurt);
    expect(state.player.level).toBe(2);
    expect(state.player.maxHp).toBe(levelMaxHp(2));
    expect(state.player.hp).toBe(50 + PROGRESSION.hpPerLevel);
    expect(events).toContainEqual({ type: 'levelUp', level: 2 });
  });

  it('several levels at once each raise the stats and each are announced', () => {
    const start = arena();
    const events: GameEvent[] = [];
    const dead = { ...start, enemies: start.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) };
    const jumped = creditDefeats({ ...dead, player: { ...dead.player, level: 3, xp: PROGRESSION.levelXp[3]! - 1 } }, events);
    expect(jumped.player.level).toBe(4);
    expect(events.filter((e) => e.type === 'levelUp')).toEqual([{ type: 'levelUp', level: 4 }]);
    const many = creditDefeats({ ...dead, player: { ...dead.player, xp: 0 }, depth: 30 }, []);
    expect(many.player.level).toBeGreaterThan(2);
    expect(many.player.maxHp).toBe(levelMaxHp(many.player.level));
  });

  it('a higher level hits harder', () => {
    const low = swing(arena('host', 'p1', 500)).events.find((e) => e.type === 'enemyHit');
    const base = arena('host', 'p1', 500);
    const high = swing({ ...base, player: { ...base.player, level: 5 } }).events.find((e) => e.type === 'enemyHit');
    expect(low?.type === 'enemyHit' && high?.type === 'enemyHit' && high.damage > low.damage).toBe(true);
  });

  it('a fainted player gains nothing (no revive through a level-up)', () => {
    const start = arena();
    const dead = { ...start, enemies: start.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) };
    const after = creditDefeats({ ...dead, player: { ...dead.player, hp: 0, xp: PROGRESSION.levelXp[1]! - 1 } }, []);
    expect(after.player.xp).toBe(PROGRESSION.levelXp[1]! - 1);
    expect(after.player.hp).toBe(0);
    // Credited anyway: it never pays out later.
    expect(after.credited).toEqual(['e1']);
  });

  it('the run sets the depth, so deeper floors pay more', () => {
    expect(startRun(5, {}).world.depth).toBe(1);
    expect(startRun(5, {}, 3).world.depth).toBe(3);
  });
});

describe('shared runs: every present player gains the experience', () => {
  it('the host gains it for an enemy a guest finished through a hit claim', () => {
    const host = arena('host', 'p1', 5);
    const claim: HitClaim = {
      id: 'p2:m0:e1',
      playerId: 'p2',
      enemyId: 'e1',
      damage: 10,
      effectiveness: 1,
      hitstunMs: 0,
      knockback: vec(0, 0),
      blocked: false,
    };
    const after = step(applyHitClaims(host, [claim]), IDLE, FIXED_DT_MS);
    expect(after.player.xp).toBe(xpFor('poochyena', 1));
  });

  it('a guest gains it from the snapshot that shows the enemy down, once, even through a stale snapshot', () => {
    const host = arena('host', 'p1', 5);
    const deadHost = { ...host, enemies: host.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) };
    let guest = applyHostSnapshot(arena('guest', 'p2', 5), hostSnapshot(host));
    guest = step(guest, IDLE, FIXED_DT_MS);
    expect(guest.player.xp).toBe(0);
    guest = step(applyHostSnapshot(guest, hostSnapshot(deadHost)), IDLE, FIXED_DT_MS);
    expect(guest.player.xp).toBe(xpFor('poochyena', 1));
    // An older snapshot (drawn in the past) shows it alive again, then down again: no double count.
    guest = step(applyHostSnapshot(guest, hostSnapshot(host)), IDLE, FIXED_DT_MS);
    guest = step(applyHostSnapshot(guest, hostSnapshot(deadHost)), IDLE, FIXED_DT_MS);
    expect(guest.player.xp).toBe(xpFor('poochyena', 1));
  });

  it("a guest's own kill shown at once and then confirmed by the host counts once", () => {
    const { state: killed } = swing(arena('guest', 'p2', 1));
    expect(killed.player.xp).toBe(xpFor('poochyena', 1));
    const host = arena('host', 'p1', 1);
    const confirmed = step(applyHostSnapshot(killed, hostSnapshot({ ...host, enemies: host.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) })), IDLE, FIXED_DT_MS);
    expect(confirmed.player.xp).toBe(xpFor('poochyena', 1));
  });
});
