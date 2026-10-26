import { describe, expect, it } from 'vitest';
import store from '../../reports/proof/witnesses.json';
import { CHALLENGES, challengeOfRoad, roadFor, SENDA_ROADS } from '../../src/data/dungeons';
import { ROOMS } from '../../src/data/rooms';
import type { Difficulty } from '../../src/data/difficulty';
import { STORY_BOSSES } from '../../src/data/story/bosses';
import { cardWorld, CARD_BOSSES, fightIn, judgeCard, proofFailures, startsOf, type BossCase, type Witness } from '../../src/sim/prove';

/**
 * An older boss met again as a gacha Senda's mid-boss (Nihilego in Abra's and
 * Shinx's third road, Trevenant in Axew's second) is proven at that road's
 * own reference level, on the tiers that road is played (I Easy and Normal,
 * II Hard, III Nightmare). Its arena is its home arena's geometry (the rift
 * with a way on, the hollow itself), so the witnesses `npm run prove` stored
 * for it there (reports/proof/witnesses.json) are replayed on the engine
 * here: survivability is the arena's, the kill margin is the road's level.
 * Replaying is cheap; searching these cards live would block a worker for
 * tens of seconds each.
 */
const cards = (store as { cards: Record<string, (Witness | null)[]> }).cards;
const GACHA_LINES = new Set(['abra', 'piplup', 'shinx', 'axew']);
const NEW = new Set<string>(STORY_BOSSES.map((b) => b.id));
const TIERS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];
const HOME = new Map(CARD_BOSSES.map((c) => [c.species, c.room]));

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

/** An arena with its home arena's geometry: same size, obstacles, start and boss spot (only the way on may differ). */
const sameGeometry = (a: (typeof ROOMS)[keyof typeof ROOMS], b: (typeof ROOMS)[keyof typeof ROOMS]): boolean =>
  JSON.stringify([a.width, a.height, a.obstacles, a.playerStart, a.spawns, a.pools ?? []]) === JSON.stringify([b.width, b.height, b.obstacles, b.playerStart, b.spawns, b.pools ?? []]);

describe('older bosses on the gacha Sendas\' roads are beatable there', () => {
  it('the reused ones are few (the story needs them), each in its home arena\'s geometry', () => {
    expect(REUSED.map((r) => r.boss.species).sort()).toEqual(['nihilego', 'nihilego', 'trevenant']);
    for (const r of REUSED) expect(sameGeometry(ROOMS[r.boss.room], ROOMS[HOME.get(r.boss.species)!]), r.boss.room).toBe(true);
  });

  for (const { boss, tiers } of REUSED) {
    for (const tier of tiers) {
      it(`${boss.species} (${boss.where!.dungeon} F${boss.where!.floor}) ${tier}: its stored witnesses hold, with punish windows and the road's kill margin`, () => {
        const fight = fightIn(cardWorld(boss, tier, 0), boss.species)!;
        const starts = startsOf(boss);
        const proofs = fight.cards.map((card, index) => judgeCard(boss, tier, index, starts, cards[`${boss.species}/${tier}/${card.id}`] ?? []));
        expect(proofFailures(proofs)).toEqual([]);
        expect(proofs.every((p) => p.starts >= 3)).toBe(true);
      }, 120_000);
    }
  }
});
