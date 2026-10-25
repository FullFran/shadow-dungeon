import { describe, expect, it } from 'vitest';
import { validateLoadout } from '../../src/core/loadout';
import { M0_SLOT_LAYOUT } from '../../src/data/slots';
import { SPECIES } from '../../src/data/species';

const mimikyu = SPECIES.mimikyu;

describe('loadout validation', () => {
  it('accepts the default and every fast x heavy combination of the movepool', () => {
    expect(validateLoadout(mimikyu, M0_SLOT_LAYOUT, mimikyu.defaultLoadout)).toEqual([]);
    for (const fast of ['shadow-claw', 'shadow-sneak']) {
      for (const heavy of ['play-rough', 'shadow-ball']) {
        expect(validateLoadout(mimikyu, M0_SLOT_LAYOUT, [fast, heavy])).toEqual([]);
      }
    }
  });

  it('rejects a move in a slot of another kind', () => {
    expect(validateLoadout(mimikyu, M0_SLOT_LAYOUT, ['play-rough', 'shadow-claw'])).toEqual([
      { code: 'wrong-slot-kind', slot: 0, moveId: 'play-rough', expected: 'fast', actual: 'heavy' },
      { code: 'wrong-slot-kind', slot: 1, moveId: 'shadow-claw', expected: 'heavy', actual: 'fast' },
    ]);
  });

  it('rejects unknown moves, moves outside the movepool and duplicates', () => {
    expect(validateLoadout(mimikyu, M0_SLOT_LAYOUT, ['tackle', null])).toEqual([
      { code: 'unknown-move', slot: 0, moveId: 'tackle' },
    ]);
    expect(validateLoadout(SPECIES.gastly, M0_SLOT_LAYOUT, ['shadow-claw', null])).toEqual([
      { code: 'not-in-movepool', slot: 0, moveId: 'shadow-claw' },
    ]);
    expect(validateLoadout(mimikyu, ['fast', 'fast'], ['shadow-claw', 'shadow-claw'])).toEqual([
      { code: 'duplicate', slot: 1, moveId: 'shadow-claw' },
    ]);
  });

  it('takes the slot count from the layout, so extra slots need no code change', () => {
    expect(validateLoadout(mimikyu, M0_SLOT_LAYOUT, ['shadow-claw'])).toEqual([
      { code: 'slot-count', expected: 2, actual: 1 },
    ]);
    expect(validateLoadout(mimikyu, ['fast', 'heavy', 'boost'], ['shadow-claw', 'play-rough', null])).toEqual([]);
    expect(validateLoadout(mimikyu, ['fast', 'heavy', 'boost', 'fast', 'heavy'], [null, null, null, null, null])).toEqual([
      { code: 'slot-count', expected: 4, actual: 5 },
    ]);
  });
});
