import { describe, expect, it } from 'vitest';
import { padLoadout, validateLoadout } from '../../src/core/loadout';
import { MAX_SLOTS, PLAYER_SLOT_LAYOUT } from '../../src/data/slots';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';
import { createPlayer } from '../../src/core/world';
import { step } from '../../src/core/step';
import { FIXED_DT_MS } from '../../src/core/timestep';
import { vec } from '../../src/core/vec';
import { IDLE, input, world } from './helpers';

describe('four slots: the layout', () => {
  it('is fast, heavy, boost, area (at most MAX_SLOTS)', () => {
    expect(PLAYER_SLOT_LAYOUT).toEqual(['fast', 'heavy', 'boost', 'area']);
    expect(PLAYER_SLOT_LAYOUT.length).toBeLessThanOrEqual(MAX_SLOTS);
  });

  it('every starter default fits it (boost and area may stay empty)', () => {
    for (const id of PLAYABLE_SPECIES) {
      const species = SPECIES[id];
      expect(species.defaultLoadout).toHaveLength(4);
      expect(validateLoadout(species, PLAYER_SLOT_LAYOUT, species.defaultLoadout), id).toEqual([]);
    }
  });

  it('an old two-slot loadout is padded with the species defaults for the new slots', () => {
    const mimikyu = SPECIES.mimikyu;
    expect(padLoadout(mimikyu, ['shadow-sneak', 'shadow-ball'])).toEqual(['shadow-sneak', 'shadow-ball', mimikyu.defaultLoadout[2], mimikyu.defaultLoadout[3]]);
    expect(padLoadout(mimikyu, mimikyu.defaultLoadout)).toEqual(mimikyu.defaultLoadout);
    expect(createPlayer(vec(0, 0), 'mimikyu', ['shadow-sneak', 'shadow-ball']).loadout).toHaveLength(4);
  });
});

describe('four slots: back-compat inputs', () => {
  it('a two-entry slots array means the new slots are not held', () => {
    const state = world();
    const old = step(state, { ...IDLE, slots: [true, false], slotMouse: [true, false] }, FIXED_DT_MS);
    const full = step(state, { ...IDLE, slots: [true, false, false, false], slotMouse: [true, false, false, false] }, FIXED_DT_MS);
    expect(old.player).toEqual(full.player);
    expect(old.player.slotsHeld).toEqual([true, false, false, false]);
  });

  it('pressing an empty slot does nothing', () => {
    const state = world();
    const player = { ...state.player, loadout: [state.player.loadout[0]!, state.player.loadout[1]!, null, null] };
    const next = step({ ...state, player }, input({ slots: [false, false, true, true] }), FIXED_DT_MS);
    expect(next.player.action).toBeNull();
  });
});
