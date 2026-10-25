import { describe, expect, it } from 'vitest';
import { composeHeraldIntro, HERALD_INTRO, heraldIntroMode, shakeAt, titleLines } from '../../src/ui/herald-intro';
import { dailySeed } from '../../src/core/endless';
import { heraldSeed } from '../../src/core/herald/floor';
import { generateBoss } from '../../src/core/herald/generate';
import { holdProgress, panelAt, skipAvailable, SKIP, totalMs } from '../../src/ui/cinematic';

const def = (seed: number) => generateBoss(seed, 32, 'normal');

describe('herald intro cutscene', () => {
  it('plays in full the first time a seed is met, a 2 s title card after, and only the name card in a shared run', () => {
    expect(heraldIntroMode({ seen: false, shared: false })).toBe('full');
    expect(heraldIntroMode({ seen: true, shared: false })).toBe('short');
    expect(heraldIntroMode({ seen: false, shared: true })).toBe('card');
    expect(heraldIntroMode({ seen: true, shared: true })).toBe('card');
  });

  it('is composed deterministically from the herald (the daily seed gives everyone the same one)', { timeout: 30_000 }, () => {
    const seed = heraldSeed(dailySeed('2026-10-25'), 22);
    const a = composeHeraldIntro(generateBoss(seed, 22, 'hard'), 'full', 'es');
    const b = composeHeraldIntro(generateBoss(seed, 22, 'hard'), 'full', 'es');
    expect(a).toEqual(b);
    const others = new Set(Array.from({ length: 12 }, (_, i) => JSON.stringify(composeHeraldIntro(def(i + 1), 'full', 'en').panels.map((p) => p.durationMs))));
    expect(others.size).toBeGreaterThan(4);
  });

  it('lasts 4-6 s in full (arrive, then the title card), 2 s short; its title card names it, its epithet and epigraph', { timeout: 30_000 }, () => {
    for (let s = 1; s <= 30; s++) {
      const d = def(s);
      const full = composeHeraldIntro(d, 'full', 'es');
      expect(full.totalMs).toBe(totalMs(full.panels));
      expect(full.totalMs).toBeGreaterThanOrEqual(HERALD_INTRO.minMs);
      expect(full.totalMs).toBeLessThanOrEqual(HERALD_INTRO.maxMs);
      expect(full.panels.map((p) => p.scene)).toEqual(['arrive', 'title']);
      expect(full.panels[1]!.lines).toEqual([d.name, `«${d.epithet.es}»`, d.epigraph.es]);
      expect(full.arrival).toBe(d.arrival);
      // The landing (and its shake and sting) happens inside the arrive panel.
      expect(full.impactMs).toBeGreaterThan(0);
      expect(full.impactMs).toBeLessThan(full.panels[0]!.durationMs);
      expect(full.music.score.events.some((e) => e.voice === 'timpani' && Math.abs(e.atS * 1000 - full.impactMs) < 1)).toBe(true);
      const short = composeHeraldIntro(d, 'short', 'en');
      expect(short.totalMs).toBe(HERALD_INTRO.shortMs);
      expect(short.panels.map((p) => p.scene)).toEqual(['title']);
      expect(short.panels[0]!.lines).toEqual(titleLines(d, 'en'));
      expect(short.panels[0]!.lines[1]).toBe(`“${d.epithet.en}”`);
    }
  });

  it('shakes only after the landing, dying out; it is skippable by holding Esc/Enter like every cinematic', () => {
    const intro = composeHeraldIntro(def(3), 'full', 'es');
    expect(shakeAt(intro, intro.impactMs - 10)).toEqual({ x: 0, y: 0 });
    const early = shakeAt(intro, intro.impactMs + 40);
    expect(Math.abs(early.x) + Math.abs(early.y)).toBeGreaterThan(0);
    expect(shakeAt(intro, intro.impactMs + intro.shake.ms + 1)).toEqual({ x: 0, y: 0 });
    // The shared skip rule: available after its first second, a held key skips.
    expect(skipAvailable(SKIP.availableAfterMs - 1)).toBe(false);
    expect(skipAvailable(SKIP.availableAfterMs)).toBe(true);
    expect(holdProgress(0, SKIP.holdMs)).toBe(1);
    expect(panelAt(intro.panels, intro.totalMs)).toBeNull();
    expect(panelAt(intro.panels, intro.panels[0]!.durationMs)?.panel.scene).toBe('title');
  });
});
