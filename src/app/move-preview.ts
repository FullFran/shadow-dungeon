import { step } from '../core/step';
import { advanceClock, FIXED_DT_MS } from '../core/timestep';
import type { GameEvent, PlayerInput, WorldState } from '../core/state';
import { vec, type Vec2 } from '../core/vec';
import { createWorld, spawnEnemy } from '../core/world';
import { MOVES, type MoveDef, type MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT } from '../data/slots';
import { SPECIES, type SpeciesId } from '../data/species';

/**
 * The move tutor's live preview (owner, 2026-11-03: "de cada ataque se vea un
 * vídeo que muestre la animación del ataque con el pokemon elegido"): the game's
 * own simulation and renderer on a tiny room, the player species with the move
 * in its slot and one passive training dummy, the move cast on a loop. Pure
 * and deterministic here (the canvas and the clock live in move-preview-view.ts).
 * It owns no input, audio, save or achievements: nothing leaves the sim.
 */
export const PREVIEW = {
  arena: { width: 300, height: 200 },
  /** The fixed camera: a window on the middle of the room, this wide; its height follows the canvas (move-preview-view.ts). */
  view: { x: 62, y: 50, width: 176, height: 99 },
  /** Where the pair stands (the dummy's distance depends on the move). */
  centre: { x: 150, y: 100 },
  /** Idle beat before each cast, so the pose is seen before the move. */
  castAtMs: 300,
  /** The shortest loop; a long move stretches it. */
  cycleMs: 1600,
  /** Time to look at the aftermath (projectile flight, a buff glowing) after the move ends. */
  afterMs: 550,
  /** The dummy: a species with a plain sprite, never able to fall. */
  dummy: 'koffing',
  dummyHp: 99999,
} as const;

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));

/** How far from the player the dummy stands: inside the move's reach, far enough to see it travel. */
export function dummyDistance(move: MoveDef): number {
  const box = move.hitbox;
  switch (box.kind) {
    case 'arc':
      return box.arcDegrees >= 360 ? clamp(box.range * 0.5, 20, 40) : clamp(box.range * 0.6, 22, 60);
    case 'dash':
      return clamp(box.distance * 0.75, 36, 100);
    case 'projectile':
      return clamp(((box.speed * box.lifetimeMs) / 1000) * 0.55, 60, 110);
    case 'self':
      return 70;
  }
}

/** The preview room for `species` casting `move` (at its owned `rank`), or null when the move does not fit that species' slot or pool. */
export function previewWorld(species: SpeciesId, move: MoveId, rank = 0): WorldState | null {
  const def = MOVES[move];
  const slot = PLAYER_SLOT_LAYOUT.indexOf(def.slot);
  if (slot < 0 || !SPECIES[species].movepool.includes(move)) return null;
  const gap = dummyDistance(def);
  const y = PREVIEW.centre.y;
  const player = vec(PREVIEW.centre.x - gap / 2, y);
  const loadout = PLAYER_SLOT_LAYOUT.map((_, i) => (i === slot ? move : null));
  const base = createWorld({ seed: 7, arena: PREVIEW.arena, playerPos: player, species, loadout, clickToLock: false, ...(rank > 0 ? { moveRanks: { [move]: rank } } : {}) });
  const spawned = spawnEnemy(base, PREVIEW.dummy, vec(PREVIEW.centre.x + gap / 2, y), { dormant: true });
  return {
    ...spawned,
    player: { ...spawned.player, facing: vec(1, 0), illusionBroken: true },
    enemies: spawned.enemies.map((e) => ({ ...e, hp: PREVIEW.dummyHp, maxHp: PREVIEW.dummyHp })),
  };
}

/** The slot button is held while a charge move builds up to its top level. */
function holdMs(move: MoveDef): number {
  const top = move.charge?.[move.charge.length - 1];
  return top ? top.holdMs + 40 : FIXED_DT_MS * 2;
}

/** How long one loop lasts: the cast, the move's own phases, then a beat to see the result. */
export function cycleLength(move: MoveDef): number {
  return Math.max(PREVIEW.cycleMs, PREVIEW.castAtMs + holdMs(move) + move.windupMs + move.activeMs + move.recoveryMs + PREVIEW.afterMs);
}

