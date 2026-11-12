import { describe, expect, it } from 'vitest';
import { kinAtSpawn } from '../../src/core/kinematics';
import type { ProjectileState, WorldState } from '../../src/core/state';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { decodeMessage, encodeMessage, type NetMessage } from '../../src/net/protocol';
import { PROTOCOL_VERSION } from '../../src/net/version';
import { IDLE, run, ticksFor } from '../core/helpers';

/**
 * The new bullet kinematics (core/kinematics.ts) travel in the host's
 * snapshot, so a guest steps a curving, accelerating, falling or bouncing
 * shot exactly as the host does between snapshots (odd/tasks/boss-patterns.md S2).
 */
const ARENA = { width: 800, height: 600 };

const shot = (id: string, kin: ProjectileState['kin']): ProjectileState => ({
  id,
  owner: 'enemy',
  type: 'electric',
  attackerTypes: ['electric'],
  power: 16,
  damageMultiplier: 1,
  pos: vec(400, 100),
  vel: vec(90, 40),
  radius: 5,
  remainingMs: 5000,
  hitstunMs: 0,
  knockback: 0,
  hitIds: [],
  ...(kin ? { kin } : {}),
});

const KINDS = {
  curve: kinAtSpawn({ curveDegPerSec: -35 }, vec(1, 0)),
  accel: kinAtSpawn({ accel: -60, maxSpeed: 200 }, vec(0.6, 0.8)),
  stop: kinAtSpawn({ accel: -80, stop: true }, vec(1, 0)),
  gravity: kinAtSpawn({ gravity: vec(0, -70) }, vec(1, 0)),
  bounce: kinAtSpawn({ bounces: 1 }, vec(1, 0)),
};

function wire(host: WorldState): WorldState {
  const message: NetMessage = { t: 'snap', at: 1, floor: 1, s: hostSnapshot(host) } as NetMessage;
  const out = decodeMessage(encodeMessage(message));
  if (out?.t !== 'snap') throw new Error('not a snap');
  const guest = createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p2', role: 'guest' });
  return applyHostSnapshot(guest, out.s);
}

describe('kinematic shots cross the wire', () => {
  it('the protocol version moved to 6 with the kinematics batch (older peers are turned away by the version gate)', () => {
    expect(PROTOCOL_VERSION).toBe(6);
  });

  it.each(Object.entries(KINDS))('a %s shot arrives with its kinematics and the guest steps it as the host does', (_name, kin) => {
    const host = { ...createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p1' }), projectiles: [shot('k1', kin)] };
    const guest = wire(host);
    const arrived = guest.projectiles.find((p) => p.id === 'k1')!;
    expect(arrived.kin).toEqual(kin);
    const h = run(host, IDLE, ticksFor(800)).projectiles.find((p) => p.id === 'k1')!;
    const g = run(guest, IDLE, ticksFor(800)).projectiles.find((p) => p.id === 'k1')!;
    expect(g.pos.x).toBeCloseTo(h.pos.x, 3);
    expect(g.pos.y).toBeCloseTo(h.pos.y, 3);
    expect(g.vel.x).toBeCloseTo(h.vel.x, 3);
    expect(g.vel.y).toBeCloseTo(h.vel.y, 3);
  });

  it('a cursed shot (Yamask) keeps its curse with or without kinematics, and the kinematics with it', () => {
    const cursed = (id: string, kin: ProjectileState['kin']): ProjectileState => ({ ...shot(id, kin), curseMs: 2400 });
    const host = { ...createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p1' }), projectiles: [cursed('c1', undefined), cursed('c2', KINDS.curve)] };
    const guest = wire(host);
    const plain = guest.projectiles.find((p) => p.id === 'c1')!;
    const both = guest.projectiles.find((p) => p.id === 'c2')!;
    expect(plain.curseMs).toBe(2400);
    expect(plain.kin).toBeUndefined();
    expect(both.curseMs).toBe(2400);
    expect(both.kin).toEqual(KINDS.curve);
  });

  it('a plain shot still carries no kinematics', () => {
    const host = { ...createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p1' }), projectiles: [shot('k2', undefined)] };
    expect(wire(host).projectiles.find((p) => p.id === 'k2')?.kin).toBeUndefined();
  });
});
