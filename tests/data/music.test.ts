import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MUSIC } from '../../src/data/audio';
import { MUSIC_CONTEXTS, MUSIC_TRACKS, PLANNED_MUSIC } from '../../src/data/music';

const ROOT = join(__dirname, '..', '..');
const read = (path: string) => readFileSync(join(ROOT, path), 'utf8');

describe('licensed music manifest', () => {
  it('has one track per used context', () => {
    expect([...MUSIC_CONTEXTS].sort()).toEqual(['collapse', 'crypt', 'defeat', 'guardian', 'title', 'victory']);
    for (const context of MUSIC_CONTEXTS) expect(MUSIC_TRACKS[context].context).toBe(context);
  });

  for (const track of Object.values(MUSIC_TRACKS)) {
    describe(track.context, () => {
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

  it('records a planned pick for every later context', () => {
    expect(PLANNED_MUSIC.map((p) => p.context).sort()).toEqual(['caves', 'forest', 'hub', 'necrozma', 'prologue', 'swamp']);
  });
});
