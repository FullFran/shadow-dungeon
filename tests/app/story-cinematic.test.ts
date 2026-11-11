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

  it('the app plays it with no seen gate and the skip at once; solo only, never again when a stored run comes back', () => {
    const main = readFileSync(join(__dirname, '../../src/app/main.ts'), 'utf8');
    expect(main).toMatch(/if \(story && !shared\.net && !resume && !devStoryDone\(\)\) await new Promise<void>\(\(resolve\) => storyCinematic\(root, story, 'before', resolve\)\);/);
    const cinematic = main.slice(main.indexOf('function storyCinematic('), main.indexOf('function heraldCinematic('));
    expect(cinematic).toContain('const panels = storyPanels(story, phase, t);');
    expect(cinematic).toContain('skipAfterMs: STORY_SKIP_AFTER_MS');
    expect(cinematic).not.toMatch(/seen|Seen/);
  });
});

describe('the speaker of a Senda cinematic panel (issue #47)', () => {
  it("an unnamed quote shows the line's Pokémon in the form the panel shows, a named one that character, narration none", async () => {
    const { storyFace } = await import('../../src/app/story');
    const { SPRITE_KEYS } = await import('../../src/data/sprites');
    const lines: Record<string, string> = { a: '«Bajo contigo.»', b: 'Drowzee: «Huelo una pesadilla.»', c: 'Abra duerme casi todo el día.' };
    const panel = (key: string, form?: 'kadabra') => ({ line: 'abra' as const, lines: [key], ...(form ? { figure: { anim: 'Idle' as const, form } } : {}) });
    expect(storyFace(panel('a'), (k) => lines[k]!)).toEqual({ sprite: SPRITE_KEYS.abra, emotion: 'Normal' });
    expect(storyFace(panel('a', 'kadabra'), (k) => lines[k]!)).toEqual({ sprite: SPRITE_KEYS.kadabra, emotion: 'Normal' });
    expect(storyFace(panel('b'), (k) => lines[k]!)).toEqual({ sprite: SPRITE_KEYS.drowzee, emotion: 'Normal' });
    expect(storyFace(panel('c'), (k) => lines[k]!)).toBeNull();
  });

  it('every Senda panel that a character speaks resolves to a portrait', async () => {
    const { storyFace } = await import('../../src/app/story');
    const { portraitFor } = await import('../../src/data/portraits');
    let faces = 0;
    for (const quest of QUESTS)
      for (const chapter of CHAPTERS)
        for (const phase of ['before', 'after'] as const)
          for (const panel of storyPanels({ line: quest!.line, chapter }, phase, text)) {
            const who = storyFace(panel, text);
            if (!who) continue;
            faces++;
            expect(portraitFor(who.sprite, who.emotion), panel.id).not.toBeNull();
          }
    expect(faces).toBeGreaterThan(30);
  });
});
