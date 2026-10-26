import type { Collection } from '../core/collection';
import type { Difficulty } from '../data/difficulty';
import type { DungeonDef } from '../data/dungeons';

/**
 * Where the player goes once a run is over: the town is the hub
 * (docs/gdd.md §10). The title only opens on launch; its first entry still
 * starts the adventure.
 */
export type EndAction = 'retry' | 'town';

/** The end screen's actions: a solo (or local tab) run may retry; an online run goes back to its town. */
export const endActions = (run: { online: boolean }): EndAction[] => (run.online ? ['town'] : ['retry', 'town']);

/** Why a screen is being left: the end screen, quitting from the Esc menu, the host leaving, or leaving a lobby before any run. */
export type LeaveReason = 'end' | 'quit' | 'hostLeft' | 'lobby';

export type ReturnPlace = 'town' | 'title';

/** Every way out of a run leads back to the town; a lobby left before its run goes back to the title it came from. */
export const returnPlace = (reason: LeaveReason): ReturnPlace => (reason === 'lobby' ? 'title' : 'town');

/**
 * Which town a run comes back to: a run of an online room brings the whole
 * room back to the room's town (`townLobby`, where the host leads the next
 * one); every other run comes back to the hub on its own (`townScreen`).
 */
export type TownReturn = 'room' | 'hub';

export const townOf = (run: { inRoom: boolean }): TownReturn => (run.inRoom ? 'room' : 'hub');

/**
 * The end screen's materials line: "+3 Esencias de Abra (Normal)", the
 * materials a challenge clear added to the save (`before` and `after` the
 * reward), or null when it added none (a main dungeon, Easy, a defeat, a
 * peer that does not own the line). `tr` is the i18n lookup.
 */
/** A challenge's closing line after its boss falls (its lore's `victoryKey`), null for any other end. */
export const victoryLine = (dungeon: DungeonDef, result: string): string | null => (result === 'victory' ? (dungeon.lore.victoryKey ?? null) : null);

export function materialsEarned(dungeon: DungeonDef, difficulty: Difficulty, before: Pick<Collection, 'materials'>, after: Pick<Collection, 'materials'>, tr: (key: string) => string): string | null {
  const line = dungeon.challenge?.line;
  if (!line || difficulty === 'easy') return null;
  const count = (c: Pick<Collection, 'materials'>) => c.materials?.[line]?.[difficulty] ?? 0;
  const earned = count(after) - count(before);
  if (earned <= 0) return null;
  return tr('screen.materials.earned').replace('{n}', String(earned)).replace('{species}', tr(`species.${line}`)).replace('{difficulty}', tr(`difficulty.${difficulty}`));
}
