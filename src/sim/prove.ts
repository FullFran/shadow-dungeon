import type { CardFightDef, SpellCardDef } from '../data/cards';
import { TIERS, type Difficulty } from '../data/difficulty';
import { CHALLENGES, DUNGEONS, SENDA_ROADS, type DungeonId } from '../data/dungeons';
import { MOVES, type MoveDef } from '../data/moves';
import { ROOMS, type RoomId } from '../data/rooms';
import { STARTER_SPECIES, SPECIES, type SpeciesId } from '../data/species';
import { TUNING } from '../data/tuning';
import { blocksHit } from '../core/boss';
import { atCard, cardGuard, echoShare, echoStageAt, fightFor, fightOf, inTurn, isDeclaring } from '../core/cards';
import { depthScale } from '../core/endless';
import { ENDLESS } from '../data/endless';
import { ECHO_CARDS } from '../data/cards';
import { computeDamage, hitEffectiveness } from '../core/damage';
import { expectedLevel } from '../core/fairness';
import { levelDamage } from '../core/progression';
import { loadRoom } from '../core/rooms';
import type { EnemyState, PlayerInput, WorldState } from '../core/state';
import { step } from '../core/step';
import { FIXED_DT_MS } from '../core/timestep';
import { behaviourFor } from '../core/tricks';
import { pierceZone } from '../core/victim';
import { add, distance, normalize, scale, sub, vec, type Vec2 } from '../core/vec';
import { createWorld } from '../core/world';
import { KILL_GAPS } from './kill-gaps';
import { STORY_BOSSES } from '../data/story/bosses';
import { isWound } from '../data/story-quests';

/**
 * The beatability proof (docs/gdd.md "Garantía de que todo se puede
 * pasar"). Every card of every card boss on every tier is played on the
 * real, deterministic engine (`core/step.ts`: every pattern, aimed shot,
 * pierce zone, sweep, mark, wormhole pull, minion and the room's cover).
 * A player who only walks (no roll, no attack) has to get through the
 * whole card, from several start positions, until the card's timer ends.
 *
 * The search generalises the heralds' safe-cell sweep (core/herald/fairness.ts)
 * to patterns that depend on the player. Time is cut into 100 ms frames, a
 * little under one walking step of 14 px. From each reached state the player
 * may stand still or walk one of 8 ways, and the engine plays the frame.
 * Children that took a hit are dropped. The rest are explored best-first,
 * ranked by the clearance from every enemy shot over the next 400 ms and
 * from the marked pierce zones. The search backtracks out of dead ends. A
 * found path is a witness: replayed on the same engine with the same seed,
 * it gets through the card without a single hit. Shots aim at the player
 * as they really walk, unlike a sweep against a still target.
 *
 * On the same witness it measures the punish windows: time on the safe path
 * spent within the fast move's reach of a boss that can be hurt (melee), or
 * with a clear line of fire (no cover in between, in range). From those
 * windows and a reference player (expected level for the boss's floor and
 * tier, each starter's default fast and heavy moves), it estimates whether
 * the card's segment can be emptied before its timer runs out.
 */

export const FRAME_TICKS = 6;
export const FRAME_MS = FRAME_TICKS * FIXED_DT_MS;
const PLAYER_R = TUNING.player.radius;
const WALK_PX = (TUNING.player.moveSpeed * FRAME_MS) / 1000;
const DIRS: readonly Vec2[] = [vec(0, 0), ...Array.from({ length: 8 }, (_, i) => vec(Math.cos((i * Math.PI) / 4), Math.sin((i * Math.PI) / 4)))];
/** A window at least this long counts as a punish opportunity. */
export const PUNISH_MIN_MS = 600;
/** Kill-feasibility targets: timer / estimated time to break, per tier. */
export const KILL_MARGIN: Readonly<Record<Difficulty, number>> = { easy: 1.5, normal: 1.5, hard: 1.3, nightmare: 1.1 };

/** A card boss in its arena. */
export interface BossCase {
  species: SpeciesId;
  room: RoomId;
  /** Turns the room into another variant (a Sima echo). */
  prepare?: (state: WorldState) => WorldState;
  /** Where the fight happens for the reference level (default: the room's own dungeon and floor). */
  where?: { dungeon: DungeonId; floor: number };
  label?: string;
}

export const CARD_BOSSES: readonly BossCase[] = [
  { species: 'aegislash', room: 'boss' },
  { species: 'decidueye', room: 'roost' },
  { species: 'sableye', room: 'vault' },
  { species: 'trevenant', room: 'hollow' },
  { species: 'lanturn', room: 'grotto' },
  { species: 'dhelmise', room: 'wreck' },
  { species: 'salazzle', room: 'den' },
  { species: 'nihilego', room: 'rift' },
];

export const CARD_TIERS: readonly Difficulty[] = ['normal', 'hard', 'nightmare'];

/** The dungeon and floor of a boss room (for the reference level). */
export function bossFloor(room: RoomId): { dungeon: DungeonId; floor: number } {
  for (const d of DUNGEONS) {
    const i = d.plan.findIndex((p) => p.kind === 'room' && p.room === room);
    if (i >= 0) return { dungeon: d.id, floor: i + 1 };
  }
  return { dungeon: DUNGEONS[0]!.id, floor: 1 };
}

/** The fight a boss plays in `state` (its tier's cards). */
export const fightIn = (state: WorldState, species: SpeciesId): CardFightDef | undefined => fightFor(state, fightOf(behaviourFor(species, state.difficulty ?? 'easy')));

