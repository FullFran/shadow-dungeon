import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { readGallerySeen } from '../../src/app/gallery-seen';
import { galleryGroups, galleryUnlocked, type GalleryScene } from '../../src/app/lore-gallery';
import { recordStoryScene } from '../../src/app/story';
import { CHAPTERS, STORY_QUESTS } from '../../src/data/story-quests';
import type { ChallengeLine } from '../../src/data/dungeons';

const lines = Object.keys(STORY_QUESTS) as ChallengeLine[];

describe("a Senda's cinematic can be watched again once it was watched, chapter closed or not", () => {
  it.each(lines)('%s: an opening watched on a lost attempt unlocks that scene alone', (line) => {
    for (const chapter of CHAPTERS) {
      const store = memoryStore();
      recordStoryScene(store, { line, chapter }, 'before');
      const seen = readGallerySeen(store, false);
      expect(galleryUnlocked({ kind: 'story', line, chapter, phase: 'before' }, seen)).toBe(true);
      expect(galleryUnlocked({ kind: 'story', line, chapter, phase: 'after' }, seen)).toBe(false);
      const others = galleryGroups().flatMap((g) => g.entries).filter((e) => e.scene.kind === 'story' && !(e.scene.line === line && e.scene.chapter === chapter));
      for (const entry of others) expect(galleryUnlocked(entry.scene, seen), entry.id).toBe(false);
    }
  });

  it('nothing is unlocked on a device that watched nothing', () => {
    const seen = readGallerySeen(memoryStore(), false);
    for (const line of lines) expect(galleryUnlocked({ kind: 'story', line, chapter: 1, phase: 'before' } as GalleryScene, seen)).toBe(false);
  });

  it('a chapter closed in the save still unlocks both of its scenes, a new device included', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.save', JSON.stringify({ version: 1, coins: 0, story: { mimikyu: 1 } }));
    const seen = readGallerySeen(store, false);
    expect(galleryUnlocked({ kind: 'story', line: 'mimikyu', chapter: 1, phase: 'before' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'story', line: 'mimikyu', chapter: 1, phase: 'after' }, seen)).toBe(true);
    expect(galleryUnlocked({ kind: 'story', line: 'mimikyu', chapter: 2, phase: 'before' }, seen)).toBe(false);
  });

  it('a broken flag reads as nothing watched', () => {
    const store = memoryStore();
    store.set('mazmorra-sombria.storyScenes', '{not json');
    expect(galleryUnlocked({ kind: 'story', line: 'mimikyu', chapter: 1, phase: 'before' }, readGallerySeen(store, false))).toBe(false);
  });

  it('marking is done where a Senda cinematic really plays, and the gallery replay never marks', () => {
    const main = readFileSync('src/app/main.ts', 'utf8');
    const start = main.indexOf('function storyCinematic(');
    expect(main.slice(start, main.indexOf('\n}\n', start))).toContain('recordStoryScene(store, story, phase)');
    expect(main.match(/recordStoryScene\(/g)).toHaveLength(1);
  });
});
