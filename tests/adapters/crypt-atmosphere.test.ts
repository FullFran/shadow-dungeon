import { beforeEach, describe, expect, it } from 'vitest';
import { CRYPT, FOREST } from '../../src/data/dungeons';
import { AEGISLASH, SABLEYE } from '../../src/data/enemies';
import { generateFloor } from '../../src/core/dungeon';
import { isWall } from '../../src/core/tiles';
import { cardLines } from '../../src/adapters/card';
import { cryptDecor } from '../../src/adapters/crypt-decor';
import { trackNote } from '../../src/adapters/intro-card';
import { catalog, LANGUAGES, setLanguage, t } from '../../src/i18n';

describe('Crypt atmosphere', () => {
  beforeEach(() => setLanguage('es'));

  it('has a short lore line for every Crypt floor in every language, and keeps its title card subtitle', () => {
    const keys = CRYPT.lore.floorKeys ?? [];
    expect(keys).toHaveLength(CRYPT.plan.length);
    for (const language of LANGUAGES) {
      const strings = catalog(language);
      for (const key of keys) {
        expect(strings[key], `${language} ${key}`).toBeTruthy();
        expect(strings[key]!.length).toBeLessThanOrEqual(64);
        expect(strings[key]).not.toMatch(/—|Necrozma/);
      }
    }
    expect(t(CRYPT.lore.subtitleKey)).toBe('Donde el acero aún espera órdenes');
    expect(trackNote(CRYPT.music.floor).startsWith('♪ ')).toBe(true);
  });

  it('puts the floor lore line on the floor card', () => {
    const card = { dungeon: 'Cripta', floor: 2, kind: 'normal' as const, escape: null, shownAtMs: 0, lore: 'Aquí descansan los que juraron.' };
    expect(cardLines(card).lore).toBe('Aquí descansan los que juraron.');
    expect(cardLines({ ...card, lore: undefined }).lore).toBeUndefined();
  });

  it('places candles on lit wall faces and grave slabs on room floor, deterministically, never on the stairs or the start', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const floor = generateFloor(seed, 2);
      const decor = cryptDecor(floor);
      expect(cryptDecor(floor)).toEqual(decor);
      expect(decor.candles.length).toBeGreaterThan(0);
      for (const c of decor.candles) {
        expect(isWall(floor, c.x, c.y)).toBe(true);
        expect(isWall(floor, c.x, c.y + 1)).toBe(false);
      }
      for (const s of decor.slabs) {
        expect(isWall(floor, s.x, s.y)).toBe(false);
        expect(floor.rooms.some((r) => s.x > r.x && s.x < r.x + r.width - 1 && s.y > r.y && s.y < r.y + r.height - 1)).toBe(true);
        expect(s.x === floor.stairs.x && s.y === floor.stairs.y).toBe(false);
        expect(s.x === floor.start.x && s.y === floor.start.y).toBe(false);
      }
    }
  });
});

describe('boss bar stance names', () => {
  it('names every stance and spell card of the Crypt bosses in every language', () => {
    const stances = ['shield', 'blade', 'unsheathe', ...AEGISLASH.phase2.cards, ...SABLEYE.cards];
    const spells = [...Object.values(AEGISLASH.cardNames), ...Object.values(SABLEYE.cardNames)];
    for (const language of LANGUAGES) {
      const strings = catalog(language);
      expect(stances.filter((s) => !strings[`boss.stance.${s}`])).toEqual([]);
      expect(spells.filter((k) => !strings[k])).toEqual([]);
      for (const k of spells) expect(strings[k]).not.toMatch(/—|Necrozma/);
    }
  });
});
