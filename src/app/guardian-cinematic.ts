import type { KeyValueStore } from '../adapters/storage';
import { GUARDIAN_CINEMATICS, type CinematicPhase, type GuardianScene } from '../data/guardian-cinematics';
import type { CinematicPanel } from '../data/prologue';
import type { SpeciesId } from '../data/species';

/**
 * When and how a guardian cinematic plays (pure sequencing; the player is the
 * prologue screen, the name card in a shared run is drawn on the game canvas):
 *
 * - `full`: the first time in this browser (per guardian and per phase), or
 *   when asked to replay. Solo only.
 * - `short`: the 2-3 s name card, every later time. Solo only.
 * - `card`: shared runs never pause, so they only get the name card drawn
 *   over the running game.
 *
 * Solo pauses the run while `full` or `short` plays; `card` never pauses.
 */
export type CinematicMode = 'full' | 'short' | 'card';

export const SEEN_KEY = 'mazmorra-sombria.cinematicsSeen';

export interface ModeInput {
  seen: boolean;
  shared: boolean;
  /** Played again on purpose: always the full version (solo). */
  replay?: boolean;
}

export function cinematicMode({ seen, shared, replay = false }: ModeInput): CinematicMode {
  if (shared) return 'card';
  return replay || !seen ? 'full' : 'short';
}

export const pausesRun = (mode: CinematicMode): boolean => mode !== 'card';

export const seenId = (species: SpeciesId, phase: CinematicPhase): string => `${species}:${phase}`;

const ID = /^[a-z0-9-]{1,40}:(pre|post)$/;

/** The ids already seen; anything broken or hostile reads as none. */
export function parseSeen(raw: string | null): Set<string> {
  try {
    const data: unknown = JSON.parse(raw ?? '[]');
    return new Set(Array.isArray(data) ? data.filter((x): x is string => typeof x === 'string' && ID.test(x)).slice(0, 64) : []);
  } catch {
    return new Set();
  }
}

export function hasSeen(store: KeyValueStore, species: SpeciesId, phase: CinematicPhase): boolean {
  try {
    return parseSeen(store.get(SEEN_KEY)).has(seenId(species, phase));
  } catch {
    return false;
  }
}

/** Remembers a full viewing (a failing store is ignored: worst case it plays in full again). */
export function markSeen(store: KeyValueStore, species: SpeciesId, phase: CinematicPhase): void {
  try {
    const seen = parseSeen(store.get(SEEN_KEY));
    seen.add(seenId(species, phase));
    store.set(SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Not persisted.
  }
}

/** The panels to play for a guardian, phase and mode (none for `card`, or a species without a cinematic). */
export function cinematicPanels(species: SpeciesId, phase: CinematicPhase, mode: CinematicMode): readonly CinematicPanel<GuardianScene>[] {
  const c = GUARDIAN_CINEMATICS[species];
  if (!c || mode === 'card') return [];
  if (mode === 'full') return phase === 'pre' ? c.pre : c.post;
  return phase === 'pre' ? c.preShort : c.postShort;
}

/** How long the shared-run name card stays over the game. */
export const CARD_MS = 2600;
