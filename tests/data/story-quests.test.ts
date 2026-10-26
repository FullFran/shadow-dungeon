import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { chapterOfDifficulty, chapterOpen, closeChapter, fragmentSpot, sanitizeStory, storyRunFor } from '../../src/core/story';
import { bondLine, recordStory, storyPanels } from '../../src/app/story';
import { loadSave, parseSave, writeSave, EMPTY_SAVE } from '../../src/app/save';
import { CHALLENGES, CRYPT, guardianOf, roadFor, type ChallengeLine } from '../../src/data/dungeons';
import { CHAPTERS, chapterOf, isWound, STORY_MID_FLOOR, STORY_QUESTS, storyKeyList, storyKeys, type StoryQuest } from '../../src/data/story-quests';
import { catalog, LANGUAGES } from '../../src/i18n';
import { totalMs } from '../../src/ui/cinematic';

const MIMIKYU = CHALLENGES.find((d) => d.challenge?.line === 'mimikyu')!;
const QUESTS = Object.values(STORY_QUESTS) as StoryQuest[];

/** The Sendas (docs/story-quests.md): every entry in the table is a whole story in both languages, so filling the other seven is guarded. */
describe('every Senda in STORY_QUESTS is complete', () => {
  it('Mimikyu has its Senda (the pilot), and so do the gacha lines', () => {
    expect(STORY_QUESTS.mimikyu).toBeDefined();
    for (const line of ['abra', 'piplup', 'shinx', 'axew'] as const) expect(STORY_QUESTS[line]?.line, line).toBe(line);
  });

  it('a gacha line\'s chapter plays on its own road: the Hard run of the challenge is chapter II on the hidden road', () => {
    const abra = CHALLENGES.find((d) => d.challenge?.line === 'abra')!;
    const hard = roadFor(abra, 'hard');
    expect(hard.id).toBe('challenge-abra-2');
    expect(storyRunFor(hard, 'hard', { abra: 1 })).toEqual({ line: 'abra', chapter: 2 });
    expect(storyRunFor(roadFor(abra, 'nightmare'), 'nightmare', { abra: 2 })).toEqual({ line: 'abra', chapter: 3 });
    expect(storyRunFor(hard, 'hard', undefined)).toBeNull();
  });

  it.each(QUESTS.map((q) => [q.line, q] as const))('%s: every text exists in every language, short and without em dashes', (_, quest) => {
    const keys = storyKeyList(quest);
    expect(new Set(keys).size).toBe(keys.length);
    for (const language of LANGUAGES) {
      const strings = catalog(language) as Record<string, string>;
      for (const key of keys) {
        expect(strings[key], `${language} ${key}`).toBeTruthy();
        expect(strings[key], `${language} ${key}`).not.toContain('—');
        expect(strings[key]!.length, `${language} ${key}`).toBeLessThanOrEqual(200);
      }
    }
  });

  it.each(QUESTS.map((q) => [q.line, q] as const))('%s: three chapters, each with 2-5 beats before and after, its voice, fragments on generated floors and every boss of the road', (_, quest) => {
    const dungeon = CHALLENGES.find((d) => d.challenge?.line === quest.line)!;
    const roomFloors = dungeon.plan.flatMap((p, i) => (p.kind === 'room' ? [i + 1] : []));
    expect(quest.chapters).toHaveLength(3);
    for (const ch of CHAPTERS) {
      const c = chapterOf(quest, ch);
      for (const beats of [c.before, c.after]) {
        expect(beats.length).toBeGreaterThanOrEqual(2);
        expect(beats.length).toBeLessThanOrEqual(5);
      }
      expect(c.fragments.length).toBeGreaterThanOrEqual(1);
      for (const floor of c.fragments) expect(dungeon.plan[floor - 1]?.kind, `fragment on F${floor}`).toBe('generated');
      // One entry per boss of the road, the last one the line's own wound; at least two before it.
      expect(c.bosses.map((b) => b.floor)).toEqual(roomFloors);
      expect(roomFloors.length).toBeGreaterThanOrEqual(3);
      for (const b of c.bosses) {
        expect(b.pre).toBeGreaterThanOrEqual(1);
        expect(b.post).toBeGreaterThanOrEqual(1);
      }
      expect(STORY_MID_FLOOR).toBeLessThan(dungeon.plan.length);
    }
    expect(isWound(guardianOf(dungeon)!)).toBe(true);
    expect(dungeon.plan.length).toBeGreaterThanOrEqual(6);
  });

  it('the cinematics: one panel per beat, each long enough to read its line, a chapter well under a minute', () => {
    for (const quest of QUESTS) {
      for (const chapter of CHAPTERS) {
        for (const phase of ['before', 'after'] as const) {
          const text = (key: string) => (catalog('es') as Record<string, string>)[key] ?? key;
          const panels = storyPanels({ line: quest.line, chapter }, phase, text);
          expect(panels).toHaveLength(chapterOf(quest, chapter)[phase].length);
          for (const p of panels) expect(p.durationMs).toBeGreaterThanOrEqual(p.textStartMs + ([...text(p.lines[0]!)].length / p.charsPerSecond) * 1000 + 1500);
          expect(totalMs(panels)).toBeLessThanOrEqual(45_000);
        }
      }
    }
  });
});

