import { afterEach, describe, expect, it } from 'vitest';
import type { ChallengeLine } from '../../src/data/dungeons';
import type { Difficulty } from '../../src/data/difficulty';
import { cardWorld, FIGHT_SEEDS, fightIn, proofFailures, proveCard, SHADOW_BOSSES, solveFight, startsOf, type BossCase } from '../../src/sim/prove';

/**
 * The Sendas' new shadows are beatable (docs/story-quests.md, docs/gdd.md
 * "Garantía de que todo se puede pasar"): the proof `npm run prove` runs on
 * the guardians, searched live like the wounds' (tests/sim/wound-prove.test.ts).
 * Every card of every new mid-boss of every chapter road, on every tier (a
 * shadow fights with cards on every tier), from every start: got through
 * without a hit, with punish windows and the tier's kill margin; the solver
 * bot clears the whole Nightmare fight. A new shadow is covered by being on
 * a road (src/sim/prove.ts `SHADOW_BOSSES`); the shards
 * (story-prove-<line>.test.ts) split the work per line.
 */
export const SHADOWS: readonly BossCase[] = SHADOW_BOSSES;

const TIERS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

/** Proves every shadow of `line`'s Senda. */
export function proveShadows(line: ChallengeLine): void {
  const cases = SHADOWS.filter((s) => s.species.startsWith(`${line}-`));
  describe(`${line}'s shadows are beatable`, () => {
    // Back-to-back synchronous proofs never let the worker read its RPC replies ("Timeout calling onTaskUpdate" once a file runs past 60 s): yield a macrotask after each.
    afterEach(() => new Promise<void>((resolve) => setTimeout(resolve, 0)));
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
