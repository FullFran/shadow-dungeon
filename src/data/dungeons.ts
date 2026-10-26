import { CRYPT_SPAWNS, RUN_PLAN, URGENT, type FloorKind, type FloorPlan, type SpawnEntry, type SpawnTuning, type WaterTuning } from './dungeon';
import { DUNGEON_LORE, type DungeonLore } from './dungeon-lore';
import type { GateTuning } from './encounters';
import type { MusicContext } from './music';
import { ROOMS, type RoomId } from './rooms';
import type { SpeciesId } from './species';
import { echoAt, ENDLESS, isEchoFloor, type EndlessDef } from './endless';
import type { Difficulty } from './difficulty';
import { MIMIKYU_ROADS } from './story/mimikyu';
import { CUBONE_ROADS } from './story/cubone';
import { LITWICK_ROADS } from './story/litwick';
import type { SendaRoad } from './story/roads';
import { ZORUA_ROADS } from './story/zorua';
import { ABRA_ROADS } from './story/abra';
import { PIPLUP_ROADS } from './story/piplup';
import { SHINX_ROADS } from './story/shinx';
import { AXEW_ROADS } from './story/axew';

/**
 * Every dungeon as data (docs/gdd.md §3): its name and lore, its floors
 * (generated ones and fixed arenas: a mid-boss, the guardian), the enemies
 * of its generated floors by depth, its urgent floors and their weights, the
 * music of each kind of floor, the colours of its tiles and what unlocks it.
 * The run (core/run.ts) reads everything from here.
 */
export type DungeonId =
  | 'crypt-of-the-sword-king'
  | 'misty-forest'
  | 'eclipse-chasm'
  | 'toxic-swamp'
  | 'flooded-caves'
  | `challenge-${ChallengeLine}`
  // A Senda's second and third chapter roads (data/story/roads.ts).
  | `challenge-${ChallengeLine}-${2 | 3}`;

/** The lines with a challenge dungeon: the gacha's and the starters' (odd/tasks/roster-parity.md). */
export type ChallengeLine = 'abra' | 'piplup' | 'shinx' | 'axew' | 'mimikyu' | 'zorua' | 'litwick' | 'cubone';

/** Urgent floor kinds a dungeon can roll (everything but `normal`). */
export type UrgentKind = Exclude<FloorKind, 'normal'>;

export interface UrgentChance {
  kind: UrgentKind;
  /** Chance by floor: index 0 is floor 1, deeper floors use the last entry. */
  chance: readonly number[];
}

/** Colours of a dungeon's floors and walls (generated tiles and fixed arenas). */
export interface TilePalette {
  tileFloorA: string;
  tileFloorB: string;
  tileWallTop: string;
  tileWallBlock: string;
  tileWallFace: string;
  tileWallLip: string;
  mapRim: string;
  /** Fixed arenas: checker floor, the dark around them, their edge and their pillars. */
  floorA: string;
  floorB: string;
  wall: string;
  wallEdge: string;
  pillarTop: string;
  pillarSide: string;
}

export interface DungeonMusic {
  floor: MusicContext;
  urgent: Readonly<Record<UrgentKind, MusicContext>>;
  midboss: MusicContext;
  guardian: MusicContext;
}

export interface DungeonDef {
  id: DungeonId;
  lore: DungeonLore;
  plan: readonly FloorPlan[];
  spawns: SpawnTuning;
  /** Rolled in order on generated floors (one draw per floor); fixed rooms are never urgent. */
  urgent: readonly UrgentChance[];
  music: DungeonMusic;
  palette: TilePalette;
  /** Unlocked from the start (null), or once this dungeon's guardian has fallen. */
  unlockedBy: DungeonId | null;
  /** The endless dungeon only: no last floor, guardian echoes and the run clock (data/endless.ts); its `plan` is empty. */
  endless?: EndlessDef;
  /** Decoration drawn over its tiles and arenas (presentation only): the Crypt's candles, graves and braziers, the Forest's roots, mushrooms and mist, the caves' water and crystals, the swamp's sludge, dead trees and spores. */
  decor?: 'crypt' | 'forest' | 'caves' | 'swamp';
  /** The Forest's event: on some generated floors a spirit light leads to a hidden berry cache (core/wisp.ts). */
  wisp?: WispDef;
  /** Shallow water pools on its generated floors (core/water.ts): they slow non-Water walkers. */
  water?: WaterTuning;
  /** Toxic pools on its generated floors (core/toxic.ts): the Toxic Swamp. */
  toxicPools?: true;
  /** Mandatory kills on some generated floors (core/gates.ts): a sealed stairs, a locked door, a wave room. */
  gates?: GateTuning;
  /** A challenge dungeon only (`CHALLENGES`): the line it belongs to (its first form) and the materials a clear pays (core/challenge.ts). */
  challenge?: { line: ChallengeLine; materials: number };
  /** A Senda line's challenge (chapter I's road): the roads a Hard and a Nightmare run walk instead (`roadFor`). */
  roads?: { hard: DungeonId; nightmare: DungeonId };
}

