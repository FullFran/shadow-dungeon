import { describe, expect, it } from 'vitest';
import { enemySprite } from '../../src/adapters/sprite-anim';
import { heraldWear } from '../../src/core/herald/generate';
import { withHerald } from '../../src/core/herald/floor';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import type { WorldState } from '../../src/core/state';
import { vec } from '../../src/core/vec';
import { createWorld, spawnEnemy } from '../../src/core/world';
import { SPECIES } from '../../src/data/species';
import { decodeMessage, encodeMessage } from '../../src/net/protocol';

const world = (role: 'host' | 'guest', localId: string): WorldState => ({ ...createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(100, 100), loadout: ['shadow-claw', 'play-rough'] }), role, localId });

/** A seed whose herald does not wear the base sheet, so a guest missing it shows. */
const seed = (() => {
  for (let s = 1; s < 5000; s++) if (heraldWear(s).sprite !== SPECIES['sima-herald'].sprite) return s;
  throw new Error('every herald wears the base sheet');
})();
const hostWithHerald = () => withHerald(spawnEnemy(world('host', 'p1'), 'sima-herald', vec(400, 300)), seed, 22);
const wire = (w: WorldState) => {
  const decoded = decodeMessage(encodeMessage({ t: 'snap', at: 1, floor: 22, s: hostSnapshot(w) }));
  if (decoded?.t !== 'snap') throw new Error('not a snap');
  return decoded.s;
};

describe('a herald looks the same to everyone', () => {
  it('a guest that first hears of it from the host wears the same sheet', () => {
    const host = hostWithHerald();
    const guest = applyHostSnapshot(world('guest', 'p2'), wire(host));
    expect(guest.enemies[0]!.herald).toEqual({ seed, depth: 22 });
    expect(enemySprite(guest.enemies[0]!)).toBe(enemySprite(host.enemies[0]!));
  });
  it('and its types and HP bar are the herald\'s, not the base species\'', () => {
    const host = hostWithHerald();
    const seen = applyHostSnapshot(world('guest', 'p2'), wire(host)).enemies[0]!;
    expect(seen.types).toEqual(host.enemies[0]!.types);
    expect(seen.maxHp).toBe(host.enemies[0]!.maxHp);
  });
  it('a guest already stuck with the base look recovers on the next snapshot', () => {
    const host = hostWithHerald();
    const stuck = spawnEnemy(world('guest', 'p2'), 'sima-herald', vec(1, 1));
    const seen = applyHostSnapshot({ ...stuck, enemies: stuck.enemies.map((e) => ({ ...e, id: host.enemies[0]!.id })) }, wire(host)).enemies[0]!;
    expect(enemySprite(seen)).toBe(enemySprite(host.enemies[0]!));
    expect(seen.maxHp).toBe(host.enemies[0]!.maxHp);
  });
  it('a guest that already has it keeps its numbers', () => {
    const host = hostWithHerald();
    const local = applyHostSnapshot(world('guest', 'p2'), wire(host));
    const again = applyHostSnapshot(local, wire(host)).enemies[0]!;
    expect(again.maxHp).toBe(host.enemies[0]!.maxHp);
    expect(again.herald).toEqual({ seed, depth: 22 });
  });
  it('an older host that sends no herald changes nothing, and other enemies carry none', () => {
    const host = spawnEnemy(world('host', 'p1'), 'gastly', vec(400, 300));
    const snap = wire(host);
    expect(snap.enemies[0]!.herald).toBeUndefined();
    expect(applyHostSnapshot(world('guest', 'p2'), snap).enemies[0]!.herald).toBeUndefined();
    expect(encodeMessage({ t: 'snap', at: 1, floor: 1, s: hostSnapshot(host) })).not.toContain('"h"');
  });
  it('a malformed herald entry on the wire is dropped', () => {
    const host = hostWithHerald();
    const raw = JSON.parse(encodeMessage({ t: 'snap', at: 1, floor: 22, s: hostSnapshot(host) }) as string);
    raw.h = [['x', 'nope', 22], 7, [host.enemies[0]!.id, 'bad', 'bad']];
    const decoded = decodeMessage(JSON.stringify(raw));
    expect(decoded?.t === 'snap' && decoded.s.enemies[0]!.herald).toBeUndefined();
  });
});
