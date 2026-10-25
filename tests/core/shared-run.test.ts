import { describe, expect, it } from 'vitest';
import { TUNING } from '../../src/data/tuning';
import type { ProjectileState, WorldState } from '../../src/core/state';
import { enemyTimeScale } from '../../src/core/step';
import { applyRemotePlayers, playerSnapshot } from '../../src/core/sync';
import { createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';

/** Spike gap fixes in the core: remote players' projectiles and perfect-dodge slow-mo in shared runs. */
const ARENA = { width: 800, height: 600 };
const world = (role: 'host' | 'guest' = 'host', localId = 'p1'): WorldState => createWorld({ seed: 1, arena: ARENA, playerPos: vec(100, 100), localId, role });

const shot = (id: string, owner: 'player' | 'enemy'): ProjectileState => ({
  id,
  owner,
  type: 'ghost',
  attackerTypes: ['ghost', 'fairy'],
  power: 40,
  pos: vec(150, 120),
  vel: vec(200, 0),
  radius: 6,
  remainingMs: 800,
  damageMultiplier: 1,
  hitstunMs: 0,
  knockback: 0,
  hitIds: [],
});

describe('remote players projectiles', () => {
  it('a player report carries its own live projectiles, never the enemies', () => {
    const state = { ...world('guest', 'p2'), projectiles: [shot('j1', 'player'), shot('j2', 'enemy')] };
    expect(playerSnapshot(state).projectiles.map((p) => p.id)).toEqual(['j1']);
  });

  it('arrive on the remote player for drawing only, outside the simulated projectiles', () => {
    const other = { ...world('guest', 'p2'), projectiles: [shot('j1', 'player')] };
    const state = applyRemotePlayers(world(), [playerSnapshot(other)]);
    expect(state.remotes[0]!.projectiles.map((p) => p.id)).toEqual(['j1']);
    expect(state.projectiles).toEqual([]);
  });
});

describe('perfect-dodge slow-mo in shared runs', () => {
  const slowed = TUNING.perfectDodge.slowMoScale;

  it('still slows enemies solo', () => {
    expect(enemyTimeScale({ ...world(), slowMoMs: 300 })).toBe(slowed);
  });

  it('never slows the enemies for everyone once another player is in the world', () => {
    const host = applyRemotePlayers(world(), [playerSnapshot(world('guest', 'p2'))]);
    expect(enemyTimeScale({ ...host, slowMoMs: 300 })).toBe(1);
    expect(enemyTimeScale({ ...world('guest', 'p2'), slowMoMs: 300 })).toBe(1);
  });
});
