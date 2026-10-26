import type { PlayerInput } from './state';

/**
 * Leaving a floor together (docs/gdd.md §7): stepping on the stairs (or a
 * cleared room's exit) asks first; confirming marks the player ready, and
 * walking off unreadies it. The floor is left once every living, active
 * player is ready. Fainted players are not waited for (they come along),
 * nor are inactive ones: no input for `AFK_MS`, or a hidden tab. Solo is
 * the same rule with one player: confirming is leaving.
 */

/** No input for this long and a player stops counting for the gather (ms). */
export const AFK_MS = 30_000;

export interface GatherMember {
  /** Standing (HP above 0). */
  alive: boolean;
  /** Played in the last `AFK_MS` with its tab in view. */
  active: boolean;
  /** Confirmed and still on the leaving point. */
  ready: boolean;
}

/** Whether a player still counts: some input within `AFK_MS` and its tab not hidden. */
export const isActive = (sinceInputMs: number, hidden: boolean): boolean => !hidden && sinceInputMs < AFK_MS;

/** The player did something this tick (moved, rolled, pressed a move, locked or scrolled): it is not away. */
export const hadInput = (input: PlayerInput): boolean =>
  input.move.x !== 0 || input.move.y !== 0 || input.roll || input.click || input.lock || input.wheel !== 0 || input.slots.some(Boolean) || input.slotMouse.some(Boolean);

/** A ready player stays ready only while it stands on the leaving point. */
export const keepReady = (ready: boolean, atPoint: boolean): boolean => ready && atPoint;

/** How many living, active players have not confirmed yet ("Esperando a N"). */
export const waitingFor = (members: readonly GatherMember[]): number => members.filter((m) => m.alive && m.active && !m.ready).length;

/** The party leaves: someone standing is ready and no living, active player is still missing. */
export const partyAgreed = (members: readonly GatherMember[]): boolean => members.some((m) => m.alive && m.ready) && waitingFor(members) === 0;
