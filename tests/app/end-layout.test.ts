import { describe, expect, it } from 'vitest';
import { endLayout, MAX_TILES, endIconOf } from '../../src/app/end-layout';
import { endModel, type EndInput, type EndView } from '../../src/app/end-model';
import { resultModel, shrineEndView, type ResultInput } from '../../src/app/shrine-result';
import type { RunSummary } from '../../src/app/game';
import { gauntletStops, SHRINE_BOSSES } from '../../src/core/shrine';
import { CHALLENGES, DUNGEONS, TUTORIAL } from '../../src/data/dungeons';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { catalog, LANGUAGES, type Language } from '../../src/i18n';
import { END_ICONS } from '../../src/ui/icons/end-icons';

/** The end screen as stat tiles, a rewards row and cards (owner, 2026-11-04: "más visual"): nothing the old table showed may be dropped. */
const trFor =
  (language: Language) =>
  (key: string): string => {
    const text = catalog(language)[key];
    if (text === undefined) throw new Error(`missing ${language} key ${key}`);
    return text;
  };
const coins = { floors: 10, enemies: 8, escapes: 3, guardian: 20, time: 4, subtotal: 45, share: 0.75, multiplier: 0.5, total: 42 };
const summary = (dungeon: string, over: Partial<RunSummary> = {}): RunSummary => ({ dungeon, floor: 3, seed: 123, level: 5, items: [], coins, difficulty: 'normal', ...over }) as RunSummary;
const entry = { floor: 9, clockMs: 61_000, mode: 'daily', date: '2026-11-04', seed: 5, species: 'mimikyu', level: 9 };
const score = { entry, rank: 2, board: [{ ...entry, floor: 12 }, entry] } as unknown as NonNullable<EndInput['score']>;
const ALL = [...DUNGEONS, ...CHALLENGES, TUTORIAL];
const total = (view: EndView): number => view.cards.reduce((n, c) => n + c.lines.length, 0);
const flat = (l: ReturnType<typeof endLayout>): number =>
  l.tiles.length + l.more.length + l.details.length + (l.reward ? l.reward.rows.length + (l.reward.hero ? 1 : 0) + (l.reward.balance ? 1 : 0) : 0) + l.cards.reduce((n, c) => n + c.lines.length, 0);

describe('end layout: every stat line becomes a tile, a reward or a card line', () => {
  it('every dungeon x outcome x solo/co-op keeps all lines, each with a registered pixel icon, and at most six visible tiles', () => {
    for (const language of LANGUAGES) {
      const tr = trFor(language);
      for (const d of ALL) {
        for (const result of ['victory', 'defeat', 'eclipse'] as const) {
          for (const online of [false, true]) {
            const input: EndInput = {
              result,
              summary: summary(d.id, d.endless ? { simaEvents: [{ floor: 3, kind: 'crystal', outcome: 'taken' }] as never } : {}),
              online,
              balance: 100,
              party: online ? ['A', 'B'] : null,
              playerSpecies: PLAYABLE_SPECIES[0]!,
              townOpen: true,
              heldNames: ['Orb ×2'],
              ...(d.endless ? { score } : {}),
              materials: '+2 Esencias',
            };
            const view = endModel(input, tr);
            const l = endLayout(view);
            const at = `${language} ${d.id} ${result} ${online}`;
            expect(flat(l), at).toBe(total(view));
            expect(l.tiles.length, at).toBeLessThanOrEqual(MAX_TILES);
            expect(l.tiles.length, at).toBeGreaterThan(0);
            expect(l.reward, at).not.toBeNull();
            expect(l.reward!.hero?.amount, at).toBe(42);
            expect(l.reward!.balance?.amount, at).toBe(100);
            const lines = [...l.tiles, ...l.more, ...l.details, ...(l.reward ? [...l.reward.rows, l.reward.hero, l.reward.balance] : []), ...l.cards.flatMap((c) => c.lines)].filter((x) => x !== null);
            for (const line of lines) {
              expect(line!.icon, `${at} ${line!.label}`).toBeTruthy();
              expect(END_ICONS[line!.icon!], `${at} ${line!.label} icon ${line!.icon}`).toBeDefined();
              expect(endIconOf(line!.icon!), at).toBe(END_ICONS[line!.icon!]);
            }
            // the old summary table: difficulty, floor, level, seed, items (and the party in co-op) all survive
            const labels = [...l.tiles, ...l.more, ...l.details].map((x) => x.label);
            for (const key of ['difficulty.label', 'screen.floorReached', 'screen.level', 'screen.seed', 'screen.items']) expect(labels, `${at} ${key}`).toContain(tr(key));
            expect(labels.includes(tr('screen.party')), at).toBe(online);
            expect(l.details.map((x) => x.label), at).toContain(tr('screen.items'));
            if (d.endless) expect(l.cards.map((c) => c.id), at).toEqual(['score', 'events']);
            else expect(l.cards, at).toHaveLength(0);
            expect(l.seal, at).toBeNull();
          }
        }
      }
    }
  });
});

