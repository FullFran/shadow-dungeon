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
  | 'decidueye'
  | 'zubat'
  | 'tentacool'
  | 'chinchou'
  | 'corphish'
  | 'clauncher'
  | 'wooper'
  | 'grimer'
  | 'koffing'
  | 'ekans'
  | 'croagunk'
  | 'stunky'
  | 'houndour'
  | 'slugma'
  | 'litleo'
  | 'duskull'
  | 'golett'
  | 'pawniard'
  | 'sableye'
  | 'impidimp'
  | 'shroomish'
  | 'drifloon'
  | 'krabby'
  | 'shellos'
  | 'remoraid'
  | 'lanturn'
  | 'dhelmise'
  | 'venipede'
  | 'salandit'
  | 'skrelp'
  | 'salazzle'
  | 'nihilego'
  // The Sima del Eclipse's own (data/sima.ts): a monster nest and the hunter floor's pursuer.
  | 'eclipse-nest'
  | 'eclipse-hunter'
  // Its own boss, a corrupted shadow of Mimikyu (the busted form's full sheet set, tinted in the eclipse's colours).
  | 'eclipse-echo';
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
  /** Default loadout, aligned with the slot layout (fast, heavy, boost, area; null = empty slot). */
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
    movepool: ['shadow-claw', 'shadow-sneak', 'play-rough', 'shadow-ball', 'swords-dance'],
    defaultLoadout: ['shadow-claw', 'play-rough', 'swords-dance', null],
    passive: 'disguise',
  },
  zorua: {
    id: 'zorua',
    types: ['dark'],
    maxHp: 90,
    radius: 10,
    sprite: 'zorua',
    speedScale: 1.12,
    movepool: ['fury-swipes', 'feint-attack', 'night-daze', 'foul-play', 'nasty-plot'],
    defaultLoadout: ['feint-attack', 'night-daze', 'nasty-plot', null],
    passive: 'illusion',
  },
  litwick: {
    id: 'litwick',
    types: ['ghost', 'fire'],
    maxHp: 95,
    radius: 10,
    sprite: 'litwick',
    speedScale: 0.95,
    movepool: ['ember', 'astonish', 'hex', 'inferno', 'will-o-wisp'],
    defaultLoadout: ['ember', 'hex', 'will-o-wisp', null],
    passive: 'flash-fire',
  },
  cubone: {
    id: 'cubone',
    types: ['ground'],
    maxHp: 115,
    radius: 10,
    sprite: 'cubone',
    speedScale: 0.92,
    movepool: ['bone-club', 'bone-rush', 'bonemerang', 'stomping-tantrum', 'bulk-up'],
    defaultLoadout: ['bone-club', 'bonemerang', 'bulk-up', null],
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
  // Experimental roster (EXPERIMENTAL_ENEMIES in enemies.ts): Flooded Caves, Toxic Swamp and Fire species; HP provisional.
  zubat: { id: 'zubat', types: ['poison', 'flying'], maxHp: 34, radius: 9, sprite: 'zubat', movepool: [], defaultLoadout: [] },
  tentacool: { id: 'tentacool', types: ['water', 'poison'], maxHp: 70, radius: 11, sprite: 'tentacool', movepool: [], defaultLoadout: [] },
  chinchou: { id: 'chinchou', types: ['water', 'electric'], maxHp: 60, radius: 11, sprite: 'chinchou', movepool: [], defaultLoadout: [] },
  corphish: { id: 'corphish', types: ['water'], maxHp: 80, radius: 11, sprite: 'corphish', movepool: [], defaultLoadout: [] },
  clauncher: { id: 'clauncher', types: ['water'], maxHp: 65, radius: 11, sprite: 'clauncher', movepool: [], defaultLoadout: [] },
  wooper: { id: 'wooper', types: ['water', 'ground'], maxHp: 110, radius: 12, sprite: 'wooper', movepool: [], defaultLoadout: [] },
  grimer: { id: 'grimer', types: ['poison'], maxHp: 120, radius: 12, sprite: 'grimer', movepool: [], defaultLoadout: [] },
  koffing: { id: 'koffing', types: ['poison'], maxHp: 70, radius: 12, sprite: 'koffing', movepool: [], defaultLoadout: [] },
  ekans: { id: 'ekans', types: ['poison'], maxHp: 65, radius: 11, sprite: 'ekans', movepool: [], defaultLoadout: [] },
  croagunk: { id: 'croagunk', types: ['poison', 'fighting'], maxHp: 90, radius: 11, sprite: 'croagunk', movepool: [], defaultLoadout: [] },
  stunky: { id: 'stunky', types: ['poison', 'dark'], maxHp: 45, radius: 10, sprite: 'stunky', movepool: [], defaultLoadout: [] },
  houndour: { id: 'houndour', types: ['dark', 'fire'], maxHp: 70, radius: 11, sprite: 'houndour', movepool: [], defaultLoadout: [] },
  slugma: { id: 'slugma', types: ['fire'], maxHp: 85, radius: 11, sprite: 'slugma', movepool: [], defaultLoadout: [] },
  litleo: { id: 'litleo', types: ['fire', 'normal'], maxHp: 60, radius: 10, sprite: 'litleo', movepool: [], defaultLoadout: [] },
  // Crypt of the Sword King remaster; HP provisional.
  duskull: { id: 'duskull', types: ['ghost'], maxHp: 70, radius: 11, sprite: 'duskull', movepool: [], defaultLoadout: [] },
  golett: { id: 'golett', types: ['ground', 'ghost'], maxHp: 160, radius: 14, sprite: 'golett', movepool: [], defaultLoadout: [] },
  pawniard: { id: 'pawniard', types: ['dark', 'steel'], maxHp: 34, radius: 9, sprite: 'pawniard', movepool: [], defaultLoadout: [] },
  sableye: { id: 'sableye', types: ['dark', 'ghost'], maxHp: 460, radius: 13, sprite: 'sableye', movepool: [], defaultLoadout: [] },
  // Misty Forest remaster; HP provisional.
  impidimp: { id: 'impidimp', types: ['dark', 'fairy'], maxHp: 50, radius: 10, sprite: 'impidimp', movepool: [], defaultLoadout: [] },
  shroomish: { id: 'shroomish', types: ['grass'], maxHp: 60, radius: 10, sprite: 'shroomish', movepool: [], defaultLoadout: [] },
  drifloon: { id: 'drifloon', types: ['ghost', 'flying'], maxHp: 55, radius: 11, sprite: 'drifloon', movepool: [], defaultLoadout: [] },
  // Flooded Caves; HP provisional.
  krabby: { id: 'krabby', types: ['water'], maxHp: 55, radius: 10, sprite: 'krabby', movepool: [], defaultLoadout: [] },
  shellos: { id: 'shellos', types: ['water'], maxHp: 95, radius: 12, sprite: 'shellos', movepool: [], defaultLoadout: [] },
  remoraid: { id: 'remoraid', types: ['water'], maxHp: 50, radius: 10, sprite: 'remoraid', movepool: [], defaultLoadout: [] },
  lanturn: { id: 'lanturn', types: ['water', 'electric'], maxHp: 560, radius: 15, sprite: 'lanturn', movepool: [], defaultLoadout: [] },
  dhelmise: { id: 'dhelmise', types: ['ghost', 'grass'], maxHp: 900, radius: 18, sprite: 'dhelmise', movepool: [], defaultLoadout: [] },
  // Toxic Swamp (docs/species-candidates.md §2, Dungeon 4); HP provisional.
  venipede: { id: 'venipede', types: ['bug', 'poison'], maxHp: 32, radius: 9, sprite: 'venipede', movepool: [], defaultLoadout: [] },
  salandit: { id: 'salandit', types: ['poison', 'fire'], maxHp: 55, radius: 10, sprite: 'salandit', movepool: [], defaultLoadout: [] },
  skrelp: { id: 'skrelp', types: ['poison', 'water'], maxHp: 60, radius: 10, sprite: 'skrelp', movepool: [], defaultLoadout: [] },
  salazzle: { id: 'salazzle', types: ['poison', 'fire'], maxHp: 520, radius: 14, sprite: 'salazzle', movepool: [], defaultLoadout: [] },
  nihilego: { id: 'nihilego', types: ['rock', 'poison'], maxHp: 980, radius: 17, sprite: 'nihilego', movepool: [], defaultLoadout: [] },
  // A nest is drawn in code (the sprite is never shown); the hunter wears Houndour's sheets in the eclipse's shadow.
  'eclipse-nest': { id: 'eclipse-nest', types: ['dark'], maxHp: 150, radius: 15, sprite: 'gastly', movepool: [], defaultLoadout: [] },
  'eclipse-echo': { id: 'eclipse-echo', types: ['ghost', 'dark'], maxHp: 800, radius: 14, sprite: 'mimikyuBusted', movepool: [], defaultLoadout: [] },
  'eclipse-hunter': { id: 'eclipse-hunter', types: ['dark', 'ghost'], maxHp: 999, radius: 12, sprite: 'houndour', movepool: [], defaultLoadout: [] },
};

/** Species a player can pick, in picker order (Mimikyu first, then the three starters). */
export const PLAYABLE_SPECIES: readonly SpeciesId[] = ['mimikyu', 'zorua', 'litwick', 'cubone'];

export const isPlayable = (id: unknown): id is SpeciesId => PLAYABLE_SPECIES.some((s) => s === id);
