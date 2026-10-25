import type { MoveId } from './moves';
import type { SPRITE_KEYS } from './sprites';
import type { PokemonType } from './types';

export type SpeciesId =
  | 'mimikyu'
  | 'zorua'
  | 'litwick'
  | 'cubone'
  | 'poochyena'
  | 'gastly'
  | 'aegislash'
  | 'phantump'
  | 'pumpkaboo-small'
  | 'pumpkaboo-super'
  | 'foongus'
  | 'spinarak'
  | 'hoothoot'
  | 'trevenant'
  | 'decidueye';
export type PassiveId = 'disguise' | 'illusion' | 'flash-fire' | 'battle-armor';

export interface SpeciesDef {
  id: SpeciesId;
  types: readonly PokemonType[];
  maxHp: number;
  /** Body radius for hurtboxes and collisions, in world pixels. */
  radius: number;
  sprite: keyof typeof SPRITE_KEYS;
  /** Sheet drawn once the passive is spent for the room (Mimikyu's Busted form). */
  spentSprite?: keyof typeof SPRITE_KEYS;
  /** Playable species: walking speed relative to `TUNING.player.moveSpeed` (default 1). */
  speedScale?: number;
  /** Moves the species can equip; empty for enemy-only species in M0. */
  movepool: readonly MoveId[];
  /** Default loadout, aligned with the slot layout. */
  defaultLoadout: readonly (MoveId | null)[];
  passive?: PassiveId;
}

/**
 * HP values and speed scales are provisional. The playable starters share
 * one damage and safety budget with distinct shapes: Zorua is fast and
 * fragile, Litwick slow and fragile but ranged, Cubone slow and sturdy.
 * Enemy behaviour lives in its own data/state machines.
 */
export const SPECIES: Record<SpeciesId, SpeciesDef> = {
  mimikyu: {
    id: 'mimikyu',
    types: ['ghost', 'fairy'],
    maxHp: 100,
    radius: 10,
    sprite: 'mimikyu',
    spentSprite: 'mimikyuBusted',
    movepool: ['shadow-claw', 'shadow-sneak', 'play-rough', 'shadow-ball'],
    defaultLoadout: ['shadow-claw', 'play-rough'],
    passive: 'disguise',
  },
  zorua: {
    id: 'zorua',
    types: ['dark'],
    maxHp: 90,
    radius: 10,
    sprite: 'zorua',
    speedScale: 1.12,
    movepool: ['fury-swipes', 'feint-attack', 'night-daze', 'foul-play'],
    defaultLoadout: ['feint-attack', 'night-daze'],
    passive: 'illusion',
  },
  litwick: {
    id: 'litwick',
    types: ['ghost', 'fire'],
    maxHp: 85,
    radius: 10,
    sprite: 'litwick',
    speedScale: 0.95,
    movepool: ['ember', 'astonish', 'hex', 'inferno'],
    defaultLoadout: ['ember', 'hex'],
    passive: 'flash-fire',
  },
  cubone: {
    id: 'cubone',
    types: ['ground'],
    maxHp: 115,
    radius: 10,
    sprite: 'cubone',
    speedScale: 0.92,
    movepool: ['bone-club', 'bone-rush', 'bonemerang', 'stomping-tantrum'],
    defaultLoadout: ['bone-club', 'bonemerang'],
    passive: 'battle-armor',
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
  // Misty Forest (docs/species-candidates.md §2); HP provisional.
  phantump: { id: 'phantump', types: ['ghost', 'grass'], maxHp: 60, radius: 11, sprite: 'phantump', movepool: [], defaultLoadout: [] },
  'pumpkaboo-small': { id: 'pumpkaboo-small', types: ['ghost', 'grass'], maxHp: 30, radius: 9, sprite: 'pumpkabooSmall', movepool: [], defaultLoadout: [] },
  'pumpkaboo-super': { id: 'pumpkaboo-super', types: ['ghost', 'grass'], maxHp: 170, radius: 15, sprite: 'pumpkabooSuper', movepool: [], defaultLoadout: [] },
  foongus: { id: 'foongus', types: ['grass', 'poison'], maxHp: 65, radius: 11, sprite: 'foongus', movepool: [], defaultLoadout: [] },
  spinarak: { id: 'spinarak', types: ['bug', 'poison'], maxHp: 50, radius: 10, sprite: 'spinarak', movepool: [], defaultLoadout: [] },
  hoothoot: { id: 'hoothoot', types: ['normal', 'flying'], maxHp: 55, radius: 11, sprite: 'hoothoot', movepool: [], defaultLoadout: [] },
  trevenant: { id: 'trevenant', types: ['ghost', 'grass'], maxHp: 520, radius: 18, sprite: 'trevenant', movepool: [], defaultLoadout: [] },
  decidueye: { id: 'decidueye', types: ['grass', 'ghost'], maxHp: 780, radius: 15, sprite: 'decidueye', movepool: [], defaultLoadout: [] },
};

/** Species a player can pick, in picker order (Mimikyu first, then the three starters). */
export const PLAYABLE_SPECIES: readonly SpeciesId[] = ['mimikyu', 'zorua', 'litwick', 'cubone'];

export const isPlayable = (id: unknown): id is SpeciesId => PLAYABLE_SPECIES.some((s) => s === id);
