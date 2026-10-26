import type { RoomDef } from '../rooms';
import type { StoryBoss, StoryQuest } from '../story-quests';
import { bossArena, fightsOf, type StoryBossDef } from './kit';
import type { SendaRoad } from './roads';

/**
 * Shinx's Senda, La Senda de la Tormenta (docs/story-quests.md): born the
 * night of the Eclipse in a storm, it has never seen the sun; its sparks are
 * its only light and seem very small. Its mother, the pack's Luxray, went to
 * find everyone lost in the dark with her eyes open day and night, and never
 * came back. I spark, II the thunder that frightened her, III seeing in the
 * dark and learning to close its eyes. Each chapter walks its own road with
 * its own shadows: I in the swamp's storm (Ampharos, a lighthouse with no
 * sea; Manectric, who laughs at small sparks), II in the caves (Absol, who
 * warns and is blamed; Electivire, the thunder that frightens), III in the
 * crypt's dark (Umbreon, a light without sun; Nihilego, what fell the night
 * it was born). An Electric shadow would shrug Shinx's sparks off, so they
 * are Ghost. Its wound, Luxray Sin Párpados, grows each chapter: eyes that
 * see everything and cannot close. Texts: `story.shinx.*`.
 */

export type ShinxRoomId = 'shinx-ampharos' | 'shinx-manectric' | 'shinx-absol' | 'shinx-electivire' | 'shinx-umbreon' | 'wound-shinx';
export type ShinxBossId = 'shinx-ampharos' | 'shinx-manectric' | 'shinx-absol' | 'shinx-electivire' | 'shinx-umbreon' | 'shinx-wound';

/** Its shadows and its wound (data/story/kit.ts; `hpScale` and the cards' `weights` per tier fitted so every card meets its kill margin, tests/sim/story-prove-shinx.test.ts and tests/sim/wound-prove.test.ts). */
export const SHINX_BOSSES: readonly (StoryBossDef & { id: ShinxBossId })[] = [
  { id: 'shinx-ampharos', sprite: 'ampharos', types: ['ghost'], maxHp: 580, radius: 15, shots: { a: 'electric', b: 'dragon' }, cards: ['bloom', 'fan', 'drop'], hpScale: [0.393, 0.372, 0.533, 0.406], weights: [[0.363, 0.637], [0.288, 0.712], [0.356, 0.269, 0.375], [0.352, 0.264, 0.384]] },
  { id: 'shinx-manectric', sprite: 'manectric', types: ['ghost', 'fire'], maxHp: 560, radius: 15, shots: { a: 'electric', b: 'fire' }, cards: ['fan', 'rain', 'drop'], hpScale: [0.5, 0.6, 0.6, 0.7], weights: [[0.5, 0.5], [0.5, 0.5], [0.333, 0.333, 0.333], [0.333, 0.333, 0.333]] },
  { id: 'shinx-absol', sprite: 'absol', types: ['dark'], maxHp: 580, radius: 15, shots: { a: 'dark', b: 'psychic' }, cards: ['blades', 'fan', 'rain'], hpScale: [0.444, 0.428, 0.494, 0.406], weights: [[0.437, 0.563], [0.382, 0.618], [0.303, 0.292, 0.405], [0.352, 0.264, 0.384]] },
  { id: 'shinx-electivire', sprite: 'electivire', types: ['ghost', 'fighting'], maxHp: 620, radius: 16, shots: { a: 'electric', b: 'fighting' }, cards: ['drop', 'fan', 'walls'], hpScale: [0.477, 0.518, 0.6, 0.656], weights: [[0.524, 0.476], [0.579, 0.421], [0.333, 0.333, 0.333], [0.355, 0.289, 0.355]], last: 'drop' },
  { id: 'shinx-umbreon', sprite: 'umbreon', types: ['dark'], maxHp: 600, radius: 15, shots: { a: 'dark', b: 'ghost' }, cards: ['moon', 'drop', 'rain'], hpScale: [0.5, 0.6, 0.6, 0.393], weights: [[0.5, 0.5], [0.5, 0.5], [0.333, 0.333, 0.333], [0.294, 0.353, 0.353]] },
  { id: 'shinx-wound', sprite: 'luxray', types: ['electric', 'water'], maxHp: 760, radius: 20, shots: { a: 'electric', b: 'dark' }, cards: ['fan', 'drop', 'rain', 'bloom'], hpScale: [0.475, 0.684, 0.654, 0.784], weights: [[0.474, 0.526], [0.341, 0.341, 0.318], [0.268, 0.268, 0.268, 0.197], [0.263, 0.27, 0.197, 0.27]], wound: true },
];

export const SHINX_FIGHTS = Object.fromEntries(SHINX_BOSSES.map((b) => [b.id, fightsOf(b)])) as Record<ShinxBossId, ReturnType<typeof fightsOf>>;

const roomOf = (id: ShinxBossId): ShinxRoomId => (id === 'shinx-wound' ? 'wound-shinx' : id);

/** The arenas: one per shadow (a way on at the top) and the wound's. */
export const SHINX_ROOMS = Object.fromEntries(SHINX_BOSSES.map((b) => [roomOf(b.id), bossArena(roomOf(b.id), b.id, !b.wound)])) as Record<ShinxRoomId, RoomDef>;

/** Each chapter's road (data/dungeons.ts): the dungeon whose look and music it borrows and its two mid-bosses. */
export const SHINX_ROADS: readonly [SendaRoad, SendaRoad, SendaRoad] = [
  { base: 'swamp', mid: ['shinx-ampharos', 'shinx-manectric'], wound: 'wound-shinx' },
  { base: 'caves', mid: ['shinx-absol', 'shinx-electivire'], wound: 'wound-shinx' },
  { base: 'crypt', mid: ['shinx-umbreon', 'rift-way'], wound: 'wound-shinx' },
];

/** The road's bosses as the story sees them: two mid-bosses and the wound, each with its lines. */
const BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

export const SHINX_QUEST: StoryQuest = {
  line: 'shinx',
  chapters: [
    {
      before: [{ scene: 'storm' }, { scene: 'cave', figure: { anim: 'Idle' } }, { scene: 'pose', figure: { anim: 'Idle' } }],
      after: [{ scene: 'cave', figure: { anim: 'Idle' } }, { scene: 'candle', figure: { anim: 'Idle', x: 0.4 } }, { scene: 'candle', figure: { anim: 'Faint', x: 0.4 } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'storm' }, { scene: 'cave', figure: { anim: 'Hurt' } }, { scene: 'dark' }, { scene: 'pose', figure: { anim: 'Idle', form: 'luxio' } }],
      after: [{ scene: 'storm', figure: { anim: 'Idle', form: 'luxio' } }, { scene: 'candle', figure: { anim: 'Idle', form: 'luxio', x: 0.4 } }, { scene: 'candle', figure: { anim: 'Idle', form: 'luxio', x: 0.4 } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'wall', figure: { anim: 'Idle', form: 'luxio' } }, { scene: 'storm', figure: { anim: 'Walk', form: 'luxray', back: true } }, { scene: 'pose', figure: { anim: 'Idle', form: 'luxio' } }],
      after: [{ scene: 'cave', figure: { anim: 'Idle', form: 'luxio' } }, { scene: 'pose', figure: { anim: 'Idle', form: 'luxray' } }, { scene: 'wall', figure: { anim: 'Idle', form: 'luxray' } }, { scene: 'phantump' }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
  ],
};
