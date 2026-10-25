/**
 * Where the player goes once a run is over: the town is the hub
 * (docs/gdd.md §10). The title only opens on launch; its first entry still
 * starts the adventure.
 */
export type EndAction = 'retry' | 'town';

/** The end screen's actions: a solo (or local tab) run may retry; an online room is gone after its run. */
export const endActions = (run: { online: boolean }): EndAction[] => (run.online ? ['town'] : ['retry', 'town']);

/** Why a screen is being left: the end screen, quitting from the Esc menu, the host leaving, or leaving a lobby before any run. */
export type LeaveReason = 'end' | 'quit' | 'hostLeft' | 'lobby';

export type ReturnPlace = 'town' | 'title';

/** Every way out of a run leads back to the town; a lobby left before its run goes back to the title it came from. */
export const returnPlace = (reason: LeaveReason): ReturnPlace => (reason === 'lobby' ? 'title' : 'town');
