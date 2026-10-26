import type { RoomDef } from '../rooms';
import type { StoryBoss, StoryQuest } from '../story-quests';
import { bossArena, fightsOf, type StoryBossDef } from './kit';
import type { SendaRoad } from './roads';

/**
 * Axew's Senda, La Senda del Colmillo (docs/story-quests.md): the night of
 * the Eclipse the elders went down the ravine to fight what drank the sun
 * and left it behind; it followed along the wet edge, fell, chipped its tusk,
 * and woke up at the top: Trevenant's roots had pulled it up and broken
 * doing it. I the chipped tusk, II the ravine (it was not caught, it was
 * saved), III growing (its own road, not the elders'). Each chapter walks its
 * own road with its own shadows: I in the forest (Druddigon, the ravine's
 * bully; Bisharp, the lord of blades who sends the small home), II in the
 * caves (Trevenant, whose roots held it; Garchomp, the ravine's shark), III
 * under the crypt's braziers (Salamence, who wanted wings; Dragonite, the
 * elder who came home). A shadow does not fly, and Bisharp's steel is gone.
 * Its wound, Haxorus de Colmillos Rotos, grows each chapter: the rage of
 * never being big enough. Texts: `story.axew.*`.
 */

export type AxewRoomId = 'axew-druddigon' | 'axew-bisharp' | 'axew-garchomp' | 'axew-salamence' | 'axew-dragonite' | 'wound-axew';
export type AxewBossId = 'axew-druddigon' | 'axew-bisharp' | 'axew-garchomp' | 'axew-salamence' | 'axew-dragonite' | 'axew-wound';

/** Its shadows and its wound (data/story/kit.ts; `hpScale` and the cards' `weights` per tier fitted so every card meets its kill margin, tests/sim/story-prove-axew.test.ts and tests/sim/wound-prove.test.ts). */
export const AXEW_BOSSES: readonly (StoryBossDef & { id: AxewBossId })[] = [
  { id: 'axew-druddigon', sprite: 'druddigon', types: ['dragon'], maxHp: 580, radius: 15, shots: { a: 'dragon', b: 'rock' }, cards: ['fan', 'walls', 'drop'], hpScale: [0.466, 0.405, 0.518, 0.332], weights: [[0.477, 0.523], [0.534, 0.466], [0.227, 0.387, 0.387], [0.231, 0.357, 0.412]] },
  { id: 'axew-bisharp', sprite: 'bisharp', types: ['dark', 'ghost'], maxHp: 600, radius: 15, shots: { a: 'steel', b: 'dark' }, cards: ['blades', 'fan', 'walls'], hpScale: [0.44, 0.419, 0.487, 0.397], weights: [[0.432, 0.568], [0.382, 0.618], [0.3, 0.289, 0.411], [0.349, 0.262, 0.389]] },
  { id: 'axew-garchomp', sprite: 'garchomp', types: ['dragon', 'ground'], maxHp: 640, radius: 17, shots: { a: 'dragon', b: 'ground' }, cards: ['drop', 'blades', 'rain'], hpScale: [0.434, 0.45, 0.49, 0.663], weights: [[0.576, 0.424], [0.667, 0.333], [0.409, 0.183, 0.409], [0.352, 0.296, 0.352]] },
  { id: 'axew-salamence', sprite: 'salamence', types: ['dragon', 'ghost'], maxHp: 640, radius: 17, shots: { a: 'dragon', b: 'fire' }, cards: ['bloom', 'fan', 'rain'], hpScale: [0.402, 0.361, 0.504, 0.471], weights: [[0.378, 0.622], [0.527, 0.473], [0.326, 0.277, 0.397], [0.419, 0.086, 0.495]] },
  { id: 'axew-dragonite', sprite: 'dragonite', types: ['dragon', 'ghost'], maxHp: 680, radius: 18, shots: { a: 'dragon', b: 'flying' }, cards: ['bloom', 'moon', 'drop'], hpScale: [0.425, 0.44, 0.6, 0.634], weights: [[0.412, 0.588], [0.319, 0.681], [0.333, 0.333, 0.333], [0.263, 0.368, 0.368]] },
  { id: 'axew-wound', sprite: 'haxorus', types: ['dragon'], maxHp: 760, radius: 20, shots: { a: 'dragon', b: 'steel' }, cards: ['blades', 'fan', 'walls', 'drop'], hpScale: [0.385, 0.628, 0.685, 0.771], weights: [[0.416, 0.584], [0.256, 0.372, 0.372], [0.233, 0.256, 0.256, 0.256], [0.215, 0.268, 0.241, 0.276]], wound: true },
];

export const AXEW_FIGHTS = Object.fromEntries(AXEW_BOSSES.map((b) => [b.id, fightsOf(b)])) as Record<AxewBossId, ReturnType<typeof fightsOf>>;

const roomOf = (id: AxewBossId): AxewRoomId => (id === 'axew-wound' ? 'wound-axew' : id);

/** The arenas: one per shadow (a way on at the top) and the wound's. */
export const AXEW_ROOMS = Object.fromEntries(AXEW_BOSSES.map((b) => [roomOf(b.id), bossArena(roomOf(b.id), b.id, !b.wound)])) as Record<AxewRoomId, RoomDef>;

/** Each chapter's road (data/dungeons.ts): the dungeon whose look and music it borrows and its two mid-bosses. */
export const AXEW_ROADS: readonly [SendaRoad, SendaRoad, SendaRoad] = [
  { base: 'forest', mid: ['axew-druddigon', 'axew-bisharp'], wound: 'wound-axew' },
  { base: 'caves', mid: ['hollow', 'axew-garchomp'], wound: 'wound-axew' },
  { base: 'crypt', mid: ['axew-salamence', 'axew-dragonite'], wound: 'wound-axew' },
];

/** The road's bosses as the story sees them: two mid-bosses and the wound, each with its lines. */
const BOSSES: readonly StoryBoss[] = [
  { floor: 3, pre: 1, post: 1 },
  { floor: 6, pre: 2, post: 1 },
  { floor: 7, pre: 2, post: 1 },
];

export const AXEW_QUEST: StoryQuest = {
  line: 'axew',
  chapters: [
    {
      before: [{ scene: 'tree', figure: { anim: 'Idle' } }, { scene: 'pose', figure: { anim: 'Idle' } }, { scene: 'pose', figure: { anim: 'Hop' } }],
      after: [{ scene: 'crack' }, { scene: 'candle', figure: { anim: 'Idle', x: 0.4 } }, { scene: 'candle', figure: { anim: 'Idle', x: 0.4 } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'burning' }, { scene: 'tree', figure: { anim: 'Walk' } }, { scene: 'crack' }, { scene: 'pose', figure: { anim: 'Idle', form: 'fraxure' } }],
      after: [{ scene: 'tree', figure: { anim: 'Idle', form: 'fraxure' } }, { scene: 'candle', figure: { anim: 'Idle', form: 'fraxure', x: 0.4 } }, { scene: 'candle', figure: { anim: 'Idle', form: 'fraxure', x: 0.4 } }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
    {
      before: [{ scene: 'burning' }, { scene: 'tree', figure: { anim: 'Idle', form: 'fraxure' } }, { scene: 'pose', figure: { anim: 'Idle', form: 'fraxure' } }],
      after: [{ scene: 'crack' }, { scene: 'burning', figure: { anim: 'Idle', form: 'haxorus' } }, { scene: 'tree', figure: { anim: 'Idle', form: 'haxorus' } }, { scene: 'phantump' }],
      fragments: [2, 5],
      bosses: BOSSES,
    },
  ],
};
