import { describe, expect, it } from 'vitest';
import { resultModel, shrineEndView, SHRINE_RESULT_KEYS, type ResultInput } from '../../src/app/shrine-result';
import { gauntletStops, heraldStop, SHRINE_BOSSES } from '../../src/core/shrine';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { GAUNTLETS } from '../../src/data/shrine';
import { SPECIES } from '../../src/data/species';
import { catalog, LANGUAGES } from '../../src/i18n';

/** The shrine's result screen as data (owner, 2026-11-04): every boss, gauntlet and herald, win and loss, with and without a previous best. */
const trial = (stops: ResultInput['request']['stops'], ms: number) => ({ stops, beaten: stops.length, ms, captures: 2, noHit: false });
const requests: ResultInput['request'][] = [
  ...SHRINE_BOSSES.map((s) => ({ kind: 'boss' as const, id: s.boss, stops: [s], difficulty: 'normal' as const })),
  ...GAUNTLETS.flatMap((g) => DIFFICULTIES.map((difficulty) => ({ kind: 'gauntlet' as const, id: g.id, stops: gauntletStops(g.id), difficulty }))),
  { kind: 'herald', id: '7', stops: [heraldStop(7)], difficulty: 'hard' },
];
const input = (request: ResultInput['request'], over: Partial<ResultInput>): ResultInput => ({ request, victory: true, trial: trial(request.stops, 80_000), before: null, coins: 0, balance: 10, canRetry: true, ...over });

describe('shrine result model', () => {
  it('a first clear is a new best with no previous time', () => {
    for (const request of requests) {
      const m = resultModel(input(request, {}));
      expect(m.outcome, request.id).toBe('victory');
      expect(m.newBest, request.id).toBe(true);
      expect(m.previousMs, request.id).toBeNull();
      expect(m.difficulty).toBe(request.difficulty);
    }
  });

  it('a faster win beats the previous best and says by how much; a slower one keeps it', () => {
    for (const request of requests) {
      const faster = resultModel(input(request, { before: { bestMs: 100_000 } }));
      expect([faster.newBest, faster.previousMs, faster.gainMs], request.id).toEqual([true, 100_000, 20_000]);
      const slower = resultModel(input(request, { before: { bestMs: 60_000 } }));
      expect([slower.newBest, slower.previousMs, slower.gainMs], request.id).toEqual([false, 60_000, null]);
      const tie = resultModel(input(request, { before: { bestMs: 80_000 } }));
      expect(tie.newBest, request.id).toBe(false);
    }
  });

  it('a defeat is never a new best, whatever came before, and still shows the previous time', () => {
    for (const request of requests) {
      for (const before of [null, { bestMs: 200_000 }]) {
        const m = resultModel(input(request, { victory: false, before, trial: { ...trial(request.stops, 30_000), beaten: 0 } }));
        expect(m.outcome, request.id).toBe('defeat');
        expect(m.newBest, request.id).toBe(false);
        expect(m.gainMs, request.id).toBeNull();
        expect(m.previousMs, request.id).toBe(before ? 200_000 : null);
      }
    }
  });

  it('shows a real boss sprite: the boss, the herald, or the last stop of a gauntlet', () => {
    for (const request of requests) {
      const m = resultModel(input(request, {}));
      expect(m.species, request.id).toBe(request.stops[request.stops.length - 1]!.boss);
      expect(SPECIES[m.species], request.id).toBeDefined();
    }
  });

  it('keeps the coin line for a paid clear only, and the retry only when the flow offers it', () => {
    const request = requests.find((r) => r.kind === 'gauntlet')!;
    expect(resultModel(input(request, { coins: 0 })).reward).toBeNull();
    expect(resultModel(input(request, { coins: 40, balance: 90 })).reward).toEqual({ coins: 40, balance: 90 });
    expect(resultModel(input(request, {})).actions).toEqual(['back', 'retry']);
    expect(resultModel(input(request, { canRetry: false })).actions).toEqual(['back']);
    expect(resultModel(input(request, { victory: false })).actions.length).toBeLessThanOrEqual(2);
  });

  it('tracks bosses beaten only for multi-stop trials and carries the no-hit mark on a win', () => {
    const gauntlet = requests.find((r) => r.kind === 'gauntlet')!;
    expect(resultModel(input(gauntlet, {})).progress).toEqual({ beaten: gauntlet.stops.length, total: gauntlet.stops.length });
    expect(resultModel(input(requests[0]!, {})).progress).toBeNull();
    expect(resultModel(input(gauntlet, { trial: { ...trial(gauntlet.stops, 1), noHit: true } })).noHit).toBe(true);
    expect(resultModel(input(gauntlet, { victory: false, trial: { ...trial(gauntlet.stops, 1), noHit: true } })).noHit).toBe(false);
  });

  it('the end view keeps every stat line (time, captures, difficulty), marks a new best, shows the previous one and pays in coins', () => {
    const tr = (key: string): string => catalog('en')[key] ?? key;
    const time = (ms: number): string => `${ms}ms`;
    for (const request of requests) {
      for (const victory of [true, false]) {
        for (const canRetry of [true, false]) {
          const win = shrineEndView(input(request, { victory, canRetry, before: { bestMs: 100_000 }, coins: 30, balance: 80 }), 'Name', tr, time);
          const at = `${request.id} ${victory} ${canRetry}`;
          const record = win.cards.find((c) => c.id === 'record')!;
          const labels = record.lines.map((l) => l.label);
          for (const key of ['shrine.time', 'difficulty.label', 'shrine.captures']) expect(labels, `${at} ${key}`).toContain(tr(key));
          expect(win.cards.find((c) => c.id === 'reward')!.lines.map((l) => l.value), at).toContain('30 P');
          expect(win.actions.map((a) => a.id), at).toEqual(canRetry ? ['back', 'retry'] : ['back']);
          expect(win.outcome, at).toBe(victory ? 'victory' : 'defeat');
          expect(win.title, at).toBe(tr(victory ? 'shrine.won' : 'shrine.lost'));
          expect(win.subtitle, at).toContain('Name');
          expect(record.lines.some((l) => l.tone === 'best'), at).toBe(victory);
          expect(record.lines.some((l) => l.label === tr('shrine.result.previous')), at).toBe(true);
        }
      }
    }
    const first = shrineEndView(input(requests[0]!, {}), 'Name', tr, time);
    expect(first.cards.find((c) => c.id === 'reward')).toBeUndefined();
    expect(first.cards.find((c) => c.id === 'record')!.lines.find((l) => l.tone === 'best')!.badge).toBe(tr('shrine.result.first'));
  });

  it('every key is in both languages', () => {
    for (const language of LANGUAGES) for (const key of SHRINE_RESULT_KEYS) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
  });
});
