import { describe, expect, it } from 'vitest';
import type { AccountApi, ApiResult, RankingEntry, SimaRanking } from '../../src/adapters/account-api';
import type { Difficulty } from '../../src/data/difficulty';
import { DIFFICULTIES } from '../../src/data/difficulty';
import { catalog, LANGUAGES } from '../../src/i18n';
import { GLOBAL_RANKING_KEYS, GLOBAL_RANKING_RETRY_MS, GLOBAL_RANKING_TTL_MS, globalRankingLines, globalRankingSource } from '../../src/town/global-ranking';

const row = (rank: number, nickname: string, over: Partial<RankingEntry> = {}): RankingEntry => ({ rank, nickname, avatarSpecies: '', floor: 20 - rank, clockMs: 65_000, species: 'zorua', level: 9, mode: 'free', date: '2026-10-25', ...over });

const templates: Record<string, string> = {
  'endless.global.title': 'Global ({tier}):',
  'endless.global.entry': '{rank}. {name} F{floor} {time}',
  'endless.global.you': '{entry} (you)',
  'endless.global.loading': 'loading',
  'endless.global.unavailable': 'unavailable',
  'endless.global.empty': 'empty',
  'endless.global.guest': 'guest',
  'endless.global.noNickname': 'set a nickname',
};
const tr = (key: string) => templates[key] ?? `[${key}]`;

describe('global ranking lines', () => {
  it('shows the top rows two per page under a title naming the tier', () => {
    const rows = [row(1, 'Ana'), row(2, 'Bea'), row(3, 'Cris')];
    expect(globalRankingLines({ kind: 'ready', entries: rows }, tr, 'Hard', { me: null })).toEqual(['Global (Hard): 1. Ana F19 1:05 · 2. Bea F18 1:05', '3. Cris F17 1:05']);
  });

  it("marks the player's own nickname, and adds its row when it is below the top", () => {
    const rows = Array.from({ length: 9 }, (_, i) => row(i + 1, i === 7 ? 'Me' : `P${i + 1}`));
    const lines = globalRankingLines({ kind: 'ready', entries: rows }, tr, 'Easy', { me: 'Me', max: 4 });
    expect(lines).toEqual(['Global (Easy): 1. P1 F19 1:05 · 2. P2 F18 1:05', '3. P3 F17 1:05 · 4. P4 F16 1:05', '8. Me F12 1:05 (you)']);
    expect(globalRankingLines({ kind: 'ready', entries: [row(1, 'Me')] }, tr, 'Easy', { me: 'Me' })).toEqual(['Global (Easy): 1. Me F19 1:05 (you)']);
  });

  it('loading, unavailable, empty and guest are one clear line each', () => {
    expect(globalRankingLines({ kind: 'loading' }, tr, 'Easy', { me: null })).toEqual(['Global (Easy): loading']);
    expect(globalRankingLines({ kind: 'unavailable' }, tr, 'Easy', { me: null })).toEqual(['Global (Easy): unavailable']);
    expect(globalRankingLines({ kind: 'ready', entries: [] }, tr, 'Easy', { me: null })).toEqual(['Global (Easy): empty']);
    expect(globalRankingLines({ kind: 'guest' }, tr, 'Easy', { me: null })).toEqual(['Global (Easy): guest']);
  });

  it('a signed-in player without a nickname sees the board and how to appear on it', () => {
    expect(globalRankingLines({ kind: 'ready', entries: [row(1, 'Ana')] }, tr, 'Easy', { me: null, noNickname: true })).toEqual(['Global (Easy): 1. Ana F19 1:05', 'set a nickname']);
    expect(globalRankingLines({ kind: 'ready', entries: [] }, tr, 'Easy', { me: null, noNickname: true })).toEqual(['Global (Easy): empty', 'set a nickname']);
    expect(globalRankingLines({ kind: 'guest' }, tr, 'Easy', { me: null, noNickname: true })).toEqual(['Global (Easy): guest']);
  });

  it('every line has its text in every language', () => {
    for (const language of LANGUAGES) {
      for (const key of GLOBAL_RANKING_KEYS) expect(catalog(language)[key], `${language} ${key}`).toBeTruthy();
      expect(catalog(language)['endless.global.entry']).toContain('{name}');
      expect(catalog(language)['endless.global.you']).toContain('{entry}');
    }
  });
});