/** Chance by floor (index 0 is floor 1, deeper floors use the last entry) and size of the spirit light's berry cache. */
export interface WispDef {
  chance: readonly number[];
  berries: number;
}

const loreOf = (id: string): DungeonLore => DUNGEON_LORE.find((l) => l.id === id)!;

export const CRYPT: DungeonDef = {
  id: 'crypt-of-the-sword-king',
  lore: loreOf('crypt-of-the-sword-king'),
  plan: RUN_PLAN,
  spawns: CRYPT_SPAWNS,
  urgent: [{ kind: 'collapse', chance: URGENT.collapseChance }],
  music: { floor: 'crypt', urgent: { collapse: 'collapse', fog: 'crypt', flood: 'crypt', gas: 'collapse' }, midboss: 'guardian', guardian: 'guardian' },
  // Cold grey-violet stone; the candles and braziers bring the only warm light.
  palette: {
    tileFloorA: '#2a2731',
    tileFloorB: '#2e2b36',
    tileWallTop: '#16141d',
    tileWallBlock: '#1e1b27',
    tileWallFace: '#3c3850',
    tileWallLip: '#565170',
    mapRim: '#4a4562',
    floorA: '#1c1a23',
    floorB: '#201e28',
    wall: '#0b0a10',
    wallEdge: '#3a3550',
    pillarTop: '#4d4862',
    pillarSide: '#2c2840',
  },
  unlockedBy: null,
  decor: 'crypt',
  // Floors 1..5 (3 is the vault): never floor 1; the locked door from floor 4.
  gates: {
    chance: [0, 0.35, 0, 0.45, 0.5],
    kinds: [
      { kind: 'seal', weights: [0, 1, 0, 1, 1] },
      { kind: 'key', weights: [0, 0, 0, 0.8, 1] },
    ],
  },
};

/**
 * The Misty Forest (Bosque Brumoso), opened by beating the Crypt's guardian:
 * eight floors (provisional), the Trevenant mid-boss on floor 4 and Decidueye
 * on floor 8. Its first floors are gentler than the Crypt's last ones (fewer
 * enemies per room, weaker hits) and it ramps with depth: the tank and the
 * diving owl only show up from floor 2-3. Its urgent floor is the fog
 * (Niebla); a landslide (the collapse) is rarer here.
 */
