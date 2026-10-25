import { describe, expect, it } from 'vitest';
import { INTRO, introAlpha, noteAlpha, trackNote } from '../../src/adapters/intro-card';
import { cardLines } from '../../src/adapters/card';
import { MUSIC_TRACKS } from '../../src/data/music';
import { setLanguage } from '../../src/i18n';

describe('dungeon entry title', () => {
  it('fades in, holds a few seconds, fades out and stays gone', () => {
    const intro = { shownAtMs: 1000 };
    expect(introAlpha(intro, 900)).toBe(0);
    expect(introAlpha(intro, 1000 + INTRO.fadeInMs / 2)).toBeCloseTo(0.5);
    expect(introAlpha(intro, 1000 + INTRO.fadeInMs + INTRO.holdMs)).toBe(1);
    expect(introAlpha(intro, 1000 + INTRO.fadeInMs + INTRO.holdMs + INTRO.fadeOutMs)).toBe(0);
    expect(introAlpha(intro, 60_000)).toBe(0);
    const total = INTRO.fadeInMs + INTRO.holdMs + INTRO.fadeOutMs;
    expect(total).toBeGreaterThanOrEqual(3000);
    expect(total).toBeLessThanOrEqual(6000);
  });

  it('shows the track note a little after the title and a little longer', () => {
    const note = { shownAtMs: 0 };
    expect(noteAlpha(note, INTRO.noteDelayMs - 1)).toBe(0);
    expect(noteAlpha(note, INTRO.noteDelayMs + INTRO.fadeInMs + INTRO.holdMs + 100)).toBe(1);
  });

  it('names the playing track from the music manifest', () => {
    expect(trackNote('crypt')).toBe(`♪ ${MUSIC_TRACKS.crypt.title}`);
  });

  it('puts the dungeon name on the floor card', () => {
    setLanguage('es');
    expect(cardLines({ dungeon: 'Cripta del Rey de las Espadas', floor: 2, kind: 'normal', escape: null, shownAtMs: 0 }).dungeon).toBe('Cripta del Rey de las Espadas');
    expect(cardLines({ floor: 2, kind: 'normal', escape: null, shownAtMs: 0 }).dungeon).toBe('Mazmorra Sombría');
  });
});
