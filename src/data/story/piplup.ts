import type { RoomDef } from '../rooms';
import type { StoryBoss, StoryQuest } from '../story-quests';
import { bossArena, fightsOf, type StoryBossDef } from './kit';
import type { SendaRoad } from './roads';

/**
 * Piplup's Senda, La Senda del Lago Helado (docs/story-quests.md): too
 * proud to take a berry from anyone; it tried to cross the frozen lake alone,
 * fell through, and the old Empoleon of the lake pulled it out and left a
 * berry by it. It never ate it. After the Eclipse she went under the black
 * ice to look for the sky and did not come up. I refuses help, II the thin
 * ice (it was afraid), III asks for a hand. Each chapter walks its own road
 * with its own shadows: I in the crypt (Glalie, the face that never cries;
 * Weavile, who steals what shines), II in the caves (Mamoswine, the weight on
 * the ice; Lanturn's shadow, the gleam under it that called), III in the
 * misty forest by the lake (Froslass, who keeps the drowned; Lapras, the sea
 * that carries others). Its wound, Empoleon de Hielo Negro, grows each
 * chapter: a king of nothing whom nobody may touch. Texts: `story.piplup.*`.
 */

export type PiplupRoomId = 'piplup-glalie' | 'piplup-weavile' | 'piplup-mamoswine' | 'piplup-lanturn' | 'piplup-froslass' | 'piplup-lapras' | 'wound-piplup';
export type PiplupBossId = 'piplup-glalie' | 'piplup-weavile' | 'piplup-mamoswine' | 'piplup-lanturn' | 'piplup-froslass' | 'piplup-lapras' | 'piplup-wound';

/** Its shadows and its wound (data/story/kit.ts; `hpScale` and the cards' `weights` per tier fitted so every card meets its kill margin, tests/sim/story-prove-piplup.test.ts and tests/sim/wound-prove.test.ts). */
export const PIPLUP_BOSSES: readonly (StoryBossDef & { id: PiplupBossId })[] = [
  { id: 'piplup-glalie', sprite: 'glalie', types: ['ice'], maxHp: 560, radius: 15, shots: { a: 'ice', b: 'normal' }, cards: ['walls', 'fan', 'drop'], hpScale: [0.491, 0.44, 0.527, 0.596], weights: [[0.509, 0.491], [0.466, 0.534], [0.379, 0.242, 0.379], [0.369, 0.239, 0.392]], last: 'drop' },
  { id: 'piplup-weavile', sprite: 'weavile', types: ['dark', 'ice'], maxHp: 540, radius: 14, shots: { a: 'dark', b: 'ice' }, cards: ['fan', 'drop', 'rain'], hpScale: [0.5, 0.6, 0.566, 0.651], weights: [[0.5, 0.5], [0.5, 0.5], [0.293, 0.354, 0.354], [0.282, 0.359, 0.359]] },
  { id: 'piplup-mamoswine', sprite: 'mamoswine', types: ['ice', 'ground'], maxHp: 640, radius: 18, shots: { a: 'ice', b: 'ground' }, cards: ['walls', 'drop', 'blades'], hpScale: [0.481, 0.488, 0.552, 0.633], weights: [[0.48, 0.52], [0.385, 0.615], [0.363, 0.363, 0.275], [0.369, 0.369, 0.262]] },
  { id: 'piplup-lanturn', sprite: 'lanturn', types: ['ghost', 'electric'], maxHp: 560, radius: 15, shots: { a: 'water', b: 'electric' }, cards: ['bloom', 'fan', 'moon'], hpScale: [0.5, 0.525, 0.6, 0.7], weights: [[0.5, 0.5], [0.428, 0.572], [0.333, 0.333, 0.333], [0.333, 0.333, 0.333]] },
  { id: 'piplup-froslass', sprite: 'froslass', types: ['ice', 'ghost'], maxHp: 560, radius: 14, shots: { a: 'ice', b: 'ghost' }, cards: ['bloom', 'rain', 'drop'], hpScale: [0.337, 0.446, 0.561, 0.56], weights: [[0.259, 0.741], [0.327, 0.673], [0.287, 0.357, 0.357], [0.211, 0.394, 0.394]] },
  { id: 'piplup-lapras', sprite: 'lapras', types: ['water', 'ice'], maxHp: 660, radius: 18, shots: { a: 'water', b: 'ice' }, cards: ['moon', 'bloom', 'fan'], hpScale: [0.4, 0.42, 0.6, 0.609], weights: [[0.625, 0.375], [0.714, 0.286], [0.333, 0.333, 0.333], [0.383, 0.234, 0.383]] },
  { id: 'piplup-wound', sprite: 'empoleon', types: ['ice', 'steel'], maxHp: 760, radius: 20, shots: { a: 'ice', b: 'water' }, cards: ['fan', 'walls', 'bloom', 'rain'], hpScale: [0.43, 0.601, 0.654, 0.76], weights: [[0.523, 0.477], [0.388, 0.388, 0.224], [0.268, 0.268, 0.197, 0.268], [0.272, 0.245, 0.28, 0.204]], wound: true },
];

