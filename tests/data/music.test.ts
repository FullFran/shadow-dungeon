import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MUSIC } from '../../src/data/audio';
import { MUSIC_CONTEXTS, MUSIC_TRACKS, PLANNED_MUSIC, RESERVED_MUSIC } from '../../src/data/music';

const ROOT = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('licensed music manifest', () => {
  it('has one track per used context', () => {
    expect([...MUSIC_CONTEXTS].sort()).toEqual(['collapse', 'crypt', 'defeat', 'forest', 'forest-fog', 'forest-guardian', 'guardian', 'title', 'victory']);
    for (const context of MUSIC_CONTEXTS) expect(MUSIC_TRACKS[context].context).toBe(context);
  });

  // Variants (the fog version of the forest track) reuse their track's file.
  const shipped = [...Object.values(MUSIC_TRACKS).filter((t) => !t.variantOf), ...RESERVED_MUSIC];

  for (const track of shipped) {
    describe(track.file, () => {
      it('ships both formats, non-empty and under 3 MB each', () => {
        for (const ext of ['ogg', 'mp3']) {
          const size = statSync(join(ROOT, 'public', 'music', `${track.file}.${ext}`)).size;
          expect(size, ext).toBeGreaterThan(10_000);
          expect(size, ext).toBeLessThan(3_000_000);
        }
      });

      it('has loop points inside the file', () => {
        expect(track.loopStart).toBeGreaterThanOrEqual(0);
        expect(track.loopEnd).toBeGreaterThan(track.loopStart);
        expect(track.loopEnd).toBeLessThanOrEqual(track.duration + 1e-6);
        if (track.loop) expect(track.loopEnd - track.loopStart, 'loop length').toBeGreaterThan(10);
      });

      it('has a license, a source page, a credit and change notes', () => {
        expect(['CC0 1.0', 'CC BY 3.0', 'CC BY 4.0']).toContain(track.license);
        expect(track.licenseUrl).toMatch(/^https:\/\/creativecommons\.org\//);
        expect(track.sourceUrl).toMatch(/^https:\/\//);
        expect(track.attribution).toContain(track.artist);
        expect(track.changes.length).toBeGreaterThan(20);
        if (track.fallback) expect(MUSIC[track.fallback]).toBeDefined();
        expect(`${track.title} ${track.changes}`).not.toMatch(/pok[eé]mon|mystery dungeon|remix|cover/i);
      });

      it('is credited in CREDITS.md and listed in public/music/LICENSES.md', () => {
        expect(read('CREDITS.md')).toContain(track.sourceUrl);
        expect(read('CREDITS.md')).toContain(track.artist);
        const licenses = read('public/music/LICENSES.md');
        expect(licenses).toContain(`${track.file}.ogg`);
        expect(licenses).toContain(`${track.file}.mp3`);
        expect(licenses).toContain(track.sourceUrl);
      });
    });
  }

  it('stingers play once and loops loop', () => {
    expect(MUSIC_TRACKS.victory.loop).toBe(false);
    expect(MUSIC_TRACKS.defeat.loop).toBe(false);
    for (const context of ['title', 'crypt', 'collapse', 'guardian'] as const) expect(MUSIC_TRACKS[context].loop).toBe(true);
  });

  it('keeps stingers short and floor loops long enough not to wear out', () => {
    for (const context of ['victory', 'defeat'] as const) {
      expect(MUSIC_TRACKS[context].duration, context).toBeGreaterThanOrEqual(3);
      expect(MUSIC_TRACKS[context].duration, context).toBeLessThanOrEqual(10);
    }
    for (const context of ['crypt', 'collapse', 'forest'] as const) {
      const length = MUSIC_TRACKS[context].loopEnd - MUSIC_TRACKS[context].loopStart;
      expect(length, context).toBeGreaterThanOrEqual(60);
      expect(length, context).toBeLessThanOrEqual(180);
    }
  });

  it('plays Boss Battle #2 for Decidueye (no longer reserved), keeps Aegislash on its own track, one file per track', () => {
    expect(RESERVED_MUSIC).toEqual([]);
    expect(MUSIC_TRACKS['forest-guardian'].file).toBe('boss-battle-2');
    expect(MUSIC_TRACKS.guardian.file).not.toBe('boss-battle-2');
    const files = new Set(shipped.map((t) => t.file));
    expect(files.size, 'one file per track').toBe(shipped.length);
  });

  it('muffles the forest track on fog floors instead of shipping another file', () => {
    const fog = MUSIC_TRACKS['forest-fog'];
    expect(fog.variantOf).toBe('forest');
    expect(fog.file).toBe(MUSIC_TRACKS.forest.file);
    expect([fog.loopStart, fog.loopEnd]).toEqual([MUSIC_TRACKS.forest.loopStart, MUSIC_TRACKS.forest.loopEnd]);
    expect(fog.lowpassHz).toBeGreaterThan(200);
    expect(fog.lowpassHz).toBeLessThan(2000);
  });

  it('ships no file that the manifest does not list', () => {
    const listed = new Set(shipped.flatMap((t) => [`${t.file}.ogg`, `${t.file}.mp3`]));
    const present = readdirSync(join(ROOT, 'public', 'music')).filter((f) => /\.(ogg|mp3)$/.test(f));
    expect(present.sort()).toEqual([...listed].sort());
  });

  it('records a planned pick for every later context', () => {
    expect(PLANNED_MUSIC.map((p) => p.context).sort()).toEqual(['caves', 'hub', 'necrozma', 'prologue', 'swamp']);
  });
});
