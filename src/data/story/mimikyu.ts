import type { RoomDef } from '../rooms';
import type { StoryBoss, StoryFigure, StoryQuest } from '../story-quests';
import { bossArena, fightsOf, type StoryBossDef } from './kit';
import type { SendaRoad } from './roads';

/**
 * Mimikyu's Senda, La Senda del Disfraz (docs/story-quests.md, the pilot):
 * the lonely one under a rag sewn in the shape of the Pokémon everyone loves,
 * so it would be loved too; it mends its broken neck at night before a
 * mirror, and whoever looks under the rag falls ill. Before the Eclipse it
 * went to the plaza every afternoon, until a gust lifted the rag and a little
 * one looked. Each chapter walks its own road with its own shadows: I in the
 * sunless crypt (Ditto, a shape with no face of its own; Noctowl, the wise
 * eyes that see in the dark and looked under the rag), II on the overgrown
 * way to the old plaza (Jigglypuff, the song nobody stayed to hear;
 * Pikachu, the one everybody hugs), III in the deep caves (Polteageist, a
 * cracked cup that hides the mark under it; Hatterene, who cannot bear what
 * others feel). Its wound, Mimikyu Sin Disfraz, grows each chapter: what
 * Mimikyu would be if it chose the grudge, a black arm too long that
 * remembers every name. Texts: `story.mimikyu.*`.
 */

export type MimikyuRoomId = 'wound-mimikyu' | 'mimikyu-ditto' | 'mimikyu-noctowl' | 'mimikyu-jigglypuff' | 'mimikyu-pikachu' | 'mimikyu-polteageist' | 'mimikyu-hatterene';
export type MimikyuBossId = 'mimikyu-wound' | 'mimikyu-ditto' | 'mimikyu-noctowl' | 'mimikyu-jigglypuff' | 'mimikyu-pikachu' | 'mimikyu-polteageist' | 'mimikyu-hatterene';

/**
 * Its shadows (data/story/kit.ts; `hpScale` per tier tuned so every card
 * meets its kill margin, tests/sim/story-prove-<line>.test.ts; `weights` give
 * a slow bloom card a smaller segment). Ghost and Fairy reach each at least
 * neutrally: a shadow of a Normal Pokémon (Ditto, Jigglypuff) is Ghost
 * instead (Fairy would turn a Dark hit aside), Noctowl trades its wings
 * (Flying) for Ghost. None throws Normal, Fighting or Dragon at a line those
 * cannot touch.
 */
export const MIMIKYU_BOSSES: readonly (StoryBossDef & { id: MimikyuBossId })[] = [
  { id: 'mimikyu-ditto', sprite: 'ditto', types: ['ghost'], maxHp: 520, radius: 14, shots: { a: 'ghost', b: 'fairy' }, cards: ['fan', 'drop', 'rain'], hpScale: [0.5, 0.6, 0.48, 0.52] },
  { id: 'mimikyu-noctowl', sprite: 'noctowl', types: ['psychic', 'ghost'], maxHp: 520, radius: 15, shots: { a: 'psychic', b: 'ghost' }, cards: ['moon', 'fan', 'drop'], hpScale: [0.5, 0.6, 0.6, 0.65] },
  { id: 'mimikyu-jigglypuff', sprite: 'jigglypuff', types: ['ghost'], maxHp: 520, radius: 14, shots: { a: 'fairy', b: 'psychic' }, cards: ['fan', 'walls', 'bloom'], hpScale: [0.5, 0.6, 0.48, 0.5], weights: [[1, 1], [1, 1], [0.75, 1, 0.6], [0.8, 1, 0.5]] },
  { id: 'mimikyu-pikachu', sprite: 'pikachu', types: ['electric', 'ghost'], maxHp: 520, radius: 14, shots: { a: 'electric', b: 'steel' }, cards: ['rain', 'fan', 'drop'], hpScale: [0.5, 0.6, 0.6, 0.7] },
  { id: 'mimikyu-polteageist', sprite: 'polteageist', types: ['ghost'], maxHp: 520, radius: 14, shots: { a: 'ghost', b: 'water' }, cards: ['walls', 'moon', 'bloom'], hpScale: [0.5, 0.6, 0.6, 0.65], weights: [[1, 1], [1, 1], [1, 1, 0.8], [1, 1, 0.5]] },
  { id: 'mimikyu-hatterene', sprite: 'hatterene', types: ['psychic', 'fairy'], maxHp: 520, radius: 16, shots: { a: 'psychic', b: 'fairy' }, cards: ['walls', 'moon', 'bloom'], hpScale: [0.5, 0.6, 0.6, 0.7] },
  // The wound: Mimikyu Sin Disfraz (Ghost and Fairy), the busted sheet huge and corrupted: claws that tear the seam, a fall where nobody looks, what is under the rag (its phase 2), a hug that hurts.
  { id: 'mimikyu-wound', sprite: 'mimikyuBusted', types: ['ghost', 'fairy'], maxHp: 760, radius: 20, shots: { a: 'ghost', b: 'fairy' }, cards: ['fan', 'drop', 'bloom', 'rain'], hpScale: [0.5, 0.7, 0.7, 0.8], weights: [[1, 1], [0.38, 0.4, 0.22], [0.27, 0.24, 0.21, 0.24], [1, 1, 1, 0.8]], wound: true },
];

