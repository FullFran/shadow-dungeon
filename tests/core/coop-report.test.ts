import { describe, expect, it } from 'vitest';
import { settleAchievements } from '../../src/core/achievements';
import { partyField, partySizeOf } from '../../src/core/party';
import { creditDefeats } from '../../src/core/progression';
import { runReport, tallyKills } from '../../src/core/run-report';
import type { WorldState } from '../../src/core/state';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';

/**
 * A co-op guest's run report (odd/tasks/progress-continuity.md T3): the
 * guest builds its summary from its own world (app/game.ts: `coop` from
 * `partySizeOf`, kills from `tallyKills` over its `credited`), so the host's
 * snapshot must give it the party size and the defeats to credit.
 */
const ARENA = { width: 1200, height: 600 };
const world = (role: 'host' | 'guest', id: string): WorldState => createWorld({ seed: 1, arena: ARENA, playerPos: vec(100, 300), localId: id, role });

describe('a co-op guest’s run report', () => {
  it('knows it played in a party and counts the kills it saw, so co-op and kill achievements reach guests', () => {
    let host = spawnEnemy(world('host', 'p1'), 'gastly', vec(500, 300));
    host = { ...host, ...partyField(2), enemies: host.enemies.map((e) => ({ ...e, alive: false, hp: 0 })) };
    const guestBefore = world('guest', 'p2');
    const synced = applyHostSnapshot(guestBefore, hostSnapshot(host));
    expect(partySizeOf(synced)).toBe(2);
    const credited = creditDefeats(synced, []);
    const kills = tallyKills({}, guestBefore, credited);
    expect(kills.ghost).toBe(1);
    const report = runReport({ dungeon: 'crypt-of-the-sword-king', floor: 5, difficulty: 'normal', kills, guardianNoHit: true, coop: partySizeOf(synced) > 1 }, 'victory', 'zorua');
    const ids = settleAchievements({ coins: 0 }, report, '2026-10-26').unlocked.map((d) => d.id);
    expect(ids).toEqual(expect.arrayContaining(['coop-clear', 'flawless-crypt-of-the-sword-king', 'species-zorua', 'clear-crypt-of-the-sword-king-normal']));
  });

  it('a solo world reports no party', () => {
    expect(partySizeOf(world('host', 'p1'))).toBe(1);
  });
});
