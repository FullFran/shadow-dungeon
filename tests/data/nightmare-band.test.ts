import { describe, expect, it } from 'vitest';
import { AEGISLASH_CARDS_HARD, AEGISLASH_CARDS_NIGHTMARE, AEGISLASH_CARDS_NORMAL } from '../../src/data/aegislash-cards';
import { bandFight, type CardFightDef, type SpellCardDef } from '../../src/data/cards';
import { DECIDUEYE_CARDS_HARD, DECIDUEYE_CARDS_NIGHTMARE, DECIDUEYE_CARDS_NORMAL } from '../../src/data/decidueye-cards';
import type { Difficulty } from '../../src/data/difficulty';
import { GUARDIAN_TRICKS } from '../../src/data/guardian-tricks';
import { HOSTED_FIGHTS } from '../../src/data/hosted-cards';
import { NIGHTMARE_BAND, NIGHTMARE_CARD_HP } from '../../src/data/nightmare-band';
import type { SpeciesId } from '../../src/data/species';
import { STORY_BOSSES, STORY_FIGHTS } from '../../src/data/story/bosses';
import { fightOf } from '../../src/core/cards';
import { behaviourFor } from '../../src/core/tricks';
import { bandFactors } from '../../src/sim/band';
import { proofFailures, type CardProof } from '../../src/sim/prove';

/**
 * N1 of odd/tasks/nightmare-tuning.md: the Nightmare card HP band. A
 * Nightmare card whose kill margin is above `NIGHTMARE_BAND.max` gets more
 * segment HP (data/nightmare-band.ts, measured by tools/nightmare-band.ts);
 * every other segment, and every easier tier, keeps its HP.
 */

/** Every card boss's own fights (Normal, Hard, Nightmare), as authored. */
const RAW: Record<string, readonly [CardFightDef, CardFightDef, CardFightDef]> = {
  ...HOSTED_FIGHTS,
  aegislash: [AEGISLASH_CARDS_NORMAL, AEGISLASH_CARDS_HARD, AEGISLASH_CARDS_NIGHTMARE],
  decidueye: [DECIDUEYE_CARDS_NORMAL, DECIDUEYE_CARDS_HARD, DECIDUEYE_CARDS_NIGHTMARE],
  ...Object.fromEntries(STORY_BOSSES.map((b) => [b.id, STORY_FIGHTS[b.id].slice(1) as unknown as readonly [CardFightDef, CardFightDef, CardFightDef]])),
};

/** Each card's HP as a share of the boss's species HP at the tier. */
const segments = (f: CardFightDef): number[] => {
  const total = f.cards.reduce((s, c) => s + c.hpShare, 0);
  return f.cards.map((c) => ((f.hpScale ?? 1) * c.hpShare) / total);
};

const card = (id: string, hpShare: number, extra: Partial<SpellCardDef> = {}): SpellCardDef => ({ id: `sc-${id}`, nameKey: id, hpShare, timerMs: 30_000, restMs: 0, steps: [], ...extra });
const FIGHT: CardFightDef = { cards: [card('a', 0.5), card('s', 0, { survival: true }), card('b', 0.5)], aggroRange: 1, breakMs: 1, phase2BreakMs: 1, maxShots: 1, walkSpeed: 1, keepDistance: 1, power: 1, hpScale: 0.8 };

