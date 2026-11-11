import { describe, expect, it } from 'vitest';
import type { GameEvent, ProjectileState } from '../../src/core/state';
import { vec, type Vec2 } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { IDLE } from '../core/helpers';
import { coopLoop, ticksOf, type CoopLoop } from './coop-loop';

/**
 * Issues #48 (SD-V0PVTZ) and #49 (SD-RQV2Y9): an enemy shot, a standing
 * puddle or one projectile of a ring, hits a guest once and is spent, as it
 * does for the host and in solo. The host keeps sending the shot in its
 * snapshots (it never tests its shots against remote players), so the guest
 * must not rebuild a shot it already spent on itself.
 */
const ARENA = { width: 800, height: 600 };
const GUEST_AT = vec(400, 300);

function pair(): CoopLoop {
  const loop = coopLoop((guestId) => {
    const host = createWorld({ seed: 1, arena: ARENA, playerPos: vec(40, 560), localId: 'p1', species: 'mimikyu' });
    const guest = createWorld({ seed: 1, arena: ARENA, playerPos: GUEST_AT, localId: guestId, role: 'guest', species: 'mimikyu' });
    return { host, guest: { ...guest, player: { ...guest.player, disguiseBroken: true, illusionBroken: true } } };
  });
  for (let i = 0; i < ticksOf(500); i++) loop.tick(IDLE, IDLE);
  return loop;
}

/** The host fires an enemy shot at `pos` moving at `vel` (px/s); a zero velocity is a puddle. */
function hostFires(loop: CoopLoop, pos: Vec2, vel: Vec2, remainingMs: number): string {
  const id = `p${loop.hostWorld.nextId}`;
  const shot: ProjectileState = { id, owner: 'enemy', type: 'poison', attackerTypes: ['poison'], power: 20, damageMultiplier: 1, pos, vel, radius: 10, remainingMs, hitstunMs: 0, knockback: 0, hitIds: [] };
  loop.hostWorld = { ...loop.hostWorld, nextId: loop.hostWorld.nextId + 1, projectiles: [...loop.hostWorld.projectiles, shot] };
  return id;
}

const hurts = (events: readonly GameEvent[]): number => events.filter((e) => e.type === 'playerHurt').length;

describe('co-op: an enemy shot hits a guest once', () => {
  it('a puddle under the guest hurts it once, not every step while it lasts (#48)', () => {
    const loop = pair();
    const hpBefore = loop.guestWorld.player.hp;
    const before = hurts(loop.guestEvents);
    const id = hostFires(loop, GUEST_AT, vec(0, 0), 3000);
    for (let i = 0; i < ticksOf(1500); i++) loop.tick(IDLE, IDLE);
    expect(hurts(loop.guestEvents) - before).toBe(1);
    expect(loop.guestWorld.player.hp).toBeLessThan(hpBefore);
    // The host still holds the puddle; the guest no longer shows the one it spent.
    expect(loop.hostWorld.projectiles.some((p) => p.id === id)).toBe(true);
    expect(loop.guestWorld.projectiles.some((p) => p.id === id)).toBe(false);
  });

  it('a slow ring projectile crossing the guest hurts it once (#49)', () => {
    const loop = pair();
    const before = hurts(loop.guestEvents);
    hostFires(loop, vec(GUEST_AT.x - 60, GUEST_AT.y), vec(60, 0), 3000);
    for (let i = 0; i < ticksOf(2500); i++) loop.tick(IDLE, IDLE);
    expect(hurts(loop.guestEvents) - before).toBe(1);
  });

  it('a later shot still hits the guest after one was spent', () => {
    const loop = pair();
    const before = hurts(loop.guestEvents);
    hostFires(loop, GUEST_AT, vec(0, 0), 800);
    for (let i = 0; i < ticksOf(1200); i++) loop.tick(IDLE, IDLE);
    hostFires(loop, GUEST_AT, vec(0, 0), 800);
    for (let i = 0; i < ticksOf(1200); i++) loop.tick(IDLE, IDLE);
    expect(hurts(loop.guestEvents) - before).toBe(2);
  });
});
