import type { DungeonId, TilePalette } from './dungeons';
import type { SpeciesId } from './species';

/**
 * The Sima del Eclipse remaster (docs/gdd.md §3 "La Sima del Eclipse"):
 * depth bands, floor events and its own boss, as data. Every value is
 * provisional. The core reads it through `ENDLESS` (data/endless.ts) and
 * core/sima.ts.
 */

export type SimaBandId = 'crypt' | 'forest' | 'abyss';

/**
 * A depth band: the look of a stretch of floors. The first ones borrow a
 * dungeon's palette (and decoration); the abyss has its own palette and
 * floats its rooms over the void (presentation only: walls still block).
 */
export interface SimaBand {
  id: SimaBandId;
  /** First floor of the band; it lasts until the next band's. */
  fromFloor: number;
  /** A dungeon's palette (by id) or the band's own. */
  palette: DungeonId | TilePalette;
  decor?: 'crypt';
  /** Rooms are rock islands over the void, with red light falling through it. */
  abyss?: true;
  nameKey: string;
  subtitleKey: string;
  /** One line per floor on the floor card, in turn. */
  loreKeys: readonly string[];
}

/** The abyss: violet void, rust-red rock, the eclipse's light on the rims. */
export const ABYSS_PALETTE: TilePalette = {
  tileFloorA: '#3a2a33',
  tileFloorB: '#3f2d37',
  tileWallTop: '#0c0710',
  tileWallBlock: '#140b17',
  tileWallFace: '#2a1620',
  tileWallLip: '#a2433f',
  mapRim: '#7a2a3a',
  floorA: '#2c1f28',
  floorB: '#31222c',
  wall: '#06030a',
  wallEdge: '#a2433f',
  pillarTop: '#5a3446',
  pillarSide: '#331c2a',
};

const loreKeys = (band: SimaBandId, count: number): string[] => Array.from({ length: count }, (_, i) => `sima.band.${band}.lore.${i + 1}`);

/** Bands every 10 floors; append one to deepen the Sima (the last one lasts forever). */
export const SIMA_BANDS: readonly SimaBand[] = [
  { id: 'crypt', fromFloor: 1, palette: 'crypt-of-the-sword-king', decor: 'crypt', nameKey: 'sima.band.crypt.name', subtitleKey: 'sima.band.crypt.subtitle', loreKeys: loreKeys('crypt', 4) },
  { id: 'forest', fromFloor: 11, palette: 'misty-forest', nameKey: 'sima.band.forest.name', subtitleKey: 'sima.band.forest.subtitle', loreKeys: loreKeys('forest', 4) },
  { id: 'abyss', fromFloor: 21, palette: ABYSS_PALETTE, abyss: true, nameKey: 'sima.band.abyss.name', subtitleKey: 'sima.band.abyss.subtitle', loreKeys: loreKeys('abyss', 5) },
];

/**
 * Tougher, not more (user feedback 2026-10-25): depth brings Sima elites,
 * tinted enemies with one extra trait. `swift` acts faster, `volley` (casters
 * only) throws two more shots beside each one, `armored` shrugs off the first
 * hit, `enrage` speeds up once hurt below `enrageBelow` of its HP. Chance per
 * enemy: `start` from `fromFloor`, + `perFloor`, at most `max`.
 */
export type EliteTrait = 'swift' | 'volley' | 'armored' | 'enrage';

export interface SimaElites {
  fromFloor: number;
  start: number;
  perFloor: number;
  max: number;
  /** Elites spawn with this much more HP (on top of the floor's scale). */
  hpScale: number;
  swiftScale: number;
  enrageScale: number;
  enrageBelow: number;
  /** Volley: the two extra shots fly this many degrees to each side. */
  volleyDegrees: number;
  traits: readonly EliteTrait[];
  /** Presentation: the glow of each trait. */
  tints: Readonly<Record<EliteTrait, string>>;
}

export const SIMA_ELITES: SimaElites = {
  fromFloor: 6,
  start: 0.06,
  perFloor: 0.015,
  max: 0.4,
  hpScale: 1.35,
  swiftScale: 1.3,
  enrageScale: 1.5,
  enrageBelow: 0.4,
  volleyDegrees: 16,
  traits: ['swift', 'volley', 'armored', 'enrage'],
  tints: { swift: '#7fe3ff', volley: '#d68cff', armored: '#c9d2e0', enrage: '#ff5a3a' },
};

/**
 * Mixed squads: a room's enemies replaced by a set that combines roles (a
 * tank with a caster behind it, two blades with a gunner...), from
 * `minDepth` on. Never more enemies than the room had. Append to add one.
 */
export interface SimaSquad {
  minDepth: number;
  members: readonly SpeciesId[];
}

export const SIMA_SQUADS: readonly SimaSquad[] = [
  { minDepth: 4, members: ['golett', 'duskull'] },
  { minDepth: 6, members: ['pawniard', 'gastly', 'pawniard'] },
  { minDepth: 8, members: ['croagunk', 'spinarak'] },
  { minDepth: 10, members: ['pumpkaboo-super', 'hoothoot', 'litleo'] },
  { minDepth: 12, members: ['grimer', 'houndour', 'chinchou'] },
  { minDepth: 15, members: ['clauncher', 'pawniard', 'koffing'] },
];

/** Chance that a room with two or more enemies holds a squad instead: from floor 4, rising, capped. */
export const SQUAD_CHANCE = { fromFloor: 4, start: 0.15, perFloor: 0.015, max: 0.5 } as const;
