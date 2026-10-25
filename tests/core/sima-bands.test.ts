import { describe, expect, it } from 'vitest';
import { bandLoreKey, bandStartsAt, simaBandAt, simaBandIndex, simaPalette } from '../../src/core/sima';
import { CAVES, CRYPT, ECLIPSE, FOREST, SWAMP } from '../../src/data/dungeons';
import { ENDLESS } from '../../src/data/endless';
import { SIMA_BANDS } from '../../src/data/sima';
import { eclipseRadius } from '../../src/adapters/sima-backdrop';
import { catalog } from '../../src/i18n';

describe('Sima depth bands', () => {
  it('the Sima carries its bands: 1-10 Crypt, 11-20 Forest, 21-30 Caves, 31-40 Swamp, 41 and deeper the abyss', () => {
    expect(ENDLESS.bands).toBe(SIMA_BANDS);
    expect([1, 10, 11, 20, 21, 30, 31, 40, 41, 400].map((f) => simaBandAt(SIMA_BANDS, f).id)).toEqual(['crypt', 'crypt', 'forest', 'forest', 'caves', 'caves', 'swamp', 'swamp', 'abyss', 'abyss']);
    expect([1, 10, 11, 21, 31, 41, 99].map((f) => simaBandIndex(SIMA_BANDS, f))).toEqual([0, 0, 1, 2, 3, 4, 4]);
  });

  it('a band card only on the first floor of a new band (floor 1 has the dungeon title instead)', () => {
    const starts = Array.from({ length: 60 }, (_, i) => i + 1).filter((f) => bandStartsAt(SIMA_BANDS, f));
    expect(starts).toEqual([11, 21, 31, 41]);
  });

  it('borrows the Crypt, Forest, Caves and Swamp palettes and decoration, then its own abyss; only the abyss floats over the void', () => {
    expect(simaPalette(simaBandAt(SIMA_BANDS, 3))).toBe(CRYPT.palette);
    expect(simaPalette(simaBandAt(SIMA_BANDS, 15))).toBe(FOREST.palette);
    expect(simaPalette(simaBandAt(SIMA_BANDS, 25))).toBe(CAVES.palette);
    expect(simaPalette(simaBandAt(SIMA_BANDS, 35))).toBe(SWAMP.palette);
    const abyss = simaBandAt(SIMA_BANDS, 45);
    expect(simaPalette(abyss)).not.toBe(CRYPT.palette);
    expect(simaPalette(abyss)).not.toBe(ECLIPSE.palette);
    expect(SIMA_BANDS.map((b) => b.abyss === true)).toEqual([false, false, false, false, true]);
    expect([2, 15, 25, 35].map((f) => simaBandAt(SIMA_BANDS, f).decor)).toEqual(['crypt', 'forest', 'caves', 'swamp']);
  });

  it('every band has a name, a subtitle and lore lines that rotate floor by floor', () => {
    const es = catalog('es');
    for (const band of SIMA_BANDS) {
      expect(es[band.nameKey]).toBeTruthy();
      expect(es[band.subtitleKey]).toBeTruthy();
      expect(band.loreKeys.length).toBeGreaterThanOrEqual(3);
      for (const key of band.loreKeys) expect(es[key]).toBeTruthy();
    }
    const crypt = SIMA_BANDS[0]!;
    expect(bandLoreKey(SIMA_BANDS, 1)).toBe(crypt.loreKeys[0]);
    expect(bandLoreKey(SIMA_BANDS, 2)).toBe(crypt.loreKeys[1]);
    expect(bandLoreKey(SIMA_BANDS, 1 + crypt.loreKeys.length)).toBe(crypt.loreKeys[0]);
    expect(bandLoreKey(SIMA_BANDS, 11)).toBe(SIMA_BANDS[1]!.loreKeys[0]);
  });

  it('the eclipse on the backdrop grows with depth, up to a cap', () => {
    const sizes = [1, 5, 10, 20, 30, 60, 200].map(eclipseRadius);
    for (let i = 1; i < sizes.length; i++) expect(sizes[i]!).toBeGreaterThanOrEqual(sizes[i - 1]!);
    expect(sizes[2]!).toBeGreaterThan(sizes[0]!);
    expect(eclipseRadius(200)).toBe(eclipseRadius(1000));
  });
});
