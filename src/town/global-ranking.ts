import type { AccountApi, RankingEntry } from '../adapters/account-api';
import { clockText } from '../core/endless';
import type { Difficulty } from '../data/difficulty';

/**
 * The Sima del Eclipse global ranking on the town notice board (docs/gdd.md
 * §3 "La Sima del Eclipse", odd/tasks/sima-global-ranking.md): each
 * account's best score per tier, read from the server
 * (`GET /api/sd/ranking/sima`), shown under the device's own board.
 *
 * It never blocks or breaks the town: the board reads whatever is cached
 * now (loading, unavailable or the rows) and a fetch runs in the background
 * for the next read. A guest makes no request at all (accounts are optional
 * and a guest's game never calls the server), and guests never appear.
 */
export type GlobalRankingState = { kind: 'guest' } | { kind: 'loading' } | { kind: 'unavailable' } | { kind: 'ready'; entries: readonly RankingEntry[] };

/** How long a tier's rows are reused (the server caches them as long). */
export const GLOBAL_RANKING_TTL_MS = 60_000;
/** After a failure, how long before the next try. */
export const GLOBAL_RANKING_RETRY_MS = 15_000;
/** Rows on the board (two per page, like the device board). */
export const GLOBAL_RANKING_SHOWN = 6;

export const GLOBAL_RANKING_KEYS = [
  'endless.global.title',
  'endless.global.entry',
  'endless.global.you',
  'endless.global.loading',
  'endless.global.unavailable',
  'endless.global.empty',
  'endless.global.guest',
  'endless.global.noNickname',
] as const;

const PER_PAGE = 2;

/**
 * The board pages for one tier: the top `max` rows, the player's own
 * nickname marked (and its row added after the top when it is lower), or
 * one line for loading, unavailable, empty and guest (plus how to appear
 * for a signed-in player without a nickname).
 */
export function globalRankingLines(
  state: GlobalRankingState,
  tr: (key: string) => string,
  tierName: string,
  options: { me: string | null; noNickname?: boolean; max?: number },
): string[] {
  const { me, max = GLOBAL_RANKING_SHOWN } = options;
  const title = tr('endless.global.title').replace('{tier}', tierName);
  if (state.kind !== 'ready') return [`${title} ${tr(`endless.global.${state.kind}`)}`];
  // Signed in without a nickname: no public profile, so not on the board; say how to appear.
  const hint = options.noNickname ? [tr('endless.global.noNickname')] : [];
  if (state.entries.length === 0) return [`${title} ${tr('endless.global.empty')}`, ...hint];
  const line = (e: RankingEntry): string => {
    const text = tr('endless.global.entry')
      .replace('{rank}', String(e.rank))
      .replace('{name}', e.nickname)
      .replace('{floor}', String(e.floor))
      .replace('{time}', clockText(e.clockMs));
    return me !== null && e.nickname === me ? tr('endless.global.you').replace('{entry}', text) : text;
  };
  const top = state.entries.slice(0, max);
  const lines = top.map(line);
  const mine = me === null ? undefined : state.entries.slice(max).find((e) => e.nickname === me);
  const pages: string[] = [];
  for (let i = 0; i < lines.length; i += PER_PAGE) pages.push(lines.slice(i, i + PER_PAGE).join(' · '));
  if (mine) pages.push(line(mine));
  pages[0] = `${title} ${pages[0]}`;
  return [...pages, ...hint];
}

export interface GlobalRankingSource {
  /** The tier's state now; starts a background fetch when there is nothing fresh. Never throws. */
  state(tier: Difficulty): GlobalRankingState;
}

interface Slot {
  entries: readonly RankingEntry[] | null;
  /** When the last answer (rows or failure) arrived. */
  at: number;
  failed: boolean;
  loading: boolean;
}

export function globalRankingSource(deps: { api: Pick<AccountApi, 'ranking'>; signedIn(): boolean; now(): number }): GlobalRankingSource {
  const slots = new Map<Difficulty, Slot>();

  function fetchTier(tier: Difficulty, slot: Slot): void {
    slot.loading = true;
    const settle = (entries: readonly RankingEntry[] | null) => {
      slot.loading = false;
      slot.at = deps.now();
      slot.failed = entries === null;
      if (entries) slot.entries = entries;
    };
    try {
      deps.api.ranking(tier).then(
        (result) => settle(result.ok ? result.value.entries : null),
        () => settle(null),
      );
    } catch {
      settle(null);
    }
  }

  return {
    state(tier) {
      if (!deps.signedIn()) return { kind: 'guest' };
      let slot = slots.get(tier);
      if (!slot) {
        slot = { entries: null, at: 0, failed: false, loading: false };
        slots.set(tier, slot);
        fetchTier(tier, slot);
      } else if (!slot.loading) {
        const age = deps.now() - slot.at;
        if (age >= (slot.failed ? GLOBAL_RANKING_RETRY_MS : GLOBAL_RANKING_TTL_MS)) fetchTier(tier, slot);
      }
      // Rows already shown stay on show while newer ones load or after a later failure.
      if (slot.entries) return { kind: 'ready', entries: slot.entries };
      return slot.loading ? { kind: 'loading' } : { kind: 'unavailable' };
    },
  };
}
