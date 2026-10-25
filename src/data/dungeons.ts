import { CRYPT_SPAWNS, RUN_PLAN, URGENT, type FloorKind, type FloorPlan, type SpawnTuning } from './dungeon';
import { DUNGEON_LORE, type DungeonLore } from './dungeon-lore';
import type { MusicContext } from './music';

/**
 * Every dungeon as data (docs/gdd.md §3): its name and lore, its floors
 * (generated ones and fixed arenas: a mid-boss, the guardian), the enemies
 * of its generated floors by depth, its urgent floors and their weights, the
 * music of each kind of floor, the colours of its tiles and what unlocks it.
 * The run (core/run.ts) reads everything from here.
 */
export type DungeonId = 'crypt-of-the-sword-king';

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
}

const loreOf = (id: string): DungeonLore => DUNGEON_LORE.find((l) => l.id === id)!;

export const CRYPT: DungeonDef = {
  id: 'crypt-of-the-sword-king',
  lore: loreOf('crypt-of-the-sword-king'),
  plan: RUN_PLAN,
  spawns: CRYPT_SPAWNS,
  urgent: [{ kind: 'collapse', chance: URGENT.collapseChance }],
  music: { floor: 'crypt', urgent: { collapse: 'collapse' }, midboss: 'guardian', guardian: 'guardian' },
  palette: {
    tileFloorA: '#2b2533',
    tileFloorB: '#2f2938',
    tileWallTop: '#1a1523',
    tileWallBlock: '#211b2c',
    tileWallFace: '#433a57',
    tileWallLip: '#5a4f73',
    mapRim: '#4b4163',
    floorA: '#1d1a26',
    floorB: '#211d2c',
    wall: '#0d0b12',
    wallEdge: '#3a3350',
    pillarTop: '#4a4360',
    pillarSide: '#2c2740',
  },
  unlockedBy: null,
};

/** Every dungeon, in the order the dungeon select lists them. */
export const DUNGEONS: readonly DungeonDef[] = [CRYPT];

const isDungeonId = (id: unknown): id is DungeonId => DUNGEONS.some((d) => d.id === id);

/** A dungeon by id; anything unknown (an old or hostile peer, a bad address) is the Crypt. */
export const dungeonById = (id: unknown): DungeonDef => (isDungeonId(id) ? DUNGEONS.find((d) => d.id === id)! : CRYPT);

/** Chance of a table at a floor: index 0 is floor 1, deeper floors use the last entry. */
export const chanceAt = (table: readonly number[], floor: number): number => table[Math.min(floor, table.length) - 1] ?? 0;

/** Music of a floor of a dungeon: its guardian or mid-boss arena, its urgent track, or its floor loop. */
export function musicFor(dungeon: DungeonDef, plan: FloorPlan, kind: FloorKind): MusicContext {
  if (plan.kind === 'room') return plan.role === 'midboss' ? dungeon.music.midboss : dungeon.music.guardian;
  return kind === 'normal' ? dungeon.music.floor : dungeon.music.urgent[kind];
}
