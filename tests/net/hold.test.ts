import { describe, expect, it } from 'vitest';
import type { HitClaim, WorldState } from '../../src/core/state';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { applyHolds, holdClaimedHits, HOLD_MS } from '../../src/net/hold';

/** Guest hit feedback: the local HP drop stays until the host's snapshot shows it (or a timeout). */
function guestWorld(hp: number): WorldState {
  const base = spawnEnemy(createWorld({ seed: 1, arena: { width: 600, height: 400 }, playerPos: vec(50, 50), localId: 'p2', role: 'guest' }), 'poochyena', vec(200, 200));
  return { ...base, enemies: base.enemies.map((e) => ({ ...e, hp })) };
}

const claim = (enemyId: string): HitClaim => ({ id: `p2:m1:${enemyId}`, playerId: 'p2', enemyId, damage: 10, effectiveness: 1, hitstunMs: 0, knockback: vec(0, 0), blocked: false });

describe('guest hp hold', () => {
  it('keeps the locally applied hp over a snapshot that does not show the hit yet', () => {
    const afterHit = guestWorld(30);
    const holds = holdClaimedHits([], afterHit, [claim('e1')], 1000);
    const fromSnapshot = guestWorld(40);
    const held = applyHolds(holds, fromSnapshot, 1100);
    expect(held.world.enemies[0]!.hp).toBe(30);
    expect(held.holds).toHaveLength(1);
  });

  it('lets go once the snapshot confirms the hit (or shows more damage)', () => {
    const holds = holdClaimedHits([], guestWorld(30), [claim('e1')], 1000);
    const confirmed = applyHolds(holds, guestWorld(25), 1200);
    expect(confirmed.world.enemies[0]!.hp).toBe(25);
    expect(confirmed.holds).toEqual([]);
  });

  it('gives up after the timeout, so a refused claim does not stick', () => {
    const holds = holdClaimedHits([], guestWorld(30), [claim('e1')], 1000);
    const late = applyHolds(holds, guestWorld(40), 1000 + HOLD_MS);
    expect(late.world.enemies[0]!.hp).toBe(40);
    expect(late.holds).toEqual([]);
  });

  it('a kill stays a kill on screen until the host agrees', () => {
    const holds = holdClaimedHits([], guestWorld(0), [claim('e1')], 1000);
    const held = applyHolds(holds, guestWorld(8), 1100);
    expect(held.world.enemies[0]).toMatchObject({ hp: 0, alive: false });
  });

  it('a newer hit on the same enemy replaces the older hold', () => {
    let holds = holdClaimedHits([], guestWorld(30), [claim('e1')], 1000);
    holds = holdClaimedHits(holds, guestWorld(20), [claim('e1')], 1300);
    expect(holds).toEqual([{ enemyId: 'e1', hp: 20, until: 1300 + HOLD_MS }]);
  });
});
