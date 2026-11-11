/**
 * What a peer does after a full wipe and on a shared defeat (issue #50).
 * Pure, so the rules are tested apart from game.ts, which wires them.
 */

export type PeerKind = 'solo' | 'host' | 'guest';

/** The choice window open on this peer: the bonfire question, any other (a stale "¿Bajar?", a Sima merchant...), or none. */
export type OpenChoice = 'bonfire' | 'other' | null;

/**
 * Each step after a full wipe: `ask` shows the bonfire question, `replace`
 * first closes a stale choice that would hide it (a host that fainted with
 * "¿Bajar?" open used to leave everyone waiting), `none` leaves things as
 * they are (a guest waits for the host's word; the question is already up;
 * the run is over).
 */
export function wipeAction(kind: PeerKind, ended: boolean, open: OpenChoice): 'ask' | 'replace' | 'none' {
  if (kind === 'guest' || ended || open === 'bonfire') return 'none';
  return open === 'other' ? 'replace' : 'ask';
}

/**
 * Whether ending the run must tell the guests it is over: a host whose party
 * is defeated with no bonfire to go back to (no respawn left, or none lit
 * behind it). A guest may still count a bonfire of its own and would wait
 * for a retry that never comes.
 */
export const defeatTellsGuests = (kind: PeerKind, outcome: string): boolean => kind === 'host' && outcome === 'defeat';

/** The i18n key of the line a fainted co-op player reads under who they watch: whether a teammate can still bring them back on this floor. */
export const faintedHintKey = (reviveAvailable: boolean): string => (reviveAvailable ? 'spectate.reviveHint' : 'spectate.nextFloor');