const IDLE_VIEW = PREVIEW.view;

/** What the player "presses" `cycleMs` into the loop: the slot held at the cast (a charge move until its top level), aimed at the dummy. */
export function castInput(move: MoveDef, slot: number, cycleMs: number, aim: Vec2): PlayerInput {
  const held = cycleMs >= PREVIEW.castAtMs && cycleMs < PREVIEW.castAtMs + holdMs(move);
  const slots = PLAYER_SLOT_LAYOUT.map((_, i) => i === slot && held);
  return { move: vec(0, 0), aim, aimPointer: true, roll: false, slots, slotMouse: slots, lock: false, click: false, wheel: 0, view: IDLE_VIEW };
}

export interface PreviewSim {
  /** The world now, and one step ago (for interpolation). */
  world: WorldState;
  prev: WorldState;
  /** Loops completed. */
  cycles: number;
  /** Share of a step elapsed since `world` (0..1). */
  alpha: number;
  /** Runs `frameMs` of game time and returns the events of its steps. */
  advance(frameMs: number): GameEvent[];
}

/** The loop's fresh start: full health and stamina, no cooldown, buff, status or leftover shots; the pair back in place. */
function restart(world: WorldState, start: WorldState): WorldState {
  const { cooldowns: _c, buff: _b, ...player } = start.player;
  return { ...world, player: { ...player }, enemies: start.enemies.map((e) => ({ ...e })), projectiles: [], lock: start.lock, slowMoMs: 0 };
}

/** The looping simulation of `species` casting `move`, or null when it cannot be set up (the caller shows the static info). */
export function createPreviewSim(species: SpeciesId, move: MoveId, rank = 0): PreviewSim | null {
  const start = previewWorld(species, move, rank);
  if (!start) return null;
  const def = MOVES[move];
  const slot = PLAYER_SLOT_LAYOUT.indexOf(def.slot);
  const aim = start.enemies[0]!.pos;
  const length = cycleLength(def);
  let clock = 0;
  let accumulator = 0;
  const sim: PreviewSim = {
    world: start,
    prev: start,
    cycles: 0,
    alpha: 0,
    advance(frameMs) {
      const events: GameEvent[] = [];
      const ticks = advanceClock(accumulator, frameMs);
      accumulator = ticks.accumulatorMs;
      for (let i = 0; i < ticks.steps; i++) {
        sim.prev = sim.world;
        sim.world = step(sim.world, castInput(def, slot, clock, aim), FIXED_DT_MS);
        events.push(...sim.world.events);
        clock += FIXED_DT_MS;
        if (clock >= length) {
          clock = 0;
          sim.cycles += 1;
          sim.world = restart(sim.world, start);
          sim.prev = sim.world;
        }
      }
      sim.alpha = accumulator / FIXED_DT_MS;
      return events;
    },
  };
  return sim;
}

export interface FrameLoop {
  readonly running: boolean;
  start(): void;
  stop(): void;
}

/** Longest frame fed on (a tab coming back from the background). */
const MAX_FRAME_MS = 100;

/**
 * One requestAnimationFrame loop with a hard off switch: `frame` gets the time since the last frame (0 on the first
 * after a start, so a pause never catches up), at most one frame is ever pending, and `stop` cancels it.
 */
export function createFrameLoop(env: { raf(cb: (now: number) => void): number; caf(id: number): void }, frame: (frameMs: number) => void): FrameLoop {
  let id: number | null = null;
  let last: number | null = null;
  const tick = (now: number): void => {
    id = null;
    const ms = last === null ? 0 : clamp(now - last, 0, MAX_FRAME_MS);
    last = now;
    frame(ms);
    if (loop.running === false && id === null && stopped) return;
    if (!stopped) id = env.raf(tick);
  };
  let stopped = true;
  const loop: FrameLoop = {
    get running() {
      return !stopped;
    },
    start() {
      if (!stopped) return;
      stopped = false;
      last = null;
      id = env.raf(tick);
    },
    stop() {
      stopped = true;
      if (id !== null) env.caf(id);
      id = null;
    },
  };
  return loop;
}
