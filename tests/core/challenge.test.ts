import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { earnChallengeReward, loadSave, writeSave, EMPTY_SAVE } from '../../src/app/save';
import { challengeMisfits, challengeOpen, challengeReward, openChallenges } from '../../src/core/challenge';
import { dungeonChoices } from '../../src/core/dungeon-select';
import { evolutionOf, lineOf } from '../../src/core/evolution';
import { awakeningsOf } from '../../src/data/player-evolutions';
import { floorCount, isBossFloor, startRun } from '../../src/core/run';
import { CHALLENGES, CRYPT, DUNGEONS, dungeonById, guardianOf } from '../../src/data/dungeons';
import { GACHA_POOL } from '../../src/data/gacha';
import { ROOMS } from '../../src/data/rooms';
import type { Collection } from '../../src/core/collection';
import { PLAYABLE_SPECIES, SPECIES, STARTER_SPECIES, type SpeciesId } from '../../src/data/species';
import { TYPE_CHART, type PokemonType } from '../../src/data/types';
import { catalog } from '../../src/i18n';

/** Challenge dungeons (odd/tasks/gacha-evolutions.md T4): one short dungeon per gacha line, its clear pays that line's materials. */
const ABRA = CHALLENGES.find((d) => d.challenge?.line === 'abra')!;
const ZORUA = CHALLENGES.find((d) => d.challenge?.line === 'zorua')!;

