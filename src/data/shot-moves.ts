import type { MoveId } from './moves';
import type { PokemonType } from './types';

/**
 * The learnable move each enemy shot is drawn as (issue #67, owner design
 * note 2): an enemy shot looks exactly like the player's use of that move.
 * No imports beyond types: story/kit.ts and the herald generator use these
 * while data/enemies.ts is still loading.
 */

/**
 * The one exception to "a shot's type is its move's type" (owner, 2026-11-24):
 * no Flying move exists, so the Flying shots of these Senda bosses keep their
 * Flying damage and are drawn as Swift's star.
 */
export const FLYING_SHOT_MOVE = 'swift' satisfies MoveId;
export const FLYING_SHOT_BOSSES = ['litwick-drifblim', 'axew-dragonite'] as const;
/**
 * The move a shot of each type is drawn as when its source does not pick one
 * (Senda templates, Sima heralds, card helpers): the player's projectile of
 * that type where one exists, else a same-type move drawn at shot size.
 * Flying has no move and borrows Swift (the listed exception above).
 */
export const DEFAULT_SHOT_MOVE = {
  normal: 'swift',
  fire: 'ember',
  water: 'bubble-beam',
  electric: 'thunderbolt',
  grass: 'energy-ball',
  ice: 'ice-beam',
  fighting: 'focus-punch',
  poison: 'sludge-bomb',
  ground: 'mud-slap',
  flying: FLYING_SHOT_MOVE,
  psychic: 'extrasensory',
  bug: 'x-scissor',
  rock: 'rock-slide',
  ghost: 'shadow-ball',
  dragon: 'dragon-pulse',
  dark: 'dark-pulse',
  steel: 'flash-cannon',
  fairy: 'dazzling-gleam',
} as const satisfies Record<PokemonType, MoveId>;
