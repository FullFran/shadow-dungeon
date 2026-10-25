import { describe, expect, it } from 'vitest';
import { COINS } from '../../src/data/coins';
import { CRYPT, FOREST } from '../../src/data/dungeons';
import { coinBreakdown, emptyTally, tallyFloor } from '../../src/core/coins';
import { isUnlocked } from '../../src/core/dungeon-select';
import { loadRoom } from '../../src/core/rooms';
import type { WorldState } from '../../src/core/state';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { decodeMessage, encodeMessage, type NetMessage } from '../../src/net/protocol';
import { clearedDungeons, EMPTY_RECORDS, parseRecords, recordRun } from '../../src/town/records';

const CRYPT_ID = CRYPT.id;

describe('Crypt coins', () => {
  it('pays Sableye like Trevenant (a mid-boss, 25) on top of the guardian', () => {
    expect(COINS.midboss).toBe(25);
    // The game tallies each floor left with `role === 'midboss'` of its plan.
    let tally = emptyTally();
    for (let floor = 1; floor <= 5; floor++) {
      const left = CRYPT.plan[floor - 1]!;
      tally = tallyFloor(tally, floor, null, left.kind === 'room' && left.role === 'midboss');
    }
    expect(tally.midbosses).toBe(1);
    expect(coinBreakdown(tally, 'victory').guardian).toBe(COINS.guardian + COINS.midboss);
    expect(coinBreakdown(tally, 'defeat').guardian).toBe(COINS.midboss);
  });
});

describe('Forest unlock after the remaster', () => {
  it('opens only when the Crypt guardian falls, not when Sableye does', () => {
    const lostToAegislash = recordRun(EMPTY_RECORDS, { dungeon: CRYPT_ID, floor: 6, level: 5, species: 'zorua', victory: false });
    expect(isUnlocked(FOREST, clearedDungeons(lostToAegislash))).toBe(false);
    const won = recordRun(lostToAegislash, { dungeon: CRYPT_ID, floor: 6, level: 6, species: 'zorua', victory: true });
    expect(isUnlocked(FOREST, clearedDungeons(won))).toBe(true);
  });

  it('keeps old saves valid: a cleared Crypt (four floors back then) still opens the Forest, legacy victories too', () => {
    const cleared = parseRecords(JSON.stringify({ runs: 4, victories: 1, bestLevel: 6, lastSpecies: 'zorua', dungeons: { [CRYPT_ID]: { bestFloor: 4, cleared: true } } }));
    expect(cleared.dungeons[CRYPT_ID]).toEqual({ bestFloor: 4, cleared: true });
    expect(isUnlocked(FOREST, clearedDungeons(cleared))).toBe(true);
    const legacy = parseRecords(JSON.stringify({ runs: 2, victories: 1, bestLevel: 5, lastSpecies: 'cubone', dungeons: { [CRYPT_ID]: { bestFloor: 4 } } }));
    expect(isUnlocked(FOREST, clearedDungeons(legacy))).toBe(true);
    // A new deeper run raises the best floor past the old maximum.
    expect(recordRun(cleared, { dungeon: CRYPT_ID, floor: 6, level: 6, species: 'zorua', victory: false }).dungeons[CRYPT_ID]).toEqual({ bestFloor: 6, cleared: true });
  });
});

describe('shared runs carry the new bosses in the existing snapshot fields', () => {
  const host = (room: 'vault' | 'boss', patch: (w: WorldState) => WorldState) => patch(loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), room));

  it('the Sableye card and the Aegislash phase-2 card and lane survive the wire and land on the guest', () => {
    for (const [room, stance, comboIndex] of [['vault', 'gems', 2], ['boss', 'shadow', 3], ['boss', 'unsheathe', 0]] as const) {
      const world = host(room, (w) => ({ ...w, enemies: w.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'telegraph' as const, attackDir: vec(0, 1) }, boss: { ...e.boss!, stance, comboIndex } })) }));
      const message: NetMessage = { t: 'snap', at: 1, floor: room === 'vault' ? 3 : 6, s: hostSnapshot(world) };
      const decoded = decodeMessage(encodeMessage(message));
      expect(decoded?.t).toBe('snap');
      if (decoded?.t !== 'snap') continue;
      expect(Object.keys(decoded.s.enemies[0]!).sort()).toEqual(Object.keys(hostSnapshot(world).enemies[0]!).sort());
      const guest = applyHostSnapshot({ ...host(room, (w) => w), role: 'guest', enemies: [] }, decoded.s);
      expect(guest.enemies[0]!.boss).toMatchObject({ stance, comboIndex });
      expect(guest.enemies[0]!.ai.attackDir).toEqual(vec(0, 1));
    }
  });
});