describe('challenge dungeons as data', () => {
  it('one per line (the gacha\'s and every starter\'s, Mimikyu\'s awakening included), keyed by the line\'s first form', () => {
    expect(CHALLENGES.map((d) => d.challenge?.line).sort()).toEqual([...GACHA_POOL.map((p) => p.species), ...STARTER_SPECIES].sort());
    expect(awakeningsOf('mimikyu').length).toBe(2);
    // Every playable species that evolves or was evolved into has its line's challenge.
    for (const id of PLAYABLE_SPECIES) if (evolutionOf(id) || lineOf(id) !== id) expect(CHALLENGES.some((d) => d.challenge!.line === lineOf(id)), id).toBe(true);
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

describe('challenge fit: the line can hurt what it meets', () => {
  /** The line's own (STAB) types: every type of every form of the line. */
  const stab = (line: SpeciesId): PokemonType[] => [...new Set(PLAYABLE_SPECIES.filter((id) => lineOf(id) === line).flatMap((id) => SPECIES[id].types))];
  /** The best effectiveness of the line's own types against `defender`. */
  const best = (line: SpeciesId, defender: SpeciesId): number => Math.max(...stab(line).map((t) => SPECIES[defender].types.reduce((m, d) => m * (TYPE_CHART[t][d] ?? 1), 1)));

  it.each(CHALLENGES.map((d) => [d.id, d] as const))('%s: at least 70 %% of the spawn weight is hit neutrally or better, nothing is immune to the whole line, and neither is the boss resistant', (_, d) => {
    const line = d.challenge!.line;
    const weight = d.spawns.pool.reduce((sum, e) => sum + e.weights.reduce((a, b) => a + b, 0), 0);
    const fair = d.spawns.pool.filter((e) => best(line, e.species) >= 1).reduce((sum, e) => sum + e.weights.reduce((a, b) => a + b, 0), 0);
    expect(fair / weight).toBeGreaterThanOrEqual(0.7);
    for (const e of d.spawns.pool) expect(best(line, e.species), e.species).toBeGreaterThan(0);
    expect(best(line, guardianOf(d)!), guardianOf(d)!).toBeGreaterThanOrEqual(1);
  });

  it('mixes enemies of more than one type and more than one dungeon, and no two challenges share a boss', () => {
    for (const d of CHALLENGES) {
      const types = new Set(d.spawns.pool.flatMap((e) => SPECIES[e.species].types));
      expect(types.size, d.id).toBeGreaterThanOrEqual(3);
      const homes = new Set(d.spawns.pool.map((e) => DUNGEONS.find((m) => m.spawns.pool.some((p) => p.species === e.species))?.id));
      expect(homes.size, d.id).toBeGreaterThanOrEqual(2);
      expect(homes.has(undefined), d.id).toBe(false);
    }
    expect(new Set(CHALLENGES.map(guardianOf)).size).toBe(CHALLENGES.length);
  });
});

describe('challenge lore', () => {
  it('each challenge has its own name, subtitle, intro, a line per floor and one after the victory, in both languages', () => {
    for (const d of CHALLENGES) {
      const keys = [d.lore.nameKey, d.lore.subtitleKey, ...d.lore.loreKeys, ...(d.lore.floorKeys ?? []), d.lore.victoryKey ?? ''];
      expect(d.lore.floorKeys, d.id).toHaveLength(d.plan.length);
      for (const lang of ['es', 'en'] as const) {
        for (const key of keys) {
          const text = catalog(lang)[key];
          expect(text, `${lang} ${key}`).toBeTruthy();
          expect(text, `${lang} ${key}`).not.toMatch(/\u2014/);
        }
      }
    }
  });
});

describe('challenge unlock', () => {
  it('opens a line\'s challenge once any form of it is owned; the starters\' are always open', () => {
    expect(openChallenges([]).map((d) => d.challenge!.line)).toEqual(STARTER_SPECIES);
    expect(challengeOpen(ZORUA, [])).toBe(true);
    expect(challengeOpen(ZORUA, ['zoroark'])).toBe(true);
    expect(challengeOpen(ABRA, ['abra'])).toBe(true);
    expect(challengeOpen(ABRA, ['alakazam'])).toBe(true);
    expect(challengeOpen(ABRA, ['piplup'])).toBe(false);
    expect(challengeOpen(CRYPT, ['abra'])).toBe(false);
    expect(openChallenges(['kadabra', 'luxio']).map((d) => d.challenge!.line)).toEqual(['abra', 'shinx', ...STARTER_SPECIES]);
  });
});

describe('challenge entry: only a form of the line plays it', () => {
  it('names (by position) every participant outside the line; a main dungeon takes anyone', () => {
    expect(challengeMisfits(ABRA, ['abra'])).toEqual([]);
    expect(challengeMisfits(ABRA, ['alakazam', 'kadabra'])).toEqual([]);
    expect(challengeMisfits(ABRA, ['mimikyu'])).toEqual([0]);
    expect(challengeMisfits(ABRA, ['abra', 'zorua', 'kadabra', 'piplup'])).toEqual([1, 3]);
    expect(challengeMisfits(ZORUA, ['zoroark', 'zorua'])).toEqual([]);
    expect(challengeMisfits(ZORUA, ['litwick'])).toEqual([0]);
    for (const d of [...DUNGEONS, CRYPT]) expect(challengeMisfits(d, ['abra', 'mimikyu'])).toEqual([]);
  });

  it('every challenge can be played by every form of its line and by no one else', () => {
    for (const d of CHALLENGES) for (const id of PLAYABLE_SPECIES) expect(challengeMisfits(d, [id]).length === 0, `${d.id} ${id}`).toBe(lineOf(id) === d.challenge!.line);
  });
});

describe('challenge reward (tier = the difficulty it was cleared on)', () => {
  const owner = { coins: 0, owned: ['kadabra' as const], materials: { abra: { normal: 2 } } };
  const pays = ABRA.challenge!.materials;

  it('a victory adds the line\'s materials of its difficulty under the first form', () => {
    expect(challengeReward(owner, ABRA, true, 'normal').materials).toEqual({ abra: { normal: 2 + pays } });
    expect(challengeReward(owner, ABRA, true, 'hard').materials).toEqual({ abra: { normal: 2, hard: pays } });
    expect(challengeReward(owner, ABRA, true, 'nightmare').materials).toEqual({ abra: { normal: 2, nightmare: pays } });
  });

  it('an Easy clear, a defeat, a main dungeon or a line the player does not own pays nothing', () => {
    expect(challengeReward(owner, ABRA, true, 'easy')).toBe(owner);
    expect(challengeReward(owner, ABRA, false, 'nightmare')).toBe(owner);
    expect(challengeReward(owner, CRYPT, true, 'hard')).toBe(owner);
    const guest = { coins: 0, owned: ['piplup' as const] };
    expect(challengeReward(guest, ABRA, true, 'hard')).toBe(guest);
  });

  it('a starter line\'s challenge pays under the starter, owned or evolved', () => {
    const fresh: Collection = { coins: 0 };
    expect(challengeReward(fresh, ZORUA, true, 'nightmare').materials).toEqual({ zorua: { nightmare: pays } });
    const evolved: Collection = { coins: 0, owned: ['zoroark'] };
    expect(challengeReward(evolved, ZORUA, true, 'hard').materials).toEqual({ zorua: { hard: pays } });
  });

  it('the save keeps it (each peer pays its own save)', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 50, owned: ['abra'] });
    expect(earnChallengeReward(store, ABRA, true, 'hard').materials).toEqual({ abra: { hard: pays } });
    expect(loadSave(store).materials).toEqual({ abra: { hard: pays } });
    expect(loadSave(store).coins).toBe(50);
    earnChallengeReward(store, ABRA, false, 'hard');
    earnChallengeReward(store, ABRA, true, 'easy');
    expect(loadSave(store).materials).toEqual({ abra: { hard: pays } });
  });
});
