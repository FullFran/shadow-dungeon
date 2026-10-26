import type { Difficulty } from '../data/difficulty';
import { CHALLENGES, type ChallengeLine, type DungeonDef } from '../data/dungeons';
import { storyOf, type ChapterNumber } from '../data/story-quests';
import type { TileRect } from './dungeon';
import { TILE } from './tiles';
import type { Vec2 } from './vec';

/**
 * The Sendas' rules (docs/story-quests.md), pure. A chapter belongs to a
 * material tier: I on Normal, II on Hard, III on Nightmare (Easy has none).
 * The first is open with the line; each next one opens once the one before
 * is closed. Progress is the chapters closed per line (0..3), kept in the
 * save's optional `story` field.
 */
export type StoryProgress = Partial<Record<ChallengeLine, number>>;

/** The chapter that is a tier's: null on Easy. */
export function chapterOfDifficulty(difficulty: Difficulty): ChapterNumber | null {
  if (difficulty === 'normal') return 1;
  if (difficulty === 'hard') return 2;
  if (difficulty === 'nightmare') return 3;
  return null;
}

/** Chapters closed of a line (0..3); also its bond level. */
export const chaptersCleared = (progress: StoryProgress | undefined, line: ChallengeLine): number => progress?.[line] ?? 0;

/** Whether a chapter can be played: the first always, the next ones after the one before. */
export const chapterOpen = (progress: StoryProgress | undefined, line: ChallengeLine, chapter: ChapterNumber): boolean => chapter <= chaptersCleared(progress, line) + 1;

/** A run's place in a Senda. */
export interface StoryRun {
  line: ChallengeLine;
  chapter: ChapterNumber;
}

/** The chapter a run of `dungeon` on `difficulty` plays: none outside a challenge with a Senda, on Easy, or while the chapter before is open. */
export function storyRunFor(dungeon: DungeonDef, difficulty: Difficulty, progress: StoryProgress | undefined): StoryRun | null {
  const line = dungeon.challenge?.line;
  const chapter = chapterOfDifficulty(difficulty);
  if (!line || chapter === null || !storyOf(line) || !chapterOpen(progress, line, chapter)) return null;
  return { line, chapter };
}

/** Progress after a run: a won chapter is closed (never lowers it). */
export function closeChapter(progress: StoryProgress | undefined, story: StoryRun | null, victory: boolean): StoryProgress {
  const base = { ...progress };
  if (!story || !victory || !chapterOpen(progress, story.line, story.chapter)) return base;
  return { ...base, [story.line]: Math.max(chaptersCleared(progress, story.line), story.chapter) };
}

const LINES: readonly ChallengeLine[] = CHALLENGES.map((d) => d.challenge!.line);

/** Only known lines with a whole count 1..3 survive; null when nothing does. */
export function sanitizeStory(raw: unknown): StoryProgress | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const out: StoryProgress = {};
  for (const line of LINES) {
    if (!Object.prototype.hasOwnProperty.call(record, line)) continue;
    const n = record[line];
    if (typeof n === 'number' && Number.isInteger(n) && n > 0) out[line] = Math.min(n, 3);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** Where a memory fragment lies on a generated floor: the centre of the room farthest from where the player stands (none without rooms). */
export function fragmentSpot(rooms: readonly TileRect[] | undefined, start: Vec2): Vec2 | null {
  let best: Vec2 | null = null;
  let far = -1;
  for (const room of rooms ?? []) {
    const at = { x: (room.x + room.width / 2) * TILE, y: (room.y + room.height / 2) * TILE };
    const d = (at.x - start.x) ** 2 + (at.y - start.y) ** 2;
    if (d > far) {
      far = d;
      best = at;
    }
  }
  return best;
}

/** How close (world px) the player must come to pick a fragment up. */
export const FRAGMENT_REACH = 24;
