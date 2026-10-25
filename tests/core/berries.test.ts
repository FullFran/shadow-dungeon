import { describe, expect, it } from 'vitest';
import { ORAN_BERRY } from '../../src/data/items';
import { applyBerryClaims, berryGranted, placeBerries } from '../../src/core/berries';
import { generateFloor } from '../../src/core/dungeon';
import { floorSeed, startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { step } from '../../src/core/step';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { isWall, tileOf } from '../../src/core/tiles';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { IDLE } from './helpers';

const SEED = 20261025;

function withBerry(role: 'host' | 'guest' = 'host', hp = 50): WorldState {
  const base = createWorld({ seed: 1, arena: { width: 800, height: 600 }, playerPos: vec(400, 300), role, localId: role === 'host' ? 'p1' : 'p2' });
  return { ...base, player: { ...base.player, hp }, berries: [{ id: 'f1b2', pos: vec(405, 300) }, { id: 'f1b3', pos: vec(700, 500) }] };
}

describe('berry placement', () => {
  it('is seeded: the same floor and seed give the same berries, never in the start room, always on floor tiles', () => {
    let rooms = 0;
    let berries = 0;
    for (let seed = 1; seed <= 60; seed++) {
      const floor = generateFloor(seed, 2);
      const placed = placeBerries(floor, seed, 2);
      expect(placeBerries(floor, seed, 2)).toEqual(placed);
      expect(new Set(placed.map((b) => b.id)).size).toBe(placed.length);
      const start = floor.rooms[floor.startRoom]!;
      for (const berry of placed) {
        const tile = tileOf(berry.pos);
        expect(isWall(floor, tile.x, tile.y)).toBe(false);
        expect(tile.x >= start.x && tile.x < start.x + start.width && tile.y >= start.y && tile.y < start.y + start.height).toBe(false);
        expect(tile).not.toEqual(floor.stairs);
      }
      rooms += floor.rooms.length - 1;
      berries += placed.length;
    }
    expect(berries / rooms).toBeGreaterThan(ORAN_BERRY.roomChance - 0.12);
    expect(berries / rooms).toBeLessThan(ORAN_BERRY.roomChance + 0.12);
  });

  it('the run lays them on generated floors only', () => {
    const { world } = startRun(SEED, {});
    expect(world.berries).toEqual(placeBerries(generateFloor(floorSeed(SEED, 1), 1), floorSeed(SEED, 1), 1));
    expect(startRun(SEED, {}, 4).world.berries).toEqual([]);
  });
});

describe('eating a berry', () => {
  it('solo: walking over it heals (up to max HP) and it is gone', () => {
    const after = step(withBerry(), IDLE, FIXED_DT_MS);
    expect(after.player.hp).toBe(50 + ORAN_BERRY.heal);
    expect(after.berries.map((b) => b.id)).toEqual(['f1b3']);
    expect(after.events).toContainEqual({ type: 'berryEaten', berryId: 'f1b2', heal: ORAN_BERRY.heal });
    expect(step(withBerry('host', 95), IDLE, FIXED_DT_MS).player.hp).toBe(100);
  });

  it('a fainted player does not pick it up', () => {
    const after = step(withBerry('host', 0), IDLE, FIXED_DT_MS);
    expect(after.berries).toHaveLength(2);
  });

  it('guest: claims it from the host once and does not heal on its own', () => {
    const first = step(withBerry('guest'), IDLE, FIXED_DT_MS);
    expect(first.player.hp).toBe(50);
    expect(first.events).toContainEqual({ type: 'berryClaim', berryId: 'f1b2' });
    expect(first.berries.map((b) => b.id)).toEqual(['f1b3']);
    expect(step(first, IDLE, FIXED_DT_MS).events.filter((e) => e.type === 'berryClaim')).toEqual([]);
  });

  it('host: applies each berry claim once (the first claimer gets it) and the snapshot carries what is left', () => {
    const host = withBerry('host', 100);
    const { state, granted } = applyBerryClaims({ ...host, player: { ...host.player, pos: vec(100, 100) } }, [
      { berryId: 'f1b3', playerId: 'p2' },
      { berryId: 'f1b3', playerId: 'p3' },
      { berryId: 'nope', playerId: 'p2' },
    ]);
    expect(granted).toEqual([{ berryId: 'f1b3', playerId: 'p2' }]);
    expect(state.berries.map((b) => b.id)).toEqual(['f1b2']);
    expect(hostSnapshot(state).berries).toEqual(['f1b2']);
    const guest = applyHostSnapshot(withBerry('guest'), hostSnapshot(state));
    expect(guest.berries.map((b) => b.id)).toEqual(['f1b2']);
  });

  it('guest: the host grant heals it once', () => {
    const events: WorldState['events'] = [];
    const healed = berryGranted(withBerry('guest'), 'f1b3', events);
    expect(healed.player.hp).toBe(50 + ORAN_BERRY.heal);
    expect(events).toEqual([{ type: 'berryEaten', berryId: 'f1b3', heal: ORAN_BERRY.heal }]);
  });
});