/** The arena with the boss already on card `index` (declaring it), the player at `start`, unkillable (every hit still shows as `playerHurt`). */
export function cardWorld(c: BossCase, tier: Difficulty, index: number, start?: Vec2, player: SpeciesId = 'mimikyu'): WorldState {
  let s = loadRoom(createWorld({ seed: 11, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: tier, species: player }), c.room);
  if (c.prepare) s = c.prepare(s);
  const fight = fightIn(s, c.species);
  s = { ...s, player: { ...s.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true, ...(start ? { pos: start } : {}) } };
  if (!fight) return s;
  return { ...s, enemies: s.enemies.map((e) => (e.species === c.species ? atCard(e, fight, index) : e)) };
}

/** Start positions: the room's own and two more across the lower half, clear of obstacles. */
export function startsOf(c: BossCase): Vec2[] {
  const s = loadRoom(createWorld({ seed: 11, arena: { width: 1, height: 1 }, playerPos: vec(0, 0) }), c.room);
  const { width, height, obstacles = [] } = s.arena;
  const free = (p: Vec2) => obstacles.every((o) => p.x < o.x - PLAYER_R - 4 || p.x > o.x + o.width + PLAYER_R + 4 || p.y < o.y - PLAYER_R - 4 || p.y > o.y + o.height + PLAYER_R + 4);
  const out = [s.player.pos];
  for (const fx of [0.2, 0.8]) {
    for (const fy of [0.75, 0.65, 0.85, 0.55]) {
      const p = vec(Math.round(width * fx), Math.round(height * fy));
      if (free(p)) {
        out.push(p);
        break;
      }
    }
  }
  return out;
}

const bossIn = (s: WorldState, species: SpeciesId): EnemyState | undefined => s.enemies.find((e) => e.species === species && e.boss);

/** Whether a boss can be hurt right now from `from` (not declaring, no survival guard, not blocked by a frontal guard). */
export function vulnerable(boss: EnemyState | undefined, from: Vec2): boolean {
  if (!boss || !boss.alive || isDeclaring(boss) || boss.ai.mode === 'idle') return false;
  if (cardGuard(boss) === 'all') return false;
  return !blocksHit(boss, from);
}

/** Whether the segment from `a` to `b` crosses a cover block (shots stop there). */
export function coverBetween(state: WorldState, a: Vec2, b: Vec2): boolean {
  const blocks = (state.arena.obstacles ?? []).filter((o) => o.cover);
  if (blocks.length === 0) return false;
  const n = Math.ceil(distance(a, b) / 6);
  for (let i = 1; i < n; i++) {
    const p = add(a, scale(sub(b, a), i / n));
    if (blocks.some((o) => p.x > o.x && p.x < o.x + o.width && p.y > o.y && p.y < o.y + o.height)) return true;
  }
  return false;
}

/** How a starter's default move reaches: melee (arc or dash) or a projectile's range. */
export function reachOf(move: MoveDef): { kind: 'melee' | 'ranged'; px: number } {
  const box = move.hitbox;
  if (box.kind === 'projectile') return { kind: 'ranged', px: (box.speed * box.lifetimeMs) / 1000 };
  if (box.kind === 'dash') return { kind: 'melee', px: box.distance };
  if (box.kind === 'arc') return { kind: 'melee', px: box.range };
  return { kind: 'melee', px: 0 };
}

export type Mode = 'survive' | 'punish' | 'attack';

export interface WalkOptions {
  species: SpeciesId;
  /** `survive`: stay clear; `punish`: also close in on the boss's openings (to measure them); `attack`: also strike with the fast move (the solver bot). */
  mode: Mode;
  /** The walk is over (success) once this holds. */
  done: (s: WorldState) => boolean;
  maxMs: number;
  /** Frames the depth-first search may simulate before giving up. */
  budget?: number;
  /** Fast-move reach the punisher closes to (px past the boss's body). */
  reach?: number;
}

export interface Walk {
  ok: boolean;
  /** Frames simulated (search effort). */
  frames: number;
  /** The witness's moves, one digit per frame (index into the 9 moves). */
  moves: string;
  /** The witness: the state after each frame (the first is the start). */
  path: WorldState[];
  reason?: 'hit' | 'budget' | 'time';
}

const hurtIn = (s: WorldState): boolean => s.events.some((e) => e.type === 'playerHurt' || e.type === 'disguiseBroken');

/** The input of move `dir` from `state` in mode `o`: walk that way, aim at the boss, and (attack mode) strike when it is open and in reach. A function of the state alone, so a witness is its moves. */
export function inputAt(state: WorldState, dir: number, o: Pick<WalkOptions, 'species' | 'mode' | 'reach'>): PlayerInput {
  const boss = bossIn(state, o.species);
  const me = state.player.pos;
  // A press every other frame (the slot fires on the press, not while held); only in reach (an arc reaches its range past the target's body).
  const press = Math.floor(state.tick / FRAME_TICKS) % 2 === 0;
  const strike = o.mode === 'attack' && press && !!boss && vulnerable(boss, me) && distance(boss.pos, me) <= boss.radius + (o.reach ?? 30) - 2;
  return {
    move: DIRS[dir]!,
    aim: boss ? boss.pos : add(me, vec(0, -1)),
    roll: false,
    slots: [strike, false, false, false],
    slotMouse: [strike, false, false, false],
    lock: false,
    click: false,
    wheel: 0,
    view: { x: 0, y: 0, width: state.arena.width, height: state.arena.height },
  };
}

