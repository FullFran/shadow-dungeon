import { describe, expect, it } from 'vitest';
import { offerItems } from '../../src/core/items';
import { POOCHYENA } from '../../src/data/enemies';
import { TUNING } from '../../src/data/tuning';
import { flowFieldFrom } from '../../src/core/flow';
import { partyDefeated, presentPlayers, targetOf } from '../../src/core/party';
import { followToFloor, progressRun, startRun } from '../../src/core/run';
import type { GameEvent, HitClaim, WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHitClaims, applyHostSnapshot, applyRemotePlayers, hostSnapshot, playerSnapshot } from '../../src/core/sync';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { vec, type Vec2 } from '../../src/core/vec';
import { input, run, ticksFor } from './helpers';

const ARENA = { width: 1200, height: 600 };

function coopWorld(local: Vec2, role: 'host' | 'guest' = 'host', localId = 'p1'): WorldState {
  return createWorld({ seed: 1, arena: ARENA, playerPos: local, localId, role });
}

/** Adds a remote player at `pos` (as its own peer would report it). */
function withRemote(state: WorldState, id: string, pos: Vec2, overrides: Partial<ReturnType<typeof playerSnapshot>> = {}): WorldState {
  const other = coopWorld(pos, 'guest', id);
  return applyRemotePlayers(state, [{ ...playerSnapshot(other), ...overrides }]);
}

const enemyOf = (state: WorldState) => state.enemies[0]!;

describe('party: N players in one world', () => {
  it('a solo world has one present player, the local one', () => {
    const state = coopWorld(vec(100, 100));
    expect(state.localId).toBe('p1');
    expect(state.role).toBe('host');
    expect(presentPlayers(state).map((p) => p.id)).toEqual(['p1']);
  });

  it('remote players join from their snapshots and never replace the local player', () => {
    let state = withRemote(coopWorld(vec(100, 100)), 'p2', vec(300, 100));
    state = applyRemotePlayers(state, [playerSnapshot(coopWorld(vec(999, 999), 'guest', 'p1'))]);
    expect(state.player.pos).toEqual(vec(100, 100));
    expect(state.remotes.map((r) => r.id)).toEqual(['p2']);
  });

  it('fainted players are not present (no target, no waking)', () => {
    const state = withRemote(coopWorld(vec(100, 100)), 'p2', vec(300, 100), { hp: 0 });
    expect(presentPlayers(state).map((p) => p.id)).toEqual(['p1']);
  });
});

describe('enemy targeting', () => {
  it('an enemy chases the nearest of two players', () => {
    let state = withRemote(coopWorld(vec(100, 300)), 'p2', vec(800, 300));
    state = spawnEnemy(state, 'poochyena', vec(600, 300));
    expect(targetOf(state, enemyOf(state)).id).toBe('p2');
    const after = run(state, input(), ticksFor(500));
    expect(enemyOf(after).pos.x).toBeGreaterThan(600);
  });

  it('breaks distance ties deterministically by player id', () => {
    let state = withRemote(coopWorld(vec(400, 300), 'host', 'p2'), 'p1', vec(800, 300));
    state = spawnEnemy(state, 'poochyena', vec(600, 300));
    expect(targetOf(state, enemyOf(state)).id).toBe('p1');
  });

  it('the flow field measures the walk to the nearest player', () => {
    const grid = { cols: 7, rows: 1, tiles: [1, 1, 1, 1, 1, 1, 1] };
    const field = flowFieldFrom(grid, [
      { x: 0, y: 0 },
      { x: 6, y: 0 },
    ]);
    expect(field.dist).toEqual([0, 1, 2, 3, 2, 1, 0]);
  });
});

describe('peer roles', () => {
  it('a guest world does not run enemy AI', () => {
    let state = spawnEnemy(coopWorld(vec(100, 300), 'guest'), 'poochyena', vec(300, 300));
    state = { ...state, enemies: [{ ...enemyOf(state), ai: { ...enemyOf(state).ai, mode: 'approach' } }] };
    const after = run(state, input(), ticksFor(500));
    expect(enemyOf(after).pos).toEqual(enemyOf(state).pos);
    expect(enemyOf(after).ai).toEqual(enemyOf(state).ai);
  });

  it('a host snapshot replaces the guest enemies (host ids win)', () => {
    let host = spawnEnemy(coopWorld(vec(100, 300)), 'gastly', vec(500, 300));
    host = spawnEnemy(host, 'poochyena', vec(700, 300));
    const guest = spawnEnemy(coopWorld(vec(100, 300), 'guest', 'p2'), 'poochyena', vec(1, 1));
    const synced = applyHostSnapshot(guest, hostSnapshot(host));
    expect(synced.enemies.map((e) => [e.id, e.species, e.pos])).toEqual(host.enemies.map((e) => [e.id, e.species, e.pos]));
    expect(synced.player).toEqual(guest.player);
  });
});

