import { describe, expect, it } from 'vitest';
import { achievementTile, formatDay, overallPercent, stepGrid } from '../../src/app/achievements';
import { ACHIEVEMENTS } from '../../src/data/achievements';
import { catalog, LANGUAGES } from '../../src/i18n';

describe('achievement tiles', () => {
  for (const language of LANGUAGES) {
    const tr = (key: string) => catalog(language)[key] ?? key;
    it(`"${language}" gives every achievement a tile with name, state, and a tier chip on clears`, () => {
      for (const def of ACHIEVEMENTS) {
        const locked = achievementTile(def, undefined, tr);
        const done = achievementTile(def, '2026-10-26', tr);
        expect(locked.done).toBe(false);
        expect(done.done).toBe(true);
        expect(done.name.length, def.id).toBeGreaterThan(0);
        expect(done.name.includes('{'), def.id).toBe(false);
        expect(done.name.includes('—'), def.id).toBe(false);
        expect(done.reward === null, def.id).toBe(def.reward === 0);
        if (def.reward > 0) expect(done.reward, def.id).toMatch(/\d/);
        if (def.rule.kind === 'clear') expect(done.chip?.tier, def.id).toBe(def.rule.tier);
      }
    });
    it(`"${language}" keeps a locked hidden achievement secret`, () => {
      const secret = ACHIEVEMENTS.find((d) => d.hidden)!;
      expect(achievementTile(secret, undefined, tr)).toMatchObject({ name: '???', done: false, hidden: true });
      expect(achievementTile(secret, '2026-10-26', tr).hidden).toBe(false);
    });
    it(`"${language}" names the new window texts`, () => {
      for (const key of ['ach.overall', 'ach.locked', 'ach.done', 'ach.back', 'ach.chip.floor']) expect(catalog(language)[key], key).toBeTruthy();
    });
  }

  it('clear tiles name the dungeon only, since the chip carries the difficulty', () => {
    const tr = (key: string) => catalog('es')[key] ?? key;
    const clear = ACHIEVEMENTS.find((d) => d.rule.kind === 'clear')!;
    expect(achievementTile(clear, undefined, tr).name).not.toMatch(/\(/);
  });

  it('flawless tiles name the guardian, so the unique part is not cut off by the tile width', () => {
    const tr = (key: string) => catalog('es')[key] ?? key;
    const names = ACHIEVEMENTS.filter((d) => d.rule.kind === 'flawless').map((d) => achievementTile(d, undefined, tr).name);
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(name.startsWith('Intacto'), name).toBe(false);
  });

  it('formats a unlock day in the language, and keeps an unparsable one', () => {
    expect(formatDay('2026-10-26', 'en')).toMatch(/Oct/);
    expect(formatDay('2026-10-26', 'es')).toMatch(/oct/);
    expect(formatDay('nonsense', 'es')).toBe('nonsense');
  });

  it('computes the overall percent, rounded down so 100 means complete', () => {
    expect(overallPercent(0, 114)).toBe(0);
    expect(overallPercent(57, 114)).toBe(50);
    expect(overallPercent(113, 114)).toBe(99);
    expect(overallPercent(114, 114)).toBe(100);
    expect(overallPercent(0, 0)).toBe(0);
  });
});

describe('stepGrid', () => {
  it('moves by one and by a row, staying inside the grid', () => {
    expect(stepGrid(0, 10, 4, 'right')).toBe(1);
    expect(stepGrid(1, 10, 4, 'down')).toBe(5);
    expect(stepGrid(5, 10, 4, 'up')).toBe(1);
    expect(stepGrid(9, 10, 4, 'right')).toBe(9);
    expect(stepGrid(1, 10, 4, 'up')).toBe(1);
  });
  it('a down from the last short row lands on the last tile; left from column 0 leaves the grid', () => {
    expect(stepGrid(6, 10, 4, 'down')).toBe(9);
    expect(stepGrid(8, 10, 4, 'down')).toBe(8);
    expect(stepGrid(4, 10, 4, 'left')).toBeNull();
    expect(stepGrid(0, 10, 4, 'left')).toBeNull();
    expect(stepGrid(5, 10, 4, 'left')).toBe(4);
  });
});
