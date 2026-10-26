import { describe, expect, it } from 'vitest';
import { CHALLENGES, guardianOf, roadFor } from '../../src/data/dungeons';
import { ROOMS, type RoomId } from '../../src/data/rooms';
import type { Difficulty } from '../../src/data/difficulty';
import { cardWorld, FIGHT_SEEDS, fightIn, proofFailures, proveCard, solveFight, startsOf, type BossCase } from '../../src/sim/prove';

/**
 * The Sendas' wounds are beatable (docs/story-quests.md, docs/gdd.md
 * "Garantía de que todo se puede pasar"): the same proof `npm run prove`
 * runs on the guardians, searched live here instead of read from the stored
 * witnesses. Every card of every wound on every tier (Easy too: a wound
 * fights with cards on every tier), from every start, is got through without
 * a hit, with punish windows and the tier's kill margin. A wound is the last
 * boss of a Senda: a challenge whose last arena holds a `-wound` species,
 * so a new line's wound is covered by being in the data.
 */
const WOUNDS: readonly BossCase[] = CHALLENGES.flatMap((d) => {
  const species = guardianOf(d);
  const last = [...d.plan].reverse().find((p) => p.kind === 'room' && p.role === undefined);
  if (!species?.endsWith('-wound') || last?.kind !== 'room') return [];
  return [{ species, room: last.room as RoomId, where: { dungeon: d.id, floor: d.plan.length } }];
});

const TIERS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

/** A wound on a tier: at the end of the road that tier plays (a Senda's chapter road: its reference level is that road's). */
const onTier = (w: BossCase, tier: Difficulty): BossCase => {
  const road = roadFor(CHALLENGES.find((d) => d.id === w.where!.dungeon)!, tier);
  return { ...w, where: { dungeon: road.id, floor: road.plan.length } };
};

describe('the wounds are beatable', () => {
  it('every Senda with a wound is listed (Mimikyu and the gacha lines at least)', () => {
    expect(WOUNDS.map((w) => w.species)).toEqual(expect.arrayContaining(['mimikyu-wound', 'abra-wound', 'piplup-wound', 'shinx-wound', 'axew-wound']));
    for (const w of WOUNDS) expect(ROOMS[w.room].spawns[0]!.species).toBe(w.species);
  });

  for (const w of WOUNDS) {
    for (const tier of TIERS) {
      const fight = fightIn(cardWorld(w, tier, 0), w.species)!;
      fight.cards.forEach((card, index) => {
        it(`${w.species} ${tier} ${card.id}: survivable from every start, with punish windows and its kill margin`, () => {
          const proof = proveCard(onTier(w, tier), tier, index, startsOf(w));
          expect(proof.starts).toBeGreaterThanOrEqual(3);
          expect(proofFailures([proof]), JSON.stringify(proofFailures([proof]))).toEqual([]);
        }, 300_000);
      });
    }
    it(`${w.species} nightmare: the solver bot clears the whole fight without a hit (seeds ${FIGHT_SEEDS.join(', ')})`, () => {
      for (const seed of FIGHT_SEEDS) expect(solveFight(onTier(w, 'nightmare'), 'nightmare', seed).cleared, `seed ${seed}`).toBe(true);
    }, 600_000);
  }
});
