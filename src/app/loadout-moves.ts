import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import { PLAYER_SLOT_LAYOUT, type SlotKind } from '../data/slots';
import { MAX_RANK } from '../data/tutor';
import { slotOptions } from './settings';
import { passiveOf } from './species-picker';

/**
 * The model of the loadout's moves step (src/app/loadout.ts draws it, src/app/loadout-moves-view.ts
 * is not needed: the view lives in loadout.ts): one tile per equip slot, the moves a slot can take,
 * the rank pips and the species' ability line. Pure, so each rule is a test.
 */

export interface SlotTile {
  slot: number;
  kind: SlotKind;
  equipped: MoveId | null;
  /** The moves this slot can take for the species (known ones only when `known` is given). */
  choices: MoveId[];
}

/** One tile per slot of the layout: what is equipped there and what could be. */
export const slotTiles = (species: SpeciesId, loadout: readonly (MoveId | null)[], known?: readonly MoveId[]): SlotTile[] =>
  PLAYER_SLOT_LAYOUT.map((kind, slot) => ({ slot, kind, equipped: loadout[slot] ?? null, choices: slotOptions(kind, species, known) }));

/** The loadout with `id` in `slot`; every other slot stays as it was. */
export const equipMove = (loadout: readonly (MoveId | null)[], slot: number, id: MoveId): (MoveId | null)[] => PLAYER_SLOT_LAYOUT.map((_, i) => (i === slot ? id : (loadout[i] ?? null)));

/** Rank pips: how many of the maximum are owned. */
export const rankPips = (rank: number): { on: number; total: number } => ({ on: Math.max(0, Math.min(MAX_RANK, Math.floor(rank))), total: MAX_RANK });

export type AbilityLine = { kind: 'passive'; nameKey: string; descriptionKey: string } | { kind: 'none'; key: string };

/** The species' passive, or the plain "no passive" line. The run goal never stands here. */
export function abilityOf(species: SpeciesId): AbilityLine {
  const passive = passiveOf(species);
  return passive ? { kind: 'passive', ...passive } : { kind: 'none', key: 'loadout.noPassive' };
}

/** The slot the step opens on: the first one with any move to choose. */
export const defaultSlot = (tiles: readonly SlotTile[]): number => Math.max(0, tiles.findIndex((tile) => tile.choices.length > 0));