/** One frame of play: six ticks with the same input; whether the player was hit. */
export function playFrame(state: WorldState, input: PlayerInput): { state: WorldState; hurt: boolean } {
  let s = state;
  let hurt = false;
  const events: WorldState['events'][number][] = [];
  for (let i = 0; i < FRAME_TICKS; i++) {
    s = step(s, input, FIXED_DT_MS);
    if (hurtIn(s)) hurt = true;
    events.push(...s.events);
  }
  // The frame's state carries all six ticks' events (step() starts every tick with fresh ones).
  return { state: { ...s, events }, hurt };
}

/** Replays a witness's moves from `start`: every state, and whether (and when) the player was hit. */
export function replay(start: WorldState, moves: string, o: Pick<WalkOptions, 'species' | 'mode' | 'reach'>): { path: WorldState[]; hitAt: number | null } {
  const path = [start];
  let s = start;
  for (let i = 0; i < moves.length; i++) {
    // A digit is a move in the walk's own mode; a letter (a..i) the same move without striking (the solver's waited-out cards).
    const ch = moves.charCodeAt(i);
    const letter = ch >= 97;
    const frame = playFrame(s, inputAt(s, letter ? ch - 97 : ch - 48, letter ? { ...o, mode: 'survive' } : o));
    s = frame.state;
    path.push(s);
    if (frame.hurt) return { path, hitAt: i };
  }
  return { path, hitAt: null };
}

/** Clearance of a spot from the enemy shots over the next 1.2 s and from the marked pierce zones (higher is safer; capped). */
function clearance(state: WorldState, at: Vec2): number {
  let best = 80;
  let threat = 0;
  for (const p of state.projectiles) {
    if (p.owner !== 'enemy') continue;
    // Closest approach to a player standing at `at`, within 1.2 s (and the shot's life).
    const rx = at.x - p.pos.x;
    const ry = at.y - p.pos.y;
    const v2 = p.vel.x * p.vel.x + p.vel.y * p.vel.y;
    const horizon = Math.min(1.2, p.remainingMs / 1000);
    const t = v2 > 0 ? Math.max(0, Math.min(horizon, (rx * p.vel.x + ry * p.vel.y) / v2)) : 0;
    const miss = Math.hypot(p.pos.x + p.vel.x * t - at.x, p.pos.y + p.vel.y * t - at.y) - p.radius - PLAYER_R;
    // A shot on course to hit soon is the danger: the sooner, the worse (walk out of its line early).
    if (miss < 8) threat += (1.4 - t) * (1.4 - t) * (8 - miss);
    if (t <= 0.4) best = Math.min(best, miss + t * 40);
  }
  best -= threat * 0.6;
  const tier = state.difficulty ?? 'easy';
  for (const e of state.enemies) {
    if (!e.alive) continue;
    if (!e.boss) {
      best = Math.min(best, distance(e.pos, at) - e.radius - PLAYER_R - 20);
      continue;
    }
    const zone = pierceZone(e, tier, state.arena);
    if (zone?.kind === 'circle') best = Math.min(best, distance(e.pos, at) - zone.radius - PLAYER_R);
    if (zone?.kind === 'mark') best = Math.min(best, distance(zone.center, at) - zone.radius - PLAYER_R);
    // Its body only matters while it strikes (an opening is the time to stand next to it).
    const striking = e.ai.mode === 'telegraph' || e.ai.mode === 'attack' || e.ai.mode === 'transform';
    if (striking) best = Math.min(best, distance(e.pos, at) - e.radius - PLAYER_R - 6);
  }
  const { width, height } = state.arena;
  const edge = Math.min(at.x, at.y, width - at.x, height - at.y) - PLAYER_R;
  return best + Math.min(0, edge - 30) * 0.5;
}

/** Whether the boss gives an opening right now: its turn, a recovery, or its rest between moves (`approach`: it threatens nothing until it winds up). */
const opening = (boss: EnemyState | undefined): boolean => !!boss && boss.alive && (inTurn(boss) || boss.ai.mode === 'recover' || boss.ai.mode === 'approach');

/** How good a spot is in mode `o`: its clearance, and for a punisher how near it is to where it wants to stand. */
function score(state: WorldState, at: Vec2, o: Pick<WalkOptions, 'species' | 'mode' | 'reach'>): number {
  let value = clearance(state, at);
  const boss = bossIn(state, o.species);
  if (boss?.alive) {
    const dist = distance(at, boss.pos);
    // A punisher closes in for the openings and holds near between them (to be there when the turn starts); a survivor holds a dodging distance.
    // A punisher also starts in as the boss's attack is about to end (its turn opens then), to be at its side for the whole turn.
    const ending = boss.ai.mode === 'attack' && boss.ai.modeDurationMs - boss.ai.modeMs < 1200;
    const close = o.mode !== 'survive' && (opening(boss) || ending) && vulnerable(boss, at);
    const want = close ? boss.radius + (o.reach ?? 30) * 0.6 : o.mode === 'survive' ? 200 : boss.radius + 70;
    value -= Math.abs(dist - want) * (close ? (ending && !opening(boss) ? 0.25 : 0.4) : o.mode === 'survive' ? 0.08 : 0.15);
  }
  return value;
}

/** The 9 moves from `state`, best first. */
function rank(state: WorldState, o: WalkOptions): number[] {
  const me = state.player.pos;
  return DIRS.map((d, i) => ({ i, value: score(state, add(me, scale(d, WALK_PX)), o) + (i === 0 ? 0.5 : 0) }))
    .sort((a, b) => b.value - a.value)
    .map((x) => x.i);
}

/**
 * The depth-first search from `start` until `o.done`: through 100 ms
 * frames, best move first, backtracking out of every dead end, within a
 * budget of simulated frames.
 */
