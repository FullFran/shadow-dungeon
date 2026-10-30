import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { evolveAt } from '../../src/app/evolve';
import { EMPTY_SAVE, loadSave, sanitize, setFemaleAt, writeSave } from '../../src/app/save';
import { FEMALE_ART, FEMALE_LINES, hasFemaleArt, isFemale, setFemale } from '../../src/core/gender';
import { startRun } from '../../src/core/run';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { lineRoot } from '../../src/data/player-evolutions';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { input } from './helpers';

/** Gender (odd/tasks/pokemon-gender.md): per line, cosmetic only, male unless chosen, only where there is female art. */
describe('the gender of a line', () => {
  it('lists Shinx, Luxio and Luxray, and only playable species', () => {
    expect([...FEMALE_ART]).toEqual(['shinx', 'luxio', 'luxray']);
    for (const species of FEMALE_ART) expect(PLAYABLE_SPECIES).toContain(species);
    expect([...FEMALE_LINES]).toEqual(['shinx']);
  });

  it('every playable species answers: art only for the listed, male by default', () => {
    for (const species of PLAYABLE_SPECIES) {
      expect(hasFemaleArt(species), species).toBe((FEMALE_ART as readonly string[]).includes(species));
      expect(isFemale(EMPTY_SAVE, species), species).toBe(false);
    }
  });

  it('belongs to the whole line, and is chosen from any of its forms', () => {
    for (const form of ['shinx', 'luxio', 'luxray'] as const) {
      const chosen = setFemale(EMPTY_SAVE, form, true);
      expect(chosen.females).toEqual(['shinx']);
      for (const other of ['shinx', 'luxio', 'luxray'] as const) expect(isFemale(chosen, other)).toBe(true);
      const back = setFemale(chosen, form, false);
      expect(back.females).toEqual([]);
      expect(isFemale(back, 'luxray')).toBe(false);
    }
  });

  it('a line without female art never takes it, and a choice already made returns the same save', () => {
    for (const species of PLAYABLE_SPECIES.filter((id) => !FEMALE_LINES.includes(lineRoot(id)))) {
      expect(setFemale(EMPTY_SAVE, species, true), species).toBe(EMPTY_SAVE);
    }
    expect(setFemale(EMPTY_SAVE, 'shinx', false)).toBe(EMPTY_SAVE);
    const chosen = setFemale(EMPTY_SAVE, 'shinx', true);
    expect(setFemale(chosen, 'luxray', true)).toBe(chosen);
  });
});

describe('gender in the save', () => {
  it('round trips through the store, without a save version bump', () => {
    const store = memoryStore();
    const version = loadSave(store).version;
    expect(setFemaleAt(store, 'luxio', true).females).toEqual(['shinx']);
    expect(loadSave(store).females).toEqual(['shinx']);
    expect(loadSave(store).version).toBe(version);
    expect(setFemaleAt(store, 'shinx', false).females).toBeUndefined();
    expect(loadSave(store).females).toBeUndefined();
  });

  it('a save without the field reads as male and is written without it', () => {
    const store = memoryStore();
    writeSave(store, EMPTY_SAVE);
    expect(loadSave(store).females).toBeUndefined();
    expect('females' in sanitize({ ...EMPTY_SAVE })).toBe(false);
    expect(isFemale(loadSave(store), 'shinx')).toBe(false);
  });

  it('sanitize drops whatever is not the first form of a line with female art', () => {
    const clean = (females: unknown) => sanitize({ ...EMPTY_SAVE, females }).females;
    for (const bad of [undefined, null, 'shinx', 7, {}, true, [], ['nope'], [3, null], ['toString'], ['luxio'], ['luxray'], ['zorua'], ['mimikyu']]) {
      expect(clean(bad), JSON.stringify(bad)).toBeUndefined();
    }
    expect(clean(['shinx', 'shinx', 'zorua', 'nope', 3])).toEqual(['shinx']);
  });

  it('evolving keeps it: the line stays female, and a male line stays male', () => {
    const wealthy = { ...EMPTY_SAVE, coins: 100000, owned: ['shinx' as const], materials: { shinx: { normal: 99, hard: 99, nightmare: 99 } } };
    const store = memoryStore();
    writeSave(store, wealthy);
    setFemaleAt(store, 'shinx', true);
    const luxio = evolveAt(store, 'shinx');
    expect(luxio?.owned).toContain('luxio');
    expect(isFemale(loadSave(store), 'luxio')).toBe(true);
    const male = memoryStore();
    writeSave(male, wealthy);
    evolveAt(male, 'shinx');
    expect(isFemale(loadSave(male), 'luxio')).toBe(false);
  });
});

describe('gender is cosmetic', () => {
  it('for every playable species, a run with it on plays the same as with it off', () => {
    for (const species of PLAYABLE_SPECIES) {
      const play = (female: boolean) => {
        let { world } = startRun(7, { species, female });
        for (let tick = 0; tick < 120; tick++) world = step(world, input({ move: vec(Math.cos(tick / 15), Math.sin(tick / 20)), slots: [tick % 30 < 2, tick % 50 === 10], aim: vec(200, 200) }), FIXED_DT_MS);
        return world;
      };
      const on = play(true);
      const off = play(false);
      expect(on.player.female, species).toBe(true);
      const { female: _drop, ...plain } = on.player;
      expect({ ...on, player: plain }, species).toEqual(off);
    }
  });
});
