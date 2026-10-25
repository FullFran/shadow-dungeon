import { describe, expect, it } from 'vitest';
import { scaledTelegraphMs, type Difficulty } from '../../src/data/difficulty';
import { ENEMY_SHOT_CAP } from '../../src/data/enemies';
import { HERALD_ANIMS, HERALD_FAIRNESS, HERALD_SPECIES } from '../../src/data/herald';
import { SPRITE_KEYS, SPRITES } from '../../src/data/sprites';
import { generateBoss, heraldCardCount, heraldDef, heraldPool, heraldWear } from '../../src/core/herald/generate';
import { asksChoice } from '../../src/core/herald/patterns';

const TIERS: readonly Difficulty[] = ['easy', 'normal', 'hard', 'nightmare'];

describe('herald generator', () => {
  it('is deterministic: the same seed, depth and tier make the same boss; other seeds make others', { timeout: 60_000 }, () => {
    for (const seed of [1, 77, 123456]) {
      expect(generateBoss(seed, 32, 'hard')).toEqual(generateBoss(seed, 32, 'hard'));
    }
    const names = new Set(Array.from({ length: 20 }, (_, i) => generateBoss(i + 1, 32, 'normal').name + generateBoss(i + 1, 32, 'normal').epithet.es));
    expect(names.size).toBeGreaterThan(15);
    // The cached lookup is the generator's.
    expect(heraldDef(5, 42, 'easy')).toEqual(generateBoss(5, 42, 'easy'));
    expect(heraldDef(5, 42, 'easy')).toBe(heraldDef(5, 42, 'easy'));
  });

  it('wears only sheets with every animation it plays (no fallback), from the curated list', { timeout: 60_000 }, () => {
    const pool = heraldPool();
    expect(pool.length).toBeGreaterThanOrEqual(15);
    for (const { sprite } of pool) {
      const meta = SPRITES.sprites[(SPRITE_KEYS as Record<string, string>)[sprite]!]!;
      for (const anim of HERALD_ANIMS) expect(meta.anims[anim]?.source).toBe(anim);
    }
    // Sheets with a fallback (Trevenant's Shoot) are left out.
    expect(pool.map((p) => p.sprite)).not.toContain('trevenant');
    expect(HERALD_SPECIES.length).toBeGreaterThan(pool.length);
    for (let s = 0; s < 40; s++) {
      const def = generateBoss(s, 22, 'easy');
      expect(pool.map((p) => p.sprite)).toContain(def.sprite);
      // The renderer's shortcut agrees with the generator.
      expect(heraldWear(s).sprite).toBe(def.sprite);
    }
  });

  it('has the Touhou structure: 3-5 cards by depth (nightmare one more), 1-3 layers, a phase 2 from the middle card, a timer each', { timeout: 60_000 }, () => {
    expect(heraldCardCount(22, 'normal')).toBe(3);
    expect(heraldCardCount(45, 'normal')).toBe(4);
    expect(heraldCardCount(80, 'normal')).toBe(5);
    expect(heraldCardCount(22, 'nightmare')).toBe(4);
    expect(heraldCardCount(90, 'nightmare')).toBe(5);
    for (let s = 0; s < 24; s++) {
      const tier = TIERS[s % 4]!;
      const depth = 22 + s * 5;
      const def = generateBoss(s + 300, depth, tier);
      expect(def.cards).toHaveLength(heraldCardCount(depth, tier));
      expect(def.phase2.cards).toHaveLength(def.cards.length);
      expect(def.phase2.fromCard).toBe(Math.max(1, Math.floor(def.cards.length / 2)));
      def.cards.forEach((card, i) => {
        expect(card.id).toBe(`herald${i}`);
        expect(card.layers.length).toBeGreaterThanOrEqual(1);
        expect(card.layers.length).toBeLessThanOrEqual(HERALD_FAIRNESS.maxLayers);
        expect(card.timerMs).toBeGreaterThanOrEqual(22_000);
        expect(card.timerMs).toBeLessThanOrEqual(48_000);
        const floor = card.layers.some(asksChoice) ? 400 : 280;
        expect(scaledTelegraphMs(card.telegraphMs, tier)).toBeGreaterThanOrEqual(floor);
        expect(card.name.es).toMatch(/^Signo .+ «.+»$/);
        expect(card.name.en).toMatch(/ Sign ".+"$/);
      });
      for (const card of def.phase2.cards.slice(def.phase2.fromCard)) expect(card.id).toMatch(/^herald\dx$/);
      expect(def.maxShots).toBeLessThanOrEqual(ENEMY_SHOT_CAP);
      expect(['static', 'drift', 'teleport', 'dash']).toContain(def.move);
      expect(def.anchors.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('names are composed: a proper name, «el/la X de los/las Y Z», an epigraph, never a borrowed one', { timeout: 60_000 }, () => {
    for (let s = 0; s < 60; s++) {
      const def = generateBoss(s * 31 + 1, 32, 'normal');
      expect(def.name).toMatch(/^[A-Z][a-z]{3,11}$/);
      expect(def.epithet.es).toMatch(/^(el|la) \S+(-\S+)? de (los|las) \S+ \S+$/);
      expect(def.epithet.en).toMatch(/^the \S+ of the \S+ \S+$/);
      expect(def.epigraph.es.length).toBeGreaterThan(10);
      expect(def.epigraph.en.length).toBeGreaterThan(10);
      expect(`${def.name} ${def.epithet.es} ${def.epigraph.es} ${def.epigraph.en}`).not.toMatch(/necrozma|\{d\}/i);
      // The theme follows one of its types.
      expect(def.types).toContain(def.theme.type);
    }
  });
});