export const FOREST: DungeonDef = {
  id: 'misty-forest',
  lore: loreOf('misty-forest'),
  plan: [
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'room', room: 'hollow', role: 'midboss' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'room', room: 'roost' },
  ],
  spawns: {
    base: 1,
    perDepth: 0.5,
    jitter: 1,
    maxPerRoom: 4,
    budget: { base: 2, perDepth: 0.9, jitter: 1, maxEnemies: 3, rest: [0.25, 0.2, 0.2, 0.2, 0.15], repeatWeight: 0.4, leaders: { fromFloor: 2, start: 0.25, perFloor: 0.07, max: 0.6 } },
    // Weights by floor 1..7 (floors 4 and 8 are arenas; their entries keep the tables aligned).
    // Remaster: Shroomish pairs (with a Foongus among them) from floor 1, Drifloon from 2, Impidimp leading
    // two Pumpkaboo Small from 3 (mixed packs only add tiles to a pick).
    pool: [
      { species: 'pumpkaboo-small', weights: [3, 3, 2, 2, 2, 2, 2], pack: 3 },
      { species: 'phantump', weights: [2, 2, 2, 2, 2, 2, 2] },
      { species: 'spinarak', weights: [1, 1, 2, 2, 2, 3, 3] },
      { species: 'foongus', weights: [1, 1, 1, 1, 2, 2, 2] },
      { species: 'hoothoot', weights: [0, 1, 2, 2, 2, 2, 3] },
      { species: 'pumpkaboo-super', weights: [0, 0, 1, 1, 1, 2, 2] },
      { species: 'shroomish', weights: [1, 1, 1, 1, 2, 2, 2], pack: 2, escort: { species: 'foongus', count: 1 } },
      { species: 'drifloon', weights: [0, 1, 1, 1, 2, 2, 2] },
      { species: 'impidimp', weights: [0, 0, 1, 1, 2, 2, 2], escort: { species: 'pumpkaboo-small', count: 2 } },
      // Evolved forms after the hollow (data/evolutions.ts); Morgrem brings an Impidimp.
      { species: 'breloom', weights: [0, 0, 0, 0, 1, 1, 2] },
      { species: 'drifblim', weights: [0, 0, 0, 0, 1, 1, 1] },
      { species: 'morgrem', weights: [0, 0, 0, 0, 1, 1, 2], escort: { species: 'impidimp', count: 1 } },
      { species: 'noctowl', weights: [0, 0, 0, 0, 1, 2, 2] },
      { species: 'ariados', weights: [0, 0, 0, 0, 1, 1, 2] },
    ],
  },
  urgent: [
    { kind: 'fog', chance: [0, 0.3, 0.35, 0, 0.4, 0.45, 0.5] },
    { kind: 'collapse', chance: [0, 0, 0.1, 0, 0.1, 0.15, 0.15] },
  ],
  music: { floor: 'forest', urgent: { collapse: 'collapse', fog: 'forest-fog', flood: 'forest', gas: 'collapse' }, midboss: 'guardian', guardian: 'forest-guardian' },
  palette: {
    tileFloorA: '#2c3b2d',
    tileFloorB: '#304131',
    tileWallTop: '#0d1710',
    tileWallBlock: '#142318',
    tileWallFace: '#2b4630',
    tileWallLip: '#3e6644',
    mapRim: '#3a5a3e',
    floorA: '#1b261d',
    floorB: '#1f2c21',
    wall: '#060c07',
    wallEdge: '#2f4a33',
    pillarTop: '#4b3b2b',
    pillarSide: '#2e241a',
  },
  unlockedBy: 'crypt-of-the-sword-king',
  decor: 'forest',
  // A spirit light on about a third of the generated floors from floor 2 (more often deeper), three berries.
  wisp: { chance: [0, 0.35, 0.35, 0, 0.35, 0.4, 0.4], berries: 3 },
  // Floors 1..7 (4 is the hollow): the locked door from floor 3.
  gates: {
    chance: [0, 0.3, 0.35, 0, 0.4, 0.45, 0.5],
    kinds: [
      { kind: 'seal', weights: [0, 1, 1, 0, 1, 1, 1] },
      { kind: 'key', weights: [0, 0, 0.5, 0, 0.8, 1, 1] },
    ],
  },
};

/**
 * The Flooded Caves (Cuevas Inundadas), opened by beating the Misty Forest's
 * guardian: ten floors (provisional), Lanturn's grotto on floor 5 and
 * Dhelmise's wreck on floor 10. Shallow pools in many rooms slow whoever is
 * not a Water type; its urgent floor is the flood (Inundación), with a rare
 * cave-in deeper down. The water species of the experimental roster live
 * here, with Krabby, Remoraid and Shellos.
 */
