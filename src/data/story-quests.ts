import type { ChallengeLine } from './dungeons';

/**
 * The Sendas (docs/story-quests.md): each line's challenge as a story in
 * three chapters, one per material tier (I Normal, II Hard, III Nightmare).
 * This table holds only the structure (which tableaux, which pose, which
 * floors hide a memory fragment, how many lines each boss says); every text
 * is an i18n key derived from it (`storyKeys`), so a new Senda is a table
 * entry plus its strings (and, for its last boss, a wound: data/wound-cards.ts).
 * A line absent here plays its challenge without a story.
 */
export type StoryScene = 'rag' | 'candle' | 'plaza' | 'eclipse' | 'dark' | 'phantump' | 'pose';

/** The line's own sprite on a tableau, in one pose (Mimikyu's busted form for a broken disguise). */
export interface StoryFigure {
  anim: 'Idle' | 'Walk' | 'Hurt' | 'Faint' | 'Hop';
  busted?: boolean;
  /** Where it stands on the stage (0..1 across; centre by default). */
  x?: number;
}

/** One tableau of a story cinematic: its scene, the figure on it (none: the scene alone) and a line of text. */
export interface StoryBeat {
  scene: StoryScene;
  figure?: StoryFigure;
}

/** The moments the Pokémon's inner voice speaks during the run (one line each). */
export type StoryTrigger = 'arrive' | 'mid' | 'lowHp';
export const STORY_TRIGGERS: readonly StoryTrigger[] = ['arrive', 'mid', 'lowHp'];

/** The share of HP under which the low-HP line is said (once per run). */
export const STORY_LOW_HP = 0.35;
/** The floor whose arrival says the mid-run line (after the first mid-boss of a Senda's seven floors). */
export const STORY_MID_FLOOR = 4;

/** What one boss of a chapter says: its epithet on the name card, lines before the fight and after it falls. */
export interface StoryBoss {
  /** The floor of the challenge plan it guards (a room floor). */
  floor: number;
  pre: number;
  post: number;
}

export interface StoryChapter {
  before: readonly StoryBeat[];
  after: readonly StoryBeat[];
  /** Generated floors that hide a memory fragment, one each, in order. */
  fragments: readonly number[];
  /** Every boss of the chapter (the mid-bosses and the wound), by floor. */
  bosses: readonly StoryBoss[];
}

export interface StoryQuest {
  line: ChallengeLine;
  chapters: readonly [StoryChapter, StoryChapter, StoryChapter];
}

export type ChapterNumber = 1 | 2 | 3;
export const CHAPTERS: readonly ChapterNumber[] = [1, 2, 3];

/** Pose shorthands. */
const idle: StoryFigure = { anim: 'Idle' };
const atCandle = (busted = false): StoryFigure => ({ anim: 'Idle', x: 0.4, ...(busted ? { busted } : {}) });

/** The bosses of a Senda's seven floors (data/dungeons.ts `sendaPlan`): two mid-bosses and the wound, each with its lines. */
const SENDA_BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

export const STORY_QUESTS: Partial<Record<ChallengeLine, StoryQuest>> = {
  mimikyu: {
    line: 'mimikyu',
    chapters: [
      {
        before: [{ scene: 'rag' }, { scene: 'pose', figure: idle }, { scene: 'candle', figure: atCandle() }],
        after: [{ scene: 'pose', figure: { anim: 'Hurt', busted: true } }, { scene: 'candle', figure: atCandle(true) }, { scene: 'candle', figure: atCandle(true) }],
        fragments: [2, 5],
        bosses: SENDA_BOSSES,
      },
      {
        before: [{ scene: 'plaza' }, { scene: 'plaza', figure: { anim: 'Hop' } }, { scene: 'dark', figure: { anim: 'Hurt', busted: true } }, { scene: 'candle', figure: atCandle() }],
        after: [{ scene: 'candle', figure: atCandle(true) }, { scene: 'candle', figure: atCandle(true) }, { scene: 'rag', figure: idle }],
        fragments: [2, 5],
        bosses: SENDA_BOSSES,
      },
      {
        before: [{ scene: 'eclipse' }, { scene: 'pose', figure: { anim: 'Walk' } }, { scene: 'dark', figure: idle }],
        after: [{ scene: 'pose', figure: { anim: 'Faint', busted: true } }, { scene: 'dark' }, { scene: 'candle', figure: atCandle() }, { scene: 'phantump' }],
        fragments: [2, 5],
        bosses: SENDA_BOSSES,
      },
    ],
  },
};

