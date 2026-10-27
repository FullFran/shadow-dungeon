import type { KeyValueStore } from '../adapters/storage';
import { DUNGEONS, guardianOf } from '../data/dungeons';
import type { SpeciesId } from '../data/species';
import { clearedDungeons, readRecords } from '../town/records';
import { hasSeen } from './guardian-cinematic';
import type { GallerySeen } from './lore-gallery';
import { hasSeenPrologue } from './prologue-seen';
import { loadSave } from './save';
import { simaScenesSeen } from './sima-cinematic';

/**
 * What the gallery (app/lore-gallery.ts) may play for this player, read and
 * never written: the device's "seen" flags (the prologue, the Sima's scenes,
 * the guardians), widened by what the progress proves was seen.
 *
 * - The prologue: also once a starter is chosen (it plays before the quiz,
 *   so any profile past it has seen it, a restored one on a new device too).
 * - A guardian: also once its dungeon is cleared in the run records (both
 *   its cinematics played on the way; the records travel with the profile).
 * - A Senda chapter: closed in the save's `story` (cloud profile included).
 */
export function readGallerySeen(store: KeyValueStore, starterChosen: boolean): GallerySeen {
  const cleared = clearedDungeons(readRecords(store));
  const fallen = new Set<SpeciesId>(DUNGEONS.filter((d) => cleared.has(d.id)).flatMap((d) => guardianOf(d) ?? []));
  return {
    prologue: starterChosen || hasSeenPrologue(store),
    sima: simaScenesSeen(store),
    guardian: (species, phase) => fallen.has(species) || hasSeen(store, species, phase),
    story: loadSave(store).story,
  };
}