export const CAVES: DungeonDef = {
  id: 'flooded-caves',
  lore: loreOf('flooded-caves'),
  plan: [
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'room', room: 'grotto', role: 'midboss' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'room', room: 'wreck' },
  ],
  spawns: {
    base: 1,
    perDepth: 0.5,
    jitter: 1,
    maxPerRoom: 4,
    budget: { base: 3, perDepth: 0.75, jitter: 1, maxEnemies: 3, rest: [0.25, 0.2, 0.2, 0.2, 0.15], repeatWeight: 0.4, leaders: { fromFloor: 2, start: 0.2, perFloor: 0.06, max: 0.6 } },
    // Weights by floor 1..9 (floor 5 is the grotto; its entry keeps the table aligned).
    pool: [
      { species: 'krabby', weights: [3, 3, 3, 2, 2, 2, 2, 2, 2] },
      { species: 'zubat', weights: [2, 2, 2, 2, 2, 2, 2, 2, 2], pack: 3 },
      { species: 'remoraid', weights: [1, 2, 2, 2, 2, 2, 2, 3, 3] },
      { species: 'tentacool', weights: [1, 1, 2, 2, 2, 2, 2, 2, 2] },
      { species: 'shellos', weights: [0, 1, 1, 2, 2, 2, 2, 2, 2] },
      { species: 'corphish', weights: [0, 1, 1, 2, 2, 2, 2, 2, 2] },
      { species: 'chinchou', weights: [0, 0, 1, 1, 1, 2, 2, 2, 2] },
      { species: 'wooper', weights: [0, 0, 1, 1, 1, 1, 2, 2, 2] },
      { species: 'clauncher', weights: [0, 0, 0, 0, 0, 1, 1, 2, 2] },
      // Evolved forms after the grotto (data/evolutions.ts); Golbat leads two Zubat.
      { species: 'golbat', weights: [0, 0, 0, 0, 0, 1, 1, 2, 2], escort: { species: 'zubat', count: 2 } },
      { species: 'kingler', weights: [0, 0, 0, 0, 0, 1, 1, 2, 2] },
      { species: 'octillery', weights: [0, 0, 0, 0, 0, 1, 1, 1, 2] },
      { species: 'crawdaunt', weights: [0, 0, 0, 0, 0, 1, 1, 1, 2] },
    ],
  },
  urgent: [
    { kind: 'flood', chance: [0, 0.25, 0.3, 0.35, 0, 0.35, 0.4, 0.45, 0.5] },
    { kind: 'collapse', chance: [0, 0, 0, 0.08, 0, 0.1, 0.1, 0.12, 0.12] },
  ],
  music: { floor: 'caves', urgent: { collapse: 'collapse', fog: 'caves', flood: 'caves-flood', gas: 'collapse' }, midboss: 'guardian', guardian: 'caves-guardian' },
  // Deep blue-teal stone, wet and dark; the crystals bring the only light.
  palette: {
    tileFloorA: '#1f2c38',
    tileFloorB: '#22303d',
    tileWallTop: '#0a121a',
    tileWallBlock: '#101b26',
    tileWallFace: '#25414f',
    tileWallLip: '#3a6474',
    mapRim: '#2f5566',
    floorA: '#16222c',
    floorB: '#192631',
    wall: '#04080c',
    wallEdge: '#2a4a5a',
    pillarTop: '#34505c',
    pillarSide: '#1d3039',
  },
  unlockedBy: 'misty-forest',
  decor: 'caves',
  water: { poolChance: 0.55 },
  // Floors 1..9 (5 is the grotto).
  gates: {
    chance: [0, 0.3, 0.35, 0.4, 0, 0.4, 0.45, 0.5, 0.5],
    kinds: [
      { kind: 'seal', weights: [0, 1, 1, 1, 0, 1, 1, 1, 1] },
      { kind: 'key', weights: [0, 0, 0.5, 0.7, 0, 0.8, 1, 1, 1] },
    ],
  },
};

/**
 * The Toxic Swamp (Pantano Tóxico), opened by clearing the Flooded Caves:
 * ten floors (provisional), Salazzle's den on floor 5 and Nihilego on 10.
 * The roster's poison species finally have a home here, with Venipede
 * packs, Salandit and Skrelp; toxic pools poison the careless on every
 * generated floor. Its urgent floor is the gas (Gas tóxico); a sinking
 * floor (the collapse) is rarer.
 */
