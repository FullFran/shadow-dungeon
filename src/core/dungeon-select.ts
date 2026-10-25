import { DUNGEONS, type DungeonDef } from '../data/dungeons';

/**
 * Which dungeons a player may enter (docs/gdd.md §3): the first is open from
 * the start, every other one once the dungeon named by its `unlockedBy` has
 * been cleared (its guardian beaten) on this device. Pure: the app passes the
 * cleared ids from the run records.
 */
export const isUnlocked = (dungeon: Pick<DungeonDef, 'unlockedBy'>, cleared: ReadonlySet<string>): boolean =>
  dungeon.unlockedBy === null || cleared.has(dungeon.unlockedBy);

export interface DungeonChoice {
  dungeon: DungeonDef;
  unlocked: boolean;
}

/** Every dungeon in select order, with whether it is open. */
export const dungeonChoices = (cleared: ReadonlySet<string>, dungeons: readonly DungeonDef[] = DUNGEONS): DungeonChoice[] =>
  dungeons.map((dungeon) => ({ dungeon, unlocked: isUnlocked(dungeon, cleared) }));

export const unlockedDungeons = (cleared: ReadonlySet<string>, dungeons: readonly DungeonDef[] = DUNGEONS): DungeonDef[] =>
  dungeons.filter((dungeon) => isUnlocked(dungeon, cleared));

/** The select is only worth a screen when there is more than one dungeon to go to. */
export const needsDungeonSelect = (cleared: ReadonlySet<string>, dungeons: readonly DungeonDef[] = DUNGEONS): boolean =>
  unlockedDungeons(cleared, dungeons).length > 1;
