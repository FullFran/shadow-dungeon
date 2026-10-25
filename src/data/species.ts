import type { MoveId } from './moves';
import type { SPRITE_KEYS } from './sprites';
import type { PokemonType } from './types';

export type SpeciesId = 'mimikyu' | 'poochyena' | 'gastly' | 'aegislash';
export type PassiveId = 'disguise';

export interface SpeciesDef {
  id: SpeciesId;
  types: readonly PokemonType[];
  maxHp: number;
  /** Body radius for hurtboxes and collisions, in world pixels. */
  radius: number;
  sprite: keyof typeof SPRITE_KEYS;
  /** Moves the species can equip; empty for enemy-only species in M0. */
  movepool: readonly MoveId[];
  /** Default loadout, aligned with the slot layout. */
  defaultLoadout: readonly (MoveId | null)[];
  passive?: PassiveId;
}

/** HP values are provisional. Enemy behaviour lives in its own data/state machines. */
export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  mimikyu: {
    id: 'mimikyu',
    types: ['ghost', 'fairy'],
    maxHp: 100,
    radius: 10,
    sprite: 'mimikyu',
    movepool: ['shadow-claw', 'shadow-sneak', 'play-rough', 'shadow-ball'],
    defaultLoadout: ['shadow-claw', 'play-rough'],
    passive: 'disguise',
  },
  poochyena: {
    id: 'poochyena',
    types: ['dark'],
    maxHp: 70,
    radius: 11,
    sprite: 'poochyena',
    movepool: [],
    defaultLoadout: [],
  },
  gastly: {
    id: 'gastly',
    types: ['poison', 'ghost'],
    maxHp: 55,
    radius: 12,
    sprite: 'gastly',
    movepool: [],
    defaultLoadout: [],
  },
  aegislash: {
    id: 'aegislash',
    types: ['steel', 'ghost'],
    maxHp: 600,
    radius: 16,
    sprite: 'aegislashShield',
    movepool: [],
    defaultLoadout: [],
  },
};
