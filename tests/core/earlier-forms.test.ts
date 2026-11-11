import { describe, expect, it } from 'vitest';
import { rosterOf, selectableOf } from '../../src/core/collection';
import { canEvolve } from '../../src/core/evolution';
import { knownMoves, moveRank, rankUp, runRanks } from '../../src/core/tutor';
import { lineForms, lineRoot, PLAYER_EVOLUTIONS } from '../../src/data/player-evolutions';
import { PLAYABLE_SPECIES, SPECIES, STARTER_SPECIES } from '../../src/data/species';

/**
 * Owner decision 2026-11-11: after evolving, every earlier form of the line
 * can still be picked and played, and it shares the line's move progress
 * (ranks and bought moves are kept under the line's current form).
 */
describe('earlier forms stay selectable after evolving', () => {
  it('lineForms walks from the line root up to the form, in order', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const forms = lineForms(e.to);
      expect(forms[0], e.to).toBe(lineRoot(e.to));
      expect(forms.at(-1)).toBe(e.to);
      expect(forms.at(-2)).toBe(e.from);
    }
    for (const s of PLAYABLE_SPECIES) if (lineRoot(s) === s) expect(lineForms(s)).toEqual([s]);
  });

  it('owning an evolved form makes every earlier form of its line selectable, and the roster still keeps one form per line', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const save = { owned: [e.to] };
      const selectable = selectableOf(save);
      for (const form of lineForms(e.to)) expect(selectable, `${form} after ${e.to}`).toContain(form);
      expect(rosterOf(save).filter((id) => lineRoot(id) === lineRoot(e.to))).toEqual([e.to]);
    }
  });

  it('with nothing evolved, the selectable list is the roster', () => {
    expect(selectableOf({})).toEqual([...STARTER_SPECIES]);
  });

  it('an earlier form cannot be evolved again once its line has moved on', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const wallet = { coins: 1e9, owned: [e.to], materials: { [lineRoot(e.from)]: { normal: 99, hard: 99, nightmare: 99 } } };
      expect(canEvolve(wallet, e.from), `${e.from} with ${e.to} owned`).toBe(false);
    }
  });

  it('an earlier form plays with its line\'s ranks and bought moves, and ranking it up grows the line\'s', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const move = SPECIES[e.from].defaultLoadout[0]!;
      const taught = SPECIES[e.from].movepool.find((m) => !knownMoves({}, e.from).includes(m));
      const wallet = { coins: 1e9, owned: [e.to], ranks: { [e.to]: { [move]: 1 } }, learned: taught ? { [e.to]: [taught] } : {} };
      expect(moveRank(wallet, e.from, move), `${e.from} rank`).toBe(1);
      expect(runRanks(wallet, e.from)?.[move]).toBe(1);
      if (taught) expect(knownMoves(wallet, e.from), `${e.from} knows ${taught}`).toContain(taught);
      const up = rankUp(wallet, e.from, move);
      expect(up?.ranks?.[e.to]?.[move], `${e.from} rank up`).toBe(2);
      expect(up?.ranks?.[e.from]).toBeUndefined();
    }
  });

  it('an earlier form never gets the evolved form\'s own stage move', () => {
    for (const e of PLAYER_EVOLUTIONS) {
      const stageMoves = SPECIES[e.to].movepool.filter((m) => !SPECIES[e.from].movepool.includes(m));
      const wallet = { coins: 0, owned: [e.to], learned: { [e.to]: stageMoves } };
      for (const m of stageMoves) expect(knownMoves(wallet, e.from), `${e.from} ${m}`).not.toContain(m);
    }
  });

  it('a line that has not evolved keeps its own progress as before', () => {
    const species = STARTER_SPECIES[0]!;
    const move = SPECIES[species].defaultLoadout[0]!;
    expect(moveRank({ owned: [], ranks: { [species]: { [move]: 1 } } }, species, move)).toBe(1);
  });
});
