import type { FloorKind } from '../data/dungeon';
import { GATE, threatOf, type GateKind, type GateTuning } from '../data/encounters';
import { tileDistances, type Floor } from './dungeon';
import { presentPlayers } from './party';
import { deriveSeed } from './rng';
import { doorTiles, withDoors } from './sima-events';
import { draws } from './sima';
import type { EnemyState, GameEvent, WorldState } from './state';
import { isWall, tileOf, type TileGrid } from './tiles';
import { distance, type Vec2 } from './vec';

/**
 * Mandatory kills (docs/gdd.md §3 "Encuentros con sentido"), pure: some
 * generated floors hold one gate between the player and the stairs (data
 * `GateTuning`). Every peer places the same gate from the run seed; only the
 * host (or solo) resolves it, guests follow its snapshot (`gateSync`). The
 * out-of-bounds safety: a gate enemy (or its dropped key) that no player can
 * reach for `GATE.unreachableMs` in a row breaks the gate, without reward.
 */

export type GateOutcome = 'opened' | 'broken';

export interface GateState {
  kind: GateKind;
  /** Seal and key: the marked enemy's id (the seal's target, the key's bearer). */
  target?: string;
  /** Key: the stairs room's doorway tiles, walls while it is locked. */
  doors?: readonly number[];
  /** Key: where the key lies once its bearer fell, until a player walks over it. */
  key?: Vec2;
  done: boolean;
  outcome?: GateOutcome;
  /** Host: ms the gate's enemy (or key) has been out of every player's reach, in a row. */
  stuckMs: number;
}

/** What a guest needs of the host's gate (sent with the snapshot). */
export interface GateSync {
  done: boolean;
  outcome?: GateOutcome;
  key?: Vec2;
}

const GATE_SALT = 0x6a7e;

const at = (table: readonly number[], floor: number): number => table[Math.min(Math.max(1, floor), table.length) - 1] ?? 0;

/**
 * The gate of a floor, if any: never floor 1, never an urgent floor, one
 * draw against the floor's chance, one weighted pick among the kinds open
 * there. A pure draw from the run seed.
 */
export function chooseGate(runSeed: number, floor: number, kind: FloorKind, gates: GateTuning | undefined): GateKind | null {
  if (!gates || floor <= 1 || kind !== 'normal') return null;
  const draw = draws(deriveSeed(runSeed, floor + GATE_SALT));
  if (draw() >= at(gates.chance, floor)) return null;
  const open = gates.kinds.filter((k) => at(k.weights, floor) > 0);
  if (open.length === 0) return null;
  let roll = draw() * open.reduce((sum, k) => sum + at(k.weights, floor), 0);
  for (const k of open) {
    roll -= at(k.weights, floor);
    if (roll < 0) return k.kind;
  }
  return open[open.length - 1]!.kind;
}

/** The gate's pick among candidates: a leader first, then an elite, then the highest threat, then the farthest walk from the start. */
function pickTarget(candidates: readonly EnemyState[], walk: (e: EnemyState) => number): EnemyState | undefined {
  const score = (e: EnemyState) => (e.leader ? 1000 : 0) + (e.elite ? 100 : 0) + threatOf(e.species) * 10 + walk(e) / 1000;
  return [...candidates].sort((a, b) => score(b) - score(a))[0];
}

/**
 * Places a floor's gate on its freshly loaded world: picks its enemy (a
 * leader first, then an elite, then the highest threat; the renderer and the
 * minimap mark it, its stats stay its own, so Easy keeps no elites) and for
 * a key gate locks the stairs room (its bearer always stands outside it,
 * reachable from the start). A seal or key with no enemy to mark, or a wave
 * gate without its wave room, places nothing.
 */
export function placeGate(world: WorldState, kind: GateKind, floor: Floor): WorldState {
  if (kind === 'waves') return world.simaEvent?.kind === 'waves' ? { ...world, gate: { kind, done: false, stuckMs: 0 } } : world;
  const stairsRoom = floor.rooms[floor.stairsRoom]!;
  const inStairsRoom = (e: EnemyState) => {
    const t = tileOf(e.pos);
    return t.x >= stairsRoom.x && t.y >= stairsRoom.y && t.x < stairsRoom.x + stairsRoom.width && t.y < stairsRoom.y + stairsRoom.height;
  };
  const alive = world.enemies.filter((e) => e.alive);
  if (kind === 'key') {
    const doors = doorTiles(floor, stairsRoom);
    const locked = withDoors(floor, doors, true);
    const dist = tileDistances(locked, floor.start);
    const walk = (e: EnemyState) => dist[tileOf(e.pos).y * floor.cols + tileOf(e.pos).x] ?? -1;
    const bearer = pickTarget(alive.filter((e) => !inStairsRoom(e) && walk(e) >= 0), walk);
    // No bearer the player can reach: the stairs are sealed by a marked enemy instead.
    if (bearer && doors.length > 0) {
      return { ...world, arena: { ...world.arena, tiles: withDoors(world.arena.tiles ?? floor, doors, true) }, gate: { kind, target: bearer.id, doors, done: false, stuckMs: 0 } };
    }
  }
  const dist = tileDistances(floor, floor.start);
  const walk = (e: EnemyState) => dist[tileOf(e.pos).y * floor.cols + tileOf(e.pos).x] ?? -1;
  const target = pickTarget(alive.filter((e) => walk(e) >= 0), walk);
  if (!target) return world;
  return { ...world, gate: { kind: 'seal', target: target.id, done: false, stuckMs: 0 } };
}

