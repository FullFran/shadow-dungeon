import { describe, expect, it } from 'vitest';
import type { TrialRequest } from '../../src/app/shrine';
import { loadoutBack, loadoutSpecies, loadoutStart, shrineFight, shrineFocus, viewOf } from '../../src/app/shrine-route';
import { bossStop, gauntletStops, heraldStop, SHRINE_BOSSES } from '../../src/core/shrine';
import { GAUNTLETS } from '../../src/data/shrine';
import { SPECIES } from '../../src/data/species';

const aegislash: TrialRequest = { kind: 'boss', id: 'aegislash', stops: [bossStop('aegislash')!], difficulty: 'hard' };
const guardians: TrialRequest = { kind: 'gauntlet', id: 'guardians', stops: gauntletStops('guardians'), difficulty: 'normal' };
const herald: TrialRequest = { kind: 'herald', id: '42', stops: [heraldStop(42)], difficulty: 'easy' };

describe('shrine → loadout → trial routing', () => {
  it('a picked boss or gauntlet opens the loadout on its species step, not the fight', () => {
    expect(shrineFight(aegislash)).toEqual({ screen: 'loadout', stage: 'species', request: aegislash });
    expect(shrineFight(guardians)).toEqual({ screen: 'loadout', stage: 'species', request: guardians });
  });

  it('picking a species goes on to its moves, same request', () => {
    expect(loadoutSpecies(aegislash)).toEqual({ screen: 'loadout', stage: 'moves', request: aegislash });
  });

  it('confirming starts the trial with the chosen species and moves', () => {
    const loadout = [...SPECIES.zorua.defaultLoadout];
    const step = loadoutStart(guardians, { species: 'zorua', loadout });
    expect(step).toEqual({ screen: 'trial', request: guardians, species: 'zorua', loadout: [...SPECIES.zorua.defaultLoadout] });
    // A copy: a later loadout edit does not change the started trial.
    loadout[0] = null;
    expect(step.loadout[0]).toBe(SPECIES.zorua.defaultLoadout[0]);
  });

  it('back from the moves returns to the species, back from the species to the shrine with the pick kept', () => {
    expect(loadoutBack('moves', aegislash)).toEqual({ screen: 'loadout', stage: 'species', request: aegislash });
    expect(loadoutBack('species', aegislash)).toEqual({ screen: 'shrine', view: 'reflections', focus: 'aegislash', difficulty: 'hard' });
    expect(loadoutBack('species', guardians)).toEqual({ screen: 'shrine', view: 'gauntlets', focus: 'guardians', difficulty: 'normal' });
    expect(loadoutBack('species', herald)).toEqual({ screen: 'shrine', view: 'heralds', focus: '42', difficulty: 'easy' });
  });

  it('maps each request kind to its shrine view', () => {
    expect(viewOf(aegislash)).toBe('reflections');
    expect(viewOf(guardians)).toBe('gauntlets');
    expect(viewOf(herald)).toBe('heralds');
  });

  it('puts the shrine cursor back on the picked row (after the tier row)', () => {
    expect(shrineFocus('reflections', 'aegislash', [])).toBe(SHRINE_BOSSES.findIndex((b) => b.boss === 'aegislash') + 1);
    expect(shrineFocus('gauntlets', 'oaths', [])).toBe(GAUNTLETS.findIndex((g) => g.id === 'oaths') + 1);
    // Heralds list the last met first.
    expect(
      shrineFocus('heralds', '7', [
        { seed: 7, name: 'A' },
        { seed: 9, name: 'B' },
      ]),
    ).toBe(2);
    expect(shrineFocus('reflections', 'nobody', [])).toBeUndefined();
    expect(shrineFocus('main', 'aegislash', [])).toBeUndefined();
    expect(shrineFocus('reflections', undefined, [])).toBeUndefined();
  });
});