export const MIMIKYU_FIGHTS = Object.fromEntries(MIMIKYU_BOSSES.map((b) => [b.id, fightsOf(b)])) as Record<MimikyuBossId, ReturnType<typeof fightsOf>>;

const roomOf = (id: MimikyuBossId): MimikyuRoomId => (id === 'mimikyu-wound' ? 'wound-mimikyu' : id);

/** The arenas: one per shadow (a way on at the top) and the wound's, a room with no name that smells of old cloth and rain. */
export const MIMIKYU_ROOMS = Object.fromEntries(MIMIKYU_BOSSES.map((b) => [roomOf(b.id), bossArena(roomOf(b.id), b.id, !b.wound)])) as Record<MimikyuRoomId, RoomDef>;

/** Each chapter's road (data/dungeons.ts): the dungeon whose look and music it borrows and its two shadows. */
export const MIMIKYU_ROADS: readonly [SendaRoad, SendaRoad, SendaRoad] = [
  { base: 'crypt', mid: ['mimikyu-ditto', 'mimikyu-noctowl'], wound: 'wound-mimikyu' },
  { base: 'forest', mid: ['mimikyu-jigglypuff', 'mimikyu-pikachu'], wound: 'wound-mimikyu' },
  { base: 'caves', mid: ['mimikyu-polteageist', 'mimikyu-hatterene'], wound: 'wound-mimikyu' },
];

/** The road's bosses as the story sees them: two shadows and the wound, each with its lines. */
const BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

/** Pose shorthands. */
const idle: StoryFigure = { anim: 'Idle' };
const atCandle = (busted = false): StoryFigure => ({ anim: 'Idle', x: 0.4, ...(busted ? { busted } : {}) });

export const MIMIKYU_QUEST: StoryQuest = {
  line: 'mimikyu',
  chapters: [
    {
      before: [{ scene: 'rag' }, { scene: 'pose', figure: idle }, { scene: 'candle', figure: atCandle() }],
      after: [{ scene: 'pose', figure: { anim: 'Hurt', busted: true } }, { scene: 'candle', figure: atCandle(true) }, { scene: 'candle', figure: atCandle(true) }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'plaza' }, { scene: 'plaza', figure: { anim: 'Hop' } }, { scene: 'dark', figure: { anim: 'Hurt', busted: true } }, { scene: 'candle', figure: atCandle() }],
      after: [{ scene: 'candle', figure: atCandle(true) }, { scene: 'candle', figure: atCandle(true) }, { scene: 'rag', figure: idle }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'eclipse' }, { scene: 'pose', figure: { anim: 'Walk' } }, { scene: 'dark', figure: idle }],
      after: [{ scene: 'pose', figure: { anim: 'Faint', busted: true } }, { scene: 'dark' }, { scene: 'candle', figure: atCandle() }, { scene: 'phantump' }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
  ],
};
