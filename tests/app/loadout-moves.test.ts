import { describe, expect, it } from 'vitest';
import { abilityOf, defaultSlot, equipMove, rankPips, slotTiles } from '../../src/app/loadout-moves';
import { PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { MOVES } from '../../src/data/moves';
import { PLAYABLE_SPECIES, SPECIES, originalKit } from '../../src/data/species';
import { MAX_RANK } from '../../src/data/tutor';
import { catalog, LANGUAGES } from '../../src/i18n';

/** The moves step of the loadout, redesigned as slot tiles, a move grid and a sheet (owner, 2026-11-03: "mejora y adapta la vista de Prepara a"). */
describe('loadout moves model', () => {
  it("has one tile per slot with its equipped move and only that slot's known moves", () => {
    for (const id of PLAYABLE_SPECIES) {
      const known = originalKit(id);
      const loadout = SPECIES[id].defaultLoadout;
      const tiles = slotTiles(id, loadout, known);
      expect(tiles.map((t) => t.kind), id).toEqual([...PLAYER_SLOT_LAYOUT]);
      tiles.forEach((tile, i) => {
        expect(tile.slot).toBe(i);
        expect(tile.equipped).toBe(loadout[i] ?? null);
        for (const m of tile.choices) {
          expect(MOVES[m].slot).toBe(tile.kind);
          expect(known).toContain(m);
        }
      });
    }
  });

  it('offers zorua its two area moves and its boost', () => {
    const tiles = slotTiles('zorua', SPECIES.zorua.defaultLoadout, originalKit('zorua'));
    expect(tiles[3]!.choices).toEqual(['dark-pulse', 'snarl']);
    expect(tiles[2]!.choices).toEqual(['nasty-plot']);
  });

  it('equips into one slot only', () => {
    const before = ['feint-attack', 'night-daze', 'nasty-plot', 'dark-pulse'] as const;
    const after = equipMove(before, 3, 'snarl');
    expect(after).toEqual(['feint-attack', 'night-daze', 'nasty-plot', 'snarl']);
    expect(before[3]).toBe('dark-pulse');
  });

  it('shows rank as pips: owned ranks filled out of the maximum, clamped', () => {
    expect(rankPips(0)).toEqual({ on: 0, total: MAX_RANK });
    expect(rankPips(1)).toEqual({ on: 1, total: MAX_RANK });
    expect(rankPips(99)).toEqual({ on: MAX_RANK, total: MAX_RANK });
    expect(rankPips(-3).on).toBe(0);
  });

  it('opens on the first slot that has moves', () => {
    expect(defaultSlot(slotTiles('zorua', SPECIES.zorua.defaultLoadout, originalKit('zorua')))).toBe(0);
    expect(
      defaultSlot([
        { slot: 0, kind: 'fast', equipped: null, choices: [] },
        { slot: 1, kind: 'heavy', equipped: null, choices: ['feint-attack'] },
      ]),
    ).toBe(1);
    expect(defaultSlot([])).toBe(0);
  });

  it('names the passive, or says there is none; the run goal is never the ability', () => {
    expect(abilityOf('axew')).toEqual({ kind: 'none', key: 'loadout.noPassive' });
    expect(abilityOf('zorua')).toEqual({ kind: 'passive', nameKey: 'passive.illusion', descriptionKey: 'passive.illusion.description' });
    for (const id of PLAYABLE_SPECIES) expect(JSON.stringify(abilityOf(id)), id).not.toContain('goal');
  });

  it('has its copy in es and en', () => {
    for (const language of LANGUAGES) {
      for (const key of ['loadout.equipIn', 'loadout.slot.empty', 'loadout.objective', 'loadout.setup', 'loadout.slots', 'loadout.keys']) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
    }
  });
});