export const SWAMP: DungeonDef = {
  id: 'toxic-swamp',
  lore: loreOf('toxic-swamp'),
  plan: [
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'room', room: 'den', role: 'midboss' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'generated' },
    { kind: 'room', room: 'rift' },
  ],
  spawns: {
    base: 1,
    perDepth: 0.4,
    jitter: 1,
    maxPerRoom: 5,
    budget: { base: 2, perDepth: 0.65, jitter: 1, maxEnemies: 3, rest: [0.3, 0.25, 0.25, 0.25, 0.2], repeatWeight: 0.4, leaders: { fromFloor: 2, start: 0.2, perFloor: 0.06, max: 0.6 } },
    // Weights by floor 1..9 (floor 5 is the den; its entry keeps the tables aligned).
    pool: [
      { species: 'venipede', weights: [3, 3, 2, 2, 0, 2, 2, 2, 2], pack: 3 },
      { species: 'stunky', weights: [2, 2, 2, 1, 0, 1, 1, 1, 1], pack: 2 },
      { species: 'ekans', weights: [2, 2, 2, 2, 0, 2, 2, 2, 2] },
      { species: 'tentacool', weights: [1, 1, 1, 1, 0, 1, 1, 1, 1] },
      { species: 'skrelp', weights: [1, 1, 2, 2, 0, 2, 2, 2, 2] },
      { species: 'salandit', weights: [0, 1, 1, 2, 0, 2, 2, 3, 3] },
      { species: 'koffing', weights: [0, 1, 1, 1, 0, 2, 2, 2, 2] },
      { species: 'grimer', weights: [0, 0, 1, 1, 0, 1, 2, 2, 2] },
      { species: 'croagunk', weights: [0, 0, 0, 1, 0, 1, 1, 2, 2] },
      // Evolved forms after the den (data/evolutions.ts); Skuntank brings a Stunky.
      { species: 'arbok', weights: [0, 0, 0, 0, 0, 1, 1, 2, 2] },
      { species: 'skuntank', weights: [0, 0, 0, 0, 0, 1, 1, 1, 1], escort: { species: 'stunky', count: 1 } },
      { species: 'weezing', weights: [0, 0, 0, 0, 0, 1, 1, 1, 2] },
      { species: 'muk', weights: [0, 0, 0, 0, 0, 1, 1, 1, 2] },
      { species: 'toxicroak', weights: [0, 0, 0, 0, 0, 0, 1, 1, 2] },
    ],
  },
  urgent: [
    { kind: 'gas', chance: [0, 0.25, 0.3, 0.35, 0, 0.35, 0.4, 0.45, 0.45] },
    { kind: 'collapse', chance: [0, 0, 0.08, 0.1, 0, 0.1, 0.1, 0.12, 0.12] },
  ],
  // Salazzle on the 16-bit battle theme like the other mid-bosses; Nihilego on the symphonic-metal theme (reused, see licensed-music).
  music: { floor: 'swamp', urgent: { collapse: 'collapse', fog: 'swamp', flood: 'swamp', gas: 'collapse' }, midboss: 'guardian', guardian: 'forest-guardian' },
  // Murky moss and black-green water; the sludge and the spores glow.
  palette: {
    tileFloorA: '#273024',
    tileFloorB: '#2b3527',
    tileWallTop: '#0c120d',
    tileWallBlock: '#131c14',
    tileWallFace: '#2c3a26',
    tileWallLip: '#4d6236',
    mapRim: '#4a5e34',
    floorA: '#1b2219',
    floorB: '#1f271c',
    wall: '#060906',
    wallEdge: '#3c4e2c',
    pillarTop: '#5b6e72',
    pillarSide: '#2e3a3e',
  },
  unlockedBy: 'flooded-caves',
  decor: 'swamp',
  toxicPools: true,
  // Floors 1..9 (5 is the den).
  gates: {
    chance: [0, 0.3, 0.35, 0.4, 0, 0.4, 0.45, 0.5, 0.5],
    kinds: [
      { kind: 'seal', weights: [0, 1, 1, 1, 0, 1, 1, 1, 1] },
      { kind: 'key', weights: [0, 0, 0.5, 0.7, 0, 0.8, 1, 1, 1] },
    ],
  },
};

/** Urgent chances of the endless dungeon by floor, from its formula (deeper floors than the table use its last entry). */
const endlessUrgent = (endless: EndlessDef, floors = 40): UrgentChance[] =>
  endless.urgent.map((u) => ({
    kind: u.kind,
    chance: Array.from({ length: floors }, (_, i) => (i + 1 < u.fromFloor ? 0 : Math.min(u.max, u.start + u.perFloor * (i + 1 - u.fromFloor)))),
  }));

/**
 * The Sima del Eclipse (Eclipse Chasm), open from the start: endless floors,
 * a guardian echo every fifth floor, the run clock and modo puro
 * (data/endless.ts). Its floors are planned by `planAt`, not by `plan`.
 */
export const ECLIPSE: DungeonDef = {
  id: 'eclipse-chasm',
  lore: loreOf('eclipse-chasm'),
  plan: [],
  spawns: { ...ENDLESS.spawns, pool: [] },
  urgent: endlessUrgent(ENDLESS),
  music: { floor: 'crypt', urgent: { collapse: 'collapse', fog: 'forest-fog', flood: 'crypt', gas: 'collapse' }, midboss: 'guardian', guardian: 'guardian' },
  palette: {
    tileFloorA: '#2a2030',
    tileFloorB: '#30233a',
    tileWallTop: '#120b16',
    tileWallBlock: '#1b111f',
    tileWallFace: '#4a2a3c',
    tileWallLip: '#7a3a3a',
    mapRim: '#6a3448',
    floorA: '#1c1420',
    floorB: '#221826',
    wall: '#08050a',
    wallEdge: '#5a2a3a',
    pillarTop: '#5a3446',
    pillarSide: '#331c2a',
  },
  unlockedBy: null,
  endless: ENDLESS,
  // From floor 3, rising to 40 %; the locked door from 4, the wave room (its own event) from 7, as the event.
  gates: {
    chance: Array.from({ length: 40 }, (_, i) => (i + 1 < 3 ? 0 : Math.min(0.4, 0.2 + 0.01 * (i - 2)))),
    kinds: [
      { kind: 'seal', weights: [0, 0, 1] },
      { kind: 'key', weights: [0, 0, 0, 0.6] },
      { kind: 'waves', weights: [0, 0, 0, 0, 0, 0, 0.5] },
    ],
  },
};