describe('Nightmare card HP band (N1)', () => {
  it('the band is [1.1, 1.8] of the kill margin', () => {
    expect(NIGHTMARE_BAND).toEqual({ min: 1.1, max: 1.8 });
  });

  it('bandFight raises only the listed cards\' segments, by their factor; the others keep their HP', () => {
    expect(bandFight(FIGHT, {})).toBe(FIGHT);
    const banded = bandFight(FIGHT, { 'sc-b': 1.5 });
    const [a, s, b] = segments(banded);
    expect(a).toBeCloseTo(segments(FIGHT)[0]!, 10);
    expect(s).toBe(0);
    expect(b).toBeCloseTo(segments(FIGHT)[2]! * 1.5, 10);
    expect(banded.cards.map((c) => c.id)).toEqual(FIGHT.cards.map((c) => c.id));
  });

  it('every card boss plays its banded Nightmare fight, and its authored Normal and Hard ones untouched', () => {
    const species = Object.keys(GUARDIAN_TRICKS) as SpeciesId[];
    expect(species.sort()).toEqual(Object.keys(RAW).sort());
    for (const s of species) {
      const [normal, hard, nightmare] = RAW[s]!;
      expect(fightOf(behaviourFor(s, 'normal')), `${s} normal`).toBe(normal);
      expect(fightOf(behaviourFor(s, 'hard')), `${s} hard`).toBe(hard);
      const played = fightOf(behaviourFor(s, 'nightmare'))!;
      const want = segments(nightmare).map((x, i) => x * (NIGHTMARE_CARD_HP[nightmare.cards[i]!.id] ?? 1));
      segments(played).forEach((x, i) => expect(x, `${s} ${nightmare.cards[i]!.id}`).toBeCloseTo(want[i]!, 10));
    }
  });

  it('every factor names a Nightmare card and only raises its HP (cards under the band are left alone)', () => {
    const ids = new Set(Object.values(RAW).flatMap((f) => f[2].cards.map((c) => c.id)));
    for (const [id, f] of Object.entries(NIGHTMARE_CARD_HP)) {
      expect(ids.has(id as never), id).toBe(true);
      expect(f, id).toBeGreaterThan(1);
    }
  });

  it('bandFactors: a home card above the band gets the factor that brings it under the ceiling, never one that drops another case under its target', () => {
    const f = bandFactors([
      { card: 'sc-x', home: true, margin: 3.58, target: 1.1 },
      { card: 'sc-x', home: false, margin: 4, target: 1.1 },
      { card: 'sc-y', home: true, margin: 1.5, target: 1.1 },
      { card: 'sc-z', home: true, margin: 2.4, target: 1.1 },
      { card: 'sc-z', home: false, margin: 1.32, target: 1.1 },
      { card: 'sc-g', home: true, margin: 3, target: 1.1, gap: true },
    ]);
    expect(f.factors['sc-x']).toBe(2);
    expect('sc-y' in f.factors).toBe(false);
    expect('sc-g' in f.factors).toBe(false);
    // sc-z: 2.4 / 1.79 → 1.35, but its other case allows only 1.32 / 1.1 = 1.2.
    expect(f.factors['sc-z']).toBe(1.19);
    expect(f.capped).toEqual(['sc-z']);
  });

  it('bandFactors keeps a current factor within 0.01 of the measured one (HP rounding never churns the table)', () => {
    const samples = [{ card: 'sc-x', home: true, margin: 3.58, target: 1.1 }];
    expect(bandFactors(samples, { 'sc-x': 2.01 }).factors['sc-x']).toBe(2.01);
    expect(bandFactors(samples, { 'sc-x': 2.03 }).factors['sc-x']).toBe(2);
  });

  it('the proof fails a banded case whose card is above the ceiling, and names the band tool', () => {
    const proof = { boss: 'x', tier: 'nightmare' as Difficulty, card: 'sc-x', index: 0, survival: false, survivable: true, starts: 3, failures: [], witnesses: [], timerMs: 30_000, punish: { meleeMs: 5000, meleeWindows: 2, longestMeleeMs: 3000, fireMs: 5000, fireWindows: 2, longestFireMs: 3000, turns: 3 }, segmentHp: 100, margin: 2.4, marginTarget: 1.1, worstStarter: 'zorua' } satisfies CardProof;
    expect(proofFailures([proof])).toEqual([]);
    expect(proofFailures([{ ...proof, marginCeiling: 1.8 }])).toEqual(['x nightmare sc-x: kill margin 2.40 > 1.8 (Nightmare band: npx vite-node tools/nightmare-band.ts --write)']);
    expect(proofFailures([{ ...proof, margin: 1.7, marginCeiling: 1.8 }])).toEqual([]);
  });
});
