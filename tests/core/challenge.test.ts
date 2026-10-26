import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { earnChallengeReward, loadSave, writeSave, EMPTY_SAVE } from '../../src/app/save';
import { challengeOpen, challengeReward, openChallenges } from '../../src/core/challenge';
import { dungeonChoices } from '../../src/core/dungeon-select';
import { lineOf } from '../../src/core/evolution';
import { floorCount, isBossFloor, startRun } from '../../src/core/run';
import { CHALLENGES, CRYPT, DUNGEONS, dungeonById, guardianOf } from '../../src/data/dungeons';
import { GACHA_POOL } from '../../src/data/gacha';
import { ROOMS } from '../../src/data/rooms';

/** Challenge dungeons (odd/tasks/gacha-evolutions.md T4): one short dungeon per gacha line, its clear pays that line's materials. */
const ABRA = CHALLENGES.find((d) => d.challenge?.line === 'abra')!;

describe('challenge dungeons as data', () => {
  it('one per gacha line, keyed by the line\'s first form', () => {
    expect(CHALLENGES.map((d) => d.challenge?.line).sort()).toEqual(GACHA_POOL.map((p) => p.species).sort());
    for (const d of CHALLENGES) expect(lineOf(d.challenge!.line)).toBe(d.challenge!.line);
  });

  it('three generated floors and a boss that already guards a main dungeon\'s arena', () => {
    const mainArenas = DUNGEONS.flatMap((d) => d.plan.flatMap((p) => (p.kind === 'room' ? [p.room] : [])));
    for (const d of CHALLENGES) {
      expect(d.plan.slice(0, 3).every((p) => p.kind === 'generated'), d.id).toBe(true);
      const boss = d.plan[3]!;
      expect(d.plan).toHaveLength(4);
      expect(boss.kind === 'room' && boss.role === undefined && mainArenas.includes(boss.room), d.id).toBe(true);
      expect(guardianOf(d), d.id).toBe(boss.kind === 'room' ? ROOMS[boss.room].spawns[0]!.species : null);
      expect(d.challenge!.materials).toBeGreaterThan(0);
    }
  });

  it('runs: every floor starts, the fourth is the boss floor, and the id round-trips', () => {
    for (const d of CHALLENGES) {
      expect(dungeonById(d.id)).toBe(d);
      for (const floor of [1, 2, 3, 4]) {
        const { run, world } = startRun(7, {}, floor, d.id);
        expect(run.dungeon).toBe(d.id);
        expect(floorCount(run)).toBe(4);
        expect(isBossFloor(run)).toBe(floor === 4);
        expect(world.enemies.length, `${d.id} F${floor}`).toBeGreaterThan(0);
      }
    }
  });

  it('stays out of the main dungeon list and its select', () => {
    for (const d of CHALLENGES) {
      expect(DUNGEONS).not.toContain(d);
      expect(dungeonChoices(new Set(DUNGEONS.map((x) => x.id))).map((c) => c.dungeon)).not.toContain(d);
    }
  });
});

describe('challenge unlock', () => {
  it('opens a line\'s challenge once any form of it is owned', () => {
    expect(openChallenges([])).toEqual([]);
    expect(challengeOpen(ABRA, ['abra'])).toBe(true);
    expect(challengeOpen(ABRA, ['alakazam'])).toBe(true);
    expect(challengeOpen(ABRA, ['piplup'])).toBe(false);
    expect(challengeOpen(CRYPT, ['abra'])).toBe(false);
    expect(openChallenges(['kadabra', 'luxio']).map((d) => d.challenge!.line)).toEqual(['abra', 'shinx']);
  });
});

describe('challenge reward', () => {
  const owner = { coins: 0, owned: ['kadabra' as const], materials: { abra: 2 } };

  it('a victory adds the line\'s materials under its first form', () => {
    expect(challengeReward(owner, ABRA, true).materials).toEqual({ abra: 2 + ABRA.challenge!.materials });
  });

  it('a defeat, a main dungeon or a line the player does not own pays nothing', () => {
    expect(challengeReward(owner, ABRA, false)).toBe(owner);
    expect(challengeReward(owner, CRYPT, true)).toBe(owner);
    const guest = { coins: 0, owned: ['piplup' as const] };
    expect(challengeReward(guest, ABRA, true)).toBe(guest);
  });

  it('the save keeps it (each peer pays its own save)', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 50, owned: ['abra'] });
    expect(earnChallengeReward(store, ABRA, true).materials).toEqual({ abra: ABRA.challenge!.materials });
    expect(loadSave(store).materials).toEqual({ abra: ABRA.challenge!.materials });
    expect(loadSave(store).coins).toBe(50);
    earnChallengeReward(store, ABRA, false);
    expect(loadSave(store).materials).toEqual({ abra: ABRA.challenge!.materials });
  });
});
