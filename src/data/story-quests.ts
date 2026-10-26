import type { ChallengeLine } from './dungeons';
import type { Difficulty } from './difficulty';
import type { SpeciesId } from './species';
import { MIMIKYU_QUEST } from './story/mimikyu';
import { CUBONE_QUEST } from './story/cubone';
import { LITWICK_QUEST } from './story/litwick';
import { ZORUA_QUEST } from './story/zorua';
import { ABRA_QUEST } from './story/abra';
import { PIPLUP_QUEST } from './story/piplup';
import { SHINX_QUEST } from './story/shinx';
import { AXEW_QUEST } from './story/axew';

/**
 * The Sendas (docs/story-quests.md): each line's challenge as a story in
 * three chapters, one per material tier (I Normal, II Hard, III Nightmare).
 * This table holds only the structure (which tableaux, which pose, which
 * floors hide a memory fragment, how many lines each boss says); every text
 * is an i18n key derived from it (`storyKeys`), so a new Senda is a table
 * entry plus its strings (its bosses, wound and roads: data/story/<line>.ts).
 * A line absent here plays its challenge without a story.
 */
export type StoryScene =
  | 'rag'
  | 'candle'
  | 'plaza'
  | 'eclipse'
  | 'dark'
  | 'phantump'
  | 'pose'
  // Cubone's (adapters/story/cubone-scenes.ts): the full moon, the black lake's dock, the roofless tower, the grave mounds.
  | 'moon'
  | 'dock'
  | 'tower'
  | 'graves'
  // Litwick's (adapters/story/litwick-scenes.ts): the big house's corridor, its hall of chandeliers, a child's hand reaching for a light.
  | 'corridor'
  | 'chandeliers'
  | 'hand'
  // Zorua's (adapters/story/zorua-scenes.ts): the village fountain with a fox's reflection, the forest path that loops, the grudge's white fog.
  | 'fountain'
  | 'loop'
  | 'fog'
  // Abra's (adapters/story/abra-scenes.ts): the moss bed where it sleeps, a bent spoon in a cone of light, the boy who woke up as Kadabra.
  | 'sleep'
  | 'spoon'
  | 'boy'
  // Piplup's (adapters/story/piplup-scenes.ts): the ice shelf with a refused berry, the dusk sea, the dark water under the ice.
  | 'ice'
  | 'sea'
  | 'underice'
  // Shinx's (adapters/story/shinx-scenes.ts): golden eyes in a dark cave, the pack at the storm's edge, a shape seen through a wall.
  | 'cave'
  | 'storm'
  | 'wall'
  // Axew's (adapters/story/axew-scenes.ts): a tusk regrowing through a crack of light, the old clawed tree, the burning sky.
  | 'crack'
  | 'tree'
  | 'burning';

/** The line's own sprite on a tableau, in one pose (Mimikyu's busted form for a broken disguise). */
export interface StoryFigure {
  anim: 'Idle' | 'Walk' | 'Hurt' | 'Faint' | 'Hop';
  busted?: boolean;
  /** Where it stands on the stage (0..1 across; centre by default). */
  x?: number;
  /** A later form of the line in its place (the last chapter's evolution). */
  form?: SpeciesId;
  /** Seen from behind (facing away, towards the sea or the storm). */
  back?: true;
  /** Fades out and back in with a shimmer, as a sleeper that teleports away. */
  vanish?: true;
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

export const STORY_QUESTS: Partial<Record<ChallengeLine, StoryQuest>> = {
  // The pilot's Senda (data/story/mimikyu.ts).
  mimikyu: MIMIKYU_QUEST,
  // The starters' Sendas (data/story/<line>.ts): each line's structure, wound and arena in its own file.
  cubone: CUBONE_QUEST,
  litwick: LITWICK_QUEST,
  zorua: ZORUA_QUEST,
  // The gacha lines' Sendas (data/story/<line>.ts).
  abra: ABRA_QUEST,
  piplup: PIPLUP_QUEST,
  shinx: SHINX_QUEST,
  axew: AXEW_QUEST,
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

/** A Senda's last boss: the line's own Pokémon as its wound (data/story/<line>.ts), drawn huge and corrupted. */
export const isWound = (species: string): boolean => species.endsWith('-wound');
/** How much bigger a wound is drawn than its sheet: it grows chapter by chapter (owner 2026-10-26), a lesser form on chapter I's tier, the whole of it on chapter III's. */
export const woundScale = (difficulty: Difficulty): number => ({ easy: 1.7, normal: 1.7, hard: 1.95, nightmare: 2.2 })[difficulty];