describe('Senda chapter rules', () => {
  it('a chapter per material tier: I Normal, II Hard, III Nightmare, none on Easy', () => {
    expect(chapterOfDifficulty('easy')).toBeNull();
    expect(chapterOfDifficulty('normal')).toBe(1);
    expect(chapterOfDifficulty('hard')).toBe(2);
    expect(chapterOfDifficulty('nightmare')).toBe(3);
  });

  it('I is open from the start; II after I; III after II', () => {
    expect(chapterOpen(undefined, 'mimikyu', 1)).toBe(true);
    expect(chapterOpen(undefined, 'mimikyu', 2)).toBe(false);
    expect(chapterOpen({ mimikyu: 1 }, 'mimikyu', 2)).toBe(true);
    expect(chapterOpen({ mimikyu: 1 }, 'mimikyu', 3)).toBe(false);
    expect(chapterOpen({ mimikyu: 2 }, 'mimikyu', 3)).toBe(true);
    // Another line's progress opens nothing here.
    expect(chapterOpen({ zorua: 3 }, 'mimikyu', 2)).toBe(false);
  });

  it('a run plays the tier\'s chapter only on a challenge with a Senda, and only once it is open', () => {
    expect(storyRunFor(MIMIKYU, 'normal', undefined)).toEqual({ line: 'mimikyu', chapter: 1 });
    expect(storyRunFor(MIMIKYU, 'easy', undefined)).toBeNull();
    expect(storyRunFor(MIMIKYU, 'hard', undefined)).toBeNull();
    expect(storyRunFor(MIMIKYU, 'hard', { mimikyu: 1 })).toEqual({ line: 'mimikyu', chapter: 2 });
    expect(storyRunFor(MIMIKYU, 'nightmare', { mimikyu: 3 })).toEqual({ line: 'mimikyu', chapter: 3 });
    expect(storyRunFor(CRYPT, 'normal', undefined)).toBeNull();
    for (const d of CHALLENGES.filter((x) => !STORY_QUESTS[x.challenge!.line])) expect(storyRunFor(d, 'normal', undefined)).toBeNull();
  });

  it('a victory closes its chapter and never lowers the progress; a defeat or a shut chapter changes nothing', () => {
    expect(closeChapter(undefined, { line: 'mimikyu', chapter: 1 }, true)).toEqual({ mimikyu: 1 });
    expect(closeChapter({ mimikyu: 1 }, { line: 'mimikyu', chapter: 1 }, true)).toEqual({ mimikyu: 1 });
    expect(closeChapter({ mimikyu: 3 }, { line: 'mimikyu', chapter: 2 }, true)).toEqual({ mimikyu: 3 });
    expect(closeChapter({ mimikyu: 1 }, { line: 'mimikyu', chapter: 2 }, false)).toEqual({ mimikyu: 1 });
    expect(closeChapter(undefined, { line: 'mimikyu', chapter: 3 }, true)).toEqual({});
    expect(closeChapter({ mimikyu: 1 }, null, true)).toEqual({ mimikyu: 1 });
  });

  it('only known lines with a whole count survive, capped at three', () => {
    expect(sanitizeStory({ mimikyu: 2, zorua: 9, abra: 0, nobody: 2, cubone: 1.5, litwick: '3' })).toEqual({ mimikyu: 2, zorua: 3 });
    expect(sanitizeStory('nope')).toBeNull();
    expect(sanitizeStory([1, 2])).toBeNull();
    expect(sanitizeStory(JSON.parse('{"__proto__":{"mimikyu":3}}'))).toBeNull();
  });

  it('a fragment lies in the room farthest from where the player stands', () => {
    const rooms = [
      { x: 1, y: 1, width: 4, height: 4 },
      { x: 20, y: 10, width: 6, height: 4 },
      { x: 8, y: 2, width: 3, height: 3 },
    ];
    expect(fragmentSpot(rooms, { x: 32, y: 32 })).toEqual({ x: 23 * 32, y: 12 * 32 });
    expect(fragmentSpot(undefined, { x: 0, y: 0 })).toBeNull();
  });
});

describe('Senda progress in the save', () => {
  it('round-trips through the stored save, and a won chapter shows its bond line', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 50 });
    expect(bondLine(loadSave(store), 'mimikyu')).toBeNull();
    expect(recordStory(store, { line: 'mimikyu', chapter: 1 }, true)).toBe(true);
    expect(recordStory(store, { line: 'mimikyu', chapter: 1 }, true)).toBe(false);
    expect(recordStory(store, { line: 'mimikyu', chapter: 2 }, false)).toBe(false);
    const save = loadSave(store);
    expect(save.story).toEqual({ mimikyu: 1 });
    expect(save.coins).toBe(50);
    expect(bondLine(save, 'mimikyu')).toEqual({ level: 1, key: storyKeys.bond('mimikyu', 1) });
    expect(parseSave(JSON.stringify(save)).story).toEqual({ mimikyu: 1 });
  });

  it('an old save reads with no Senda progress, and a hostile field is dropped', () => {
    expect(parseSave(JSON.stringify({ version: 4, coins: 3, upgrades: {} })).story).toBeUndefined();
    expect(parseSave(JSON.stringify({ version: 4, coins: 3, upgrades: {}, story: { mimikyu: -1, x: 2 } })).story).toBeUndefined();
  });

  it('a line without a Senda has no bond line', () => {
    const without = CHALLENGES.map((d) => d.challenge!.line).filter((line) => !STORY_QUESTS[line]);
    for (const line of without) expect(bondLine({ story: { [line]: 2 } }, line as ChallengeLine)).toBeNull();
  });
});
