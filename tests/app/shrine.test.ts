import { describe, expect, it } from 'vitest';
import { bestText, heraldEntries, requestName, trialTime } from '../../src/app/shrine';
import { gauntletStops } from '../../src/core/shrine';
import { REFUGIO } from '../../src/data/world';
import { setLanguage } from '../../src/i18n';

describe('shrine window helpers', () => {
  it('formats a trial time as minutes, seconds and tenths, and "-" for none', () => {
    expect(trialTime(0)).toBe('0:00.0');
    expect(trialTime(83_456)).toBe('1:23.4');
    expect(trialTime(600_000)).toBe('10:00.0');
    expect(trialTime(null)).toBe('-');
    expect(trialTime(Number.NaN)).toBe('-');
    expect(trialTime(-5)).toBe('-');
  });

  it('lists the last heralds met first, at most a few', () => {
    const met = Array.from({ length: 12 }, (_, i) => ({ seed: i, name: `H${i}` }));
    expect(heraldEntries(met, 3).map((e) => e.seed)).toEqual([11, 10, 9]);
    expect(heraldEntries([])).toEqual([]);
  });

  it('names a request by its boss, gauntlet or herald', () => {
    setLanguage('es');
    expect(requestName({ kind: 'gauntlet', id: 'oaths', stops: gauntletStops('oaths'), difficulty: 'easy' })).toBe('Todos los juramentos');
    expect(requestName({ kind: 'herald', id: '5', stops: [], difficulty: 'easy' }, 'Vigía Umbrío')).toBe('Vigía Umbrío');
  });

  it('names the species of a best time next to it (older records show none)', () => {
    setLanguage('es');
    expect(bestText({ clears: 1, bestMs: 83_456, captures: 2, species: 'zorua' })).toBe('1:23.4 · ✦2 · Zorua');
    expect(bestText({ clears: 1, bestMs: 83_456, captures: 2 })).toBe('1:23.4 · ✦2');
    expect(bestText(null)).toBe('-');
  });

  it('puts the altar in the Refugio', () => {
    expect(REFUGIO.shrine).toBeDefined();
    expect(REFUGIO.props.some((p) => p.kind === 'statue')).toBe(true);
  });
});
