import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { playerVfx } from '../../src/adapters/move-vfx';
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

describe('what a player sees of a teammate attacking', () => {
  it('the action reaches the others, with what the swing is drawn from', () => {
    const other = world('guest', 'p2');
    const swinging = { ...other, player: { ...other.player, action: { slotIndex: 0, moveId: 'shadow-claw' as const, phase: 'active' as const, phaseMs: 10, chargeMs: 0, chargeLevel: 0, aimDir: { x: 0, y: -1 }, mouseAim: false, hitIds: [], startTick: 0 } } };
    const seen = applyRemotePlayers(world(), [playerSnapshot(swinging)]).remotes[0]!.player;
    expect(seen.action).toMatchObject({ moveId: 'shadow-claw', phase: 'active', aimDir: { x: 0, y: -1 } });
    expect(playerVfx(seen).map((v) => v.kind)).toContain('arc');
  });
  it('a shot keeps its type, for its colour', () => {
    const other = world('guest', 'p2');
    const shooting = { ...other, projectiles: [{ id: 'q1', owner: 'player', type: 'ghost', attackerTypes: ['ghost'], power: 1, pos: { x: 1, y: 2 }, vel: { x: 0, y: 0 }, radius: 4, remainingMs: 100, hitIds: [] }] } as never;
    expect(applyRemotePlayers(world(), [playerSnapshot(shooting)]).remotes[0]!.projectiles[0]!.type).toBe('ghost');
  });
  it('the renderer draws a teammate as it draws the local player: swing and charge ring', () => {
    const renderer = readFileSync(join(__dirname, '../../src/adapters/renderer.ts'), 'utf8');
    expect(renderer).toContain('for (const remote of current.remotes) drawPlayerVfx(ctx, playerVfx(remote.player)');
    expect(renderer).toContain('chargeRing(remote.player, pos);');
  });
});

