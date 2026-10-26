import type { RoomId } from '../rooms';

/**
 * One chapter's road of a Senda (docs/story-quests.md, owner 2026-10-26: the
 * three chapters must not feel the same): the main dungeon whose look,
 * decor and music it borrows, its two mid-bosses' arenas (floors 3 and 6),
 * and the wound's arena (floor 7). Chapter I's road is the line's challenge
 * itself (Easy plays it too, without the story); chapters II and III are
 * dungeons of their own (`challenge-<line>-2`, `-3`) that a Hard or
 * Nightmare run of the challenge walks instead (data/dungeons.ts `roadFor`).
 */
export interface SendaRoad {
  base: 'crypt' | 'forest' | 'caves' | 'swamp';
  mid: readonly [RoomId, RoomId];
  wound: RoomId;
}
