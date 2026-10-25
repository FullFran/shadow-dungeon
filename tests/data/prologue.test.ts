import { describe, expect, it } from 'vitest';
import { ECLIPSE_REVEAL_MS, eclipseRevealAtMs, PROLOGUE } from '../../src/data/prologue';
import { catalog, LANGUAGES } from '../../src/i18n';
import { revealedChars, totalMs } from '../../src/ui/cinematic';

/** Seconds of reading left after the last character before the panel starts to fade. */
const READING_MS = 1000;

describe('the prologue', () => {
  it('lasts between 60 and 75 seconds over 6 to 8 panels', () => {
    expect(totalMs(PROLOGUE)).toBeGreaterThanOrEqual(60_000);
    expect(totalMs(PROLOGUE)).toBeLessThanOrEqual(75_000);
    expect(PROLOGUE.length).toBeGreaterThanOrEqual(6);
    expect(PROLOGUE.length).toBeLessThanOrEqual(8);
  });

  it('opens on the age of light, reveals the eclipse in the middle and ends on the voice in the dark', () => {
    const scenes = PROLOGUE.map((p) => p.scene);
    expect(scenes[0]).toBe('light');
    expect(scenes.at(-1)).toBe('voice');
    expect(scenes).toContain('eclipse');
    expect(scenes).toContain('king');
    const reveal = eclipseRevealAtMs();
    expect(reveal).toBeGreaterThan(totalMs(PROLOGUE) * 0.25);
    expect(reveal).toBeLessThan(totalMs(PROLOGUE) * 0.6);
    expect(ECLIPSE_REVEAL_MS).toBeGreaterThan(0);
  });

  it('keeps every panel id unique and every fade shorter than its panel', () => {
    expect(new Set(PROLOGUE.map((p) => p.id)).size).toBe(PROLOGUE.length);
    for (const p of PROLOGUE) expect(p.fadeInMs + p.fadeOutMs).toBeLessThan(p.durationMs);
  });

  for (const language of LANGUAGES) {
    it(`has every narration line in "${language}" and leaves time to read it before the fade`, () => {
      const strings = catalog(language);
      for (const p of PROLOGUE) {
        const lengths = p.lines.map((key) => {
          expect(strings[key], key).toBeTruthy();
          return [...strings[key]!].length;
        });
        const readBy = p.durationMs - p.fadeOutMs - READING_MS;
        expect(revealedChars(p, readBy, lengths), p.id).toEqual(lengths);
      }
    });
  }

  it('never names the final boss', () => {
    for (const language of LANGUAGES) {
      const strings = catalog(language);
      for (const key of PROLOGUE.flatMap((p) => p.lines)) expect(strings[key]!.toLowerCase()).not.toContain('necrozma');
    }
  });
});
