import type { DungeonDef } from '../data/dungeons';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../data/species';
import { lookKey, SPRITE_KEYS, SPRITES } from '../data/sprites';
import { sheetKey } from './asset-keys';

/**
 * Which sheets a screen needs (odd/tasks/loading-errors.md). Sheets are loaded
 * by need, never all at boot: the hub needs the partner's idle; a run needs the player whole and the species of
 * the first floor right away, the rest of the dungeon's pool a moment later.
 * Anything not named here still loads on first use (assets.ts `get`).
 */

/** Every animation sheet of one sprite folder ("0778/0000"). */
export function sheetsOfSprite(sprite: string): string[] {
  const meta = SPRITES.sprites[sprite];
  return meta ? [...new Set(Object.values(meta.anims).map((anim) => sheetKey(sprite, anim.file)))] : [];
}

/** One animation of a sprite, if the sprite has it. */
function animSheet(sprite: string, anim: string): string[] {
  const meta = SPRITES.sprites[sprite]?.anims[anim];
  return meta ? [sheetKey(sprite, meta.file)] : [];
}

/** What the title hub draws: the partner's idle (its shiny or female look); the backdrop has no residents since 2026-11-04. */
export function hubKeys(species: SpeciesId, shiny: boolean, female: boolean): string[] {
  const partner = lookKey(SPRITE_KEYS[SPECIES[species].sprite], shiny, female);
  return animSheet(partner, 'Idle');
}

/**
 * What a run of `dungeon` needs. `now`: the player in every animation and the
 * species that can appear on floor 1 (and their escorts). `later`: the rest of
 * the pool, loaded in the background while floor 1 is played.
 */
export function runKeys(dungeon: DungeonDef, species: SpeciesId, shiny: boolean, female: boolean): { now: string[]; later: string[] } {
  const sprites = (id: SpeciesId): string => SPRITE_KEYS[SPECIES[id].sprite];
  const first = new Set<string>([lookKey(SPRITE_KEYS[SPECIES[species].sprite], shiny, female)]);
  const rest = new Set<string>();
  for (const entry of dungeon.spawns.pool) {
    const onFirstFloor = (entry.weights[0] ?? 0) > 0;
    (onFirstFloor ? first : rest).add(sprites(entry.species));
    if (entry.escort) (onFirstFloor ? first : rest).add(sprites(entry.escort.species));
  }
  for (const sprite of first) rest.delete(sprite);
  const keysOf = (set: Set<string>) => [...set].flatMap(sheetsOfSprite);
  const now = keysOf(first);
  const later = keysOf(rest).filter((k) => !now.includes(k));
  return { now, later };
}

/** The idle sheet of every playable species in each look it can wear: the picker, the gacha, the Maestro and the town read them. */
export function idlePrefetchKeys(): string[] {
  const keys = new Set<string>();
  for (const species of PLAYABLE_SPECIES) {
    const base = SPRITE_KEYS[SPECIES[species].sprite];
    for (const shiny of [false, true]) for (const female of [false, true]) for (const key of animSheet(lookKey(base, shiny, female), 'Idle')) keys.add(key);
  }
  return [...keys];
}