/** Every dungeon, in the order the dungeon select lists them. */
export const DUNGEONS: readonly DungeonDef[] = [CRYPT, FOREST, CAVES, SWAMP, ECLIPSE];

const GENERATED: FloorPlan = { kind: 'generated' };

/** The plan of a floor (1-based): the dungeon's table, or for the endless dungeon an echo every few floors and generated ones between. */
export function planAt(dungeon: DungeonDef, floor: number): FloorPlan | undefined {
  const endless = dungeon.endless;
  if (!endless) return dungeon.plan[floor - 1];
  if (floor < 1) return undefined;
  return isEchoFloor(endless, floor) ? { kind: 'room', room: echoAt(endless, floor).room, role: 'echo' } : GENERATED;
}

/** Floors of a dungeon; the endless one never runs out. */
export const floorsOf = (dungeon: DungeonDef): number => (dungeon.endless ? Number.POSITIVE_INFINITY : dungeon.plan.length);

/** Materials a challenge dungeon's clear pays, of the tier of its difficulty (Easy pays none; provisional). */
export const CHALLENGE_MATERIALS = 3;

/**
 * A challenge dungeon (odd/tasks/gacha-evolutions.md T4,
 * odd/tasks/roster-parity.md): the line's own trial. Three generated floors
 * with its own enemy pool (`pool`: by floor 1..3, drawn from every dungeon's
 * regulars, themed to its lore and mostly hit at least neutrally by the
 * line's own types: tests/core/challenge.test.ts) and, on the fourth, one of
 * `base`'s arenas as the boss. It borrows the look and music of `base` and
 * its room budget; it is open while the player has any form of `line`, only
 * a form of the line may play it (core/challenge.ts) and its clear pays the
 * line's materials. Its lore is its own (`challenge.<line>.*`: a name, a
 * subtitle, an intro, a line per floor, the fourth before the boss, and one
 * after the victory). Kept apart from `DUNGEONS` (the main select and the
 * balance sweeps never list it).
 */
const challenge = (line: ChallengeLine, base: DungeonDef, room: RoomId, pool: readonly SpawnEntry[], plan: readonly FloorPlan[] = [GENERATED, GENERATED, GENERATED, { kind: 'room', room }], chapter: 1 | 2 | 3 = 1): DungeonDef => ({
  id: chapter === 1 ? `challenge-${line}` : `challenge-${line}-${chapter}`,
  lore: {
    id: chapter === 1 ? `challenge-${line}` : `challenge-${line}-${chapter}`,
    nameKey: `challenge.${line}.name`,
    subtitleKey: `challenge.${line}.subtitle`,
    loreKeys: [`challenge.${line}.lore`],
    // A later chapter's road has its own floor lines (`challenge.<line>.<chapter>.floor.<n>`).
    floorKeys: plan.map((_, i) => (chapter === 1 ? `challenge.${line}.floor.${i + 1}` : `challenge.${line}.${chapter}.floor.${i + 1}`)),
    victoryKey: `challenge.${line}.victory`,
  },
  plan,
  spawns: { ...base.spawns, pool },
  urgent: [],
  music: base.music,
  palette: base.palette,
  unlockedBy: null,
  ...(base.decor ? { decor: base.decor } : {}),
  ...(base.water ? { water: base.water } : {}),
  ...(base.toxicPools ? { toxicPools: base.toxicPools } : {}),
  challenge: { line, materials: CHALLENGE_MATERIALS },
});

/**
 * A Senda's longer road (docs/story-quests.md, owner 2026-10-26): two
 * generated floors, a mid-boss (fog wall and bonfire as everywhere), two
 * more, a second mid-boss, and the line's wound as the last boss. The pool's
 * floor-3 weights hold on the deeper generated floors.
 */
