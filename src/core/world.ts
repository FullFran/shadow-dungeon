import { SPECIES, type SpeciesId } from '../data/species';
import { PLAYER_SLOT_LAYOUT } from '../data/slots';
import type { MoveId } from '../data/moves';
import { TUNING } from '../data/tuning';
import type { UpgradeLevels } from '../data/upgrades';
import { ELITE_TRAIT_DEFS, type Difficulty, type EliteTrait } from '../data/difficulty';
import { LEADER } from '../data/encounters';
import { eliteHp, rollTierOf, tierOf } from './difficulty';
import { upgradeBonuses } from './upgrades';
import { stageBonus } from './evolution';
import { padLoadout, validateLoadout } from './loadout';
import { hasBossState, initialBoss } from './boss';
import { returnStolen } from './stolen';
import { initialAi } from './enemies';
import { partyField, partyHpScale } from './party';
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
  /** The move tutor's Mejoras of the local player's species (core/tutor.ts `runRanks`; default none). */
  moveRanks?: Readonly<Partial<Record<MoveId, number>>>;
  /** The run's tier, the host's for every peer (absent = easy, data/difficulty.ts). */
  difficulty?: Difficulty;
  /** Co-op: the room's roster size when the run starts (core/party.ts; absent or 1 = solo). */
  party?: number;
  /** Awakening steps of the local player's species (Mimikyu's; core/evolution.ts `stageBonus`; absent = none). */
  awakened?: number;
}

/**
 * `party`: players at the run's start (an evolved form's stage bonus is capped lower in a party; core/evolution.ts);
 * `awakened`: awakening steps of a species that awakens (Mimikyu), which give the same bonus.
 */
export function createPlayer(pos: Vec2, speciesId: SpeciesId = 'mimikyu', loadout?: readonly (MoveId | null)[], upgrades?: UpgradeLevels, party = 1, awakened = 0): PlayerState {
  const species = SPECIES[speciesId];
  const stage = stageBonus(speciesId, party, awakened);
  const maxHp = Math.round(species.maxHp * (1 + stage.hp)) + upgradeBonuses(upgrades).maxHp;
  // An older two-slot loadout (save or peer) gets the species defaults in the new slots.
  const equipped = padLoadout(species, loadout ?? species.defaultLoadout);
  const errors = validateLoadout(species, PLAYER_SLOT_LAYOUT, equipped);
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
    ...(stage.damage > 0 ? { stageDamage: 1 + stage.damage } : {}),
  };
}

/** Harder tiers: a shorter i-frame window and a dearer roll (data/difficulty.ts `TierDef.roll`). */
function withRollTier(player: PlayerState, difficulty: Difficulty | undefined): PlayerState {
  const rollTier = difficulty ? rollTierOf(difficulty) : null;
  return rollTier ? { ...player, rollTier } : player;
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
  moveRanks,
  difficulty,
  party,
  awakened,
}: WorldOptions): WorldState {
  const player = withRollTier(createPlayer(playerPos, species, loadout, upgrades, party ?? 1, awakened ?? 0), difficulty);
  return {
    tick: 0,
    ...(difficulty ? { difficulty } : {}),
    ...partyField(party ?? 1),
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
    player: moveRanks ? { ...player, moveRanks } : player,
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
  /** An elite of a generated floor (core/difficulty.ts `drawElite`): its trait (armored spawns with its armor). */
  elite?: EliteTrait;
  /** An elite's HP share on top of its trait's (the Sima's elites: data/sima.ts `hpScale`). */
  eliteHp?: number;
  /** A deep Sima elite: its attacks ignore roll i-frames. */
  pierceRoll?: true;
  /** A group's leader (core/leaders.ts): more HP, a rally cry, bonus experience. */
  leader?: true;
}

/** Adds an enemy with a deterministic id ("e<n>"). */
export function spawnEnemy(state: WorldState, speciesId: SpeciesId, pos: Vec2, options: SpawnOptions = {}): WorldState {
  const species = SPECIES[speciesId];
  // The endless dungeon's deeper floors spawn tougher enemies, and so do harder tiers (a tough elite more so) and bigger parties (core/party.ts).
  const maxHp = species.maxHp * (state.enemyScale?.hp ?? 1) * tierOf(state).hp * eliteHp(options.elite) * (options.elite ? (options.eliteHp ?? 1) : 1) * partyHpScale(state, speciesId) * (options.leader ? LEADER.hp : 1);
  const enemy: EnemyState = {
    id: `e${state.nextId}`,
    species: speciesId,
    types: species.types,
    pos,
    facing: vec(0, 1),
    hp: maxHp,
    maxHp,
    radius: species.radius,
    alive: true,
    hitstunMs: 0,
    knockback: vec(0, 0),
    ai: options.sleepIn ? { ...initialAi(), mode: 'asleep' } : initialAi(options.dormant),
    ...(options.sleepIn ? { wakeRoom: options.sleepIn } : {}),
    ...(hasBossState(speciesId) ? { boss: initialBoss(speciesId) } : {}),
    ...(options.elite ? { elite: options.elite, ...(ELITE_TRAIT_DEFS[options.elite].armor ? { armor: true as const } : {}) } : {}),
    ...(options.pierceRoll ? { pierceRoll: true as const } : {}),
    ...(options.leader ? { leader: { rallyMs: LEADER.rally.firstMs } } : {}),
  };
  return { ...state, nextId: state.nextId + 1, enemies: [...state.enemies, enemy] };
}

/** A swamp pool's poison does not follow the player to the next floor. */
const cured = (player: PlayerState): PlayerState => {
  const { poison: _gone, ...rest } = player;
  return rest;
};

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
    player: { ...cured(returnStolen(state.player)), disguiseBroken: false, illusionBroken: false, action: null, itemUses: {} },
    collapse: undefined,
    fog: undefined,
    wisp: undefined,
    flood: undefined,
    gas: undefined,
    pools: undefined,
  };
}
