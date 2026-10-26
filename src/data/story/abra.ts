import type { RoomDef } from '../rooms';
import type { StoryBoss, StoryQuest } from '../story-quests';
import { bossArena, fightsOf, type StoryBossDef } from './kit';
import type { SendaRoad } from './roads';

/**
 * Abra's Senda, La Senda del Sueño (docs/story-quests.md): it dreamed the
 * Eclipse a week before it came and teleported away instead of warning
 * anyone; it sleeps so as not to see. I sleep, II flee (the boy who woke up
 * as Kadabra, the dream told at last), III stay (it does not teleport,
 * though it could). Each chapter walks its own road with its own shadows: I
 * in the caves (Munna, who eats the sweet dreams; Drowzee, who smells the old
 * nightmare), II in the crypt (Mr. Mime's invisible walls; Hypno's pendulum
 * and the boy), III in the swamp (Musharna's endless sleep; Nihilego, what
 * fell from the torn sky into its dreams). Psychic moves would barely touch a
 * shadow that kept its Psychic type, so they are Ghost. Its wound, Alakazam
 * Desvelado, grows each chapter: awake for ever, a thousand spoons bending.
 * Texts: `story.abra.*`.
 */

export type AbraRoomId = 'abra-munna' | 'abra-drowzee' | 'abra-mr-mime' | 'abra-hypno' | 'abra-musharna' | 'wound-abra';
export type AbraBossId = 'abra-munna' | 'abra-drowzee' | 'abra-mr-mime' | 'abra-hypno' | 'abra-musharna' | 'abra-wound';

/** Its shadows and its wound (data/story/kit.ts; `hpScale` and the cards' `weights` per tier fitted so every card meets its kill margin, tests/sim/story-prove-abra.test.ts and tests/sim/wound-prove.test.ts). */
export const ABRA_BOSSES: readonly (StoryBossDef & { id: AbraBossId })[] = [
  { id: 'abra-munna', sprite: 'munna', types: ['ghost', 'fairy'], maxHp: 520, radius: 13, shots: { a: 'psychic', b: 'fairy' }, cards: ['bloom', 'fan', 'rain'], hpScale: [0.342, 0.313, 0.461, 0.489], weights: [[0.345, 0.655], [0.393, 0.607], [0.284, 0.352, 0.364], [0.25, 0.363, 0.387]], last: 'drop' },
  { id: 'abra-drowzee', sprite: 'drowzee', types: ['ghost'], maxHp: 560, radius: 14, shots: { a: 'psychic', b: 'normal' }, cards: ['drop', 'fan', 'bloom'], hpScale: [0.5, 0.6, 0.555, 0.551], weights: [[0.5, 0.5], [0.5, 0.5], [0.36, 0.287, 0.353], [0.423, 0.31, 0.266]] },
  { id: 'abra-mr-mime', sprite: 'mrMime', types: ['ghost', 'fairy'], maxHp: 560, radius: 14, shots: { a: 'psychic', b: 'fairy' }, cards: ['walls', 'fan', 'rain'], hpScale: [0.42, 0.472, 0.507, 0.458], weights: [[0.595, 0.405], [0.545, 0.455], [0.394, 0.211, 0.394], [0.367, 0.214, 0.419]] },
  { id: 'abra-hypno', sprite: 'hypno', types: ['ghost'], maxHp: 600, radius: 15, shots: { a: 'psychic', b: 'ghost' }, cards: ['blades', 'bloom', 'drop'], hpScale: [0.397, 0.318, 0.576, 0.7], weights: [[0.577, 0.423], [0.604, 0.396], [0.306, 0.347, 0.347], [0.333, 0.333, 0.333]], last: 'aimed' },
  { id: 'abra-musharna', sprite: 'musharna', types: ['ghost', 'fairy'], maxHp: 620, radius: 16, shots: { a: 'psychic', b: 'fairy' }, cards: ['bloom', 'rain', 'drop'], hpScale: [0.337, 0.206, 0.481, 0.31], weights: [[0.426, 0.574], [0.667, 0.333], [0.237, 0.347, 0.416], [0.331, 0.335, 0.335]], last: 'aimed' },
  { id: 'abra-wound', sprite: 'alakazam', types: ['psychic', 'fighting'], maxHp: 760, radius: 20, shots: { a: 'psychic', b: 'fighting' }, cards: ['fan', 'drop', 'bloom', 'rain'], hpScale: [0.475, 0.601, 0.654, 0.784], weights: [[0.474, 0.526], [0.388, 0.388, 0.224], [0.268, 0.268, 0.197, 0.268], [0.263, 0.27, 0.27, 0.197]], wound: true },
];

export const ABRA_FIGHTS = Object.fromEntries(ABRA_BOSSES.map((b) => [b.id, fightsOf(b)])) as Record<AbraBossId, ReturnType<typeof fightsOf>>;

const roomOf = (id: AbraBossId): AbraRoomId => (id === 'abra-wound' ? 'wound-abra' : id);

/** The arenas: one per shadow (a way on at the top) and the wound's. */
export const ABRA_ROOMS = Object.fromEntries(ABRA_BOSSES.map((b) => [roomOf(b.id), bossArena(roomOf(b.id), b.id, !b.wound)])) as Record<AbraRoomId, RoomDef>;

/** Each chapter's road (data/dungeons.ts): the dungeon whose look and music it borrows and its two mid-bosses. */
export const ABRA_ROADS: readonly [SendaRoad, SendaRoad, SendaRoad] = [
  { base: 'caves', mid: ['abra-munna', 'abra-drowzee'], wound: 'wound-abra' },
  { base: 'crypt', mid: ['abra-mr-mime', 'abra-hypno'], wound: 'wound-abra' },
  { base: 'swamp', mid: ['abra-musharna', 'rift-way'], wound: 'wound-abra' },
];

/** The road's bosses as the story sees them: two mid-bosses and the wound, each with its lines. */
const BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

export const ABRA_QUEST: StoryQuest = {
  line: 'abra',
  chapters: [
    {
      before: [{ scene: 'sleep', figure: { anim: 'Idle' } }, { scene: 'sleep', figure: { anim: 'Idle', vanish: true } }, { scene: 'pose', figure: { anim: 'Idle' } }],
      after: [{ scene: 'sleep', figure: { anim: 'Idle' } }, { scene: 'spoon' }, { scene: 'candle', figure: { anim: 'Idle', x: 0.4 } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'boy', figure: { anim: 'Idle', form: 'kadabra' } }, { scene: 'spoon', figure: { anim: 'Idle', form: 'kadabra', x: 0.36 } }, { scene: 'sleep', figure: { anim: 'Idle', form: 'kadabra', vanish: true } }, { scene: 'pose', figure: { anim: 'Idle', form: 'kadabra' } }],
      after: [{ scene: 'eclipse', figure: { anim: 'Idle', form: 'kadabra' } }, { scene: 'plaza' }, { scene: 'candle', figure: { anim: 'Idle', form: 'kadabra', x: 0.4 } }, { scene: 'candle', figure: { anim: 'Idle', form: 'kadabra', x: 0.4 } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'dark' }, { scene: 'sleep', figure: { anim: 'Idle', form: 'kadabra', vanish: true } }, { scene: 'pose', figure: { anim: 'Walk', form: 'kadabra' } }],
      after: [{ scene: 'spoon', figure: { anim: 'Hurt', form: 'kadabra', x: 0.36 } }, { scene: 'pose', figure: { anim: 'Idle', form: 'alakazam' } }, { scene: 'candle', figure: { anim: 'Idle', form: 'alakazam', x: 0.4 } }, { scene: 'phantump' }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
  ],
};
