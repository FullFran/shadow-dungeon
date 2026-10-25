import { describe, expect, it } from 'vitest';
import { COINS } from '../../src/data/coins';
import { dungeonById, SWAMP } from '../../src/data/dungeons';
import { coinBreakdown, emptyTally, tallyFloor } from '../../src/core/coins';
import { isUnlocked, unlockedDungeons } from '../../src/core/dungeon-select';
import { loadRoom } from '../../src/core/rooms';
import { startRun } from '../../src/core/run';
import type { WorldState } from '../../src/core/state';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { decodeMessage, encodeMessage, type NetMessage } from '../../src/net/protocol';
import { clearedDungeons, EMPTY_RECORDS, recordRun } from '../../src/town/records';

describe('Toxic Swamp coins, records and unlock', () => {
  it('pays Salazzle as a mid-boss (25) on top of the guardian', () => {
    expect(COINS.midboss).toBe(25);
    let tally = emptyTally();
    for (let floor = 1; floor <= 9; floor++) {
      const left = SWAMP.plan[floor - 1]!;
      tally = tallyFloor(tally, floor, null, left.kind === 'room' && left.role === 'midboss');
    }
    expect(tally.midbosses).toBe(1);
    expect(coinBreakdown(tally, 'victory').guardian).toBe(COINS.guardian + COINS.midboss);
  });

  it('stays closed until the Flooded Caves are cleared; beating Nihilego marks the swamp cleared', () => {
    const before = recordRun(EMPTY_RECORDS, { dungeon: 'misty-forest', floor: 8, level: 8, species: 'zorua', victory: true });
    expect(isUnlocked(SWAMP, clearedDungeons(before))).toBe(false);
    expect(unlockedDungeons(clearedDungeons(before)).map((d) => d.id)).not.toContain(SWAMP.id);
    const caves = recordRun(before, { dungeon: 'flooded-caves', floor: 8, level: 9, species: 'zorua', victory: true });
    expect(isUnlocked(SWAMP, clearedDungeons(caves))).toBe(true);
    const lost = recordRun(caves, { dungeon: SWAMP.id, floor: 10, level: 10, species: 'zorua', victory: false });
    expect(clearedDungeons(lost).has(SWAMP.id)).toBe(false);
    expect(lost.dungeons[SWAMP.id]?.bestFloor).toBe(10);
    const won = recordRun(lost, { dungeon: SWAMP.id, floor: 10, level: 10, species: 'zorua', victory: true });
    expect(clearedDungeons(won).has(SWAMP.id)).toBe(true);
  });
});

describe('shared Toxic Swamp runs', () => {
  it('start the swamp from the id in the host\'s start message', () => {
    const message: NetMessage = { t: 'start', seed: 7, floor: 1, dungeon: SWAMP.id, players: [] };
    const decoded = decodeMessage(encodeMessage(message));
    expect(decoded?.t === 'start' && decoded.dungeon).toBe(SWAMP.id);
    expect(dungeonById(SWAMP.id)).toBe(SWAMP);
    // Every peer places the same pools from the shared seed.
    expect(startRun(7, {}, 1, SWAMP.id).world.pools).toEqual(startRun(7, {}, 1, SWAMP.id).world.pools);
  });

  it('carry the bosses\' cards, waves and aimed spots in the existing snapshot fields', () => {
    const host = (room: 'den' | 'rift', patch: (w: WorldState) => WorldState) => patch(loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), room));
    for (const [room, stance, comboIndex] of [['den', 'haze', 0], ['rift', 'flood', 0], ['rift', 'tendrils', 1], ['rift', 'wormhole', 2]] as const) {
      const world = host(room, (w) => ({
        ...w,
        enemies: w.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'telegraph' as const, attackDir: vec(0, 1), aimPoint: vec(120, 100) }, boss: { ...e.boss!, stance, comboIndex } })),
      }));
      const decoded = decodeMessage(encodeMessage({ t: 'snap', at: 1, floor: room === 'den' ? 5 : 10, s: hostSnapshot(world) }));
      expect(decoded?.t).toBe('snap');
      if (decoded?.t !== 'snap') continue;
      expect(Object.keys(decoded.s.enemies[0]!).sort()).toEqual(Object.keys(hostSnapshot(world).enemies[0]!).sort());
      const guest = applyHostSnapshot({ ...host(room, (w) => w), role: 'guest', enemies: [] }, decoded.s);
      expect(guest.enemies[0]!.boss).toMatchObject({ stance, comboIndex });
      expect(guest.enemies[0]!.ai.aimPoint).toEqual(vec(120, 100));
      expect(guest.enemies[0]!.ai.attackDir).toEqual(vec(0, 1));
    }
  });
});
