import { gauntletStops, heraldStop, SHRINE_BOSSES, type BossStop } from '../core/shrine';
import type { Difficulty } from '../data/difficulty';
import { GAUNTLETS, type GauntletId } from '../data/shrine';
import type { SpeciesId } from '../data/species';
import type { BestiaryEntry } from '../town/bestiary';
import { gauntletReward, gauntletUnlocked, trialBest, type ShrineRecords, type TrialBest } from '../town/shrine-records';
import type { PixelIconId } from '../ui/pixel-icons';

/**
 * The hall of oaths as data for its view (owner, 2026-11-04: "rediseña el santuario"), pure:
 * the trial kinds as tabs (progress and best time on the tier) and every guardian, gauntlet
 * and herald as a card with its state. A boss not yet beaten is a sealed slab: no name, its sprite as a black silhouette.
 */
export type HallTab = 'reflections' | 'gauntlets' | 'heralds';
export type OathState = 'sworn' | 'beaten' | 'open' | 'locked';

export interface HallInput {
  shrine: ShrineRecords;
  beaten: ReadonlySet<string>;
  heralds: readonly BestiaryEntry[];
  tier: Difficulty;
}

export interface OathCard {
  /** A boss species, a gauntlet id or a herald's seed as text. */
  id: string;
  kind: 'boss' | 'gauntlet' | 'herald';
  state: OathState;
  /** Sworn: a record on this tier. Beaten: a boss that fell, no record on the tier. Open: a gauntlet or herald you may fight, never won on the tier. Locked: sealed. */
  icon: PixelIconId;
  /** The boss shown (null for a gauntlet or a herald); a sealed boss keeps it for its silhouette. */
  species: SpeciesId | null;
  /** Draw `species` as a black silhouette, unnamed (a boss not beaten yet; owner 2026-11-08). */
  silhouette: boolean;
  stops: readonly BossStop[];
  best: TrialBest | null;
  group: TrialBest | null;
  /** Pokémonedas of a gauntlet's first clear on the tier (null: pays none). */
  reward: number | null;
  rewardTaken: boolean;
  /** Bosses still to beat (gauntlets), else 0. */
  missing: number;
}

const MAX_HERALDS = 8;

/** The last heralds met first. */
export const metHeralds = (heralds: readonly BestiaryEntry[], max = MAX_HERALDS): BestiaryEntry[] => [...heralds].reverse().slice(0, max);

/** «Vencido» is only for a boss that really fell; an unlocked gauntlet without a record is just «Abierto». */
const stateOf = (unlocked: boolean, best: TrialBest | null, kind: 'boss' | 'gauntlet'): OathState => (!unlocked ? 'locked' : best ? 'sworn' : kind === 'boss' ? 'beaten' : 'open');

export function hallCards(tab: HallTab, input: HallInput): OathCard[] {
  const { shrine, beaten, tier } = input;
  if (tab === 'reflections') {
    return SHRINE_BOSSES.map((stop): OathCard => {
      const best = trialBest(shrine, 'boss', stop.boss, tier);
      const state = stateOf(beaten.has(stop.boss), best, 'boss');
      return {
        id: stop.boss,
        kind: 'boss',
        state,
        icon: state === 'locked' ? 'seal' : 'reflexes',
        species: stop.boss,
        silhouette: state === 'locked',
        stops: [stop],
        best,
        group: trialBest(shrine, 'boss', stop.boss, tier, true),
        reward: null,
        rewardTaken: false,
        missing: 0,
      };
    });
  }
  if (tab === 'gauntlets') {
    return GAUNTLETS.map((g): OathCard => {
      const best = trialBest(shrine, 'gauntlet', g.id, tier);
      const state = stateOf(gauntletUnlocked(g.id, beaten), best, 'gauntlet');
      return {
        id: g.id,
        kind: 'gauntlet',
        state,
        icon: state === 'locked' ? 'seal' : 'challenges',
        species: null,
        silhouette: false,
        stops: gauntletStops(g.id),
        best,
        group: trialBest(shrine, 'gauntlet', g.id, tier, true),
        reward: gauntletReward(g.id as GauntletId, tier),
        rewardTaken: best !== null,
        missing: g.bosses.filter((b) => !beaten.has(b)).length,
      };
    });
  }
  return metHeralds(input.heralds).map(
    (e): OathCard => ({ id: String(e.seed), kind: 'herald', state: 'open', icon: 'mirror', species: null, silhouette: false, stops: [heraldStop(e.seed)], best: null, group: null, reward: null, rewardTaken: false, missing: 0 }),
  );
}

export interface HallTabInfo {
  id: HallTab;
  icon: PixelIconId;
  /** Oaths open to fight, of `total`. */
  open: number;
  total: number;
  /** Oaths with a record on the tier. */
  sworn: number;
  /** The fastest best time of the tab on the tier. */
  bestMs: number | null;
}

export function hallTabs(input: HallInput): HallTabInfo[] {
  const tabs: HallTab[] = input.heralds.length > 0 ? ['reflections', 'gauntlets', 'heralds'] : ['reflections', 'gauntlets'];
  return tabs.map((id): HallTabInfo => {
    const cards = hallCards(id, input);
    const times = cards.flatMap((c) => (c.best ? [c.best.bestMs] : []));
    return {
      id,
      icon: id === 'reflections' ? 'reflexes' : id === 'gauntlets' ? 'challenges' : 'mirror',
      open: cards.filter((c) => c.state !== 'locked').length,
      total: cards.length,
      sworn: cards.filter((c) => c.state === 'sworn').length,
      bestMs: times.length > 0 ? Math.min(...times) : null,
    };
  });
}

/** The keys the hall view reads besides the boss and gauntlet names (a test checks both languages). */
export const SHRINE_HALL_KEYS = [
  'shrine.title',
  'shrine.subtitle',
  'shrine.swear',
  'shrine.state.sworn',
  'shrine.state.beaten',
  'shrine.state.open',
  'shrine.state.locked',
  'shrine.sealed.boss',
  'shrine.sealed.name',
  'shrine.rules',
  'shrine.record',
  'shrine.noRecord',
  'shrine.reward.none',
  'shrine.tab.open',
  'shrine.tab.best',
  'shrine.gauntlet.order',
  'shrine.reflections',
  'shrine.gauntlets',
  'shrine.heralds',
  'shrine.reflections.text',
  'shrine.gauntlets.text',
  'shrine.heralds.text',
  'shrine.locked',
  'shrine.carry',
  'shrine.best',
  'shrine.clears',
  'shrine.noHit',
  'shrine.group',
  'shrine.reward',
  'shrine.reward.taken',
  'difficulty.label',
  'menu.back',
  'hub.hint',
] as const;
