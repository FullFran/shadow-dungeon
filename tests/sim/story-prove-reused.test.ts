import { describe, expect, it } from 'vitest';
import { CHALLENGES, challengeOfRoad, roadFor, SENDA_ROADS } from '../../src/data/dungeons';
import { ROOMS } from '../../src/data/rooms';
import type { Difficulty } from '../../src/data/difficulty';
import { STORY_BOSSES } from '../../src/data/story/bosses';
import { cardWorld, fightIn, proofFailures, proveCard, startsOf, type BossCase } from '../../src/sim/prove';

/**
 * An older boss met again as a gacha Senda's mid-boss (Nihilego in Abra's and
 * Shinx's third road, Trevenant in Axew's second) is proven at that road's
 * own reference level, on the tiers that road is played (I Easy and Normal,
 * II Hard, III Nightmare): its home arena's proof (`npm run prove`) is at a
 * deeper floor of a main dungeon. Same proof as tests/sim/story-prove.ts.
 */
const GACHA_LINES = new Set(['abra', 'piplup', 'shinx', 'axew']);
const NEW = new Set<string>(STORY_BOSSES.map((b) => b.id));
const TIERS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

const REUSED: readonly { boss: BossCase; tiers: readonly Difficulty[] }[] = [...CHALLENGES, ...SENDA_ROADS]
  .filter((d) => GACHA_LINES.has(d.challenge?.line ?? ''))
  .flatMap((d) => {
    const tiers = TIERS.filter((t) => roadFor(challengeOfRoad(d), t).id === d.id);
    return d.plan.flatMap((p, i) => {
      if (p.kind !== 'room' || p.role !== 'midboss') return [];
      const species = ROOMS[p.room].spawns[0]!.species;
      return NEW.has(species) ? [] : [{ boss: { species, room: p.room, where: { dungeon: d.id, floor: i + 1 } }, tiers }];
    });
  });

describe('older bosses on the gacha Sendas\' roads are beatable there', () => {
  it('the reused ones are few (the story needs them): Nihilego twice and Trevenant once', () => {
    expect(REUSED.map((r) => r.boss.species).sort()).toEqual(['nihilego', 'nihilego', 'trevenant']);
  });

  for (const { boss, tiers } of REUSED) {
    for (const tier of tiers) {
      const fight = fightIn(cardWorld(boss, tier, 0), boss.species);
      if (!fight) continue;
      fight.cards.forEach((card, index) => {
        it(`${boss.species} (${boss.where!.dungeon} F${boss.where!.floor}) ${tier} ${card.id}: survivable from every start, with punish windows and its kill margin`, () => {
          const proof = proveCard(boss, tier, index, startsOf(boss));
          expect(proofFailures([proof]), JSON.stringify(proofFailures([proof]))).toEqual([]);
        }, 300_000);
      });
    }
  }
});
