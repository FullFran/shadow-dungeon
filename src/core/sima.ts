import { dungeonById, type TilePalette } from '../data/dungeons';
import type { SimaBand } from '../data/sima';

/**
 * Rules of the Sima del Eclipse remaster (docs/gdd.md §3), pure: its depth
 * bands; floor events, pacts and the Eclipse Echo's volleys live beside them.
 */

/** Index of the band a floor belongs to: the last one whose `fromFloor` is reached. */
export function simaBandIndex(bands: readonly SimaBand[], floor: number): number {
  let index = 0;
  bands.forEach((band, i) => {
    if (floor >= band.fromFloor) index = i;
  });
  return index;
}

export const simaBandAt = (bands: readonly SimaBand[], floor: number): SimaBand => bands[simaBandIndex(bands, floor)]!;

/** True on the first floor of a new band (floor 1 opens with the dungeon's own title instead). */
export const bandStartsAt = (bands: readonly SimaBand[], floor: number): boolean => floor > 1 && simaBandIndex(bands, floor) !== simaBandIndex(bands, floor - 1);

/** The floor card's lore line: the band's lines in turn from its first floor. */
export function bandLoreKey(bands: readonly SimaBand[], floor: number): string | undefined {
  const band = simaBandAt(bands, floor);
  if (band.loreKeys.length === 0) return undefined;
  return band.loreKeys[(Math.max(0, floor - band.fromFloor) % band.loreKeys.length + band.loreKeys.length) % band.loreKeys.length];
}

/** The colours of a band: a dungeon's palette, or its own. */
export const simaPalette = (band: SimaBand): TilePalette => (typeof band.palette === 'string' ? dungeonById(band.palette).palette : band.palette);