export function walk(start: WorldState, o: WalkOptions): Walk {
  const budget = o.budget ?? 40_000;
  const maxFrames = Math.ceil(o.maxMs / FRAME_MS);
  const stack: { state: WorldState; order: number[]; next: number; move: number }[] = [{ state: start, order: rank(start, o), next: 0, move: -1 }];
  let frames = 0;
  let deepest: WorldState[] = [start];
  const movesOf = () => stack.slice(1).map((n) => n.move).join('');
  while (stack.length > 0) {
    const top = stack[stack.length - 1]!;
    if (stack.length > deepest.length) deepest = stack.map((n) => n.state);
    if (o.done(top.state)) return { ok: true, frames, moves: movesOf(), path: stack.map((n) => n.state) };
    if (stack.length > maxFrames) return { ok: false, frames, moves: movesOf(), path: stack.map((n) => n.state), reason: 'time' };
    if (top.next >= top.order.length) {
      stack.pop();
      continue;
    }
    if (frames >= budget) return { ok: false, frames, moves: '', path: deepest, reason: 'budget' };
    const move = top.order[top.next++]!;
    const child = playFrame(top.state, inputAt(top.state, move, o));
    frames++;
    if (child.hurt) continue;
    stack.push({ state: child.state, order: rank(child.state, o), next: 0, move });
  }
  return { ok: false, frames, moves: '', path: deepest, reason: 'hit' };
}

/**
 * The same search with a beam, for cards the depth-first search cannot
 * finish within its budget: every frame keeps the `width` best states, at
 * most one per 16 px cell (so the alternatives stay spread over the room),
 * each expanded to its 9 moves. A path that survives is a witness exactly as
 * before; the beam only finds ones the greedy order misses.
 */
export function beamWalk(start: WorldState, o: WalkOptions & { width?: number }): Walk {
  const width = o.width ?? 16;
  const maxFrames = Math.ceil(o.maxMs / FRAME_MS);
  // Only the moves are kept for the way back (the states of old frames are let go): the witness is replayed at the end.
  type Trail = { move: number; prev: Trail | null };
  type Beam = { state: WorldState; trail: Trail | null; value: number };
  let beam: Beam[] = [{ state: start, trail: null, value: 0 }];
  let frames = 0;
  const movesOf = (b: Beam): string => {
    const out: number[] = [];
    for (let t = b.trail; t; t = t.prev) out.push(t.move);
    return out.reverse().join('');
  };
  const finish = (b: Beam, ok: boolean, reason?: Walk['reason']): Walk => {
    const moves = movesOf(b);
    return { ok, frames, moves: ok ? moves : '', path: replay(start, moves, o).path, ...(reason ? { reason } : {}) };
  };
  for (let f = 0; f < maxFrames; f++) {
    const done = beam.find((b) => o.done(b.state));
    if (done) return finish(done, true);
    const children = new Map<number, Beam>();
    for (const b of beam) {
      for (let move = 0; move < DIRS.length; move++) {
        const child = playFrame(b.state, inputAt(b.state, move, o));
        frames++;
        if (child.hurt) continue;
        const p = child.state.player.pos;
        const cell = Math.floor(p.x / 16) * 4096 + Math.floor(p.y / 16);
        const value = score(child.state, p, o);
        const had = children.get(cell);
        if (!had || had.value < value) children.set(cell, { state: child.state, trail: { move, prev: b.trail }, value });
      }
    }
    if (children.size === 0) return finish(beam[0]!, false, 'hit');
    beam = [...children.values()].sort((x, y) => y.value - x.value).slice(0, width);
  }
  return finish(beam[0]!, false, 'time');
}

/** The cascade every proof uses: depth-first, then wider and wider beams (each only when the last could not finish). */
export function search(start: WorldState, o: WalkOptions, widths: readonly number[] = [24, 96, 192]): Walk {
  let w = walk(start, { ...o, budget: o.budget ?? 20_000 });
  for (const width of widths) if (!w.ok) w = beamWalk(start, { ...o, width });
  return w;
}

/** Punish windows along a witness: melee (within `reach` past the boss's body) and line of fire (in `range`, no cover). */
export interface Punish {
  meleeMs: number;
  meleeWindows: number;
  longestMeleeMs: number;
  fireMs: number;
  fireWindows: number;
  longestFireMs: number;
  turns: number;
}

/**
 * The punish probe: from a state on the witness where the boss opens its
 * turn, the player walks straight at it (no roll, no attack) and holds by
 * its side, until the boss winds up its next move, the card ends, or a hit
 * lands (the probe stops there: only time before it counts). During the
 * turn nothing new threatens and the shots fade (tests/core/turn-windows),
 * and during the rest that follows nothing has been wound up yet; the engine
 * checks it all again here. Returns the time in melee reach and in line of
 * fire, each as one window.
 */
