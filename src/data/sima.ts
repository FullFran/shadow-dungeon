import type { DungeonId, TilePalette } from './dungeons';

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
