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
    { t: 'hello', species: 'zorua', loadout: ['feint-attack', 'night-daze'] },
    { t: 'start', seed: 42, floor: 1, players: [{ peer: 'tab-a', id: 'p1', species: 'mimikyu' }] },
    {
      t: 'claim',
      claims: [{ id: 'p2:m4:e1', playerId: 'p2', enemyId: 'e1', damage: 12, effectiveness: 2, hitstunMs: 180, knockback: vec(3, -4), blocked: false }],
    },
    { t: 'pick', id: 'f2b3', by: 'p2' },
    { t: 'berry', id: 'f2b3', to: 'p2' },
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

  it('carries the species and the Illusion of a starter player', () => {
    const zorua = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10), localId: 'p2', species: 'zorua' });
    const decoded = decodeMessage(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(zorua) }));
    expect(decoded?.t === 'state' && [decoded.p.species, decoded.p.hidden, decoded.p.projectiles]).toEqual(['zorua', true, []]);
    const broken = { ...zorua, player: { ...zorua.player, illusionBroken: true } };
    const plain = decodeMessage(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(broken) }));
    expect(plain?.t === 'state' && plain.p.hidden).toBeUndefined();
  });

  it('round-trips the player own projectiles in its state, and none as an empty list', () => {
    const world = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10), localId: 'p2' });
    const shot = { id: 'j4', owner: 'player' as const, type: 'ghost' as const, attackerTypes: ['ghost' as const], power: 40, pos: vec(55.55, 66.66), vel: vec(210, -3), radius: 6, remainingMs: 700, damageMultiplier: 1, hitstunMs: 0, knockback: 0, hitIds: [] };
    const message: NetMessage = { t: 'state', at: 5, floor: 1, p: playerSnapshot({ ...world, projectiles: [shot] }) };
    const decoded = decodeMessage(encodeMessage(message));
    expect(decoded?.t === 'state' && decoded.p.projectiles.map((p) => p.id)).toEqual(['j4']);
    close(decoded, message);
    const none = decodeMessage(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(world) }));
    expect(none?.t === 'state' && none.p.projectiles).toEqual([]);
  });

  it('carries the berries left on the floor in host snapshots', () => {
    const world = { ...createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(0, 0) }), berries: [{ id: 'f1b2', pos: vec(10, 10) }] };
    const decoded = decodeMessage(encodeMessage({ t: 'snap', at: 1, floor: 1, s: hostSnapshot(world) }));
    expect(decoded?.t === 'snap' && decoded.s.berries).toEqual(['f1b2']);
  });

  it('round-trips a host snapshot within the wire rounding and reports its size', () => {
    const { world } = startRun(7, {}, 5);
    const snapshot = hostSnapshot(world);
    expect(snapshot.enemies.length).toBeGreaterThan(5);
    const message: NetMessage = { t: 'snap', at: 99.25, floor: 5, s: snapshot };
    const wire = encodeMessage(message);
    close(decodeMessage(wire), message);
    // Measured for the feature document: a whole generated floor (every enemy, asleep or not).
    console.info(`snapshot bytes: ${wire.length} for ${snapshot.enemies.length} enemies`);
    expect(wire.length).toBeLessThan(4000);
  });

  it('turns a species it does not know (or cannot play) into the default, so a newer or hostile peer never crashes the world', () => {
    for (const species of ['missingno', 'gastly', 42]) {
      const hello = decodeMessage(JSON.stringify({ t: 'hello', species, loadout: [] }));
      expect(hello?.t === 'hello' && hello.species).toBe('mimikyu');
      const lobby = decodeMessage(JSON.stringify({ t: 'lobby', players: [{ peer: 'a', id: 'p1', species }] }));
      expect(lobby?.t === 'lobby' && lobby.players[0]!.species).toBe('mimikyu');
      const start = decodeMessage(JSON.stringify({ t: 'start', seed: 1, floor: 1, players: [{ peer: 'a', id: 'p1', species }] }));
      expect(start?.t === 'start' && start.players[0]!.species).toBe('mimikyu');
    }
    const world = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(10, 10), localId: 'p2', species: 'zorua' });
    const wire = JSON.parse(encodeMessage({ t: 'state', at: 5, floor: 1, p: playerSnapshot(world) })) as { p: unknown[] };
    wire.p[1] = 'missingno';
    const state = decodeMessage(JSON.stringify(wire));
    expect(state?.t === 'state' && state.p.species).toBe('mimikyu');
  });

  it('rejects garbage', () => {
    expect(decodeMessage('not json')).toBeNull();
    expect(decodeMessage('{"t":"nope"}')).toBeNull();
  });
});
