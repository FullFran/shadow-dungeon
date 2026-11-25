import { describe, expect, it } from 'vitest';
import { kinAtSpawn } from '../../src/core/kinematics';
import type { ProjectileState, WorldState } from '../../src/core/state';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { decodeMessage, encodeMessage, type NetMessage } from '../../src/net/protocol';
import { PROTOCOL_VERSION } from '../../src/net/version';

/**
 * Issue #67: an enemy shot carries the learnable move it is drawn as, so a
 * co-op guest draws the same look as the host (S6).
 */
const ARENA = { width: 800, height: 600 };

const shot = (id: string, more: Partial<ProjectileState> = {}): ProjectileState => ({
  id,
  owner: 'enemy',
  type: 'water',
  attackerTypes: ['water'],
  power: 16,
  damageMultiplier: 1,
  pos: vec(400, 100),
  vel: vec(90, 40),
  radius: 7,
  remainingMs: 5000,
  hitstunMs: 0,
  knockback: 0,
  hitIds: [],
  ...more,
});

function wire(projectiles: ProjectileState[]): WorldState {
  const host = { ...createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p1' }), projectiles };
  const message: NetMessage = { t: 'snap', at: 1, floor: 1, s: hostSnapshot(host) } as NetMessage;
  const out = decodeMessage(encodeMessage(message));
  if (out?.t !== 'snap') throw new Error('not a snap');
  const guest = createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p2', role: 'guest' });
  return applyHostSnapshot(guest, out.s);
}

describe('an enemy shot crosses the wire with its move (#67)', () => {
  it('bumped the protocol to 7 (an older guest would draw the anonymous bullet)', () => {
    expect(PROTOCOL_VERSION).toBe(7);
  });

  it('a plain shot, a curse shot, a kinematic shot and a weakened, positional one keep their move and every other field', () => {
    const kin = kinAtSpawn({ curveDegPerSec: -35 }, vec(1, 0));
    const sent = [
      shot('a', { shotMove: 'bubble-beam' }),
      shot('b', { type: 'ghost', shotMove: 'hex', curseMs: 3500 }),
      shot('c', { type: 'electric', shotMove: 'thunderbolt', ...(kin ? { kin } : {}) }),
      shot('d', { type: 'dark', shotMove: 'dark-pulse', damageMultiplier: 0.5, pierceRoll: true }),
    ];
    const guest = wire(sent);
    for (const s of sent) {
      const arrived = guest.projectiles.find((p) => p.id === s.id)!;
      expect(arrived.shotMove, s.id).toBe(s.shotMove);
      expect(arrived.moveId, s.id).toBeUndefined();
      expect(arrived.curseMs, s.id).toBe(s.curseMs);
      expect(arrived.kin, s.id).toEqual(s.kin);
      expect(arrived.damageMultiplier, s.id).toBe(s.damageMultiplier);
      expect(arrived.pierceRoll, s.id).toBe(s.pierceRoll);
    }
  });

  it('a shot without a move (a spore cloud on the ground) arrives without one', () => {
    const arrived = wire([shot('cloud', { vel: vec(0, 0), type: 'poison' })]).projectiles.find((p) => p.id === 'cloud')!;
    expect(arrived.shotMove).toBeUndefined();
  });

  it('an unknown move on the wire is dropped, the shot kept', () => {
    const host = { ...createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p1' }), projectiles: [shot('x', { shotMove: 'bubble-beam' })] };
    const text = encodeMessage({ t: 'snap', at: 1, floor: 1, s: hostSnapshot(host) } as NetMessage).replace('"bubble-beam"', '"not-a-move"');
    const out = decodeMessage(text);
    if (out?.t !== 'snap') throw new Error('not a snap');
    const arrived = out.s.projectiles.find((p) => p.id === 'x')!;
    expect(arrived).toBeDefined();
    expect(arrived.shotMove).toBeUndefined();
  });
});