export function probeOpening(start: WorldState, species: SpeciesId, reach: number, range: number): { meleeMs: number; fireMs: number } {
  let s = start;
  let melee = 0;
  let fire = 0;
  for (let f = 0; f < 60; f++) {
    const boss = bossIn(s, species);
    if (!boss?.alive || boss.ai.mode === 'telegraph' || boss.ai.mode === 'attack' || isDeclaring(boss)) break;
    const me = s.player.pos;
    const gap = distance(boss.pos, me) - boss.radius;
    // A frontal guard (Aegislash's Shield cards) is flanked: go for its back.
    const flank = cardGuard(boss) === 'front';
    const spot = flank ? sub(boss.pos, scale(normalize(boss.facing), boss.radius + reach * 0.5)) : boss.pos;
    const there = flank ? distance(spot, me) <= 8 : gap <= reach * 0.6;
    // Straight in, or the nearest-to-it move that is not hit (a fading shot in the way); none: the window closes.
    const order = there ? [0] : DIRS.map((d, i) => ({ i, d: distance(add(me, scale(d, WALK_PX)), spot) })).sort((a, b) => a.d - b.d).map((x) => x.i);
    let next: WorldState | null = null;
    for (const dir of order) {
      const frame = playFrame(s, inputAt(s, dir, { species, mode: 'survive' }));
      if (!frame.hurt) {
        next = frame.state;
        break;
      }
    }
    if (!next) break;
    s = next;
    const after = bossIn(s, species);
    const can = vulnerable(after, s.player.pos);
    const g = after ? distance(after.pos, s.player.pos) - after.radius : Infinity;
    if (can && g <= reach) melee += FRAME_MS;
    if (can && after && g <= range && !coverBetween(s, s.player.pos, after.pos)) fire += FRAME_MS;
  }
  return { meleeMs: melee, fireMs: fire };
}

/** Punish windows of a witness: one probe from every turn it meets (windows under `PUNISH_MIN_MS` do not count). */
export function turnPunish(path: readonly WorldState[], species: SpeciesId, reach: number, range: number): Punish {
  const out: Punish = { meleeMs: 0, meleeWindows: 0, longestMeleeMs: 0, fireMs: 0, fireWindows: 0, longestFireMs: 0, turns: 0 };
  for (const s of path) {
    if (!s.events.some((e) => e.type === 'bossTurn')) continue;
    out.turns++;
    const p = probeOpening(s, species, reach, range);
    if (p.meleeMs >= PUNISH_MIN_MS) {
      out.meleeMs += p.meleeMs;
      out.meleeWindows++;
      out.longestMeleeMs = Math.max(out.longestMeleeMs, p.meleeMs);
    }
    if (p.fireMs >= PUNISH_MIN_MS) {
      out.fireMs += p.fireMs;
      out.fireWindows++;
      out.longestFireMs = Math.max(out.longestFireMs, p.fireMs);
    }
  }
  return out;
}

/** Punish windows along a witness itself (time on the safe path in reach); the proof uses `turnPunish`. */
export function punishOf(path: readonly WorldState[], species: SpeciesId, reach: number, range: number): Punish {
  const out: Punish = { meleeMs: 0, meleeWindows: 0, longestMeleeMs: 0, fireMs: 0, fireWindows: 0, longestFireMs: 0, turns: 0 };
  let melee = 0;
  let fire = 0;
  const close = (run: number, kind: 'melee' | 'fire') => {
    if (run < PUNISH_MIN_MS) return;
    if (kind === 'melee') {
      out.meleeMs += run;
      out.meleeWindows++;
      out.longestMeleeMs = Math.max(out.longestMeleeMs, run);
    } else {
      out.fireMs += run;
      out.fireWindows++;
      out.longestFireMs = Math.max(out.longestFireMs, run);
    }
  };
  for (const s of path) {
    if (s.events.some((e) => e.type === 'bossTurn')) out.turns++;
    const boss = bossIn(s, species);
    const me = s.player.pos;
    const can = vulnerable(boss, me);
    // An arc reaches its range past the target's body, from the player's centre (core/combat.ts `resolveMelee`).
    const gap = boss ? distance(boss.pos, me) - boss.radius : Infinity;
    if (can && gap <= reach) melee += FRAME_MS;
    else {
      close(melee, 'melee');
      melee = 0;
    }
    if (can && boss && gap <= range && !coverBetween(s, me, boss.pos)) fire += FRAME_MS;
    else {
      close(fire, 'fire');
      fire = 0;
    }
  }
  close(melee, 'melee');
  close(fire, 'fire');
  return out;
}

/** A starter's reference damage per second on a boss with its default fast or heavy move (the better), at `level`; the reach is the fast move's. */
export function referenceDps(player: SpeciesId, boss: SpeciesId, level: number): { dps: number; move: MoveDef; reach: { kind: 'melee' | 'ranged'; px: number } } {
  const def = SPECIES[player];
  let best: { dps: number; move: MoveDef } | null = null;
  for (const id of def.defaultLoadout.slice(0, 2)) {
    if (!id) continue;
    const move = MOVES[id];
    const { damage } = computeDamage({ power: move.power, moveType: move.type, attackerTypes: def.types, defenderTypes: SPECIES[boss].types, multiplier: levelDamage(level), onEnemy: true });
    const cycle = move.windupMs + move.activeMs + move.recoveryMs + (move.cooldownMs ?? 0);
    const dps = (damage * 1000) / cycle;
    if (!best || dps > best.dps) best = { dps, move };
  }
  const fast = MOVES[def.defaultLoadout[0]!];
  return { dps: best?.dps ?? 0, move: best?.move ?? fast, reach: reachOf(fast) };
}

/** Whether a starter is at a type disadvantage on a boss: none of its default fast and heavy moves does neutral damage or better (a resistance or an immunity). */
export function typeWalled(player: SpeciesId, boss: SpeciesId): boolean {
  const def = SPECIES[player];
  return def.defaultLoadout.slice(0, 2).every((id) => !id || hitEffectiveness(MOVES[id].type, SPECIES[boss].types) < 1);
}

/** The proof's reach for melee windows (Mimikyu's Shadow Claw, the shortest fast move) and its line-of-fire range. */
export const MELEE_REACH = 34;
export const FIRE_RANGE = 200;

