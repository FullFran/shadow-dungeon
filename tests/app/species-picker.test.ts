import { describe, expect, it } from 'vitest';
import { passiveOf, speciesStats } from '../../src/app/species-picker';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { catalog, LANGUAGES } from '../../src/i18n';

/** The Pokémon picker (owner, 2026-11-03: "Mejora muchísimo más el selector de pokemon"). */
describe('species picker', () => {
  it('rates every playable species on life and speed between 0 and 1', () => {
    for (const id of PLAYABLE_SPECIES) {
      const s = speciesStats(id);
      for (const v of [s.hp, s.speed]) {
        expect(v, id).toBeGreaterThan(0);
        expect(v, id).toBeLessThanOrEqual(1);
      }
    }
  });

  it('shows a passive only where the species has one (never the run goal in its place)', () => {
    expect(passiveOf('axew')).toBeNull();
    expect(passiveOf('zorua')?.nameKey).toBe('passive.illusion');
    for (const language of LANGUAGES) {
      for (const key of ['loadout.stat.hp', 'loadout.stat.speed', 'loadout.noPassive', 'loadout.choose']) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
    }
  });
});
