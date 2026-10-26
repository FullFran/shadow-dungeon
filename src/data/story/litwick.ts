import type { RoomDef } from '../rooms';
import type { StoryBoss, StoryQuest } from '../story-quests';
import { bossArena, fightsOf, type StoryBossDef } from './kit';
import type { SendaRoad } from './roads';

/**
 * Litwick's Senda, La Senda de la Llama (docs/story-quests.md): the candle
 * that guides the lost to the shore and eats a little of them on the way.
 * Before the Eclipse it led a lost child home from the caves by the hand;
 * the child got home cold and never warmed again, and since then Litwick
 * lights every lamp of the empty big house each night. It fears being a small
 * piece of what drank the sun. Each chapter walks its own road with its own
 * shadows: I in the flooded caves (Drifblim, who takes children by the hand;
 * Lanturn, the other light), II in the big house (Banette, the doll nobody
 * picked up; Mismagius, who sings in the corridor), III under the torn sky
 * (Muk, who eats whatever it touches; Nihilego, the closest thing to what
 * drank the sun). Its wound, Chandelure de Llamas Ajenas, grows each chapter:
 * a chandelier lit with every soul Litwick could have burned. Texts:
 * `story.litwick.*`.
 */

export type LitwickRoomId = 'wound-litwick' | 'litwick-drifblim' | 'litwick-banette' | 'litwick-mismagius' | 'litwick-muk';
export type LitwickBossId = 'litwick-wound' | 'litwick-drifblim' | 'litwick-banette' | 'litwick-mismagius' | 'litwick-muk';

/** Its shadows (data/story/kit.ts; `hpScale` per tier tuned so every card meets its kill margin, tests/sim/story-prove-<line>.test.ts). Flash Fire drinks real fire, so the souls' flames are Ghost. */
export const LITWICK_BOSSES: readonly (StoryBossDef & { id: LitwickBossId })[] = [
  { id: 'litwick-drifblim', sprite: 'drifblim', types: ['ghost', 'flying'], maxHp: 520, radius: 16, shots: { a: 'ghost', b: 'flying' }, cards: ['drop', 'fan', 'rain'], hpScale: [0.5, 0.6, 0.6, 0.7] },
  { id: 'litwick-banette', sprite: 'banette', types: ['ghost'], maxHp: 520, radius: 14, shots: { a: 'ghost', b: 'dark' }, cards: ['fan', 'moon', 'walls'], hpScale: [0.48, 0.6, 0.45, 0.5] },
  { id: 'litwick-mismagius', sprite: 'mismagius', types: ['ghost'], maxHp: 520, radius: 14, shots: { a: 'ghost', b: 'fairy' }, cards: ['fan', 'moon', 'bloom'], hpScale: [0.5, 0.6, 0.58, 0.55] },
  { id: 'litwick-muk', sprite: 'muk', types: ['poison', 'ghost'], maxHp: 520, radius: 16, shots: { a: 'poison', b: 'ghost' }, cards: ['walls', 'drop', 'rain'], hpScale: [0.5, 0.6, 0.6, 0.7] },
  // The wound: a huge chandelier of borrowed flames (Ghost and Fire), every shot a soul: a lure, a child's hand, a bloom of names, wax that rises.
  { id: 'litwick-wound', sprite: 'chandelure', types: ['ghost', 'fire'], maxHp: 760, radius: 20, shots: { a: 'ghost', b: 'ghost' }, cards: ['drop', 'moon', 'bloom', 'rain'], hpScale: [0.5, 0.7, 0.7, 0.85], wound: true },
];

export const LITWICK_FIGHTS = Object.fromEntries(LITWICK_BOSSES.map((b) => [b.id, fightsOf(b)])) as Record<LitwickBossId, ReturnType<typeof fightsOf>>;

const roomOf = (id: LitwickBossId): LitwickRoomId => (id === 'litwick-wound' ? 'wound-litwick' : id);

/** The arenas: one per new shadow (a way on at the top) and the wound's, the big house's dining hall. */
export const LITWICK_ROOMS = Object.fromEntries(LITWICK_BOSSES.map((b) => [roomOf(b.id), bossArena(roomOf(b.id), b.id, !b.wound)])) as Record<LitwickRoomId, RoomDef>;

/** Each chapter's road: Lanturn keeps its grotto and Nihilego its rift (with a way on), the two old lights of the story. */
export const LITWICK_ROADS: readonly [SendaRoad, SendaRoad, SendaRoad] = [
  { base: 'caves', mid: ['litwick-drifblim', 'grotto'], wound: 'wound-litwick' },
  { base: 'crypt', mid: ['litwick-banette', 'litwick-mismagius'], wound: 'wound-litwick' },
  { base: 'swamp', mid: ['litwick-muk', 'rift-way'], wound: 'wound-litwick' },
];

/** The road's bosses as the story sees them: two shadows and the wound, each with its lines. */
const BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

/** Litwick beside a light (the candle scene draws its flame to the right). */
const atCandle = { anim: 'Idle', x: 0.4 } as const;

export const LITWICK_QUEST: StoryQuest = {
  line: 'litwick',
  chapters: [
    {
      before: [{ scene: 'corridor' }, { scene: 'candle', figure: atCandle }, { scene: 'pose', figure: { anim: 'Idle' } }],
      after: [{ scene: 'candle', figure: atCandle }, { scene: 'candle', figure: { anim: 'Hurt', x: 0.4 } }, { scene: 'pose', figure: { anim: 'Idle' } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'corridor' }, { scene: 'hand' }, { scene: 'hand', figure: { anim: 'Walk' } }, { scene: 'chandeliers' }],
      after: [{ scene: 'chandeliers' }, { scene: 'hand', figure: { anim: 'Idle' } }, { scene: 'dark', figure: { anim: 'Idle' } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'dark' }, { scene: 'candle', figure: atCandle }, { scene: 'pose', figure: { anim: 'Walk' } }],
      after: [{ scene: 'dark', figure: { anim: 'Hurt' } }, { scene: 'chandeliers', figure: { anim: 'Idle', form: 'chandelure' } }, { scene: 'pose', figure: { anim: 'Idle', form: 'chandelure' } }, { scene: 'phantump' }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
  ],
};