describe('hit claims', () => {
  it('a guest hit on an enemy emits one claim per enemy per swing', () => {
    let state = spawnEnemy(coopWorld(vec(100, 300), 'guest', 'p2'), 'poochyena', vec(130, 300), { dormant: true });
    state = run(state, input({ slots: [true, false], slotMouse: [true, false], aim: vec(200, 300) }), 1);
    let claims: HitClaim[] = [];
    for (let i = 0; i < ticksFor(800); i++) {
      state = step(state, input(), FIXED_DT_MS);
      claims = [...claims, ...state.events.flatMap((e) => (e.type === 'hitClaim' ? [e.claim] : []))];
    }
    expect(claims).toHaveLength(1);
    expect(claims[0]).toMatchObject({ playerId: 'p2', enemyId: enemyOf(state).id });
    expect(claims[0]!.damage).toBeGreaterThan(0);
  });

  it('a solo or host world emits no claims (its own hits are authoritative)', () => {
    let state = spawnEnemy(coopWorld(vec(100, 300)), 'poochyena', vec(130, 300), { dormant: true });
    const events: GameEvent[] = [];
    state = run(state, input({ slots: [true, false], slotMouse: [true, false], aim: vec(200, 300) }), 1);
    for (let i = 0; i < ticksFor(800); i++) {
      state = step(state, input(), FIXED_DT_MS);
      events.push(...state.events);
    }
    expect(events.some((e) => e.type === 'hitClaim')).toBe(false);
    expect(events.some((e) => e.type === 'enemyHit')).toBe(true);
  });

  it('the host applies a remote claim once, however many times it arrives', () => {
    let state = spawnEnemy(coopWorld(vec(100, 300)), 'poochyena', vec(600, 300), { dormant: true });
    const enemy = enemyOf(state);
    const claim: HitClaim = {
      id: 'p2:m4:' + enemy.id,
      playerId: 'p2',
      enemyId: enemy.id,
      damage: 10,
      effectiveness: 1,
      hitstunMs: 200,
      knockback: vec(5, 0),
      blocked: false,
    };
    state = applyHitClaims(state, [claim]);
    state = applyHitClaims(state, [claim, claim]);
    expect(enemyOf(state).hp).toBe(enemy.maxHp - 10);
    expect(enemyOf(state).hitstunMs).toBe(200);
    expect(state.events.filter((e) => e.type === 'enemyHit')).toHaveLength(1);
  });

  it('a claim that empties the hp defeats the enemy', () => {
    let state = spawnEnemy(coopWorld(vec(100, 300)), 'poochyena', vec(600, 300), { dormant: true });
    const enemy = enemyOf(state);
    state = applyHitClaims(state, [
      { id: 'x', playerId: 'p2', enemyId: enemy.id, damage: 9999, effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: false },
    ]);
    expect(enemyOf(state).alive).toBe(false);
    expect(state.events.some((e) => e.type === 'enemyDefeated')).toBe(true);
  });
});

/** A Poochyena mid-lunge sitting on `pos`. */
function lungingAt(state: WorldState, pos: Vec2): WorldState {
  const spawned = spawnEnemy(state, 'poochyena', pos);
  const enemy = enemyOf(spawned);
  return {
    ...spawned,
    enemies: [{ ...enemy, ai: { ...enemy.ai, mode: 'attack', modeMs: 0, modeDurationMs: POOCHYENA.lungeMs, attackDir: vec(1, 0), contact: 'none' } }],
  };
}

