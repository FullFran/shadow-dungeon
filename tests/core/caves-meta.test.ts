import { describe, expect, it } from 'vitest';
import { COINS } from '../../src/data/coins';
import { CAVES, CRYPT, dungeonById, FOREST } from '../../src/data/dungeons';
import { DHELMISE, KRABBY, LANTURN, REMORAID, SHELLOS } from '../../src/data/enemies';
import { WORLD } from '../../src/data/world';
import { coinBreakdown, emptyTally, tallyFloor } from '../../src/core/coins';
import { isUnlocked, unlockedDungeons } from '../../src/core/dungeon-select';
import { loadRoom } from '../../src/core/rooms';
import type { WorldState } from '../../src/core/state';
import { applyHostSnapshot, hostSnapshot } from '../../src/core/sync';
import { withTricks } from '../../src/core/tricks';
import { vec } from '../../src/core/vec';
import { createWorld } from '../../src/core/world';
import { decodeMessage, encodeMessage, type NetMessage } from '../../src/net/protocol';
import { clearedDungeons, EMPTY_RECORDS, recordRun } from '../../src/town/records';

describe('Flooded Caves coins and records', () => {
  it('pays Lanturn as a mid-boss (25) on top of the guardian', () => {
    let tally = emptyTally();
    for (let floor = 1; floor <= 9; floor++) {
      const left = CAVES.plan[floor - 1]!;
      tally = tallyFloor(tally, floor, null, left.kind === 'room' && left.role === 'midboss');
    }
    expect(tally.midbosses).toBe(1);
    expect(COINS.midboss).toBe(25);
    expect(coinBreakdown(tally, 'victory').guardian).toBe(COINS.guardian + COINS.midboss);
  });

  it('chains the unlocks: Crypt, then Forest, then Caves; losing to Dhelmise does not mark them cleared', () => {
    const forestWon = recordRun(recordRun(EMPTY_RECORDS, { dungeon: CRYPT.id, floor: 6, level: 6, species: 'zorua', victory: true }), { dungeon: FOREST.id, floor: 8, level: 8, species: 'zorua', victory: true });
    expect(isUnlocked(CAVES, clearedDungeons(recordRun(EMPTY_RECORDS, { dungeon: CRYPT.id, floor: 6, level: 6, species: 'zorua', victory: true })))).toBe(false);
    expect(isUnlocked(CAVES, clearedDungeons(forestWon))).toBe(true);
    expect(unlockedDungeons(clearedDungeons(forestWon)).map((d) => d.id)).toContain('flooded-caves');
    const lost = recordRun(forestWon, { dungeon: CAVES.id, floor: 10, level: 9, species: 'zorua', victory: false });
    expect(lost.dungeons[CAVES.id]).toEqual({ bestFloor: 10 });
    expect(clearedDungeons(lost).has(CAVES.id)).toBe(false);
    const won = recordRun(lost, { dungeon: CAVES.id, floor: 10, level: 10, species: 'zorua', victory: true });
    expect(clearedDungeons(won).has(CAVES.id)).toBe(true);
  });

  it('has its mouth in the Black Lake village, once', () => {
    const mouths = Object.values(WORLD).flatMap((m) => m.entrances.map((e) => ({ map: m.id, dungeon: e.dungeon })));
    expect(mouths.filter((m) => m.dungeon === CAVES.id)).toEqual([{ map: 'lago', dungeon: CAVES.id }]);
  });
});

describe('Flooded Caves in shared runs', () => {
  it('sends its id in start, and the guest plays the caves', () => {
    const message: NetMessage = { t: 'start', seed: 7, floor: 1, dungeon: CAVES.id, players: [] };
    const decoded = decodeMessage(encodeMessage(message));
    expect(decoded?.t === 'start' && dungeonById(decoded.dungeon).id).toBe('flooded-caves');
  });

  it('carries the bullet cards, waves and marks in the existing snapshot fields', () => {
    const host = (room: 'grotto' | 'wreck', patch: (w: WorldState) => WorldState) => patch(loadRoom(createWorld({ seed: 1, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), room));
    for (const [room, stance, comboIndex] of [['grotto', 'lure', 7], ['wreck', 'kelp', 2], ['wreck', 'riptide', 0], ['wreck', 'awaken', 0]] as const) {
      const world = host(room, (w) => ({ ...w, enemies: w.enemies.map((e) => ({ ...e, ai: { ...e.ai, mode: 'telegraph' as const, attackDir: vec(0, -1), aimPoint: vec(123, 45) }, boss: { ...e.boss!, stance, comboIndex } })) }));
      const decoded = decodeMessage(encodeMessage({ t: 'snap', at: 1, floor: room === 'grotto' ? 5 : 10, s: hostSnapshot(world) }));
      expect(decoded?.t).toBe('snap');
      if (decoded?.t !== 'snap') continue;
      expect(Object.keys(decoded.s.enemies[0]!).sort()).toEqual(Object.keys(hostSnapshot(world).enemies[0]!).sort());
      const guest = applyHostSnapshot({ ...host(room, (w) => w), role: 'guest', enemies: [] }, decoded.s);
      expect(guest.enemies[0]!.boss).toMatchObject({ stance, comboIndex });
      expect(guest.enemies[0]!.ai.attackDir).toEqual(vec(0, -1));
      expect(guest.enemies[0]!.ai.aimPoint).toEqual(vec(123, 45));
    }
  });
});

describe('Flooded Caves difficulty hooks', () => {
  it('leaves easy and normal as written and adds one trick from hard on to every new enemy and boss', () => {
    for (const def of [KRABBY, REMORAID, SHELLOS, LANTURN, DHELMISE] as const) {
      expect(withTricks(def as never, 'easy')).toBe(def);
      expect(withTricks(def as never, 'normal')).toBe(def);
      expect(withTricks(def as never, 'hard')).not.toBe(def);
      expect(def.tricks?.every((t) => t.minDifficulty === 'hard' || t.minDifficulty === 'nightmare')).toBe(true);
    }
  });

  it('gives both bosses an extra card on nightmare only', () => {
    expect(withTricks(LANTURN, 'hard').cards).toHaveLength(LANTURN.cards.length);
    expect(withTricks(LANTURN, 'nightmare').cards).toHaveLength(LANTURN.cards.length + 1);
    expect(withTricks(DHELMISE, 'hard').phase2!.cards).toHaveLength(DHELMISE.phase2!.cards.length);
    expect(withTricks(DHELMISE, 'nightmare').phase2!.cards).toHaveLength(DHELMISE.phase2!.cards.length + 1);
  });
});
