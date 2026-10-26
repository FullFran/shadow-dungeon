import { describe, expect, it } from 'vitest';
import { CHALLENGES, SENDA_ROADS, type ChallengeLine } from '../../src/data/dungeons';
import { ROOMS, type RoomId } from '../../src/data/rooms';
import type { Difficulty } from '../../src/data/difficulty';
import { STORY_BOSSES } from '../../src/data/story/bosses';
import { isWound } from '../../src/data/story-quests';
import { cardWorld, FIGHT_SEEDS, fightIn, proofFailures, proveCard, solveFight, startsOf, type BossCase } from '../../src/sim/prove';

/**
 * The Sendas' new shadows are beatable (docs/story-quests.md, docs/gdd.md
 * "Garantía de que todo se puede pasar"): the proof `npm run prove` runs on
 * the guardians, searched live like the wounds' (tests/sim/wound-prove.test.ts).
 * Every card of every new mid-boss of every chapter road, on every tier (a
 * shadow fights with cards on every tier), from every start: got through
 * without a hit, with punish windows and the tier's kill margin; the solver
 * bot clears the whole Nightmare fight. A new shadow is covered by being on
 * a road; the shards (story-prove-<line>.test.ts) split the work per line.
 */
const STORY_IDS = new Set<string>(STORY_BOSSES.map((b) => b.id));

/** Every new shadow on a road, where it stands (its first road and floor). */
export const SHADOWS: readonly BossCase[] = [...CHALLENGES, ...SENDA_ROADS].flatMap((d) =>
  d.plan.flatMap((p, i) => {
    if (p.kind !== 'room' || p.role !== 'midboss') return [];
    const species = ROOMS[p.room].spawns[0]!.species;
    return STORY_IDS.has(species) && !isWound(species) ? [{ species, room: p.room as RoomId, where: { dungeon: d.id, floor: i + 1 } }] : [];
  }),
);

const TIERS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

/** Proves every shadow of `line`'s Senda. */
export function proveShadows(line: ChallengeLine): void {
  const cases = SHADOWS.filter((s) => s.species.startsWith(`${line}-`));
  describe(`${line}'s shadows are beatable`, () => {
    it('it has its shadows on its roads', () => expect(cases.length).toBeGreaterThan(0));
    for (const s of cases) {
      for (const tier of TIERS) {
        const fight = fightIn(cardWorld(s, tier, 0), s.species)!;
        fight.cards.forEach((card, index) => {
          it(`${s.species} ${tier} ${card.id}: survivable from every start, with punish windows and its kill margin`, () => {
            const proof = proveCard(s, tier, index, startsOf(s));
            expect(proof.starts).toBeGreaterThanOrEqual(3);
            expect(proofFailures([proof]), JSON.stringify(proofFailures([proof]))).toEqual([]);
          }, 300_000);
        });
      }
      // One test per seed: a single long synchronous test starves the worker's RPC ("Timeout calling onTaskUpdate").
      for (const seed of FIGHT_SEEDS) {
        it(`${s.species} nightmare: the solver bot clears the whole fight without a hit (seed ${seed})`, () => {
          expect(solveFight(s, 'nightmare', seed).cleared).toBe(true);
        }, 600_000);
      }
    }
  });
}