const sendaPlan = (first: RoomId, second: RoomId, wound: RoomId): readonly FloorPlan[] => [
  GENERATED,
  GENERATED,
  { kind: 'room', room: first, role: 'midboss' },
  GENERATED,
  GENERATED,
  { kind: 'room', room: second, role: 'midboss' },
  { kind: 'room', room: wound },
];

const BASES: Record<SendaRoad['base'], DungeonDef> = { crypt: CRYPT, forest: FOREST, caves: CAVES, swamp: SWAMP };
const roadPlan = (road: SendaRoad): readonly FloorPlan[] => sendaPlan(road.mid[0], road.mid[1], road.wound);

/**
 * A starter's Senda (data/story/<line>.ts): its challenge is chapter I's road;
 * chapters II and III walk roads of their own, each with its own look and its
 * own two shadows before the wound. The enemy pool is the line's.
 */
function senda(line: ChallengeLine, roads: readonly [SendaRoad, SendaRoad, SendaRoad], pool: readonly SpawnEntry[]): readonly [DungeonDef, DungeonDef, DungeonDef] {
  const [one, two, three] = roads.map((road, i) => challenge(line, BASES[road.base], road.wound, pool, roadPlan(road), (i + 1) as 1 | 2 | 3));
  return [{ ...one!, roads: { hard: two!.id, nightmare: three!.id } }, two!, three!];
}

/** A pool entry: its weight on challenge floors 1, 2 and 3. */
const at = (species: SpeciesId, f1: number, f2: number, f3: number): SpawnEntry => ({ species, weights: [f1, f2, f3] });

/**
 * One challenge per line, each with its own trial and a boss its types can
 * hurt: Abra's dream (Lanturn's lights), Piplup's frozen lake (Sableye's
 * hoard), Shinx's storm (Salazzle), Axew's ravine of fangs (Trevenant),
 * Mimikyu's disguise (Ditto, Noctowl, its wound), Zorua's reflection (Trevenant, Decidueye, its
 * wound), Litwick's flame (Lanturn, Dhelmise, its wound) and Cubone's bone (Trevenant, Dhelmise, its wound). The gacha
 * lines keep the four mid-boss arenas; a starter with a Senda faces its own wound last.
 */
// The starters' Sendas, one road per chapter (data/story/<line>.ts); chapter I's is the line's challenge.
// Mimikyu's: Ditto and Noctowl in the crypt, Jigglypuff and Pikachu on the way to the old plaza, Polteageist and Hatterene in the caves, then Mimikyu Sin Disfraz.
const MIMIKYU_SENDA = senda('mimikyu', MIMIKYU_ROADS, [at('duskull', 3, 2, 2), at('phantump', 2, 2, 2), at('gastly', 2, 2, 2), at('impidimp', 1, 2, 2), at('dusclops', 0, 0, 1)]);
const ZORUA_SENDA = senda('zorua', ZORUA_ROADS, [at('drifloon', 3, 2, 2), at('phantump', 2, 2, 2), at('pumpkaboo-small', 2, 2, 2), at('duskull', 1, 2, 2), at('drifblim', 0, 0, 1)]);
const LITWICK_SENDA = senda('litwick', LITWICK_ROADS, [at('phantump', 3, 2, 2), at('gastly', 2, 2, 2), at('spinarak', 1, 2, 2), at('foongus', 1, 1, 2), at('golett', 0, 1, 1), at('haunter', 0, 0, 1)]);
const CUBONE_SENDA = senda('cubone', CUBONE_ROADS, [at('gastly', 2, 2, 2), at('pawniard', 2, 2, 2), at('ekans', 2, 2, 2), at('koffing', 1, 2, 2), at('golett', 0, 1, 1), at('haunter', 0, 0, 1)]);

// The gacha lines' Sendas, one road per chapter (data/story/<line>.ts); chapter I's is the line's challenge.
const ABRA_SENDA = senda('abra', ABRA_ROADS, [at('hoothoot', 3, 2, 2), at('gastly', 2, 2, 2), at('drifloon', 1, 2, 2), at('koffing', 1, 1, 2), at('haunter', 0, 0, 1)]);
const PIPLUP_SENDA = senda('piplup', PIPLUP_ROADS, [at('wooper', 3, 2, 2), at('zubat', 2, 2, 2), at('krabby', 1, 2, 2), at('golett', 0, 1, 2), at('golbat', 0, 0, 1)]);
const SHINX_SENDA = senda('shinx', SHINX_ROADS, [at('zubat', 3, 2, 2), at('drifloon', 2, 2, 2), at('krabby', 2, 2, 2), at('hoothoot', 1, 2, 2), at('chinchou', 0, 1, 2), at('golbat', 0, 0, 1)]);
const AXEW_SENDA = senda('axew', AXEW_ROADS, [at('poochyena', 3, 3, 2), at('ekans', 2, 2, 2), at('corphish', 1, 2, 2), at('croagunk', 0, 1, 2), at('mightyena', 0, 0, 1)]);