describe('shrine result as tiles, delta and seal', () => {
  const trial = (stops: ResultInput['request']['stops'], ms: number, over = {}) => ({ stops, beaten: stops.length, ms, captures: 2, noHit: true, ...over });
  const requests: ResultInput['request'][] = [
    ...SHRINE_BOSSES.map((s) => ({ kind: 'boss' as const, id: s.boss, stops: [s], difficulty: 'normal' as const })),
    { kind: 'gauntlet', id: 'guardians', stops: gauntletStops('guardians'), difficulty: 'hard' },
  ];
  const input = (request: ResultInput['request'], over: Partial<ResultInput>): ResultInput => ({ request, victory: true, trial: trial(request.stops, 80_000), before: null, coins: 0, balance: 10, canRetry: true, ...over });
  const tr = (key: string): string => catalog('es')[key] ?? key;
  const time = (ms: number): string => `${ms}ms`;
  const timeTile = (view: EndView) => endLayout(view).tiles.find((t) => t.label === tr('shrine.time'))!;

  it('keeps time, previous, difficulty, captures (and beaten, no-hit) as tiles; a paid clear fills the reward', () => {
    for (const request of requests) {
      const view = shrineEndView(input(request, { before: { bestMs: 100_000 }, coins: 30, balance: 80 }), 'N', tr, time);
      const l = endLayout(view);
      const labels = l.tiles.map((t) => t.label);
      for (const key of ['shrine.time', 'shrine.result.previous', 'difficulty.label', 'shrine.captures', 'shrine.noHit']) expect(labels, `${request.id} ${key}`).toContain(tr(key));
      expect(l.tiles.length).toBeLessThanOrEqual(MAX_TILES);
      expect(l.reward!.hero!.amount).toBe(30);
      expect(l.reward!.balance!.amount).toBe(80);
      expect(flat(l)).toBe(total(view));
    }
    expect(endLayout(shrineEndView(input(requests[0]!, {}), 'N', tr, time)).reward).toBeNull();
  });

  it('a slower win carries a red "+16.7 s" delta, a faster one a green minus delta, a defeat or a first clear none', () => {
    const r = requests[0]!;
    const slowInput = input(r, { trial: trial(r.stops, 66_600), before: { bestMs: 49_900 } });
    expect(resultModel(slowInput).deltaMs).toBe(16_700);
    expect(timeTile(shrineEndView(slowInput, 'N', tr, time)).delta).toMatchObject({ tone: 'slower', text: '+16.7 s' });
    expect(timeTile(shrineEndView(input(r, { trial: trial(r.stops, 40_000), before: { bestMs: 56_700 } }), 'N', tr, time)).delta).toMatchObject({ tone: 'faster', text: '−16.7 s' });
    for (const over of [{ victory: false, before: { bestMs: 1000 } }, { before: null }]) expect(timeTile(shrineEndView(input(r, over), 'N', tr, time)).delta, JSON.stringify(over)).toBeUndefined();
    expect(timeTile(shrineEndView(input(r, { trial: trial(r.stops, 50_000), before: { bestMs: 50_000 } }), 'N', tr, time)).delta).toMatchObject({ tone: 'even' });
  });

  it('only a new best stamps the seal, with its own words (first record or new best)', () => {
    const r = requests[0]!;
    expect(endLayout(shrineEndView(input(r, { before: null }), 'N', tr, time)).seal).toBe(tr('shrine.result.first'));
    expect(endLayout(shrineEndView(input(r, { before: { bestMs: 99_000 } }), 'N', tr, time)).seal).toBe(tr('shrine.newBest'));
    expect(endLayout(shrineEndView(input(r, { before: { bestMs: 10_000 } }), 'N', tr, time)).seal).toBeNull();
    expect(endLayout(shrineEndView(input(r, { victory: false, before: null }), 'N', tr, time)).seal).toBeNull();
  });
});