/** One start's witness of a card (what `npm run prove` stores and the tests replay). */
export interface Witness {
  mode: Mode;
  moves: string;
}

export interface CardProof {
  boss: string;
  tier: Difficulty;
  card: string;
  index: number;
  survival: boolean;
  /** Every start got through the whole card without a hit. */
  survivable: boolean;
  starts: number;
  failures: string[];
  witnesses: (Witness | null)[];
  timerMs: number;
  /** Worst start: punish windows on its witness. */
  punish: Punish;
  /** Segment HP, the reference starters' worst margin (window damage / segment HP), and the target. */
  segmentHp: number;
  margin: number;
  marginTarget: number;
  worstStarter: SpeciesId | null;
}

/** The end of card `index`: its `spellCardEnd`, or the boss fell. */
export const cardOver = (species: SpeciesId, cardId: string) => (s: WorldState): boolean =>
  s.events.some((e) => e.type === 'spellCardEnd' && e.card === cardId) || !bossIn(s, species)?.alive;

/** Judges one card from its witnesses (found or stored): every start replayed on the engine, then its punish windows and kill margin. */
export function judgeCard(c: BossCase, tier: Difficulty, index: number, starts: readonly Vec2[], witnesses: readonly (Witness | null)[]): CardProof {
  const probe = cardWorld(c, tier, index);
  const fight = fightIn(probe, c.species)!;
  const card: SpellCardDef = fight.cards[index]!;
  const boss0 = bossIn(probe, c.species)!;
  const failures: string[] = [];
  let worst: Punish | null = null;
  starts.forEach((start, i) => {
    const w = witnesses[i];
    const where = `from (${Math.round(start.x)}, ${Math.round(start.y)})`;
    if (!w) {
      failures.push(`${where}: no witness`);
      return;
    }
    const played = replay(cardWorld(c, tier, index, start), w.moves, { species: c.species, mode: w.mode, reach: MELEE_REACH });
    const last = played.path.at(-1)!;
    if (played.hitAt !== null) failures.push(`${where}: hit at ${((played.hitAt * FRAME_MS) / 1000).toFixed(1)} s`);
    else if (!cardOver(c.species, card.id)(last)) failures.push(`${where}: the card did not end`);
    else {
      const p = turnPunish(played.path, c.species, MELEE_REACH, FIRE_RANGE);
      if (!worst || p.meleeMs + p.fireMs < worst.meleeMs + worst.fireMs) worst = p;
    }
  });
  const punish: Punish = worst ?? { meleeMs: 0, meleeWindows: 0, longestMeleeMs: 0, fireMs: 0, fireWindows: 0, longestFireMs: 0, turns: 0 };
  // Kill estimate: the reference player at the boss floor's expected level, each starter's best default move, attacking only in its windows.
  const where = c.where ?? bossFloor(c.room);
  const level = expectedLevel(where.dungeon, where.floor, tier);
  const share = card.hpShare / fight.cards.reduce((sum, k) => sum + k.hpShare, 0);
  const segmentHp = boss0.maxHp * share;
  let margin = Infinity;
  let worstStarter: SpeciesId | null = null;
  if (!card.survival) {
    for (const player of STARTER_SPECIES) {
      // A type disadvantage (no default move at neutral or better) is reported apart, not as the card's margin.
      if (typeWalled(player, c.species)) continue;
      const ref = referenceDps(player, c.species, level);
      const windowMs = ref.reach.kind === 'ranged' ? punish.fireMs : punish.meleeMs;
      const m = (ref.dps * windowMs) / 1000 / segmentHp;
      if (m < margin) {
        margin = m;
        worstStarter = player;
      }
    }
  }
  return {
    boss: c.label ?? c.species,
    tier,
    card: card.id,
    index,
    survival: card.survival === true,
    survivable: failures.length === 0,
    starts: starts.length,
    failures,
    witnesses: [...witnesses],
    timerMs: card.timerMs,
    punish,
    segmentHp: Math.round(segmentHp),
    margin: card.survival ? Infinity : margin,
    marginTarget: KILL_MARGIN[tier],
    worstStarter,
  };
}

/** Finds a witness for card `index` from `start`: the punisher's first (it also measures the openings), else a plain survivor's. */
export function findWitness(c: BossCase, tier: Difficulty, index: number, start: Vec2): Witness | null {
  const s0 = cardWorld(c, tier, index, start);
  const fight = fightIn(s0, c.species)!;
  const card = fight.cards[index]!;
  const maxMs = card.timerMs + (card.phase2 ? fight.phase2BreakMs : fight.breakMs) + 5000;
  const done = cardOver(c.species, card.id);
  for (const mode of ['punish', 'survive'] as const) {
    const w = search(s0, { species: c.species, mode, done, maxMs, reach: MELEE_REACH }, mode === 'punish' ? [24, 96] : [96, 192]);
    if (w.ok) return { mode, moves: w.moves };
  }
  return null;
}

/** Proves card `index`: a witness from every start, then judges them. */
export function proveCard(c: BossCase, tier: Difficulty, index: number, starts: readonly Vec2[] = startsOf(c)): CardProof {
  return judgeCard(c, tier, index, starts, starts.map((start) => findWitness(c, tier, index, start)));
}

export interface FightRun {
  boss: string;
  tier: Difficulty;
  seed: number;
  cleared: boolean;
  timeMs: number;
  cards: number;
  captured: number;
  broken: number;
  timedOut: number;
  moves: string;
}

