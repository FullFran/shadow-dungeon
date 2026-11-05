import { step } from '../core/step';
import { advanceClock, FIXED_DT_MS } from '../core/timestep';
import type { GameEvent, PlayerInput, WorldState } from '../core/state';
import { vec, type Vec2 } from '../core/vec';
import { createWorld, spawnEnemy } from '../core/world';
import { MOVES, type MoveDef, type MoveId } from '../data/moves';
import { PLAYER_SLOT_LAYOUT } from '../data/slots';
import { SPECIES, type SpeciesId } from '../data/species';
import { SPRITE_KEYS, SPRITES } from '../data/sprites';
import { rankedMove } from '../core/rank-effects';

/**
 * The move tutor's live preview (owner, 2026-11-03: "de cada ataque se vea un
 * vídeo que muestre la animación del ataque con el pokemon elegido"): the game's
 * own simulation and renderer on a tiny room, the player species with the move
 * in its slot and one passive training dummy, the move cast on a loop. Pure
 * and deterministic here (the canvas and the clock live in move-preview-view.ts).
 * It owns no input, audio, save or achievements: nothing leaves the sim.
 */
export const PREVIEW = {
  /** Roomy on purpose: the camera frames each move (frameStage) and must never look past the floor. */
  arena: { width: 800, height: 480 },
  /** The resting camera (the aim window of the sim's input, and the framing before a move is chosen); the view shown is `frameStage`. */
  view: { x: 312, y: 190, width: 176, height: 99 },
  /** Where the pair stands (the dummy's distance depends on the move). */
  centre: { x: 400, y: 240 },
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

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Acc = { x0: number; y0: number; x1: number; y1: number };
const grow = (a: Acc, x0: number, y0: number, x1: number, y1: number): void => {
  a.x0 = Math.min(a.x0, x0);
  a.y0 = Math.min(a.y0, y0);
  a.x1 = Math.max(a.x1, x1);
  a.y1 = Math.max(a.y1, y1);
};
const growCircle = (a: Acc, p: Vec2, r: number): void => grow(a, p.x - r, p.y - r, p.x + r, p.y + r);

/** The animations the preview can show (the pair stands, casts and gets hit; it never falls, hops or sleeps). */
const SHOWN_ANIMS: ReadonlySet<string> = new Set(['Idle', 'Walk', 'Attack', 'Strike', 'Swing', 'Shoot', 'Charge', 'SpAttack', 'Double', 'Hurt']);

interface Sides {
  left: number;
  right: number;
  up: number;
  down: number;
}

/** What a sprite occupies around its feet point: the largest frame of any of its animations, on the renderer's anchor (Sprite fit rule: whole, never cropped). */
function spriteSides(keys: readonly string[]): Sides {
  const sides = { left: 0, right: 0, up: 0, down: 0 };
  for (const key of keys) {
    for (const [anim, meta] of Object.entries(SPRITES.sprites[key]?.anims ?? {})) {
      if (!SHOWN_ANIMS.has(anim)) continue;
      const anchor = meta.anchor ?? { x: meta.frameWidth / 2, y: meta.frameHeight * 0.75 };
      sides.left = Math.max(sides.left, anchor.x);
      sides.right = Math.max(sides.right, meta.frameWidth - anchor.x);
      sides.up = Math.max(sides.up, anchor.y);
      sides.down = Math.max(sides.down, meta.frameHeight - anchor.y);
    }
  }
  return sides;
}

/** The sprite sheets a species can show while it casts (its forms too: Mimikyu busted, Aegislash blade). */
const keysOf = (sprite: string): string[] => Object.entries(SPRITE_KEYS).filter(([name]) => name === sprite || name.startsWith(sprite)).map(([, key]) => key);

/** Room kept around the extent so the effect is never flush with the stage edge (world pixels). */
export const FRAME_MARGIN = 10;
/** The camera never shows less than this wide: a small move is not blown up. */
export const MIN_FRAME_WIDTH = 120;

const extents = new Map<string, Box>();

/**
 * Everything of the cast that must stay on screen: both sprites wherever they stand during the loop
 * and the effect's greatest reach (area ring or cone, dash path, projectile path and size, zones,
 * the buff aura). Measured on the real simulation, plus the ranges of the (ranked, fully charged) move.
 */
export function previewExtent(species: SpeciesId, move: MoveId, rank = 0): Box {
  const key = `${species}|${move}|${rank}`;
  const cached = extents.get(key);
  if (cached) return cached;
  const start = previewWorld(species, move, rank);
  const sim = createPreviewSim(species, move, rank);
  if (!start || !sim) return { ...PREVIEW.view };
  const acc: Acc = { x0: Number.POSITIVE_INFINITY, y0: Number.POSITIVE_INFINITY, x1: Number.NEGATIVE_INFINITY, y1: Number.NEGATIVE_INFINITY };
  const def = rankedMove(move, rank);
  const size = Math.max(1, ...(def.charge ?? []).map((c) => c.sizeMultiplier));
  const mine = spriteSides(keysOf(SPECIES[species].sprite));
  const theirs = spriteSides(keysOf(PREVIEW.dummy));
  const place = (p: Vec2, s: Sides): void => grow(acc, p.x - s.left, p.y - s.up, p.x + s.right, p.y + s.down);
  const at = (world: WorldState): void => {
    place(world.player.pos, mine);
    for (const e of world.enemies) place(e.pos, theirs);
    for (const shot of world.projectiles) growCircle(acc, shot.pos, shot.radius + 8);
  };
  at(start);
  const p0 = start.player.pos;
  const d0 = start.enemies[0]!.pos;
  const hb = def.hitbox;
  if (hb.kind === 'arc') {
    const r = hb.range * size;
    // A sector facing +x: its arc spans ±half the angle, so it reaches back behind the player only past 180 degrees.
    const half = Math.min(Math.PI, (hb.arcDegrees * Math.PI) / 360);
    grow(acc, p0.x + Math.min(0, r * Math.cos(half)), p0.y - r * Math.sin(Math.min(half, Math.PI / 2)), p0.x + r, p0.y + r * Math.sin(Math.min(half, Math.PI / 2)));
  } else if (hb.kind === 'dash') grow(acc, p0.x, p0.y - hb.radius * size, p0.x + hb.distance, p0.y + hb.radius * size);
  else if (hb.kind === 'self') growCircle(acc, p0, 30);
  if (def.zone) {
    growCircle(acc, def.zone.at === 'impact' ? d0 : p0, def.zone.radius);
    if (def.zone.at === 'line') growCircle(acc, d0, def.zone.radius);
  }
  if (def.buff) growCircle(acc, p0, 30);
  const steps = Math.ceil(cycleLength(MOVES[move]) / FIXED_DT_MS);
  for (let i = 0; i < steps; i++) {
    sim.advance(FIXED_DT_MS);
    if (i % 3 === 0) at(sim.world);
  }
  const box = { x: acc.x0, y: acc.y0, width: acc.x1 - acc.x0, height: acc.y1 - acc.y0 };
  extents.set(key, box);
  return box;
}

/**
 * The camera for a stage of `aspect` (width / height) that holds `extent` whole, with a margin,
 * centred on it. Never narrower than MIN_FRAME_WIDTH; any aspect works (wide strip or square).
 */
export function frameStage(extent: Box, aspect: number): Box {
  const width = Math.max(MIN_FRAME_WIDTH, extent.width + 2 * FRAME_MARGIN, (extent.height + 2 * FRAME_MARGIN) * aspect);
  const height = width / aspect;
  const x = extent.x + extent.width / 2 - width / 2;
  const y = extent.y + extent.height / 2 - height / 2;
  // Slide the camera back onto the floor when it would look past the room (it still holds the extent: that is inside the room).
  const shift = (at: number, size: number, room: number): number => (size >= room ? at : Math.min(Math.max(at, 0), room - size));
  return { x: shift(x, width, PREVIEW.arena.width), y: shift(y, height, PREVIEW.arena.height), width, height };
}
