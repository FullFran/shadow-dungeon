import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { hasSeenStoryBefore, markStoryBeforeSeen, STORY_SEEN_KEY, storyBeforePanels, storyPanels } from '../../src/app/story';
import type { ChapterNumber } from '../../src/data/story-quests';
import { STORY_QUESTS, storyKeys } from '../../src/data/story-quests';
import { catalog, LANGUAGES } from '../../src/i18n';

/**
 * A Senda chapter's «before» cinematic (docs/story-quests.md) plays in full
 * once per chapter on this device; every retry of the same chapter opens on
 * a short title card instead (like the guardians' name cards). Every Senda,
 * every chapter.
 */
const QUESTS = Object.values(STORY_QUESTS);
const CHAPTERS: readonly ChapterNumber[] = [1, 2, 3];
const text = (key: string) => (catalog('es') as Record<string, string>)[key] ?? key;

describe('the Senda «before» cinematic on retries', () => {
  it('in full the first time, then a short title card, for every Senda and chapter', () => {
    expect(QUESTS.length).toBeGreaterThan(0);
    for (const quest of QUESTS) {
      for (const chapter of CHAPTERS) {
        const story = { line: quest.line, chapter };
        const store = memoryStore();
        expect(hasSeenStoryBefore(store, story)).toBe(false);
        expect(storyBeforePanels(story, text, false)).toEqual(storyPanels(story, 'before', text));
        markStoryBeforeSeen(store, story);
        expect(hasSeenStoryBefore(store, story)).toBe(true);
        const card = storyBeforePanels(story, text, true);
        expect(card).toHaveLength(1);
        expect(card[0]!.lines).toEqual([storyKeys.title(quest.line), storyKeys.chapterTitle(quest.line, chapter)]);
        expect(card[0]!.scene).toBe(storyPanels(story, 'before', text)[0]!.scene);
        expect(card[0]!.durationMs).toBeLessThanOrEqual(4000);
      }
    }
  });

  it('each chapter is its own flag; a broken key reads as unseen', () => {
    const [quest] = QUESTS;
    const store = memoryStore();
    markStoryBeforeSeen(store, { line: quest!.line, chapter: 1 });
    expect(hasSeenStoryBefore(store, { line: quest!.line, chapter: 2 })).toBe(false);
    store.set(STORY_SEEN_KEY, '{nope');
    expect(hasSeenStoryBefore(store, { line: quest!.line, chapter: 1 })).toBe(false);
  });

  it('the card reads in every language', () => {
    for (const language of LANGUAGES) {
      const strings = catalog(language) as Record<string, string>;
      for (const quest of QUESTS) {
        expect(strings[storyKeys.title(quest.line)], `${language} ${quest.line}`).toBeTruthy();
        for (const chapter of CHAPTERS) expect(strings[storyKeys.chapterTitle(quest.line, chapter)], `${language} ${quest.line} ${chapter}`).toBeTruthy();
      }
    }
  });

  it('solo only, as before: a shared run plays none and sets no flag; the gallery replays in full and marks nothing', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main).toMatch(/if \(story && !shared\.net && !devStoryDone\(\)\) await new Promise<void>\(\(resolve\) => storyCinematic\(root, story, 'before', resolve\)\);/);
    const cinematic = main.slice(main.indexOf('function storyCinematic('), main.indexOf('function heraldCinematic('));
    expect(cinematic).toContain('markStoryBeforeSeen(store, story)');
    const gallery = main.slice(main.indexOf('function galleryCinematic('), main.indexOf('function townScreen('));
    expect(gallery).not.toContain('markStoryBeforeSeen');
    expect(gallery).toContain("storyPanels({ line: scene.line, chapter: scene.chapter }, scene.phase, t)");
  });
});
