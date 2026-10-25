import { SPECIES, type SpeciesId } from '../data/species';
import { M0_SLOT_LAYOUT } from '../data/slots';
import type { MoveId } from '../data/moves';
import { TUNING } from '../data/tuning';
import type { UpgradeLevels } from '../data/upgrades';
import { upgradeBonuses } from './upgrades';
import { validateLoadout } from './loadout';
import { hasBossState, initialBoss } from './boss';
import { returnStolen } from './stolen';
import { initialAi } from './enemies';
import { seedRng } from './rng';
import type { Arena, EnemyState, LockType, PeerRole, PlayerState, Rect, WorldState } from './state';
import { vec, type Vec2 } from './vec';

export interface WorldOptions {
  seed: number;
  arena: Arena;
  playerPos: Vec2;
  species?: SpeciesId;
  /** Defaults to the species' default loadout. Must be valid for the M0 slot layout. */
  loadout?: readonly (MoveId | null)[];
  /** Click-to-lock setting: a left click on an enemy locks onto it (default on). */
  clickToLock?: boolean;
  /** How the lock input works (default `toggle`). */
  lockType?: LockType;
  /** This peer's player id (default "p1"). */
  localId?: string;
  /** Default `host` (solo). */
  role?: PeerRole;
  /** Permanent upgrade levels of the local player (default none). */
  upgrades?: UpgradeLevels;
}

export function createPlayer(pos: Vec2, speciesId: SpeciesId = 'mimikyu', loadout?: readonly (MoveId | null)[], upgrades?: UpgradeLevels): PlayerState {
  const species = SPECIES[speciesId];
  const maxHp = species.maxHp + upgradeBonuses(upgrades).maxHp;
  const equipped = loadout ?? species.defaultLoadout;
  const errors = validateLoadout(species, M0_SLOT_LAYOUT, equipped);
  if (errors.length > 0) throw new Error(`invalid loadout: ${JSON.stringify(errors)}`);
  return {
    species: speciesId,
    types: species.types,
    pos,
    facing: vec(0, 1),
    hp: maxHp,
    maxHp,
    stamina: TUNING.stamina.max,
    staminaRegenDelayMs: 0,
    roll: null,
    nextHitBuff: null,
    loadout: equipped,
    slotsHeld: equipped.map(() => false),
    action: null,
    disguiseBroken: false,
    illusionBroken: false,
    flashFire: false,
    lastMoveMissed: false,
    level: 1,
    xp: 0,
    items: [],
    itemUses: {},
    ...(upgrades ? { upgrades } : {}),
  };
}

export function createWorld({
  seed,
  arena,
  playerPos,
  species,
  loadout,
  clickToLock = true,
  lockType = 'toggle',
  localId = 'p1',
  role = 'host',
  upgrades,
}: WorldOptions): WorldState {
  return {
    tick: 0,
    localId,
    role,
    remotes: [],
    appliedClaims: [],
    timeMs: 0,
    depth: 1,
    credited: [],
    rng: seedRng(seed),
    nextId: 1,
    arena,
    player: createPlayer(playerPos, species, loadout, upgrades),
    enemies: [],
    projectiles: [],
    berries: [],
    lock: { lockType, clickToLock, targetId: null, wheelAccum: 0, keyHeld: false, clickHeld: false },
    slowMoMs: 0,
    events: [],
  };
}

export interface SpawnOptions {
  /** A dormant enemy never acts: a training dummy (and a fixture for tests of other systems). */
  dormant?: boolean;
  /** Floor enemies: asleep until the player enters this room or comes close in sight (activation.ts). */
  sleepIn?: Rect;
}

/** Adds an enemy with a deterministic id ("e<n>"). */
export function spawnEnemy(state: WorldState, speciesId: SpeciesId, pos: Vec2, options: SpawnOptions = {}): WorldState {
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
    ai: options.sleepIn ? { ...initialAi(), mode: 'asleep' } : initialAi(options.dormant),
    ...(options.sleepIn ? { wakeRoom: options.sleepIn } : {}),
    ...(hasBossState(speciesId) ? { boss: initialBoss(speciesId) } : {}),
  };
  return { ...state, nextId: state.nextId + 1, enemies: [...state.enemies, enemy] };
}

/** Starts a new room: clears enemies and projectiles and restores per-room passives (Disguise, Illusion) and per-floor item uses. */
export function enterRoom(state: WorldState): WorldState {
  return {
    ...state,
    enemies: [],
    projectiles: [],
    berries: [],
    credited: [],
    lock: { ...state.lock, targetId: null, wheelAccum: 0 },
    // An item Sableye still holds comes back on leaving its room.
    player: { ...returnStolen(state.player), disguiseBroken: false, illusionBroken: false, action: null, itemUses: {} },
    collapse: undefined,
    fog: undefined,
  };
}
