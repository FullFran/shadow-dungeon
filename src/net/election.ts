import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { NetSession } from './session';
import type { Scheduler } from './transport';

/**
 * `?net=local` start (docs/gdd.md §12): a tab knocks, and if no host
 * answers within `searchMs` it may host. Tabs opened at the same instant
 * used to both host; now each one hears the others' knocks, and only the
 * one with the lowest transport id among the searching tabs hosts (it lets
 * the others in at once); the rest keep knocking until it answers. If the
 * winner closes, it drops out of the searching set and the next lowest hosts.
 */
export interface AutoJoinOptions {
  session: NetSession;
  scheduler: Pick<Scheduler, 'setTimeout'>;
  searchMs: number;
  seed: number;
  floor: number;
  species: SpeciesId;
  loadout: readonly (MoveId | null)[];
  /** `?host=1`: host without searching. */
  forceHost?: boolean;
}

export interface AutoJoinResult {
  role: 'host' | 'guest';
  localId: string;
  seed: number;
  floor: number;
}

/** Deterministic tie-break: the lowest id among this tab and the other searching tabs hosts. */
export const winsElection = (self: string, rivals: readonly string[]): boolean => rivals.every((rival) => self < rival);

export function autoJoin(options: AutoJoinOptions): Promise<AutoJoinResult> {
  const { session, scheduler, searchMs, seed, floor, species, loadout } = options;
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: AutoJoinResult) => {
      if (done) return;
      done = true;
      resolve(result);
    };
    const asHost = () => {
      session.host(seed, floor, species);
      finish({ role: 'host', localId: 'p1', seed, floor });
    };
    session.onStart((start) => finish({ role: 'guest', localId: start.localId, seed: start.seed, floor: start.floor }));
    if (options.forceHost) return asHost();
    session.join(species, loadout);
    const decide = () => {
      if (done) return;
      if (winsElection(session.peerId(), session.rivals())) return asHost();
      // Lost: knock again; the winner lets this tab in when it hosts.
      session.join(species, loadout);
      scheduler.setTimeout(decide, searchMs);
    };
    scheduler.setTimeout(decide, searchMs);
  });
}