export const CHALLENGES: readonly DungeonDef[] = [
  ABRA_SENDA[0],
  PIPLUP_SENDA[0],
  SHINX_SENDA[0],
  AXEW_SENDA[0],
  MIMIKYU_SENDA[0],
  ZORUA_SENDA[0],
  LITWICK_SENDA[0],
  CUBONE_SENDA[0],
];

/** The Sendas' second and third chapter roads (kept apart from `CHALLENGES`: one challenge per line). */
export const SENDA_ROADS: readonly DungeonDef[] = [ABRA_SENDA, PIPLUP_SENDA, SHINX_SENDA, AXEW_SENDA, MIMIKYU_SENDA, ZORUA_SENDA, LITWICK_SENDA, CUBONE_SENDA].flatMap(([, two, three]) => [two, three]);

const ALL: readonly DungeonDef[] = [...DUNGEONS, ...CHALLENGES, ...SENDA_ROADS];

/** The road a run of `dungeon` on `difficulty` walks: a Senda's chapter II road on Hard, its III on Nightmare; the dungeon itself otherwise. */
export function roadFor(dungeon: DungeonDef, difficulty: Difficulty | undefined): DungeonDef {
  if (!dungeon.roads) return dungeon;
  if (difficulty === 'hard') return dungeonById(dungeon.roads.hard);
  if (difficulty === 'nightmare') return dungeonById(dungeon.roads.nightmare);
  return dungeon;
}

/** A road's own challenge (chapter I's, the line's): what records, missions and achievements count a Senda run under. */
export const challengeOfRoad = (dungeon: DungeonDef): DungeonDef => (dungeon.challenge ? (CHALLENGES.find((d) => d.challenge!.line === dungeon.challenge!.line) ?? dungeon) : dungeon);

/** True for the id of a dungeon of this build (challenges too). */
export const isDungeonId = (id: unknown): id is DungeonId => ALL.some((d) => d.id === id);

/** A dungeon by id (challenges too); anything unknown (an old or hostile peer, a bad address) is the Crypt. */
export const dungeonById = (id: unknown): DungeonDef => (isDungeonId(id) ? ALL.find((d) => d.id === id)! : CRYPT);

/** Chance of a table at a floor: index 0 is floor 1, deeper floors use the last entry. */
export const chanceAt = (table: readonly number[], floor: number): number => table[Math.min(floor, table.length) - 1] ?? 0;

/**
 * Music of a floor of a dungeon: its guardian or mid-boss arena, its urgent
 * track, or its floor loop. The endless dungeon rotates its floor tracks by
 * depth band and plays each echo's own track (`floor` is needed there).
 */
export function musicFor(dungeon: DungeonDef, plan: FloorPlan, kind: FloorKind, floor = 1): MusicContext {
  const endless = dungeon.endless;
  if (plan.kind === 'room') {
    if (plan.role === 'echo' && endless) return echoAt(endless, floor).music;
    return plan.role === 'midboss' ? dungeon.music.midboss : dungeon.music.guardian;
  }
  if (kind !== 'normal') return dungeon.music.urgent[kind];
  if (!endless || endless.musicBands.length === 0) return dungeon.music.floor;
  return endless.musicBands[Math.floor((Math.max(1, floor) - 1) / endless.bandFloors) % endless.musicBands.length]!;
}

/** The guardian of a dungeon: the first spawn of its last fixed arena that is not a mid-boss (end screen text). */
export function guardianOf(dungeon: DungeonDef): SpeciesId | null {
  const arena = [...dungeon.plan].reverse().find((plan) => plan.kind === 'room' && plan.role === undefined);
  return arena?.kind === 'room' ? (ROOMS[arena.room].spawns[0]?.species ?? null) : null;
}

/** The decorations a dungeon may ask the renderer for. */
export type DungeonDecor = NonNullable<DungeonDef['decor']>;
