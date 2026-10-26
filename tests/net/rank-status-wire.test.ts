import { describe, expect, it } from 'vitest';
import { vec } from '../../src/core/vec';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';
import type { EnemySnapshot, ProjectileSnapshot } from '../../src/core/sync';

/** Rank-effect statuses on the host's snap (odd/tasks/move-progression.md F2). */
const enemy = (id: string): EnemySnapshot => ({ id, species: 'gastly', pos: vec(1, 2), facing: vec(1, 0), hp: 30, alive: true, hitstunMs: 0, ai: { mode: 'idle', modeMs: 0, modeDurationMs: 0, attackDir: vec(1, 0) } });
const shot: ProjectileSnapshot = { id: 'p9', type: 'ghost', attackerTypes: ['ghost'], power: 40, pos: vec(5, 5), vel: vec(0, 0), radius: 5, remainingMs: 300 };

function snapOf(text: string) {
  const decoded = decodeMessage(text);
  if (decoded?.t !== 'snap') throw new Error('not a snap');
  return decoded.s;
}

describe('protocol: rank-effect statuses on the snap', () => {
  it('carries marks, weakenings and a weakened shot multiplier, and nothing for plain enemies', () => {
    const s = { tick: 1, berries: [], enemies: [{ ...enemy('e1'), mark: { damage: 12, ms: 800 }, weakened: { factor: 0.7, ms: 2500 } }, enemy('e2')], projectiles: [{ ...shot, mult: 0.7 }, { ...shot, id: 'p10' }] };
    const decoded = snapOf(encodeMessage({ t: 'snap', at: 1, floor: 1, s }));
    expect(decoded.enemies[0]!.mark).toEqual({ damage: 12, ms: 800 });
    expect(decoded.enemies[0]!.weakened).toEqual({ factor: 0.7, ms: 2500 });
    expect(decoded.enemies[1]!.mark).toBeUndefined();
    expect(decoded.enemies[1]!.weakened).toBeUndefined();
    expect(decoded.projectiles.map((p) => p.mult)).toEqual([0.7, undefined]);
    // A plain snap carries no status key at all.
    expect(encodeMessage({ t: 'snap', at: 1, floor: 1, s: { ...s, enemies: [enemy('e2')], projectiles: [shot] } })).not.toContain('"x"');
  });

  it('drops malformed statuses and out-of-range multipliers from a hostile host', () => {
    const wire = JSON.parse(encodeMessage({ t: 'snap', at: 1, floor: 1, s: { tick: 1, berries: [], enemies: [enemy('e1')], projectiles: [shot] } }));
    wire.x = [['e1', 'x', 1, 5, 100], 'junk', ['e1']];
    wire.p[0].push(0, 50);
    const decoded = snapOf(JSON.stringify(wire));
    expect(decoded.enemies[0]!.mark).toBeUndefined();
    expect(decoded.enemies[0]!.weakened).toBeUndefined();
    expect(decoded.projectiles[0]!.mult).toBeUndefined();
  });
});
