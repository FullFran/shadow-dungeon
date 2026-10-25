import { TUNING } from '../data/tuning';
import { bossBar } from '../core/boss';
import { effectiveTelegraphMs, eliteTimeScale, worldDifficulty } from '../core/difficulty';
import { cooldownLeft } from '../core/boosts';
import type { MoveId } from '../data/moves';
import { insideRect } from '../core/geometry';
import { bandTimeScale } from '../core/leaders';
import type { AiMode, Arena, Rect, WorldState } from '../core/state';
import { enemyTimeScale } from '../core/time';
import { pierceZone, type PierceZone } from '../core/victim';
import type { Vec2 } from '../core/vec';

/**
 * What a player could see on screen this tick (docs/souls-difficulty-research.md P7):
 * the bots decide from this and nothing else. The camera shows `VIEW` world
 * pixels around the player (the game's own 512 x 320, `src/app/game.ts`), kept
 * inside the arena; enemies and enemy shots outside it are not seen. Wind-ups
 * are seen as their animation: how long is left (the game draws its progress),
 * and the ground a positional (`pierceRoll`) one will burn (the game draws it
 * too, `pierceZone`). The map layout (rooms, stairs, a fixed room's exit) is
 * known like the minimap and the stairs marker show it.
 */
export const VIEW = { width: 512, height: 320 } as const;

/** The camera's world rectangle around `focus` (the same math as `src/adapters/view.ts` `cameraView`, which the sim may not import). */
export function cameraRect(focus: Vec2, arena: Pick<Arena, 'width' | 'height'>, view: { width: number; height: number } = VIEW): Rect {
  const axis = (center: number, size: number, limit: number) => (limit <= size ? (limit - size) / 2 : Math.min(limit - size, Math.max(0, center - size / 2)));
  return { x: axis(focus.x, view.width, arena.width), y: axis(focus.y, view.height, arena.height), width: view.width, height: view.height };
}

/** A circle overlapping the rectangle at all counts as on screen. */
export const onScreen = (pos: Vec2, rect: Rect, margin = 0): boolean =>
  insideRect(pos, { x: rect.x - margin, y: rect.y - margin, width: rect.width + 2 * margin, height: rect.height + 2 * margin });

export interface SeenWindup {
  /** Real ms left before it fires, as its animation shows (tier scaling, elite pace and slow-mo included). */
  remainingMs: number;
  /** Real ms the whole wind-up lasts. */
  totalMs: number;
}

export interface SeenEnemy {
  id: string;
  pos: Vec2;
  radius: number;
  facing: Vec2;
  hp: number;
  maxHp: number;
  boss: boolean;
  mode: AiMode;
  /** Aim of its current attack (drawn as its facing during a wind-up). */
  attackDir: Vec2;
  windup: SeenWindup | null;
  /** The ground a positional attack will burn (drawn by the game); null for an ordinary attack. */
  zone: PierceZone | null;
  /** A deep Sima elite: every attack of it is positional. */
  pierceRoll: boolean;
}

export interface SeenProjectile {
  id: string;
  pos: Vec2;
  /** Pixels per second. */
  vel: Vec2;
  radius: number;
  pierceRoll: boolean;
}

export interface SelfView {
  pos: Vec2;
  hp: number;
  maxHp: number;
  stamina: number;
  radius: number;
  rolling: boolean;
  /** A move of the player is in progress (the player is rooted or committed). */
  acting: boolean;
  /** The equipped moves (fast, heavy, boost, area; null = empty), as the HUD shows them. */
  loadout: readonly (MoveId | null)[];
  /** Ms of cooldown left per slot (0 = ready), as the HUD shows them. */
  cooldowns: readonly number[];
  /** A boost buff is running (its aura is drawn). */
  buffed: boolean;
}

export interface Observation {
  tick: number;
  timeMs: number;
  view: Rect;
  self: SelfView;
  enemies: readonly SeenEnemy[];
  projectiles: readonly SeenProjectile[];
  /** Static map knowledge: the arena (tiles, obstacles, stairs, rooms). */
  arena: Arena;
  /** Every enemy of the room is down (a fixed room's exit opens; the boss bar is gone). */
  cleared: boolean;
}

/** Real ms left of an enemy's wind-up, from its AI clock (the game's own rule: core/difficulty.ts `effectiveTelegraphMs`). */
function windupOf(state: WorldState, e: WorldState['enemies'][number]): SeenWindup | null {
  const ai = e.ai;
  if (ai.mode !== 'telegraph' || ai.modeDurationMs <= 0) return null;
  const d = worldDifficulty(state);
  // The game's own pace (core/enemies.ts): tier clock × elite × a leader's band (inspired or broken followers).
  const pace = enemyTimeScale(state) * eliteTimeScale(e) * bandTimeScale(e);
  const totalMs = effectiveTelegraphMs(ai.modeDurationMs, d, pace, pierceZone(e, d, state.arena) !== null);
  const remainingMs = Math.max(0, ((ai.modeDurationMs - ai.modeMs) / ai.modeDurationMs) * totalMs);
  return { remainingMs, totalMs };
}

/** The screen of the world's local player. */
export function observe(state: WorldState): Observation {
  const view = cameraRect(state.player.pos, state.arena);
  const d = worldDifficulty(state);
  const bossId = bossBar(state)?.enemyId ?? null;
  const enemies: SeenEnemy[] = state.enemies
    .filter((e) => e.alive && onScreen(e.pos, view, e.radius))
    .map((e) => ({
      id: e.id,
      pos: e.pos,
      radius: e.radius,
      facing: e.facing,
      hp: e.hp,
      maxHp: e.maxHp,
      boss: e.id === bossId,
      mode: e.ai.mode,
      attackDir: e.ai.attackDir,
      windup: windupOf(state, e),
      zone: pierceZone(e, d, state.arena),
      pierceRoll: e.pierceRoll === true,
    }));
  const projectiles: SeenProjectile[] = state.projectiles
    .filter((p) => p.owner === 'enemy' && onScreen(p.pos, view, p.radius))
    .map((p) => ({ id: p.id, pos: p.pos, vel: p.vel, radius: p.radius, pierceRoll: p.pierceRoll === true }));
  const p = state.player;
  return {
    tick: state.tick,
    timeMs: state.timeMs,
    view,
    self: {
      pos: p.pos,
      hp: p.hp,
      maxHp: p.maxHp,
      stamina: p.stamina,
      radius: TUNING.player.radius,
      rolling: p.roll !== null,
      acting: p.action !== null,
      loadout: p.loadout,
      cooldowns: p.loadout.map((id) => (id ? cooldownLeft(p, id) : 0)),
      buffed: p.buff !== undefined,
    },
    enemies,
    projectiles,
    arena: state.arena,
    cleared: state.enemies.every((e) => !e.alive),
  };
}
