import type { HitClaim, WorldState } from '../core/state';

/**
 * Guest hit feedback (docs/gdd.md §12): a guest's own hit lowers the enemy's
 * HP on its screen at once, but the next host snapshot (drawn ~100 ms in the
 * past, before the host applied the claim) would put it back up, so health
 * bars flickered. A hold keeps the local HP until a snapshot shows the hit
 * (HP at or below it, or the enemy down), or `HOLD_MS` passes (the host
 * refused or lost the claim: the host's value wins). Pure.
 */
export interface HpHold {
  enemyId: string;
  hp: number;
  /** Local time after which the snapshot wins anyway. */
  until: number;
}

/** Longer than a bad round trip plus the render delay. */
export const HOLD_MS = 1500;

/** After a guest step: one hold per enemy its claims hit, at the HP that step left it with (a newer hit replaces the older hold). */
export function holdClaimedHits(holds: readonly HpHold[], world: WorldState, claims: readonly HitClaim[], now: number): HpHold[] {
  let next = [...holds];
  for (const claim of claims) {
    const enemy = world.enemies.find((e) => e.id === claim.enemyId);
    if (!enemy) continue;
    next = [...next.filter((h) => h.enemyId !== enemy.id), { enemyId: enemy.id, hp: enemy.hp, until: now + HOLD_MS }];
  }
  return next;
}

/** After a snapshot is applied: held enemies keep their local HP; confirmed or expired holds are dropped. */
export function applyHolds(holds: readonly HpHold[], world: WorldState, now: number): { world: WorldState; holds: HpHold[] } {
  if (holds.length === 0) return { world, holds: [] };
  const kept: HpHold[] = [];
  const enemies = world.enemies.map((enemy) => {
    const hold = holds.find((h) => h.enemyId === enemy.id);
    if (!hold || now >= hold.until || !enemy.alive || enemy.hp <= hold.hp + 1e-6) return enemy;
    kept.push(hold);
    return { ...enemy, hp: hold.hp, alive: hold.hp > 0 };
  });
  return { world: kept.length > 0 ? { ...world, enemies } : world, holds: kept };
}
