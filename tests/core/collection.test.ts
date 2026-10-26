import { describe, expect, it } from 'vitest';
import { rosterOf } from '../../src/core/collection';
import { STARTER_SPECIES } from '../../src/data/species';

describe('collection: who a player can play as', () => {
  it('a fresh save plays the starters, in picker order', () => {
    expect(rosterOf({})).toEqual(STARTER_SPECIES);
  });

  it('owned species follow the starters, once each, and never a starter twice', () => {
    expect(rosterOf({ owned: ['zorua', 'zorua'] })).toEqual(STARTER_SPECIES);
  });
});