/** A ranking API answering from a script; each call waits until `release` is called. */
function scriptedApi(answer: (tier: Difficulty) => ApiResult<SimaRanking>) {
  const calls: Difficulty[] = [];
  const pending: (() => void)[] = [];
  const api: Pick<AccountApi, 'ranking'> = {
    ranking: (tier) => {
      calls.push(tier);
      return new Promise((resolve) => pending.push(() => resolve(answer(tier))));
    },
  };
  const release = async () => {
    for (const p of pending.splice(0)) p();
    for (let i = 0; i < 3; i++) await Promise.resolve();
  };
  return { api, calls, release };
}

describe('global ranking source', () => {
  it('a guest makes no request', () => {
    const { api, calls } = scriptedApi((tier) => ({ ok: true, value: { tier, entries: [] } }));
    const source = globalRankingSource({ api, signedIn: () => false, now: () => 0 });
    expect(source.state('easy')).toEqual({ kind: 'guest' });
    expect(calls).toEqual([]);
  });

  it('loads each tier once, then serves it from the cache until it is stale', async () => {
    let now = 0;
    const { api, calls, release } = scriptedApi((tier) => ({ ok: true, value: { tier, entries: [row(1, tier)] } }));
    const source = globalRankingSource({ api, signedIn: () => true, now: () => now });
    for (const tier of DIFFICULTIES) expect(source.state(tier)).toEqual({ kind: 'loading' });
    expect(source.state('easy')).toEqual({ kind: 'loading' });
    expect(calls).toEqual([...DIFFICULTIES]);
    await release();
    for (const tier of DIFFICULTIES) expect(source.state(tier)).toEqual({ kind: 'ready', entries: [row(1, tier)] });
    now = GLOBAL_RANKING_TTL_MS - 1;
    source.state('hard');
    expect(calls).toHaveLength(DIFFICULTIES.length);
    now = GLOBAL_RANKING_TTL_MS;
    // Stale: the old rows stay on show while the new ones load.
    expect(source.state('hard')).toEqual({ kind: 'ready', entries: [row(1, 'hard')] });
    expect(calls.at(-1)).toBe('hard');
  });

  it('a failure reads as unavailable and is retried later, never at once', async () => {
    let now = 0;
    let up = false;
    const { api, calls, release } = scriptedApi((tier) => (up ? { ok: true, value: { tier, entries: [] } } : { ok: false, error: { kind: 'offline' } }));
    const source = globalRankingSource({ api, signedIn: () => true, now: () => now });
    source.state('easy');
    await release();
    expect(source.state('easy')).toEqual({ kind: 'unavailable' });
    expect(calls).toHaveLength(1);
    up = true;
    now = GLOBAL_RANKING_RETRY_MS;
    source.state('easy');
    await release();
    expect(source.state('easy')).toEqual({ kind: 'ready', entries: [] });
  });

  it('a throwing API never escapes', async () => {
    const source = globalRankingSource({
      api: {
        ranking: () => {
          throw new Error('boom');
        },
      },
      signedIn: () => true,
      now: () => 0,
    });
    expect(source.state('easy')).toEqual({ kind: 'unavailable' });
    const rejecting = globalRankingSource({ api: { ranking: () => Promise.reject(new Error('boom')) }, signedIn: () => true, now: () => 0 });
    rejecting.state('easy');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(rejecting.state('easy')).toEqual({ kind: 'unavailable' });
  });
});