describe('victim-side hits', () => {
  it('on the host, an enemy attack overlapping a remote player does not damage it', () => {
    const remotePos = vec(800, 300);
    const state = lungingAt(withRemote(coopWorld(vec(100, 300)), 'p2', remotePos), vec(800, 300));
    const after = step(state, input(), FIXED_DT_MS);
    expect(after.remotes[0]!.player.hp).toBe(TUNING.player.maxHp);
    expect(after.player.hp).toBe(TUNING.player.maxHp);
    expect(after.events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken')).toBe(false);
  });

  it('on a guest, an enemy attack from the snapshot hits the local player once', () => {
    const state = lungingAt(coopWorld(vec(400, 300), 'guest', 'p2'), vec(400, 300));
    let current = step(state, input(), FIXED_DT_MS);
    const firstHurt = current.events.filter((e) => e.type === 'disguiseBroken' || e.type === 'playerHurt');
    expect(firstHurt).toHaveLength(1);
    current = step(current, input(), FIXED_DT_MS);
    expect(current.events.some((e) => e.type === 'disguiseBroken' || e.type === 'playerHurt')).toBe(false);
  });

  it('a guest keeps its own contact record across snapshots of the same attack', () => {
    const host = lungingAt(coopWorld(vec(100, 300)), vec(400, 300));
    let guest = applyHostSnapshot(coopWorld(vec(400, 300), 'guest', 'p2'), hostSnapshot(host));
    guest = step(guest, input(), FIXED_DT_MS);
    expect(enemyOf(guest).ai.contact).toBe('hit');
    const later = { ...host, enemies: [{ ...enemyOf(host), ai: { ...enemyOf(host).ai, modeMs: 50 } }] };
    guest = applyHostSnapshot(guest, hostSnapshot(later));
    expect(enemyOf(guest).ai.contact).toBe('hit');
    guest = step(guest, input(), FIXED_DT_MS);
    expect(guest.events.some((e) => e.type === 'disguiseBroken' || e.type === 'playerHurt')).toBe(false);
  });

  it('a guest rolling through the attack dodges it locally', () => {
    let guest = lungingAt(coopWorld(vec(400, 300), 'guest', 'p2'), vec(700, 300));
    guest = run(guest, input({ roll: true, move: vec(0, 1) }), ticksFor(TUNING.roll.iframesStartMs) + 1);
    guest = { ...guest, enemies: [{ ...enemyOf(guest), pos: guest.player.pos }] };
    guest = step(guest, input(), FIXED_DT_MS);
    expect(guest.events.some((e) => e.type === 'hitDodged' || e.type === 'perfectDodge')).toBe(true);
    expect(guest.player.hp).toBe(TUNING.player.maxHp);
  });
});

describe('shared run: the host moves everyone', () => {
  const SEED = 777;
  const stairsPos = (w: WorldState) => vec(w.arena.stairs!.x + 16, w.arena.stairs!.y + 16);

  it('the host goes down once the party agreed (core/gather.ts), not because a teammate stands on the stairs', () => {
    const { run, world } = startRun(SEED, { localId: 'p1' });
    const withP2 = withRemote(world, 'p2', stairsPos(world));
    expect(progressRun(run, withP2).entered).toBe(false);
    const progress = progressRun(run, withP2, true);
    expect(progress.entered).toBe(true);
    expect(progress.run.floor).toBe(2);
  });

  it('a guest on the stairs waits for the host', () => {
    const { run, world } = startRun(SEED, { localId: 'p2', role: 'guest' });
    const progress = progressRun(run, { ...world, player: { ...world.player, pos: stairsPos(world) } });
    expect(progress.entered).toBe(false);
  });

  it('a guest told about a floor change loads the same floor as the host', () => {
    const host = startRun(SEED, { localId: 'p1' });
    const guest = startRun(SEED, { localId: 'p2', role: 'guest' });
    const moved = progressRun(host.run, { ...host.world, player: { ...host.world.player, pos: stairsPos(host.world) } });
    const followed = followToFloor(guest.run, guest.world, moved.run.floor);
    // Same floor; the item offer is each player's own (seeded by player id).
    expect({ ...followed.run, offer: null }).toEqual({ ...moved.run, offer: null });
    expect(followed.run.offer).toEqual(offerItems(SEED, 2, 'p2', []));
    expect(moved.run.offer).toEqual(offerItems(SEED, 2, 'p1', []));
    expect(followed.world.arena).toEqual(moved.world.arena);
    expect(followed.world.player.pos).toEqual(moved.world.player.pos);
    expect(followed.world.role).toBe('guest');
  });

  it('the run is lost only when every player is down', () => {
    const { run, world } = startRun(SEED, { localId: 'p1' });
    const down = { ...world, player: { ...world.player, hp: 0 } };
    expect(progressRun(run, withRemote(down, 'p2', vec(0, 0))).outcome).toBeNull();
    expect(partyDefeated(withRemote(down, 'p2', vec(0, 0), { hp: 0 }))).toBe(true);
    expect(progressRun(run, withRemote(down, 'p2', vec(0, 0), { hp: 0 })).outcome).toBe('defeat');
  });
});
