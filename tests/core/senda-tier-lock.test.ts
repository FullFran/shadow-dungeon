import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { sendaTier, sendaTierOpen } from '../../src/core/story';
import { CHALLENGES, CRYPT, dungeonById } from '../../src/data/dungeons';
import type { Difficulty } from '../../src/data/difficulty';
import { storyOf } from '../../src/data/story-quests';

const sendas = CHALLENGES.filter((d) => storyOf(d.challenge!.line));
const lines = sendas.map((d) => [d.challenge!.line, d] as const);

describe('a Senda opens its difficulties one chapter at a time', () => {
  it('there are Sendas to test', () => expect(sendas.length).toBeGreaterThan(0));

  it.each(lines)('%s: Normal first, Hard after chapter I, Nightmare after chapter II; Easy always', (line, dungeon) => {
    const open = (n: number, d: Difficulty) => sendaTierOpen(dungeon, d, n ? { [line]: n } : undefined);
    expect([open(0, 'easy'), open(0, 'normal'), open(0, 'hard'), open(0, 'nightmare')]).toEqual([true, true, false, false]);
    expect([open(1, 'easy'), open(1, 'normal'), open(1, 'hard'), open(1, 'nightmare')]).toEqual([true, true, true, false]);
    expect([open(2, 'easy'), open(2, 'normal'), open(2, 'hard'), open(2, 'nightmare')]).toEqual([true, true, true, true]);
    expect(open(3, 'nightmare')).toBe(true);
  });

  it.each(lines)('%s: a locked tier plays at the highest open one, never above what was picked', (line, dungeon) => {
    expect(sendaTier(dungeon, 'nightmare', undefined)).toBe('normal');
    expect(sendaTier(dungeon, 'hard', undefined)).toBe('normal');
    expect(sendaTier(dungeon, 'nightmare', { [line]: 1 })).toBe('hard');
    expect(sendaTier(dungeon, 'nightmare', { [line]: 2 })).toBe('nightmare');
    expect(sendaTier(dungeon, 'easy', undefined)).toBe('easy');
    expect(sendaTier(dungeon, 'normal', { [line]: 3 })).toBe('normal');
  });

  it("another line's progress opens nothing", () => {
    const [first, second] = sendas;
    expect(sendaTierOpen(first!, 'hard', { [second!.challenge!.line]: 3 })).toBe(false);
  });

  it('normal dungeons are never locked', () => {
    for (const d of ['easy', 'normal', 'hard', 'nightmare'] as const) {
      expect(sendaTierOpen(CRYPT, d, undefined)).toBe(true);
      expect(sendaTier(CRYPT, d, undefined)).toBe(d);
    }
    expect(dungeonById(CRYPT.id).challenge).toBeUndefined();
  });
});

describe('wiring', () => {
  const main = readFileSync('src/app/main.ts', 'utf8');
  it('a solo run plays at the open tier; a room keeps its host tier', () => {
    expect(main).toMatch(/difficulty: sendaTier\(dungeonById\(dungeon\), settings\.difficulty, loadSave\(store\)\.story\)/);
    expect(main).toMatch(/difficulty: join\.difficulty \?\? DEFAULT_DIFFICULTY/);
  });
  it('the loadout offers only open tiers for a Senda', () => {
    expect(main).toContain('allowed: (d) => !dungeon || sendaTierOpen(dungeonById(dungeon), d, save.story)');
  });
  it.each(['es', 'en'])('%s says why a tier is shut', (language) => {
    const strings = JSON.parse(readFileSync(`src/i18n/${language}.json`, 'utf8')) as Record<string, string>;
    expect(strings['story.tierLocked']).toContain('{tier}');
    expect(strings['story.tierLocked']).toContain('{chapter}');
  });
});
