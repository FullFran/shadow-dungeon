import type { KeyValueStore } from '../adapters/storage';
import { chaptersCleared, closeChapter, storyRunFor, type StoryRun } from '../core/story';
import type { Difficulty } from '../data/difficulty';
import type { ChallengeLine, DungeonDef } from '../data/dungeons';
import type { CinematicPanel, Shot } from '../data/prologue';
import { chapterOf, storyKeys, storyOf, type ChapterNumber, type StoryFigure, type StoryScene } from '../data/story-quests';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * The Sendas in the app (docs/story-quests.md): which chapter a run plays,
 * closing it on a victory (the save's optional `story`), and the chapter's
 * cinematics as panels for the prologue player (drawn by
 * adapters/story-scenes.ts). No DOM here.
 */
export interface StoryPanel extends CinematicPanel<StoryScene> {
  line: ChallengeLine;
  figure?: StoryFigure;
}

export type StoryPhase = 'before' | 'after';

const SLOW = { textStartMs: 900, charsPerSecond: 26, lineGapMs: 600 } as const;
const CAMERAS: readonly { from: Shot; to: Shot }[] = [
  { from: { x: 0.5, y: 0.45, zoom: 1.06 }, to: { x: 0.5, y: 0.5, zoom: 1.16 } },
  { from: { x: 0.5, y: 0.5, zoom: 1 }, to: { x: 0.5, y: 0.55, zoom: 1.1 } },
  { from: { x: 0.46, y: 0.52, zoom: 1.12 }, to: { x: 0.54, y: 0.52, zoom: 1.12 } },
];

/** How long a beat stays: its text typed out, then time to read it (at least 4.5 s). */
export const beatMs = (text: string): number => Math.max(4500, SLOW.textStartMs + ([...text].length / SLOW.charsPerSecond) * 1000 + 2600);

/** A chapter's cinematic as panels; `text` reads a key (beats last as long as their line needs). */
export function storyPanels(story: StoryRun, phase: StoryPhase, text: (key: string) => string): StoryPanel[] {
  const quest = storyOf(story.line);
  if (!quest) return [];
  const beats = chapterOf(quest, story.chapter)[phase];
  return beats.map((beat, i) => {
    const key = phase === 'before' ? storyKeys.before(story.line, story.chapter, i) : storyKeys.after(story.line, story.chapter, i);
    const last = i === beats.length - 1;
    return {
      id: `${story.line}-${story.chapter}-${phase}-${i}`,
      scene: beat.scene,
      line: story.line,
      ...(beat.figure ? { figure: beat.figure } : {}),
      durationMs: beatMs(text(key)),
      fadeInMs: i === 0 ? 1200 : 800,
      fadeOutMs: last ? 1400 : 800,
      lines: [key],
      ...SLOW,
      camera: CAMERAS[i % CAMERAS.length]!,
    };
  });
}

/**
 * The chapters whose «before» cinematic this device has played in full (its
 * own storage key, like the guardians' and the Sima's: not progress, never
 * in the save). Retrying the same chapter opens on a short title card.
 */
export const STORY_SEEN_KEY = 'mazmorra-sombria.storySeen';

const storySeenId = (story: StoryRun): string => `${story.line}:${story.chapter}`;

function storySeen(store: KeyValueStore): Set<string> {
  try {
    const raw = JSON.parse(store.get(STORY_SEEN_KEY) ?? '[]') as unknown;
    return new Set(Array.isArray(raw) ? raw.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
}

export const hasSeenStoryBefore = (store: KeyValueStore, story: StoryRun): boolean => storySeen(store).has(storySeenId(story));

/** Remembers the chapter's «before» as seen (a failing store is ignored: it plays in full again). */
export function markStoryBeforeSeen(store: KeyValueStore, story: StoryRun): void {
  try {
    const seen = storySeen(store);
    if (seen.has(storySeenId(story))) return;
    seen.add(storySeenId(story));
    store.set(STORY_SEEN_KEY, JSON.stringify([...seen]));
  } catch {
    // Not persisted.
  }
}

/** How long the retry's title card stays. */
const CARD_MS = 3200;

/**
 * The «before» cinematic of a chapter: in full the first time, then (`seen`)
 * a short title card on its first tableau with the Senda's and the chapter's
 * names, like the guardians' name cards.
 */
export function storyBeforePanels(story: StoryRun, text: (key: string) => string, seen: boolean): StoryPanel[] {
  const full = storyPanels(story, 'before', text);
  const first = full[0];
  if (!seen || !first) return full;
  return [
    {
      ...first,
      id: `${story.line}-${story.chapter}-before-card`,
      lines: [storyKeys.title(story.line), storyKeys.chapterTitle(story.line, story.chapter)],
      durationMs: CARD_MS,
      fadeInMs: 500,
      fadeOutMs: 700,
      textStartMs: 300,
      charsPerSecond: 60,
      lineGapMs: 200,
    },
  ];
}

/** The chapter a run of `dungeon` on `difficulty` plays for this save (none: a plain challenge). */
export const storyRunOf = (save: Pick<SaveData, 'story'>, dungeon: DungeonDef, difficulty: Difficulty): StoryRun | null => storyRunFor(dungeon, difficulty, save.story);

/** Closes the run's chapter in the stored save on a victory; returns whether it was newly closed. */
export function recordStory(store: KeyValueStore, story: StoryRun | null, victory: boolean): boolean {
  if (!story || !victory) return false;
  const save = loadSave(store);
  const before = chaptersCleared(save.story, story.line);
  const progress = closeChapter(save.story, story, victory);
  if (chaptersCleared(progress, story.line) === before) return false;
  writeSave(store, { ...save, story: progress });
  return true;
}

/** The bond line of the latest chapter closed for a line (null before the first). */
export function bondLine(save: Pick<SaveData, 'story'>, line: ChallengeLine): { level: number; key: string } | null {
  const level = chaptersCleared(save.story, line);
  if (level < 1 || !storyOf(line)) return null;
  return { level, key: storyKeys.bond(line, Math.min(3, level) as ChapterNumber) };
}
