import { describe, expect, it } from 'vitest';
import { depthScale } from '../../src/core/endless';
import type { WorldState } from '../../src/core/state';
import type { Difficulty } from '../../src/data/difficulty';
import { ECLIPSE } from '../../src/data/dungeons';
import { ENDLESS } from '../../src/data/endless';
import { SIMA_SHADOWS, SIMA_STORY, SIMA_WOUNDS, type SimaStoryBoss } from '../../src/data/sima-story';
import { cardWorld, fightIn, proofFailures, proveCard, startsOf, type BossCase } from '../../src/sim/prove';

/**
 * The Sendas' bosses are beatable where the Sima puts them (docs/sima-redesign.md
 * §4, docs/gdd.md "Garantía de que todo se puede pasar"): every lost shadow on
 * the first floor a stray can be (12) and every wound on the first wound floor
 * (35), with the Sima's scale (its fixed HP share, that floor's damage) and the
 * Sima's expected level there. Deeper floors only hit harder (survivability is
 * a no-hit proof, so damage does not change it) and the expected level only
 * rises, while the HP share stays: the first floor is the hardest kill. Every
 * card on every tier from every start, searched live like the Sendas' own
 * proofs (tests/sim/story-prove-<line>.test.ts). A new Senda's bosses are
 * covered by being in the pools (data/sima-story.ts reads STORY_BOSSES).
 */
const TIERS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

/** A Senda boss as the Sima meets it on `floor`. */
export function simaCase(b: SimaStoryBoss, floor: number): BossCase {
  const damage = depthScale(ENDLESS.scaling, floor).damage;
  return {
    species: b.species,
    room: b.room,
    label: `${b.species}-sima`,
    where: { dungeon: ECLIPSE.id, floor },
    prepare: (s: WorldState): WorldState => {
      const hp = (maxHp: number) => Math.max(1, Math.round(maxHp * SIMA_STORY.hp));
      const enemies = s.enemies.map((e) => (e.species === b.species ? { ...e, maxHp: hp(e.maxHp), hp: hp(e.maxHp) } : e));
      return { ...s, depth: floor, enemyScale: { hp: SIMA_STORY.hp, damage }, enemies };
    },
  };
}

export const SIMA_STORY_CASES: readonly BossCase[] = [
  ...SIMA_SHADOWS.map((b) => simaCase(b, SIMA_STORY.strays.fromFloor)),
  ...SIMA_WOUNDS.map((b) => simaCase(b, ENDLESS.wounds!.from)),
];

describe('the Sendas\' bosses are beatable in the Sima', () => {
  it('every shadow and every wound has its case', () => {
    expect(SIMA_STORY_CASES.length).toBe(SIMA_SHADOWS.length + SIMA_WOUNDS.length);
  });

  for (const c of SIMA_STORY_CASES) {
    for (const tier of TIERS) {
      const fight = fightIn(cardWorld(c, tier, 0), c.species)!;
      fight.cards.forEach((card, index) => {
        it(`${c.label} ${tier} ${card.id}: survivable from every start, with punish windows and its kill margin`, () => {
          const proof = proveCard(c, tier, index, startsOf(c));
          expect(proof.starts).toBeGreaterThanOrEqual(3);
          expect(proofFailures([proof]), JSON.stringify(proofFailures([proof]))).toEqual([]);
        }, 300_000);
      });
    }
  }
});
