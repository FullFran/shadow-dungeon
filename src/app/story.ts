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
 * When a Senda cinematic can be skipped (owner, 2026-10-28: «que salga
 * siempre pero con botón de saltar»): it plays in full on every attempt, so
 * its «Saltar» is there from the first frame (the prologue keeps its one
 * second, `SKIP.availableAfterMs`).
 */
export const STORY_SKIP_AFTER_MS = 0;

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
