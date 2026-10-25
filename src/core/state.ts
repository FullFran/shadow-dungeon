import type { MoveId } from '../data/moves';
import type { SpeciesId } from '../data/species';
import type { PokemonType } from '../data/types';
import type { CollapseState } from './collapse';
import type { TileRect } from './dungeon';
import type { FlowField } from './flow';
import type { TileGrid } from './tiles';
import type { Vec2 } from './vec';

/** One tick of player intent, produced by the input adapter. */
export interface PlayerInput {
  /** Raw WASD vector; components in [-1, 1], not necessarily normalized. */
  move: Vec2;
  /** Cursor position in world coordinates. */
  aim: Vec2;
  /** Edge: roll pressed this tick. */
  roll: boolean;
  /** Level: whether each move slot's button is held, aligned with the loadout. Edges are derived in the core. */
  slots: readonly boolean[];
  /**
   * Level, aligned with `slots`: the slot's mouse button (LMB fast, RMB heavy) is held.
   * Without a lock, a mouse-triggered move aims at the cursor and a key-triggered one (Q/E)
   * along the facing; with both held the mouse wins.
   */
  slotMouse: readonly boolean[];
  /** Level: lock-on input (Shift or middle mouse) held. With `toggle` each press edge locks or releases; with `hold` the level is the lock. */
  lock: boolean;
  /** Level: fast-slot mouse button (left click) held. Its press edge drives click-to-lock; Q does not set it. */
  click: boolean;
  /** Wheel deltaY accumulated since the last tick, DOM convention: negative = wheel up. */
  wheel: number;
  /** Visible world rectangle (camera view); lock-on only considers enemies inside it. */
  view: Rect;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * How the lock input works (docs/gdd.md §4 "Apuntar y fijar"):
 * `toggle` each press of Shift / middle mouse locks or releases; `hold` locked
 * only while held; `clickOnly` Shift / middle do nothing and a left click locks
 * an enemy or, on the ground, releases; `off` never locks.
 */
export type LockType = 'toggle' | 'hold' | 'clickOnly' | 'off';

export const LOCK_TYPES: readonly LockType[] = ['toggle', 'hold', 'clickOnly', 'off'];

export interface LockState {
  /** Setting: how the lock input works. */
  lockType: LockType;
  /** Setting: a left click on an enemy locks onto it (acquire or switch). Implied by `clickOnly`, ignored by `off`. */
  clickToLock: boolean;
  targetId: string | null;
  /** Wheel delta accumulated towards the switch threshold (touchpad-friendly). */
  wheelAccum: number;
  /** Lock key state on the previous tick, to detect press edges. */
  keyHeld: boolean;
  /** Left click state on the previous tick, to detect press edges. */
  clickHeld: boolean;
}

export interface RollState {
  elapsedMs: number;
  /** Unit direction committed when the roll started. */
  dir: Vec2;
}

export interface DamageBuff {
  multiplier: number;
  remainingMs: number;
}

export type ActionPhase = 'charging' | 'windup' | 'active' | 'recovery';

/** A move in progress. */
export interface ActionState {
  slotIndex: number;
  moveId: MoveId;
  phase: ActionPhase;
  /** Time spent in the current phase. */
  phaseMs: number;
  /** Time spent charging (heavy moves). */
  chargeMs: number;
  chargeLevel: number;
  /** Unit aim direction, committed when the wind-up starts. */
  aimDir: Vec2;
  /** Fixed by the press that started the move: without a lock, aim at the cursor (mouse) or along the facing (key). */
  mouseAim: boolean;
  /** Entities already hit by this use of the move (one hit per target per swing). */
  hitIds: readonly string[];
  /** World tick the move started on: names the swing in hit claims (one claim per enemy per swing). */
  startTick?: number;
}

export interface PlayerState {
  species: SpeciesId;
  types: readonly PokemonType[];
  pos: Vec2;
  /** Unit vector of the last movement direction; rolls without input go this way. */
  facing: Vec2;
  hp: number;
  maxHp: number;
  stamina: number;
  /** Time left before stamina starts regenerating. */
  staminaRegenDelayMs: number;
  roll: RollState | null;
  /** Granted by a perfect dodge; consumed by the next damaging player hit. */
  nextHitBuff: DamageBuff | null;
  /** Equipped moves aligned with the slot layout (null = empty slot). */
  loadout: readonly (MoveId | null)[];
  /** Slot buttons held on the previous tick, to detect press/release edges. */
  slotsHeld: readonly boolean[];
  action: ActionState | null;
  /** Disguise passive: true once the free hit of this room has been used. */
  disguiseBroken: boolean;
}

export interface EnemyState {
  id: string;
  species: SpeciesId;
  types: readonly PokemonType[];
  pos: Vec2;
  facing: Vec2;
  hp: number;
  maxHp: number;
  radius: number;
  alive: boolean;
  /** While > 0 the enemy is staggered and cannot act. */
  hitstunMs: number;
  /** Knockback displacement still to be applied. */
  knockback: Vec2;
  /** Behaviour state machine (enemies.ts). */
  ai: AiState;
  /** Boss-only state (boss.ts). */
  boss?: BossState;
  /** Room of a sleeping floor enemy: the player entering it wakes the enemy. */
  wakeRoom?: Rect;
}

export type BossStance = 'shield' | 'blade';

export interface BossState {
  stance: BossStance;
  /** Time spent in the current stance (enemy time scale). */
  stanceMs: number;
  /** Damage taken since the current stance began. */
  stanceDamage: number;
  /** Blow of the Blade combo in progress (0-based). */
  comboIndex: number;
  /** Combos finished in the current Blade stance. */
  combosDone: number;
}

/**
 * Enemy behaviour modes. Not every species uses every mode: Poochyena goes
 * idle -> approach -> telegraph -> attack -> recover; Gastly uses reposition
 * instead of approach; Aegislash adds transform (stance change). A dormant
 * enemy never acts (training dummy); an asleep one waits until woken
 * (activation.ts) and then hunts for good.
 */
export type AiMode = 'dormant' | 'asleep' | 'idle' | 'approach' | 'reposition' | 'telegraph' | 'attack' | 'recover' | 'transform';

export interface AiState {
  mode: AiMode;
  /** Time spent in the current mode (enemy time scale). */
  modeMs: number;
  /** Planned length of the current timed mode (telegraph, attack, recover); 0 when open-ended. */
  modeDurationMs: number;
  /** Unit direction of the current attack: tracked during the telegraph, committed when it fires. */
  attackDir: Vec2;
  /** Whether the current attack already met the player (one contact per attack). */
  contact: 'none' | 'hit' | 'dodged';
  /** Time before the next attack may start. */
  cooldownMs: number;
  /** Strafing side while circling or keeping distance. */
  strafeSign: 1 | -1;
}

export interface ProjectileState {
  id: string;
  owner: 'player' | 'enemy';
  type: PokemonType;
  attackerTypes: readonly PokemonType[];
  power: number;
  /** Charge (and other) damage multiplier fixed at spawn. */
  damageMultiplier: number;
  pos: Vec2;
  /** Pixels per second. */
  vel: Vec2;
  radius: number;
  remainingMs: number;
  hitstunMs: number;
  knockback: number;
  /** Entities already hit or passed through (a dodged projectile keeps flying). */
  hitIds: readonly string[];
}

export interface Arena {
  width: number;
  height: number;
  /** Solid blocks for walkers; floaters and projectiles ignore them. */
  obstacles?: readonly Rect[];
  /** Generated floors: wall tiles block walkers and stop projectiles; floaters pass them. */
  tiles?: TileGrid;
  /** Generated floors: stepping here goes down to the next floor. */
  stairs?: Rect;
  /** Generated floors: the rooms, in tiles (the minimap reveals a whole room on entering it). */
  rooms?: readonly TileRect[];
}

/** Things that happened during the last step, for renderer juice and audio. Cleared every step. */
export type GameEvent =
  | { type: 'rollStarted' }
  | { type: 'rollDenied' }
  | { type: 'hitDodged' }
  | { type: 'perfectDodge' }
  | { type: 'playerHurt'; damage: number }
  | { type: 'disguiseBroken' }
  | { type: 'moveStarted'; moveId: MoveId; slotIndex: number }
  | { type: 'moveDenied'; moveId: MoveId }
  | { type: 'moveReleased'; moveId: MoveId; chargeLevel: number }
  | { type: 'enemyHit'; enemyId: string; damage: number; effectiveness: number; pos: Vec2 }
  | { type: 'enemyDefeated'; enemyId: string }
  /** Collapsed ground hurt the player (not an attack: no dodge, no Disguise). */
  | { type: 'collapseHurt'; damage: number }
  | { type: 'enemyTelegraph'; enemyId: string; attack: string; durationMs: number }
  | { type: 'enemyAttack'; enemyId: string; attack: string }
  | { type: 'hitBlocked'; enemyId: string; pos: Vec2 }
  | { type: 'bossStance'; enemyId: string; stance: BossStance }
  | { type: 'lockAcquired'; targetId: string }
  | { type: 'lockSwitched'; targetId: string }
  | { type: 'lockReleased'; reason: 'key' | 'click' | 'range' | 'offscreen' | 'noTarget' }
  /** A guest's own player hit an enemy: the host applies the claim (sync.ts). */
  | { type: 'hitClaim'; claim: HitClaim };

/**
 * Who runs what in a shared run (docs/gdd.md §12): the `host` runs enemy AI,
 * the boss, spawns and floor changes and applies hit claims; a `guest` gets
 * enemies from host snapshots and runs only its own player. Solo is a host
 * with no peers.
 */
export type PeerRole = 'host' | 'guest';

/** Another peer's player, as its own peer reported it (never simulated here). */
export interface RemotePlayer {
  id: string;
  player: PlayerState;
  /** That player's own projectiles in flight, drawn only (they never hit anything on this peer). */
  projectiles: readonly RemoteProjectile[];
}

/** Enough of another player's projectile to draw it. */
export interface RemoteProjectile {
  id: string;
  pos: Vec2;
  vel: Vec2;
  radius: number;
}

/**
 * A guest's hit on an enemy, resolved on the guest (damage, type
 * effectiveness, stagger and knockback already computed) and applied by the
 * host, trusted in the spike. `id` names the swing or projectile and the
 * enemy, so a resent or duplicated claim lands once.
 */
export interface HitClaim {
  id: string;
  playerId: string;
  enemyId: string;
  damage: number;
  effectiveness: number;
  /** Stagger (hitstun) already scaled by the enemy's poise. */
  hitstunMs: number;
  /** Knockback displacement, already scaled by the enemy's poise. */
  knockback: Vec2;
  /** Stopped by a guard: chip damage only, no stagger. */
  blocked: boolean;
}

export interface WorldState {
  tick: number;
  /** Id of this peer's player (`player`); "p1" solo. */
  localId: string;
  role: PeerRole;
  /** The other peers' players (empty solo). */
  remotes: readonly RemotePlayer[];
  /** Host: ids of the hit claims already applied (bounded), so a claim never lands twice. */
  appliedClaims: readonly string[];
  /** Real (unscaled) simulation time. */
  timeMs: number;
  rng: number;
  /** Counter for deterministic entity ids. */
  nextId: number;
  arena: Arena;
  player: PlayerState;
  enemies: readonly EnemyState[];
  projectiles: readonly ProjectileState[];
  lock: LockState;
  /** Remaining perfect-dodge slow-mo, in real time. */
  slowMoMs: number;
  /** Generated floors: walking distances to the nearest present player's tile, for walkers out of sight (flow.ts). */
  flow?: FlowField;
  /** Collapse urgent floors: the advancing front (collapse.ts). */
  collapse?: CollapseState;
  events: GameEvent[];
}

/** A hit about to land on the player (from an enemy attack or projectile), damage already computed. */
export interface IncomingHit {
  damage: number;
}
