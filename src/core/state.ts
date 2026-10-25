import type { Vec2 } from './vec';

/** One tick of player intent, produced by the input adapter. Booleans are edges ("pressed this tick"). */
export interface PlayerInput {
  /** Raw WASD vector; components in [-1, 1], not necessarily normalized. */
  move: Vec2;
  /** Cursor position in world coordinates. */
  aim: Vec2;
  roll: boolean;
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

export interface PlayerState {
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
}

export interface Arena {
  width: number;
  height: number;
}

/** Things that happened during the last step, for renderer juice and audio. Cleared every step. */
export type GameEvent =
  | { type: 'rollStarted' }
  | { type: 'rollDenied' }
  | { type: 'hitDodged' }
  | { type: 'perfectDodge' }
  | { type: 'playerHurt'; damage: number };

export interface WorldState {
  tick: number;
  /** Real (unscaled) simulation time. */
  timeMs: number;
  rng: number;
  arena: Arena;
  player: PlayerState;
  /** Remaining perfect-dodge slow-mo, in real time. */
  slowMoMs: number;
  events: GameEvent[];
}

/** A hit about to land on the player (from an enemy attack or projectile). */
export interface IncomingHit {
  damage: number;
}
