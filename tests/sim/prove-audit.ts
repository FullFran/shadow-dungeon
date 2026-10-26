import { describe, expect, it } from 'vitest';
import store from '../../reports/proof/witnesses.json';
import { cardWorld, fightIn, FIGHT_SEEDS, judgeCard, judgeFight, proofFailures, PROOF_CASES, startsOf, type Witness } from '../../src/sim/prove';

/**
 * The beatability proof in CI (docs/gdd.md "Garantía de que todo se puede
 * pasar"): every stored witness (reports/proof/witnesses.json, found by
 * `npm run prove`) is replayed on the real engine. Every card of every card
 * boss on every card tier, from every start, must be got through without a
 * hit (survivability); every card that can be hurt must show melee and
 * line-of-fire punish windows of at least 600 ms on its witness, and the
 * reference player's damage in those windows must empty its segment with
 * the tier's margin (kill feasibility). The solver bot's stored Nightmare
 * fights must clear. A change to a pattern that breaks a witness fails here:
 * run `npm run prove` again (it keeps the witnesses that still hold).
 */

const cards = (store as { cards: Record<string, (Witness | null)[]> }).cards;
const fights = (store as { fights: Record<string, string> }).fights;

export function auditCases(labels: readonly string[]): void {
  for (const p of PROOF_CASES.filter((x) => labels.includes(x.case.label ?? x.case.species))) {
    const label = p.case.label ?? p.case.species;
    describe(`beatability proof: ${label}`, () => {
      for (const tier of p.tiers) {
        it(`${label} ${tier}: every card survivable from every start, with punish windows and its kill margin`, () => {
          const fight = fightIn(cardWorld(p.case, tier, 0), p.case.species)!;
          const starts = startsOf(p.case);
          const proofs = fight.cards.map((card, index) => judgeCard(p.case, tier, index, starts, cards[`${label}/${tier}/${card.id}`] ?? []));
          expect(proofFailures(proofs)).toEqual([]);
          expect(proofs.every((x) => x.starts >= 3)).toBe(true);
        }, 120_000);
        if (p.fights.includes(tier)) {
          it(`${label} ${tier}: the solver bot clears the whole fight without a hit (seeds ${FIGHT_SEEDS.join(', ')})`, () => {
            for (const seed of FIGHT_SEEDS) expect(judgeFight(p.case, tier, seed, fights[`${label}/${tier}/${seed}`] ?? '').cleared, `seed ${seed}`).toBe(true);
          }, 120_000);
        }
      }
    });
  }
}
