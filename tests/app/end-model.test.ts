import { describe, expect, it } from 'vitest';
import { coinLines } from '../../src/app/coin-lines';
import { endModel, END_KEYS, type EndInput } from '../../src/app/end-model';
import type { RunSummary } from '../../src/app/game';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { CHALLENGES, DUNGEONS, guardianOf, TUTORIAL } from '../../src/data/dungeons';
import { PLAYABLE_SPECIES } from '../../src/data/species';
import { catalog, LANGUAGES, type Language } from '../../src/i18n';

/** Every win/lose end screen (owner, 2026-11-04): each dungeon, challenge and the Sima, every outcome, solo and co-op. */
const ALL = [...DUNGEONS, ...CHALLENGES, TUTORIAL];
const trFor =
  (language: Language) =>
  (key: string): string => {
    const text = catalog(language)[key];
    if (text === undefined) throw new Error(`missing ${language} key ${key}`);
    return text;
  };
const coins = { floors: 10, enemies: 8, escapes: 0, guardian: 20, time: 4, subtotal: 42, share: 1, multiplier: 1, total: 42 };
const summary = (dungeon: string, over: Partial<RunSummary> = {}): RunSummary => ({ dungeon, floor: 3, seed: 123, level: 5, items: [], coins, difficulty: 'normal', ...over }) as RunSummary;
const entry = { floor: 9, clockMs: 61_000, mode: 'daily', date: '2026-11-04', seed: 5, species: 'mimikyu', level: 9 };
const score = { entry, rank: 2, board: [{ ...entry, floor: 12 }, entry] } as unknown as NonNullable<EndInput['score']>;
const other = PLAYABLE_SPECIES[1]!;
const input = (dungeonId: string, over: Partial<EndInput>): EndInput => ({
  result: 'victory',
  summary: summary(dungeonId),
  online: false,
  balance: 100,
  party: null,
  playerSpecies: PLAYABLE_SPECIES[0]!,
  townOpen: true,
  heldNames: [],
  ...over,
});

describe('end screen model', () => {
  it('every dungeon, outcome and play mode gets a heading, a sprite, the summary and coin cards and one primary action', () => {
    for (const language of LANGUAGES) {
      const tr = trFor(language);
      for (const d of ALL) {
        for (const result of ['victory', 'defeat', 'eclipse'] as const) {
          for (const online of [false, true]) {
            for (const cut of [undefined, 'hostLeft'] as const) {
              const at = `${language} ${d.id} ${result} ${online ? 'coop' : 'solo'} ${cut ?? ''}`;
              const view = endModel(input(d.id, { result, online, party: online ? ['A', 'B'] : null, summary: summary(d.id, cut ? { cutShort: cut } : {}) }), tr);
              expect(view.title, at).toBeTruthy();
              expect(view.species, at).toBeTruthy();
              expect(view.actions.length, at).toBeGreaterThanOrEqual(1);
              expect(view.actions.length, at).toBeLessThanOrEqual(2);
              expect(view.actions[0]!.id, at).toBe('back');
              expect(
                view.actions.some((a) => a.id === 'retry'),
                at,
              ).toBe(!online && !(d.id === TUTORIAL.id && result === 'victory'));
              const labels = view.cards.find((c) => c.id === 'summary')!.lines.map((l) => l.label);
              for (const key of ['difficulty.label', 'screen.floorReached', 'screen.level', 'screen.seed', 'screen.items']) expect(labels, `${at} ${key}`).toContain(tr(key));
              expect(labels.includes(tr('screen.party')), at).toBe(online);
              expect(
                view.cards.find((c) => c.id === 'coins')!.lines.map((l) => l.label),
                at,
              ).toEqual(coinLines(coins, 100, tr).map((l) => l.label));
              expect(view.outcome, at).toBe(cut ? 'cut' : result);
              if (cut) expect(view.notes.join(' '), at).toContain(tr(`net.cutShort.${cut}`));
            }
          }
        }
      }
    }
  });

  it('a win shows the guardian, a loss the player', () => {
    const tr = trFor('es');
    for (const d of ALL) {
      expect(endModel(input(d.id, { result: 'victory' }), tr).species, d.id).toBe(guardianOf(d) ?? 'aegislash');
      expect(endModel(input(d.id, { result: 'defeat', playerSpecies: other }), tr).species, d.id).toBe(other);
    }
  });

  it('the Sima adds its score card (mode, time, rank, board); a challenge adds the materials line', () => {
    const tr = trFor('es');
    const sima = ALL.find((d) => d.endless)!;
    const view = endModel(input(sima.id, { result: 'eclipse', score }), tr);
    const card = view.cards.find((c) => c.id === 'score')!;
    expect(card.lines.map((l) => l.label)).toEqual([tr('endless.score.mode'), tr('endless.score.time'), tr('endless.score.rank')]);
    expect(card.notes?.length).toBe(2);
    expect(view.cards.find((c) => c.id === 'coins')!.lines.some((l) => l.label === tr('endless.coins.rate'))).toBe(false);
    const challenge = CHALLENGES[0]!;
    const withMaterials = endModel(input(challenge.id, { materials: '+2 Esencias' }), tr);
    expect(withMaterials.cards.find((c) => c.id === 'coins')!.lines.at(-1)).toMatchObject({ label: tr('screen.materials'), value: '+2 Esencias' });
  });

  it('keeps the held items and every tier readable', () => {
    const tr = trFor('en');
    const view = endModel(input(DUNGEONS[0]!.id, { heldNames: ['Orb ×2', 'Band'] }), tr);
    expect(view.cards.find((c) => c.id === 'summary')!.lines.find((l) => l.label === tr('screen.items'))!.value).toBe('Orb ×2, Band');
    for (const difficulty of DIFFICULTIES) {
      expect(endModel(input(DUNGEONS[0]!.id, { summary: summary(DUNGEONS[0]!.id, { difficulty }) }), tr).cards[0]!.lines[0]!.value).toBe(tr(`difficulty.${difficulty}`));
    }
  });

  it('every key is in both languages', () => {
    for (const language of LANGUAGES) for (const key of END_KEYS) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
  });
});
