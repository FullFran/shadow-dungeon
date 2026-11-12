import { describe, expect, it } from 'vitest';
import { aimedThreats, familyViolations, patternDensity, positionalStep, stepPatterns } from '../../src/core/card-fairness';
import { fightOf } from '../../src/core/cards';
import { behaviourFor } from '../../src/core/tricks';
import type { CardFightDef } from '../../src/data/cards';
import { scaledTelegraphMs, type Difficulty } from '../../src/data/difficulty';
import { ENEMY_BEHAVIOUR } from '../../src/data/enemies';
import { NEW_CARDS } from '../../src/data/pattern-cards';
import type { SpeciesId } from '../../src/data/species';
import { catalog, LANGUAGES } from '../../src/i18n';

/**
 * Every pattern card of every card boss (the guardians, the hosted bosses'
 * new cards, every Senda boss) keeps the fairness rules on every tier
 * (src/core/card-fairness.ts), and every dungeon boss carries its new cards
 * where owner decision 2b puts them (odd/tasks/boss-patterns.md S3).
 */
const TIERS: readonly Difficulty[] = ['normal', 'hard', 'nightmare'];
const SPECIES = Object.keys(ENEMY_BEHAVIOUR) as SpeciesId[];
const fight = (s: SpeciesId, d: Difficulty): CardFightDef | undefined => fightOf(behaviourFor(s, d));
const CARD_BOSSES = SPECIES.filter((s) => TIERS.some((d) => fight(s, d)));

describe('pattern cards keep the fairness rules on every boss and tier', () => {
  it('finds the card bosses (8 dungeon bosses and the Senda shadows)', () => {
    expect(CARD_BOSSES.length).toBeGreaterThanOrEqual(8 + 48);
  });

  it.each(CARD_BOSSES.map((s) => [s] as const))('%s', (species) => {
    for (const d of TIERS) {
      const f = fight(species, d);
      if (!f) continue;
      const normal = fight(species, 'normal');
      for (const card of f.cards) {
        for (const [i, s] of card.steps.entries()) {
          const where = `${d} ${card.id} step ${i}`;
          expect(scaledTelegraphMs(s.telegraphMs, d), where).toBeGreaterThanOrEqual(positionalStep(s) ? 400 : 280);
          expect(aimedThreats(s), where).toBeLessThanOrEqual(2);
          expect(stepPatterns(s).length, where).toBeLessThanOrEqual(3);
          for (const p of stepPatterns(s)) expect(familyViolations(p), where).toEqual([]);
          // The same card on a harder tier: density or speed, never both past x1.3.
          const old = normal?.cards.find((c) => c.id === card.id)?.steps[i];
          if (d !== 'normal' && old) {
            const dens = patternDensity(s.pattern) / patternDensity(old.pattern);
            const speed = ('shot' in s.pattern ? s.pattern.shot.speed : 1) / ('shot' in old.pattern ? old.pattern.shot.speed : 1);
            expect(dens > 1.3 && speed > 1.3, where).toBe(false);
          }
        }
        for (const lang of LANGUAGES) {
          expect(catalog(lang)[card.nameKey], `${lang} ${card.nameKey}`).toBeTruthy();
          expect(catalog(lang)[`boss.stance.${card.id}`], `${lang} ${card.id}`).toBeTruthy();
        }
      }
      expect(f.cards.every((c) => c.steps.length > 0 || (c.moves?.length ?? 0) > 0), `${d}: every card plays something`).toBe(true);
    }
  });
});

describe('every dungeon boss has its new cards where decision 2b puts them', () => {
  it.each(Object.entries(NEW_CARDS))('%s', (species, plan) => {
    const ids = (d: Difficulty) => fight(species as SpeciesId, d)!.cards.map((c) => c.id);
    expect(ids('normal')).toContain(plan.normal);
    expect(ids('normal')).not.toContain(plan.replaces);
    for (const id of plan.extra) expect(ids('normal')).not.toContain(id);
    for (const id of plan.nightmareOnly) expect([...ids('normal'), ...ids('hard')]).not.toContain(id);
    for (const d of ['hard', 'nightmare'] as const) {
      expect(ids(d)).toContain(plan.normal);
      expect(ids(d), `${d} keeps the replaced card`).toContain(plan.replaces);
      for (const id of plan.extra) expect(ids(d)).toContain(id);
    }
    for (const id of plan.nightmareOnly) expect(ids('nightmare')).toContain(id);
  });

  it('covers every dungeon boss that fights with cards', () => {
    expect(Object.keys(NEW_CARDS).sort()).toEqual(['aegislash', 'decidueye', 'dhelmise', 'lanturn', 'nihilego', 'sableye', 'salazzle', 'trevenant']);
  });
});

describe('the family limits catch what they should', () => {
  const shot = { power: 10, type: 'ghost' as const, speed: 100, radius: 5, lifetimeMs: 4000 };
  it('flags a laser without warning, a fast orbit, a sharp curve, double bounces and strong homing', () => {
    expect(familyViolations({ kind: 'laser', volleys: 1, everyMs: 1000, lines: 1, fanDeg: 0, turnDeg: 0, warnMs: 200, fireMs: 300, beamEveryMs: 50, shot })).toHaveLength(1);
    expect(familyViolations({ kind: 'familiars', count: 2, radius: 80, degPerSec: 90, centre: 'boss', atOnce: 1, volleys: 2, gapMs: 500, perVolley: 1, spreadDeg: 0, aim: 'target', shot })).toHaveLength(1);
    expect(familyViolations({ kind: 'fan', fans: 1, perFan: 3, spreadDeg: 30, gapMs: 300, aim: 'first', shot: { ...shot, kin: { curveDegPerSec: 60, bounces: 2 } } })).toHaveLength(2);
    expect(familyViolations({ kind: 'homing', volleys: 1, gapMs: 500, orbs: 1, spreadDeg: 0, shot: { ...shot, steer: { degPerSec: 120, ms: 4000 } } })).toHaveLength(1);
  });
});
