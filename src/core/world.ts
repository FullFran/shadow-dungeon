import { SPECIES, type SpeciesId } from '../data/species';
import { M0_SLOT_LAYOUT } from '../data/slots';
import type { MoveId } from '../data/moves';
import { TUNING } from '../data/tuning';
import { validateLoadout } from './loadout';
import { seedRng } from './rng';
import type { Arena, EnemyState, PlayerState, WorldState } from './state';
import { vec, type Vec2 } from './vec';

export interface WorldOptions {
  seed: number;
  arena: Arena;
  playerPos: Vec2;
  species?: SpeciesId;
  /** Defaults to the species' default loadout. Must be valid for the M0 slot layout. */
  loadout?: readonly (MoveId | null)[];
}

export function createPlayer(pos: Vec2, speciesId: SpeciesId = 'mimikyu', loadout?: readonly (MoveId | null)[]): PlayerState {
  const species = SPECIES[speciesId];
  const equipped = loadout ?? species.defaultLoadout;
  const errors = validateLoadout(species, M0_SLOT_LAYOUT, equipped);
  if (errors.length > 0) throw new Error(`invalid loadout: ${JSON.stringify(errors)}`);
  return {
    species: speciesId,
    types: species.types,
    pos,
    facing: vec(0, 1),
    hp: TUNING.player.maxHp,
    maxHp: TUNING.player.maxHp,
    stamina: TUNING.stamina.max,
    staminaRegenDelayMs: 0,
    roll: null,
    nextHitBuff: null,
    loadout: equipped,
    slotsHeld: equipped.map(() => false),
    action: null,
    disguiseBroken: false,
  };
}

export function createWorld({ seed, arena, playerPos, species, loadout }: WorldOptions): WorldState {
  return {
    tick: 0,
    timeMs: 0,
    rng: seedRng(seed),
    nextId: 1,
    arena,
    player: createPlayer(playerPos, species, loadout),
    enemies: [],
    projectiles: [],
    slowMoMs: 0,
    events: [],
  };
}

/** Adds an enemy with a deterministic id ("e<n>"). */
export function spawnEnemy(state: WorldState, speciesId: SpeciesId, pos: Vec2): WorldState {
  const species = SPECIES[speciesId];
  const enemy: EnemyState = {
    id: `e${state.nextId}`,
    species: speciesId,
    types: species.types,
    pos,
    facing: vec(0, 1),
    hp: species.maxHp,
    maxHp: species.maxHp,
    radius: species.radius,
    alive: true,
    hitstunMs: 0,
    knockback: vec(0, 0),
  };
  return { ...state, nextId: state.nextId + 1, enemies: [...state.enemies, enemy] };
}

/** Starts a new room: clears enemies and projectiles and restores per-room passives (Disguise). */
export function enterRoom(state: WorldState): WorldState {
  return {
    ...state,
    enemies: [],
    projectiles: [],
    player: { ...state.player, disguiseBroken: false, action: null },
  };
}
