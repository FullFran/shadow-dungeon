import { TUNING } from '../data/tuning';
import { seedRng } from './rng';
import type { Arena, PlayerState, WorldState } from './state';
import { vec, type Vec2 } from './vec';

export interface WorldOptions {
  seed: number;
  arena: Arena;
  playerPos: Vec2;
}

export function createPlayer(pos: Vec2): PlayerState {
  return {
    pos,
    facing: vec(0, 1),
    hp: TUNING.player.maxHp,
    maxHp: TUNING.player.maxHp,
    stamina: TUNING.stamina.max,
    staminaRegenDelayMs: 0,
    roll: null,
    nextHitBuff: null,
  };
}

export function createWorld({ seed, arena, playerPos }: WorldOptions): WorldState {
  return {
    tick: 0,
    timeMs: 0,
    rng: seedRng(seed),
    arena,
    player: createPlayer(playerPos),
    slowMoMs: 0,
    events: [],
  };
}