/** The Senda of a line, if it has one. */
export const storyOf = (line: ChallengeLine): StoryQuest | null => STORY_QUESTS[line] ?? null;

/** A chapter of a Senda (1-based). */
export const chapterOf = (quest: StoryQuest, chapter: ChapterNumber): StoryChapter => quest.chapters[chapter - 1]!;

/** The i18n keys of a chapter's parts (and the line's own ones). */
export const storyKeys = {
  title: (line: ChallengeLine) => `story.${line}.title`,
  /** Phantump's word once the third chapter is closed (his window). */
  phantump: (line: ChallengeLine) => `story.${line}.phantump`,
  chapterTitle: (line: ChallengeLine, ch: ChapterNumber) => `story.${line}.${ch}.title`,
  before: (line: ChallengeLine, ch: ChapterNumber, beat: number) => `story.${line}.${ch}.before.${beat + 1}`,
  after: (line: ChallengeLine, ch: ChapterNumber, beat: number) => `story.${line}.${ch}.after.${beat + 1}`,
  voice: (line: ChallengeLine, ch: ChapterNumber, trigger: StoryTrigger) => `story.${line}.${ch}.voice.${trigger}`,
  fragmentName: (line: ChallengeLine, ch: ChapterNumber, index: number) => `story.${line}.${ch}.fragment.${index + 1}.name`,
  fragmentText: (line: ChallengeLine, ch: ChapterNumber, index: number) => `story.${line}.${ch}.fragment.${index + 1}.text`,
  bossTitle: (line: ChallengeLine, ch: ChapterNumber, floor: number) => `story.${line}.${ch}.boss.${floor}.title`,
  bossPre: (line: ChallengeLine, ch: ChapterNumber, floor: number, n: number) => `story.${line}.${ch}.boss.${floor}.pre.${n + 1}`,
  bossPost: (line: ChallengeLine, ch: ChapterNumber, floor: number, n: number) => `story.${line}.${ch}.boss.${floor}.post.${n + 1}`,
  bond: (line: ChallengeLine, ch: ChapterNumber) => `story.${line}.${ch}.bond`,
};

/** Every i18n key a Senda needs (the completeness test checks each exists in every language). */
export function storyKeyList(quest: StoryQuest): string[] {
  const { line } = quest;
  const keys = [storyKeys.title(line), storyKeys.phantump(line)];
  for (const ch of CHAPTERS) {
    const c = chapterOf(quest, ch);
    keys.push(storyKeys.chapterTitle(line, ch), storyKeys.bond(line, ch));
    c.before.forEach((_, i) => keys.push(storyKeys.before(line, ch, i)));
    c.after.forEach((_, i) => keys.push(storyKeys.after(line, ch, i)));
    for (const trigger of STORY_TRIGGERS) keys.push(storyKeys.voice(line, ch, trigger));
    c.fragments.forEach((_, i) => keys.push(storyKeys.fragmentName(line, ch, i), storyKeys.fragmentText(line, ch, i)));
    for (const boss of c.bosses) {
      keys.push(storyKeys.bossTitle(line, ch, boss.floor));
      for (let i = 0; i < boss.pre; i++) keys.push(storyKeys.bossPre(line, ch, boss.floor, i));
      for (let i = 0; i < boss.post; i++) keys.push(storyKeys.bossPost(line, ch, boss.floor, i));
    }
  }
  return keys;
}

/** A Senda's last boss: the line's own Pokémon as its wound (data/wound-cards.ts), drawn huge and corrupted. */
export const isWound = (species: string): boolean => species.endsWith('-wound');
/** How much bigger a wound is drawn than its sheet. */
export const WOUND_SCALE = 1.7;