/** True while the floor's gate keeps the stairs shut (the host's word on every peer). */
export const gateShut = (state: Pick<WorldState, 'gate'>): boolean => state.gate !== undefined && !state.gate.done;

/** Whether the marked enemy pays the gate's bonus when it falls: it is the gate's, and the gate did not break. */
export const gateBonus = (state: Pick<WorldState, 'gate'>, enemy: Pick<EnemyState, 'id'>): number =>
  state.gate?.target === enemy.id && state.gate.outcome !== 'broken' ? GATE.xp : 1;

/**
 * Whether a point can be walked to by some present player: its tile, or one
 * of its four neighbours, on the players' flow field (a body pressed against
 * a wall still counts). Off the map, or no flow field yet: unreachable and
 * reachable respectively.
 */
export function reachable(state: WorldState, pos: Vec2): boolean {
  const flow = state.flow;
  const grid: TileGrid | undefined = state.arena.tiles;
  if (!grid) return true;
  const t = tileOf(pos);
  if (t.x < 0 || t.y < 0 || t.x >= grid.cols || t.y >= grid.rows) return false;
  if (!flow) return true;
  return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => {
    const x = t.x + dx!;
    const y = t.y + dy!;
    return !isWall(grid, x, y) && (flow.dist[y * grid.cols + x] ?? -1) >= 0;
  });
}

const settle = (state: WorldState, gate: GateState, outcome: GateOutcome, events: GameEvent[]): WorldState => {
  events.push({ type: 'gateOpened', kind: gate.kind, outcome });
  const open = gate.doors && state.arena.tiles ? { ...state.arena, tiles: withDoors(state.arena.tiles, gate.doors, false) } : state.arena;
  const { key: _key, ...rest } = gate;
  return { ...state, arena: open, gate: { ...rest, done: true, outcome, stuckMs: 0 } };
};

/**
 * Host (and solo), every step: a wave gate opens with its cleared wave room;
 * a seal with its marked enemy's fall; a key gate drops its key where the
 * bearer fell and opens once a player walks over it. The out-of-bounds
 * safety breaks a gate whose enemy or key stays out of reach too long.
 */
export function updateGate(state: WorldState, dtMs: number, events: GameEvent[]): WorldState {
  const gate = state.gate;
  if (!gate || gate.done) return state;
  if (gate.kind === 'waves') return state.simaEvent?.kind !== 'waves' || state.simaEvent.done ? settle(state, gate, 'opened', events) : state;
  const target = state.enemies.find((e) => e.id === gate.target);
  if (!target || !target.alive) {
    if (gate.kind === 'seal') return settle(state, gate, 'opened', events);
    const key = gate.key ?? target?.pos;
    if (!key) return settle(state, gate, 'broken', events);
    if (!gate.key) events.push({ type: 'keyDropped', pos: key });
    if (presentPlayers(state).some((p) => distance(p.pos, key) <= GATE.keyTouch)) return settle(state, gate, 'opened', events);
    return watch({ ...state, gate: { ...gate, key } }, key, dtMs, events);
  }
  return watch(state, target.pos, dtMs, events);
}

/** The out-of-bounds safety for the gate's enemy or key at `pos`. */
function watch(state: WorldState, pos: Vec2, dtMs: number, events: GameEvent[]): WorldState {
  const gate = state.gate!;
  if (reachable(state, pos)) return gate.stuckMs === 0 ? state : { ...state, gate: { ...gate, stuckMs: 0 } };
  const stuckMs = gate.stuckMs + dtMs;
  if (stuckMs >= GATE.unreachableMs) return settle(state, gate, 'broken', events);
  return { ...state, gate: { ...gate, stuckMs } };
}

/** Host: the gate progress a guest needs. */
export function gateSync(state: Pick<WorldState, 'gate'>): GateSync | undefined {
  const g = state.gate;
  if (!g) return undefined;
  return { done: g.done, ...(g.outcome ? { outcome: g.outcome } : {}), ...(g.key ? { key: g.key } : {}) };
}

/** Guest: takes the host's gate progress (its own gate was placed from the same seed); a key gate's doors follow. */
export function applyGateSync(state: WorldState, sync: GateSync | undefined): WorldState {
  const gate = state.gate;
  if (!gate || !sync) return state;
  const opening = sync.done && !gate.done && gate.doors && state.arena.tiles;
  const arena = opening ? { ...state.arena, tiles: withDoors(state.arena.tiles!, gate.doors!, false) } : state.arena;
  const { key: _key, ...rest } = gate;
  return { ...state, arena, gate: { ...rest, done: sync.done, ...(sync.outcome ? { outcome: sync.outcome } : {}), ...(sync.key && !sync.done ? { key: sync.key } : {}) } };
}
