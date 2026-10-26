import type { Difficulty } from '../data/difficulty';
import type { MoveId } from '../data/moves';
import { bossStop, gauntletStops, heraldStop } from '../core/shrine';
import { GAUNTLETS, type GauntletId } from '../data/shrine';
import type { SpeciesId } from '../data/species';
import type { RoomTrial } from '../net/protocol';
import type { ShrineView, TrialRequest } from './shrine';

export { shrineFocus } from './shrine';

const isGauntletId = (id: string): id is GauntletId => GAUNTLETS.some((g) => g.id === id);

/**
 * The shrine's screens before a trial (docs/gdd.md §3): the shrine window
 * picks a boss or gauntlet and its tier, the loadout picks the species and
 * then its moves (the same picker as a run), and its confirm starts the
 * trial with them. Back walks the same way: moves → species → the shrine,
 * on the view and row of the pick, its tier kept. Pure, so main.ts only
 * draws the step it is handed.
 */
export type ShrineStep =
  | { screen: 'shrine'; view: ShrineView; focus: string; difficulty: Difficulty }
  | { screen: 'loadout'; stage: 'species' | 'moves'; request: TrialRequest }
  | { screen: 'trial'; request: TrialRequest; species: SpeciesId; loadout: (MoveId | null)[] };

/** The wire form of a request, for an online room's `lobby` and `start` (net/protocol.ts). */
export const roomTrialOf = (request: TrialRequest): RoomTrial => ({ kind: request.kind, id: request.id, difficulty: request.difficulty });

/** A room's trial as a request with its arenas; null when this build does not know its boss or gauntlet. */
export function trialRequestOf(trial: RoomTrial): TrialRequest | null {
  if (trial.kind === 'boss') {
    const stop = bossStop(trial.id);
    return stop ? { kind: 'boss', id: trial.id, stops: [stop], difficulty: trial.difficulty } : null;
  }
  if (trial.kind === 'gauntlet') return isGauntletId(trial.id) ? { kind: 'gauntlet', id: trial.id, stops: gauntletStops(trial.id), difficulty: trial.difficulty } : null;
  const seed = /^\d{1,10}$/.test(trial.id) ? Number(trial.id) : Number.NaN;
  return Number.isSafeInteger(seed) ? { kind: 'herald', id: trial.id, stops: [heraldStop(seed)], difficulty: trial.difficulty } : null;
}

/** The shrine view a request was picked from. */
export const viewOf = (request: TrialRequest): ShrineView => (request.kind === 'gauntlet' ? 'gauntlets' : request.kind === 'herald' ? 'heralds' : 'reflections');

/** A boss or gauntlet picked in the shrine: its loadout, species first. */
export const shrineFight = (request: TrialRequest): ShrineStep => ({ screen: 'loadout', stage: 'species', request });

/** A species picked: its moves. */
export const loadoutSpecies = (request: TrialRequest): ShrineStep => ({ screen: 'loadout', stage: 'moves', request });

/** The loadout confirmed: the trial, with a copy of the chosen species and moves. */
export const loadoutStart = (request: TrialRequest, pick: { species: SpeciesId; loadout: readonly (MoveId | null)[] }): Extract<ShrineStep, { screen: 'trial' }> => ({
  screen: 'trial',
  request,
  species: pick.species,
  loadout: [...pick.loadout],
});

/** Back on the loadout: moves → species → the shrine, on the picked row and tier. */
export function loadoutBack(stage: 'species' | 'moves', request: TrialRequest): ShrineStep {
  if (stage === 'moves') return { screen: 'loadout', stage: 'species', request };
  return { screen: 'shrine', view: viewOf(request), focus: request.id, difficulty: request.difficulty };
}