/** The solver bot's fight world: the room's start, the reference level, an unkillable player whose every hit still counts as one. */
export function fightWorld(c: BossCase, tier: Difficulty, seed: number, player: SpeciesId = 'mimikyu'): WorldState {
  let s = loadRoom(createWorld({ seed, arena: { width: 1, height: 1 }, playerPos: vec(0, 0), difficulty: tier, species: player }), c.room);
  if (c.prepare) s = c.prepare(s);
  const where = c.where ?? bossFloor(c.room);
  return { ...s, referenceLevel: expectedLevel(where.dungeon, where.floor, tier), player: { ...s.player, hp: 1e9, maxHp: 1e9, disguiseBroken: true } };
}

/** What a fight's moves did, replayed: cleared (the boss fell with no hit taken), when, and its cards' ends. */
export function judgeFight(c: BossCase, tier: Difficulty, seed: number, moves: string): FightRun {
  const s0 = fightWorld(c, tier, seed);
  const played = replay(s0, moves, { species: c.species, mode: 'attack', reach: MELEE_REACH });
  const events = played.path.flatMap((x) => x.events);
  const last = played.path.at(-1)!;
  return {
    boss: c.label ?? c.species,
    tier,
    seed,
    cleared: played.hitAt === null && !bossIn(last, c.species)?.alive,
    timeMs: (played.path.length - 1) * FRAME_MS,
    cards: fightIn(s0, c.species)?.cards.length ?? 0,
    captured: events.filter((e) => e.type === 'cardCaptured').length,
    broken: events.filter((e) => e.type === 'spellCardEnd' && e.outcome === 'broken').length,
    timedOut: events.filter((e) => e.type === 'spellCardEnd' && e.outcome === 'timeout').length,
    moves,
  };
}

/**
 * The solver bot: a whole boss fight from the room's start, on the real
 * engine, with perfect information. Card by card it searches a path that
 * never takes a hit and strikes with the starter's fast move whenever the
 * boss is open and in reach (the same cascade as the proof); the moves of
 * all the cards in a row are the fight.
 */
export function solveFight(c: BossCase, tier: Difficulty, seed: number): FightRun {
  let s = fightWorld(c, tier, seed);
  let moves = '';
  const fight = fightIn(s, c.species);
  for (let guard = 0; guard < 24 && bossIn(s, c.species)?.alive; guard++) {
    const boss = bossIn(s, c.species)!;
    const index = boss.boss?.card ?? 0;
    const card = fight?.cards[index];
    const maxMs = (card?.timerMs ?? 30_000) + 8000;
    // Until the card in play ends (or the boss falls).
    const id = card?.id;
    const done = (x: WorldState) => !bossIn(x, c.species)?.alive || (id !== undefined && x.events.some((e) => e.type === 'spellCardEnd' && e.card === id));
    // Striking where it can; a card it cannot strike through safely it waits out (the liveness half: the timer ends it).
    let w = search(s, { species: c.species, mode: 'attack', done, maxMs, reach: MELEE_REACH }, [24, 96]);
    let waited = false;
    if (!w.ok) {
      w = search(s, { species: c.species, mode: 'survive', done, maxMs, reach: MELEE_REACH }, [96, 192]);
      waited = true;
    }
    if (!w.ok) break;
    moves += waited ? w.moves.replace(/[0-8]/g, (d) => String.fromCharCode(97 + Number(d))) : w.moves;
    s = w.path.at(-1)!;
  }
  return judgeFight(c, tier, seed, moves);
}

/** Markdown report of the proof (reports/proof/latest.md). */
export function renderProofs(proofs: readonly CardProof[], runs: readonly FightRun[] = []): string {
  const lines = [
    '# Beatability proof',
    '',
    'Generated by `npm run prove` (src/sim/prove.ts; docs/gdd.md "Garantía de que todo se puede pasar"). Every card of every card boss on Normal, Hard and Nightmare, from every start: a walk-only witness (no roll, no attack) replayed on the real engine without a single hit until the card ends. Punish windows (≥ 600 ms; melee within 34 px of the body, line of fire within 200 px with no cover; boss hurtable) are measured on the worst start\'s witness. Kill margin = reference DPS × window time / segment HP, for the worst starter at the floor\'s expected level; target per tier.',
    '',
    `"Tu turno" per tier (TIERS.turnMs): ${(['easy', 'normal', 'hard', 'nightmare'] as const).map((d) => `${d} ${TIERS[d].turnMs} ms`).join(', ')}.`,
    '',
    '| boss | tier | card | survivable | melee window ms (windows) | line of fire ms | turns | segment HP / timer | margin (worst starter) | target |',
    '|---|---|---|---|---|---|---|---|---|---|',
  ];
  for (const p of proofs) {
    const margin = p.survival ? 'survival' : `${p.margin.toFixed(2)} (${p.worstStarter})${gapOf(p) ? ' · known gap' : ''}`;
    lines.push(
      `| ${p.boss} | ${p.tier} | ${p.card} | ${p.survivable ? `✓ (${p.starts})` : `✗ ${p.failures.join('; ')}`} | ${p.punish.meleeMs} (${p.punish.meleeWindows}) | ${p.punish.fireMs} | ${p.punish.turns} | ${p.survival ? '-' : p.segmentHp} / ${p.timerMs / 1000} s | ${margin} | ${p.survival ? '-' : p.marginTarget} |`,
    );
  }
  if (runs.length > 0) {
    lines.push('', '## Solver bot (whole fights from the room\'s start, perfect information, never hit, Mimikyu at the expected level)', '', '| boss | tier | seed | cleared | time s | cards broken / timed out / captured |', '|---|---|---|---|---|---|');
    for (const r of runs) lines.push(`| ${r.boss} | ${r.tier} | ${r.seed} | ${r.cleared ? '✓' : '✗'} | ${(r.timeMs / 1000).toFixed(1)} | ${r.broken} / ${r.timedOut} / ${r.captured} |`);
  }
  return `${lines.join('\n')}\n`;
}

