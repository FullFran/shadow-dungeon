import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { loadStarter, playableStarter, saveStarter } from '../../src/app/starter-choice';
import { SPECIES } from '../../src/data/species';

describe('starter choice', () => {
  it('is empty until the quiz stores one, then remembers it', () => {
    const store = memoryStore();
    expect(loadStarter(store)).toBeNull();
    saveStarter(store, 'zorua');
    expect(loadStarter(store)).toBe('zorua');
  });

  it('ignores a stored value that is not a starter', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.starter', 'gastly');
    expect(loadStarter(store)).toBeNull();
    store.set('mazmorra-sombria.starter', '{oops');
    expect(loadStarter(store)).toBeNull();
  });

  it('hands the run a playable species, else Mimikyu', () => {
    expect(playableStarter('mimikyu')).toBe('mimikyu');
    expect(playableStarter(null)).toBe('mimikyu');
    for (const id of ['zorua', 'litwick', 'cubone'] as const) {
      const species = (SPECIES as Record<string, { movepool: readonly string[] } | undefined>)[id];
      expect(playableStarter(id)).toBe(species && species.movepool.length > 0 ? id : 'mimikyu');
    }
  });
});