export const PIPLUP_FIGHTS = Object.fromEntries(PIPLUP_BOSSES.map((b) => [b.id, fightsOf(b)])) as Record<PiplupBossId, ReturnType<typeof fightsOf>>;

const roomOf = (id: PiplupBossId): PiplupRoomId => (id === 'piplup-wound' ? 'wound-piplup' : id);

/** The arenas: one per shadow (a way on at the top) and the wound's. */
export const PIPLUP_ROOMS = Object.fromEntries(PIPLUP_BOSSES.map((b) => [roomOf(b.id), bossArena(roomOf(b.id), b.id, !b.wound)])) as Record<PiplupRoomId, RoomDef>;

/** Each chapter's road (data/dungeons.ts): the dungeon whose look and music it borrows and its two mid-bosses. */
export const PIPLUP_ROADS: readonly [SendaRoad, SendaRoad, SendaRoad] = [
  { base: 'crypt', mid: ['piplup-glalie', 'piplup-weavile'], wound: 'wound-piplup' },
  { base: 'caves', mid: ['piplup-mamoswine', 'piplup-lanturn'], wound: 'wound-piplup' },
  { base: 'forest', mid: ['piplup-froslass', 'piplup-lapras'], wound: 'wound-piplup' },
];

/** The road's bosses as the story sees them: two mid-bosses and the wound, each with its lines. */
const BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

export const PIPLUP_QUEST: StoryQuest = {
  line: 'piplup',
  chapters: [
    {
      before: [{ scene: 'ice', figure: { anim: 'Idle' } }, { scene: 'pose', figure: { anim: 'Walk' } }, { scene: 'sea', figure: { anim: 'Idle', back: true } }],
      after: [{ scene: 'ice', figure: { anim: 'Hurt' } }, { scene: 'ice', figure: { anim: 'Idle' } }, { scene: 'candle', figure: { anim: 'Idle', x: 0.4 } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'sea' }, { scene: 'ice', figure: { anim: 'Walk' } }, { scene: 'underice' }, { scene: 'pose', figure: { anim: 'Idle', form: 'prinplup' } }],
      after: [{ scene: 'underice', figure: { anim: 'Hurt' } }, { scene: 'sea', figure: { anim: 'Idle', form: 'empoleon', back: true } }, { scene: 'candle', figure: { anim: 'Idle', form: 'prinplup', x: 0.4 } }, { scene: 'candle', figure: { anim: 'Idle', form: 'prinplup', x: 0.4 } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'sea', figure: { anim: 'Walk', form: 'empoleon', back: true } }, { scene: 'ice', figure: { anim: 'Idle', form: 'prinplup' } }, { scene: 'pose', figure: { anim: 'Idle', form: 'prinplup' } }],
      after: [{ scene: 'underice', figure: { anim: 'Hurt', form: 'prinplup' } }, { scene: 'underice', figure: { anim: 'Idle', form: 'prinplup' } }, { scene: 'sea', figure: { anim: 'Idle', form: 'empoleon' } }, { scene: 'phantump' }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
  ],
};
