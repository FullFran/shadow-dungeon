import { describe, expect, it } from 'vitest';
import { startRun } from '../../src/core/run';
import { hostSnapshot, playerSnapshot } from '../../src/core/sync';
import { createWorld } from '../../src/core/world';
import { vec } from '../../src/core/vec';
import { decodeMessage, encodeMessage, type NetMessage } from '../../src/net/protocol';

/** Numbers survive the wire to within its rounding (0.1 px positions, 0.001 directions, whole ms). */
function close(actual: unknown, expected: unknown, path = '$'): void {
  if (typeof expected === 'number') {
    expect(typeof actual, path).toBe('number');
    expect(Math.abs((actual as number) - expected), path).toBeLessThanOrEqual(0.5);
    return;
  }
  if (expected === null || typeof expected !== 'object') {
    expect(actual, path).toEqual(expected);
    return;
  }
  for (const key of Object.keys(expected)) close((actual as Record<string, unknown>)[key], (expected as Record<string, unknown>)[key], `${path}.${key}`);
}

describe('protocol', () => {
  const messages: NetMessage[] = [
    { t: 'hello', species: 'mimikyu', loadout: ['shadow-claw', 'play-rough'] },
    { t: 'start', seed: 42, floor: 1, players: [{ peer: 'tab-a', id: 'p1', species: 'mimikyu' }] },
    {
      t: 'claim',
      claims: [{ id: 'p2:m4:e1', playerId: 'p2', enemyId: 'e1', damage: 12, effectiveness: 2, hitstunMs: 180, knockback: vec(3, -4), blocked: false }],
    },
    { t: 'floor', floor: 3 },
    { t: 'leave', id: 'p3' },
  ];

  for (const message of messages) {
    it(`round-trips a ${message.t} message exactly`, () => {
      expect(decodeMessage(encodeMessage(message))).toEqual(message);
    });
  }

  it('round-trips a player state within the wire rounding', () => {
    const world = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(123.456, 78.9), localId: 'p2' });
    const rolling = { ...world, player: { ...world.player, roll: { elapsedMs: 40, dir: vec(0.6, 0.8) } } };
    const message: NetMessage = { t: 'state', at: 1234.5, floor: 2, p: playerSnapshot(rolling) };
    const decoded = decodeMessage(encodeMessage(message));
    close(decoded, message);
  });

  it('round-trips a host snapshot within the wire rounding and reports its size', () => {
    const { world } = startRun(7, {}, 3);
    const snapshot = hostSnapshot(world);
    expect(snapshot.enemies.length).toBeGreaterThan(5);
    const message: NetMessage = { t: 'snap', at: 99.25, floor: 3, s: snapshot };
    const wire = encodeMessage(message);
    close(decodeMessage(wire), message);
    // Measured for the feature document: a whole generated floor (every enemy, asleep or not).
    console.info(`snapshot bytes: ${wire.length} for ${snapshot.enemies.length} enemies`);
    expect(wire.length).toBeLessThan(4000);
  });

  it('rejects garbage', () => {
    expect(decodeMessage('not json')).toBeNull();
    expect(decodeMessage('{"t":"nope"}')).toBeNull();
  });
});
