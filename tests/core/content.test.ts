import { describe, expect, it } from 'vitest';
import { catalog } from '../../src/i18n';
import { MOVES } from '../../src/data/moves';
import { SPECIES } from '../../src/data/species';
import { POKEMON_TYPES } from '../../src/data/types';

describe('move data', () => {
  for (const move of Object.values(MOVES)) {
    it(`${move.id} is well formed for its slot`, () => {
      expect(move.windupMs).toBeGreaterThan(0);
      expect(move.activeMs).toBeGreaterThan(0);
      expect(move.recoveryMs).toBeGreaterThan(0);
      if (move.slot === 'heavy') {
        expect(move.charge?.[0]?.holdMs).toBe(0);
        const holds = move.charge!.map((level) => level.holdMs);
        expect(holds).toEqual([...holds].sort((a, b) => a - b));
      } else {
        expect(move.charge).toBeUndefined();
        expect(move.staminaCost).toBe(0);
      }
    });
  }

  it('keeps fast moves faster than heavy ones', () => {
    const windups = (slot: string) => Object.values(MOVES).filter((m) => m.slot === slot).map((m) => m.windupMs);
    expect(Math.max(...windups('fast'))).toBeLessThan(Math.min(...windups('heavy')));
  });
});

describe('content names are localized', () => {
  const es = catalog('es');
  const keys = [
    ...Object.keys(MOVES).map((id) => `move.${id}`),
    ...Object.keys(SPECIES).map((id) => `species.${id}`),
    ...POKEMON_TYPES.map((id) => `type.${id}`),
  ];
  it('has a Spanish (and therefore English) name for every move, species and type', () => {
    expect(keys.filter((key) => !(key in es))).toEqual([]);
  });

  it('uses the official names', () => {
    expect(es['move.shadow-claw']).toBe('Garra Umbría');
    expect(catalog('en')['move.play-rough']).toBe('Play Rough');
  });
});
