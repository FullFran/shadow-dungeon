import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { STORY_SKIP_AFTER_MS, storyPanels } from '../../src/app/story';
import type { ChapterNumber } from '../../src/data/story-quests';
import { chapterOf, STORY_QUESTS } from '../../src/data/story-quests';
import { catalog } from '../../src/i18n';
import { skipAvailable } from '../../src/ui/cinematic';

/**
 * A Senda chapter's «before» cinematic (docs/story-quests.md) plays in full
 * on every attempt (owner, 2026-10-28: «que salga siempre pero con botón de
 * saltar»), and its skip is there from the very first frame. Every Senda,
 * every chapter (each chapter is its own tier).
 */
const QUESTS = Object.values(STORY_QUESTS);
const CHAPTERS: readonly ChapterNumber[] = [1, 2, 3];
const text = (key: string) => (catalog('es') as Record<string, string>)[key] ?? key;

describe('the Senda «before» cinematic, every attempt', () => {
  it('plays in full on the first attempt and on the second alike, for every Senda and chapter', () => {
    expect(QUESTS.length).toBeGreaterThan(0);
    for (const quest of QUESTS) {
      for (const chapter of CHAPTERS) {
        const story = { line: quest.line, chapter };
        const first = storyPanels(story, 'before', text);
        const second = storyPanels(story, 'before', text);
        expect(first, `${quest.line} ${chapter}`).toHaveLength(chapterOf(quest, chapter).before.length);
        expect(second).toEqual(first);
      }
    }
  });

  it('can be skipped from the very start (t = 0); the prologue keeps its one second', () => {
    expect(STORY_SKIP_AFTER_MS).toBe(0);
    expect(skipAvailable(0, STORY_SKIP_AFTER_MS)).toBe(true);
    expect(skipAvailable(0)).toBe(false);
  });

  it('the app plays it with no seen gate and the skip at once; solo only, as before', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main).toMatch(/if \(story && !shared\.net && !devStoryDone\(\)\) await new Promise<void>\(\(resolve\) => storyCinematic\(root, story, 'before', resolve\)\);/);
    const cinematic = main.slice(main.indexOf('function storyCinematic('), main.indexOf('function heraldCinematic('));
    expect(cinematic).toContain('const panels = storyPanels(story, phase, t);');
    expect(cinematic).toContain('skipAfterMs: STORY_SKIP_AFTER_MS');
    expect(cinematic).not.toMatch(/seen|Seen/);
  });
});
