import { MOVES, type MoveId } from '../data/moves';
import { MAX_SLOTS, type SlotKind } from '../data/slots';
import type { SpeciesDef } from '../data/species';

export type LoadoutError =
  | { code: 'slot-count'; expected: number; actual: number }
  | { code: 'unknown-move'; slot: number; moveId: string }
  | { code: 'not-in-movepool'; slot: number; moveId: MoveId }
  | { code: 'wrong-slot-kind'; slot: number; moveId: MoveId; expected: SlotKind; actual: SlotKind }
  | { code: 'duplicate'; slot: number; moveId: MoveId };

const isMoveId = (id: string): id is MoveId => Object.hasOwn(MOVES, id);

/**
 * Checks a loadout against a slot layout: one entry per slot (null = empty),
 * each move known, in the species movepool, of the slot's kind, and unique.
 * Returns every problem found; an empty list means valid.
 */
export function validateLoadout(
  species: SpeciesDef,
  layout: readonly SlotKind[],
  loadout: readonly (string | null)[],
): LoadoutError[] {
  if (layout.length > MAX_SLOTS) return [{ code: 'slot-count', expected: MAX_SLOTS, actual: layout.length }];
  if (loadout.length !== layout.length) return [{ code: 'slot-count', expected: layout.length, actual: loadout.length }];

  const errors: LoadoutError[] = [];
  const seen = new Set<MoveId>();
  loadout.forEach((moveId, slot) => {
    if (moveId === null) return;
    if (!isMoveId(moveId)) {
      errors.push({ code: 'unknown-move', slot, moveId });
      return;
    }
    if (!species.movepool.includes(moveId)) {
      errors.push({ code: 'not-in-movepool', slot, moveId });
      return;
    }
    const expected = layout[slot]!;
    const actual = MOVES[moveId].slot;
    if (actual !== expected) errors.push({ code: 'wrong-slot-kind', slot, moveId, expected, actual });
    else if (seen.has(moveId)) errors.push({ code: 'duplicate', slot, moveId });
    seen.add(moveId);
  });
  return errors;
}
