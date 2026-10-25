import { CRYPT_SPAWNS, RUN_PLAN, URGENT, type FloorKind, type FloorPlan, type SpawnTuning, type WaterTuning } from './dungeon';
import { DUNGEON_LORE, type DungeonLore } from './dungeon-lore';
import type { MusicContext } from './music';
import { ROOMS } from './rooms';
import type { SpeciesId } from './species';
import { echoAt, ENDLESS, isEchoFloor, type EndlessDef } from './endless';

/**
 * Every dungeon as data (docs/gdd.md §3): its name and lore, its floors
 * (generated ones and fixed arenas: a mid-boss, the guardian), the enemies
 * of its generated floors by depth, its urgent floors and their weights, the
 * music of each kind of floor, the colours of its tiles and what unlocks it.
 * The run (core/run.ts) reads everything from here.
 */
export type DungeonId = 'crypt-of-the-sword-king' | 'misty-forest' | 'eclipse-chasm' | 'flooded-caves';

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
  /** Decoration drawn over its tiles and arenas (presentation only): the Crypt's candles, graves and braziers, the Forest's roots, mushrooms and mist, the caves' water and crystals. */
  decor?: 'crypt' | 'forest' | 'caves';
  /** The Forest's event: on some generated floors a spirit light leads to a hidden berry cache (core/wisp.ts). */
  wisp?: WispDef;
  /** Shallow water pools on its generated floors (core/water.ts): they slow non-Water walkers. */
  water?: WaterTuning;
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
  music: { floor: 'crypt', urgent: { collapse: 'collapse', fog: 'crypt', flood: 'crypt' }, midboss: 'guardian', guardian: 'guardian' },
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
    ],
  },
  urgent: [
    { kind: 'fog', chance: [0, 0.3, 0.35, 0, 0.4, 0.45, 0.5] },
    { kind: 'collapse', chance: [0, 0, 0.1, 0, 0.1, 0.15, 0.15] },
  ],
  music: { floor: 'forest', urgent: { collapse: 'collapse', fog: 'forest-fog', flood: 'forest' }, midboss: 'guardian', guardian: 'forest-guardian' },
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
    ],
  },
  urgent: [
    { kind: 'flood', chance: [0, 0.25, 0.3, 0.35, 0, 0.35, 0.4, 0.45, 0.5] },
    { kind: 'collapse', chance: [0, 0, 0, 0.08, 0, 0.1, 0.1, 0.12, 0.12] },
  ],
  music: { floor: 'caves', urgent: { collapse: 'collapse', fog: 'caves', flood: 'caves-flood' }, midboss: 'guardian', guardian: 'caves-guardian' },
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
  music: { floor: 'crypt', urgent: { collapse: 'collapse', fog: 'forest-fog', flood: 'crypt' }, midboss: 'guardian', guardian: 'guardian' },
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
};

/** Every dungeon, in the order the dungeon select lists them. */
export const DUNGEONS: readonly DungeonDef[] = [CRYPT, FOREST, CAVES, ECLIPSE];

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

const isDungeonId = (id: unknown): id is DungeonId => DUNGEONS.some((d) => d.id === id);

/** A dungeon by id; anything unknown (an old or hostile peer, a bad address) is the Crypt. */
export const dungeonById = (id: unknown): DungeonDef => (isDungeonId(id) ? DUNGEONS.find((d) => d.id === id)! : CRYPT);

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