/** What the proof covers: every card boss on every card tier (its witnesses), and the solver bot's whole fights on Nightmare. */
export interface ProofCase {
  case: BossCase;
  tiers: readonly Difficulty[];
  fights: readonly Difficulty[];
}

/**
 * The Sima echoes of the card guardians, each on the first floor it meets
 * (core/cards.ts `echoStageAt`: Aegislash and Trevenant in phase 1, Decidueye
 * with phase 2, Dhelmise and Nihilego with everything), at that floor's
 * depth scale and the echo's kept HP share.
 */
export const ECHO_BOSSES: readonly BossCase[] = (
  [
    { species: 'aegislash', room: 'boss', floor: 5 },
    { species: 'trevenant', room: 'hollow', floor: 15 },
    { species: 'decidueye', room: 'roost', floor: 25 },
    { species: 'dhelmise', room: 'wreck', floor: 45 },
    { species: 'nihilego', room: 'rift', floor: 65 },
  ] as const
).map(({ species, room, floor }) => ({
  species,
  room,
  label: `${species}-echo`,
  where: { dungeon: 'eclipse-chasm' as DungeonId, floor },
  prepare: (s: WorldState): WorldState => {
    const stage = echoStageAt(floor);
    const scale = { ...depthScale(ENDLESS.scaling, floor, true), echoStage: stage };
    const fight = fightOf(behaviourFor(species, s.difficulty ?? 'easy'));
    const share = fight ? echoShare(fight, stage) : 1;
    const hp = (maxHp: number) => Math.max(1, Math.round(maxHp * ECHO_CARDS.hpScale * share));
    const enemies = s.enemies.map((e) => (e.species === species ? { ...e, maxHp: hp(e.maxHp), hp: hp(e.maxHp) } : e));
    return { ...s, depth: floor, enemyScale: scale, enemies };
  },
}));

/**
 * The Sendas' shadows: every new story mid-boss (data/story/bosses.ts) on a
 * challenge or a chapter road, where it first stands (its road and floor).
 * The live proof (tests/sim/story-prove.ts) and the type-balance study
 * (src/sim/type-balance.ts) read this one list, so a new shadow reaches both.
 */
export const SHADOW_BOSSES: readonly BossCase[] = (() => {
  const story = new Set<string>(STORY_BOSSES.map((b) => b.id));
  return [...CHALLENGES, ...SENDA_ROADS].flatMap((d) =>
    d.plan.flatMap((p, i) => {
      if (p.kind !== 'room' || p.role !== 'midboss') return [];
      const species = ROOMS[p.room].spawns[0]!.species;
      return story.has(species) && !isWound(species) ? [{ species, room: p.room as RoomId, where: { dungeon: d.id, floor: i + 1 } }] : [];
    }),
  );
})();

export const PROOF_CASES: readonly ProofCase[] = [
  ...CARD_BOSSES.map((c) => ({ case: c, tiers: CARD_TIERS, fights: ['nightmare'] as const })),
  ...ECHO_BOSSES.map((c) => ({ case: c, tiers: CARD_TIERS, fights: [] as const })),
];

/** Seeds of the solver bot's fights. */
export const FIGHT_SEEDS: readonly number[] = [1, 2, 3];

/**
 * Damage gaps the proof still finds (punish windows or kill margin short of
 * the target), each with its reason, as the balance harness's
 * `KNOWN_VIOLATIONS`: they are reported, never hidden, and the tests fail on
 * any other one and on an entry that no longer fails (delete it then).
 * Survivability and liveness have no exceptions.
 */
export interface KillGap {
  boss: string;
  tier: Difficulty;
  card: string;
  why: string;
}

export const KNOWN_KILL_GAPS: readonly KillGap[] = KILL_GAPS;

const gapOf = (p: Pick<CardProof, 'boss' | 'tier' | 'card'>): KillGap | undefined => KNOWN_KILL_GAPS.find((g) => g.boss === p.boss && g.tier === p.tier && g.card === p.card);

/** The damage half's shortfalls of one card (empty when it meets everything). */
export function killShortfalls(p: CardProof): string[] {
  if (p.survival || !p.survivable) return [];
  const out: string[] = [];
  if (p.punish.meleeWindows === 0) out.push(`no melee punish window ≥ ${PUNISH_MIN_MS} ms`);
  if (p.punish.fireWindows === 0) out.push(`no line-of-fire window ≥ ${PUNISH_MIN_MS} ms`);
  if (p.margin < p.marginTarget) out.push(`kill margin ${p.margin.toFixed(2)} < ${p.marginTarget} (${p.worstStarter})`);
  return out;
}

/** The proof's verdict: every card survivable; every card that can be hurt gives punish windows and meets its kill margin, unless it is a recorded gap. */
export function proofFailures(proofs: readonly CardProof[]): string[] {
  const out: string[] = [];
  for (const p of proofs) {
    const at = `${p.boss} ${p.tier} ${p.card}`;
    if (!p.survivable) out.push(`${at}: not survivable (${p.failures.join('; ')})`);
    const short = killShortfalls(p);
    if (short.length > 0 && !gapOf(p)) out.push(`${at}: ${short.join('; ')}`);
    if (short.length === 0 && gapOf(p)) out.push(`${at}: listed in KNOWN_KILL_GAPS but meets its targets now (delete the entry)`);
  }
  return out;
}
