import type { RoomDef } from '../rooms';
import type { StoryBoss, StoryQuest } from '../story-quests';
import { bossArena, fightsOf, type StoryBossDef } from './kit';
import type { SendaRoad } from './roads';

/**
 * Cubone's Senda, La Senda del Hueso (docs/story-quests.md): the little one
 * who wears its mother's skull and cries inside it, so the crying sounds like
 * a song. Its mother went down to the dungeons for light the night of the
 * Eclipse; her skull came back in other arms, and a shadow with her shape
 * hums among the swamp's grave mounds. Each chapter walks its own road with
 * its own shadows: I by the swamp (Haunter, who laughs at crying; Mandibuzz,
 * whom crying calls), II in the caves where she went down (Dusclops, who
 * carries the dead inside; Kangaskhan, a mother with an empty pouch), III up
 * the roofless tower (Bisharp at its stair; Dusknoir, who guides the dead).
 * Its wound, Marowak Sin Lágrimas, grows each chapter: the grief that stopped
 * crying, a Marowak of bone and smoke with a bone that burns. Texts:
 * `story.cubone.*`.
 */

export type CuboneRoomId = 'wound-cubone' | 'cubone-haunter' | 'cubone-mandibuzz' | 'cubone-dusclops' | 'cubone-kangaskhan' | 'cubone-bisharp' | 'cubone-dusknoir';
export type CuboneBossId = 'cubone-wound' | 'cubone-haunter' | 'cubone-mandibuzz' | 'cubone-dusclops' | 'cubone-kangaskhan' | 'cubone-bisharp' | 'cubone-dusknoir';

/** Its shadows (data/story/kit.ts; `hpScale` per tier tuned so every card meets its kill margin, tests/sim/story-prove-<line>.test.ts): sheets, types (a shadow does not fly), shots and signature cards. */
export const CUBONE_BOSSES: readonly (StoryBossDef & { id: CuboneBossId })[] = [
  { id: 'cubone-haunter', sprite: 'haunter', types: ['ghost', 'poison'], maxHp: 520, radius: 15, shots: { a: 'ghost', b: 'poison' }, cards: ['fan', 'drop', 'rain'], hpScale: [0.5, 0.6, 0.6, 0.69] },
  { id: 'cubone-mandibuzz', sprite: 'mandibuzz', types: ['dark', 'ghost'], maxHp: 520, radius: 15, shots: { a: 'dark', b: 'ghost' }, cards: ['drop', 'fan', 'bloom'], hpScale: [0.5, 0.6, 0.5, 0.47] },
  { id: 'cubone-dusclops', sprite: 'dusclops', types: ['ghost'], maxHp: 520, radius: 15, shots: { a: 'ghost', b: 'dark' }, cards: ['moon', 'drop', 'walls'], hpScale: [0.5, 0.6, 0.6, 0.49] },
  { id: 'cubone-kangaskhan', sprite: 'kangaskhan', types: ['normal', 'ghost'], maxHp: 520, radius: 16, shots: { a: 'normal', b: 'ghost' }, cards: ['fan', 'drop', 'rain'], hpScale: [0.45, 0.44, 0.6, 0.57] },
  { id: 'cubone-bisharp', sprite: 'bisharp', types: ['steel', 'ghost'], maxHp: 520, radius: 14, shots: { a: 'steel', b: 'dark' }, cards: ['fan', 'walls', 'rain'], hpScale: [0.5, 0.6, 0.6, 0.7] },
  { id: 'cubone-dusknoir', sprite: 'dusknoir', types: ['ghost'], maxHp: 520, radius: 16, shots: { a: 'ghost', b: 'dark' }, cards: ['drop', 'moon', 'bloom'], hpScale: [0.5, 0.6, 0.6, 0.7] },
  // The wound: a towering Marowak of bone and smoke whose bone burns (Fire and Ghost, the mourning flame): moon phases, a leap, the bone fire's bloom, a rain of bones.
  { id: 'cubone-wound', sprite: 'marowak', types: ['fire', 'ghost'], maxHp: 760, radius: 20, shots: { a: 'ground', b: 'fire' }, cards: ['moon', 'drop', 'bloom', 'rain'], hpScale: [0.5, 0.7, 0.7, 0.85], wound: true },
];

export const CUBONE_FIGHTS = Object.fromEntries(CUBONE_BOSSES.map((b) => [b.id, fightsOf(b)])) as Record<CuboneBossId, ReturnType<typeof fightsOf>>;

const roomOf = (id: CuboneBossId): CuboneRoomId => (id === 'cubone-wound' ? 'wound-cubone' : id);

/** The arenas: one per shadow (a way on at the top) and the wound's, the grave mounds under the full moon. */
export const CUBONE_ROOMS = Object.fromEntries(CUBONE_BOSSES.map((b) => [roomOf(b.id), bossArena(roomOf(b.id), b.id, !b.wound)])) as Record<CuboneRoomId, RoomDef>;

/** Each chapter's road (data/dungeons.ts): the dungeon whose look and music it borrows and its two shadows. */
export const CUBONE_ROADS: readonly [SendaRoad, SendaRoad, SendaRoad] = [
  { base: 'swamp', mid: ['cubone-haunter', 'cubone-mandibuzz'], wound: 'wound-cubone' },
  { base: 'caves', mid: ['cubone-dusclops', 'cubone-kangaskhan'], wound: 'wound-cubone' },
  { base: 'crypt', mid: ['cubone-bisharp', 'cubone-dusknoir'], wound: 'wound-cubone' },
];

/** The road's bosses as the story sees them: two shadows and the wound, each with its lines. */
const BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

export const CUBONE_QUEST: StoryQuest = {
  line: 'cubone',
  chapters: [
    {
      before: [{ scene: 'moon' }, { scene: 'dock', figure: { anim: 'Idle' } }, { scene: 'moon', figure: { anim: 'Idle' } }, { scene: 'pose', figure: { anim: 'Walk' } }],
      after: [{ scene: 'dock', figure: { anim: 'Idle' } }, { scene: 'moon', figure: { anim: 'Hurt' } }, { scene: 'dock', figure: { anim: 'Idle' } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'eclipse' }, { scene: 'moon', figure: { anim: 'Idle' } }, { scene: 'graves' }, { scene: 'pose', figure: { anim: 'Idle' } }],
      after: [{ scene: 'graves', figure: { anim: 'Idle' } }, { scene: 'moon', figure: { anim: 'Hurt' } }, { scene: 'dock', figure: { anim: 'Idle' } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'tower' }, { scene: 'tower', figure: { anim: 'Walk' } }, { scene: 'moon', figure: { anim: 'Idle' } }],
      after: [{ scene: 'tower', figure: { anim: 'Idle' } }, { scene: 'moon', figure: { anim: 'Hurt' } }, { scene: 'graves', figure: { anim: 'Idle', form: 'marowak' } }, { scene: 'phantump' }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
  ],
};
