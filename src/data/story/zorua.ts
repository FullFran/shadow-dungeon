import type { RoomDef } from '../rooms';
import type { StoryBoss, StoryQuest } from '../story-quests';
import { bossArena, fightsOf, type StoryBossDef } from './kit';
import type { SendaRoad } from './roads';

/**
 * Zorua's Senda, La Senda del Reflejo (docs/story-quests.md): the fox who
 * wears other faces since the sun went out. The night of the Eclipse its pack
 * crossed the Bosque Brumoso on a path only they could see; Zorua got scared,
 * became a quiet child, and the pack walked past without knowing it. Since
 * then the forest path loops back to the same tree. Each chapter walks its
 * own road with its own shadows: I among reflections in the caves (Kecleon,
 * who also changes colour to hide; Gengar, the shadow that copies you), II in
 * the looping forest (Mightyena, who leads a pack and never looks back;
 * Decidueye, who saw the pack pass), III in the grudge's fog (Houndoom, the
 * hunter; Spiritomb, a hundred and eight souls bound by resentment). Its
 * wound, Zoroark de Niebla Blanca, grows each chapter: the grudge of the one
 * left behind (Ghost, white like an omen), wearing the pack's
 * faces. Texts: `story.zorua.*`.
 */

export type ZoruaRoomId = 'wound-zorua' | 'zorua-kecleon' | 'zorua-gengar' | 'zorua-mightyena' | 'zorua-houndoom' | 'zorua-spiritomb';
export type ZoruaBossId = 'zorua-wound' | 'zorua-kecleon' | 'zorua-gengar' | 'zorua-mightyena' | 'zorua-houndoom' | 'zorua-spiritomb';

/** Its shadows (data/story/kit.ts; `hpScale` per tier tuned so every card meets its kill margin, tests/sim/story-prove-<line>.test.ts); a shadow that were Dark alone would shrug Zorua's own moves off, so they are part Ghost. */
export const ZORUA_BOSSES: readonly (StoryBossDef & { id: ZoruaBossId })[] = [
  { id: 'zorua-kecleon', sprite: 'kecleon', types: ['ghost'], maxHp: 520, radius: 15, shots: { a: 'normal', b: 'ghost' }, cards: ['fan', 'drop', 'moon'], hpScale: [0.5, 0.6, 0.54, 0.51] },
  { id: 'zorua-gengar', sprite: 'gengar', types: ['ghost', 'poison'], maxHp: 520, radius: 15, shots: { a: 'ghost', b: 'poison' }, cards: ['drop', 'bloom', 'fan'], hpScale: [0.5, 0.46, 0.6, 0.7] },
  { id: 'zorua-mightyena', sprite: 'mightyena', types: ['dark', 'ghost'], maxHp: 520, radius: 15, shots: { a: 'dark', b: 'ghost' }, cards: ['fan', 'drop', 'rain'], hpScale: [0.5, 0.54, 0.44, 0.41] },
  { id: 'zorua-houndoom', sprite: 'houndoom', types: ['fire', 'ghost'], maxHp: 520, radius: 15, shots: { a: 'fire', b: 'dark' }, cards: ['walls', 'fan', 'bloom'], hpScale: [0.5, 0.6, 0.6, 0.69] },
  { id: 'zorua-spiritomb', sprite: 'spiritomb', types: ['ghost', 'dark'], maxHp: 520, radius: 15, shots: { a: 'ghost', b: 'dark' }, cards: ['moon', 'walls', 'drop'], hpScale: [0.5, 0.56, 0.6, 0.49] },
  // The wound: Zoroark of the white fog (Ghost, the grudge's vessel): borrowed faces, a blow from behind, the path that loops, the fog that closes in.
  { id: 'zorua-wound', sprite: 'zoroark', types: ['ghost'], maxHp: 760, radius: 20, shots: { a: 'dark', b: 'ghost' }, cards: ['fan', 'drop', 'bloom', 'walls'], hpScale: [0.5, 0.55, 0.7, 0.85], wound: true },
];

export const ZORUA_FIGHTS = Object.fromEntries(ZORUA_BOSSES.map((b) => [b.id, fightsOf(b)])) as Record<ZoruaBossId, ReturnType<typeof fightsOf>>;

const roomOf = (id: ZoruaBossId): ZoruaRoomId => (id === 'zorua-wound' ? 'wound-zorua' : id);

/** The arenas: one per new shadow (a way on at the top) and the wound's, a clearing in the white fog. */
export const ZORUA_ROOMS = Object.fromEntries(ZORUA_BOSSES.map((b) => [roomOf(b.id), bossArena(roomOf(b.id), b.id, !b.wound)])) as Record<ZoruaRoomId, RoomDef>;

/** Each chapter's road: Decidueye keeps its roost (with a way on), the one witness of the night the pack left. */
export const ZORUA_ROADS: readonly [SendaRoad, SendaRoad, SendaRoad] = [
  { base: 'caves', mid: ['zorua-kecleon', 'zorua-gengar'], wound: 'wound-zorua' },
  { base: 'forest', mid: ['zorua-mightyena', 'roost-way'], wound: 'wound-zorua' },
  { base: 'swamp', mid: ['zorua-houndoom', 'zorua-spiritomb'], wound: 'wound-zorua' },
];

/** The road's bosses as the story sees them: two shadows and the wound, each with its lines. */
const BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

export const ZORUA_QUEST: StoryQuest = {
  line: 'zorua',
  chapters: [
    {
      before: [{ scene: 'fountain' }, { scene: 'fountain', figure: { anim: 'Idle' } }, { scene: 'pose', figure: { anim: 'Hop' } }],
      after: [{ scene: 'fountain', figure: { anim: 'Idle' } }, { scene: 'pose', figure: { anim: 'Idle' } }, { scene: 'fountain', figure: { anim: 'Hop' } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'eclipse' }, { scene: 'loop' }, { scene: 'loop', figure: { anim: 'Walk' } }, { scene: 'pose', figure: { anim: 'Idle' } }],
      after: [{ scene: 'loop', figure: { anim: 'Idle' } }, { scene: 'fog', figure: { anim: 'Hurt' } }, { scene: 'pose', figure: { anim: 'Idle' } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'fog' }, { scene: 'fountain', figure: { anim: 'Idle' } }, { scene: 'pose', figure: { anim: 'Walk' } }],
      after: [{ scene: 'fog', figure: { anim: 'Idle' } }, { scene: 'loop', figure: { anim: 'Idle', form: 'zoroark' } }, { scene: 'fountain', figure: { anim: 'Idle', form: 'zoroark' } }, { scene: 'phantump' }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
  ],
};
