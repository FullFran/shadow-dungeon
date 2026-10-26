import { atLeast, type Difficulty } from '../data/difficulty';
import { encounterChance, encounterWaves, worldDifficulty } from './difficulty';
import type { CoinBreakdown } from './coins';
import type { FloorKind } from '../data/dungeon';
import type { ItemId } from '../data/items';
import type { PactEffect, PactId, SimaEventKind, SimaEvents, SimaPact } from '../data/sima';
import type { SpeciesId } from '../data/species';
import { enterMode } from './brain';
import { roomRect, type Floor, type TileRect } from './dungeon';
import { ENEMY_BEHAVIOUR } from '../data/enemies';
import { confineCircle, insideRect } from './geometry';
import { offerItems } from './items';
import { deriveSeed } from './rng';
import { draws, rising } from './sima';
import type { EnemyState, PlayerState, Rect, WorldState } from './state';
import { isWall, tileCenter, tileOf, TILE, type TileGrid, type TilePoint } from './tiles';
import { nearestTile } from './bounds';
import { TUNING } from '../data/tuning';
import { distance, type Vec2 } from './vec';
import { spawnEnemy } from './world';

/**
 * The Sima del Eclipse's floor events (docs/gdd.md §3), pure. One may sit on
 * a generated floor (data/sima.ts `SIMA_EVENTS`): a treasure vault, an
 * eclipse shrine (pacts), a monster house, a time crystal, a merchant echo,
 * a monster nest, a wave room, an ambush or a hunter. Every peer places the
 * same event from the run seed; only the host (or solo) runs it, and guests
 * take its progress from the host's snapshot (`simaSync`).
 */

export type SimaOutcome = 'opened' | 'accepted' | 'declined' | 'cleared' | 'taken' | 'faded' | 'destroyed' | 'sprung' | 'loosed';

export interface SimaEventState {
  kind: SimaEventKind;
  /** Index of its room in the floor's rooms. */
  room: number;
  /** That room, in px. */
  rect: Rect;
  /** Where its object stands (the room's centre). */
  pos: Vec2;
  done: boolean;
  outcome?: SimaOutcome;
  /** Crystal: until it fades; nest: until the next hatching; waves: the pause before the next wave; ambush: the tell; hunter: until it comes. */
  remainingMs?: number;
  /** A player walked in (monster house woke, nest stirred, ambush sprung, waves started). */
  woke?: boolean;
  /** Shrine: the pact on offer. */
  pact?: PactId;
  /** Nest: its enemy id; waves: the ids of the wave in progress; nest: its living brood. */
  nestId?: string;
  ids?: readonly string[];
  /** Waves: the wave in progress (1-based; 0 before the first). */
  wave?: number;
  /** Waves: the doors are locked; `doors` are the grid indices that close. */
  sealed?: boolean;
  doors?: readonly number[];
  /** Waves, host only: how long the sealed room has gone with a player inside and its wave enemies losing no HP, and the HP they last had (the failsafe). */
  stallMs?: number;
  stallHp?: number;
  /** Ambush: where the hidden enemies wait, and what they are. */
  spots?: readonly Vec2[];
  species?: readonly SpeciesId[];
}

/** A pact in force: its effects, and the floors it still lasts (this one included). */
export interface SimaPactState {
  id: PactId;
  floorsLeft: number;
  playerDamage: number;
  enemySpeed: number;
  enemyDamage: number;
}

/** What a guest needs of the host's event and pact (sent with the snapshot). */
export interface SimaSync {
  e?: Pick<SimaEventState, 'done' | 'outcome' | 'remainingMs' | 'woke' | 'wave' | 'sealed'>;
  p?: SimaPactState | null;
}

const EVENT_SALT = 0x5e7e;
const SPAWN_SALT = 0x5e7f;
const REWARD_SALT = 7000;
const MERCHANT_SALT = 9000;

/** Chance of an event on a floor at tier `d`: the depth's chance scaled by the tier's set-piece frequency (core/difficulty.ts `encounterChance`). */
export const simaEventChance = (def: SimaEvents, floor: number, d: Difficulty = 'easy'): number => encounterChance(rising(def, floor), d);

/** Waves of a wave room at tier `d`: the data's, plus the tier's extra waves (Nightmare +1; `encounterWaves`). */
export const simaWaves = (def: SimaEvents, d: Difficulty = 'easy'): number => encounterWaves(def.waves.waves.length, d);

/** Enemies of wave `wave` (1-based): an extra wave repeats the last planned size. */
export const simaWaveSize = (def: SimaEvents, wave: number): number => def.waves.waves[Math.min(wave, def.waves.waves.length) - 1] ?? 0;

/**
 * The event of a generated floor, if any: one draw against the depth's
 * chance, one weighted pick among the kinds open at that depth, one room
 * (never the start room; never the stairs' room either, except for a hunter,
 * which has no room of its own). Never on urgent floors.
 */
export function chooseSimaEvent(
  seed: number,
  depth: number,
  floor: Floor,
  kind: FloorKind,
  def: SimaEvents,
  difficulty: Difficulty = 'easy',
): { kind: SimaEventKind; room: number } | null {
  if (kind !== 'normal') return null;
  const draw = draws(deriveSeed(seed, depth + EVENT_SALT));
  if (draw() >= simaEventChance(def, depth, difficulty)) return null;
  const open = def.kinds.filter((k) => k.minDepth <= depth && k.weight > 0);
  if (open.length === 0) return null;
  let roll = draw() * open.reduce((sum, k) => sum + k.weight, 0);
  let picked = open[open.length - 1]!;
  for (const k of open) {
    roll -= k.weight;
    if (roll < 0) {
      picked = k;
      break;
    }
  }
  if (picked.kind === 'hunter') return { kind: 'hunter', room: floor.startRoom };
  const rooms = floor.rooms.map((_, i) => i).filter((i) => i !== floor.startRoom && i !== floor.stairsRoom);
  if (rooms.length === 0) return null;
  return { kind: picked.kind, room: rooms[Math.min(rooms.length - 1, Math.floor(draw() * rooms.length))]! };
}

/** Inner tiles of a room (off its walls), in a seeded order. */
function roomTiles(room: TileRect, draw: () => number): TilePoint[] {
  const tiles: TilePoint[] = [];
  for (let y = room.y + 1; y < room.y + room.height - 1; y++) for (let x = room.x + 1; x < room.x + room.width - 1; x++) tiles.push({ x, y });
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(draw() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j]!, tiles[i]!];
  }
  return tiles;
}

/** Floor tiles just outside a room's edge (its doorways): a wave room closes them. */
export function doorTiles(grid: TileGrid, room: TileRect): number[] {
  const out: number[] = [];
  const add = (x: number, y: number) => {
    if (x >= 0 && y >= 0 && x < grid.cols && y < grid.rows && grid.tiles[y * grid.cols + x] === 1) out.push(y * grid.cols + x);
  };
  for (let x = room.x; x < room.x + room.width; x++) {
    add(x, room.y - 1);
    add(x, room.y + room.height);
  }
  for (let y = room.y; y < room.y + room.height; y++) {
    add(room.x - 1, y);
    add(room.x + room.width, y);
  }
  return out;
}

/** The grid with `doors` closed (walls) or open again. */
export function withDoors(grid: TileGrid, doors: readonly number[], closed: boolean): TileGrid {
  const tiles = [...grid.tiles];
  for (const i of doors) tiles[i] = closed ? 0 : 1;
  return { ...grid, tiles };
}

/** Species of the depth's pool for the event's own enemies (weighted by `pick`). */
function pickSpecies(pool: readonly { species: SpeciesId; weights: readonly number[] }[], roll: number): SpeciesId {
  const total = pool.reduce((sum, e) => sum + (e.weights[0] ?? 0), 0);
  let left = roll * total;
  for (const entry of pool) {
    left -= entry.weights[0] ?? 0;
    if (left < 0) return entry.species;
  }
  return pool[pool.length - 1]?.species ?? 'poochyena';
}

const awake = (enemy: EnemyState): EnemyState => ({ ...enemy, ai: enterMode(enemy.ai, ENEMY_BEHAVIOUR[enemy.species]?.kind === 'caster' ? 'reposition' : 'approach') });

/** Spawns a species at `pos`, awake (hunting at once); returns the world and its id. */
function spawnAwake(world: WorldState, species: SpeciesId, pos: Vec2, extra: Partial<EnemyState> = {}): { world: WorldState; id: string } {
  const spawned = spawnEnemy(world, species, pos);
  const enemy = spawned.enemies[spawned.enemies.length - 1]!;
  const ready = { ...awake(enemy), ...extra };
  return { world: { ...spawned, enemies: spawned.enemies.map((e) => (e.id === enemy.id ? ready : e)) }, id: enemy.id };
}

/**
 * Places an event on a freshly loaded floor: its state and, for the kinds
 * that bring them, its own enemies (vault guards, the monster house's
 * sleepers, the nest). `pool` is the depth's spawn pool.
 */
export function placeSimaEvent(
  world: WorldState,
  choice: { kind: SimaEventKind; room: number },
  floor: Floor,
  seed: number,
  depth: number,
  def: SimaEvents,
  pool: readonly { species: SpeciesId; weights: readonly number[] }[],
  difficulty: Difficulty = 'easy',
): WorldState {
  const room = floor.rooms[choice.room]!;
  const rect = roomRect(room);
  const pos = tileCenter({ x: room.x + Math.floor(room.width / 2), y: room.y + Math.floor(room.height / 2) });
  const draw = draws(deriveSeed(seed, depth + SPAWN_SALT));
  const base: SimaEventState = { kind: choice.kind, room: choice.room, rect, pos, done: false };
  const free = roomTiles(room, draw).filter((t) => distance(tileCenter(t), pos) > TILE);
  let next = world;
  switch (choice.kind) {
    case 'vault': {
      for (const tile of free.slice(0, def.vault.guards)) {
        next = spawnEnemy(next, pickSpecies(pool, draw()), tileCenter(tile), { sleepIn: rect });
        const guard = next.enemies[next.enemies.length - 1]!;
        const maxHp = guard.maxHp * def.vault.guardHp;
        next = { ...next, enemies: next.enemies.map((e) => (e.id === guard.id ? { ...e, maxHp, hp: maxHp } : e)) };
      }
      return { ...next, simaEvent: base };
    }
    case 'monsterHouse':
      for (const tile of free.slice(0, def.monsterHouse.extra)) next = spawnEnemy(next, pickSpecies(pool, draw()), tileCenter(tile), { sleepIn: rect });
      return { ...next, simaEvent: base };
    case 'crystal':
      return { ...next, simaEvent: { ...base, remainingMs: def.crystal.fadeMs } };
    case 'shrine': {
      const pacts = def.shrine.pacts;
      return { ...next, simaEvent: { ...base, pact: pacts[Math.min(pacts.length - 1, Math.floor(draw() * pacts.length))]!.id } };
    }
    case 'nest': {
      next = spawnEnemy(next, def.nest.species, pos, { dormant: true });
      const nestId = next.enemies[next.enemies.length - 1]!.id;
      return { ...next, simaEvent: { ...base, nestId, ids: [], remainingMs: def.nest.spawnEveryMs } };
    }
    case 'waves':
      return { ...next, simaEvent: { ...base, wave: 0, ids: [], doors: doorTiles(floor, room) } };
    case 'ambush': {
      const spots = free.slice(0, def.ambush.count).map(tileCenter);
      return { ...next, simaEvent: { ...base, spots, species: spots.map(() => pickSpecies(pool, draw())) } };
    }
    case 'hunter':
      // Deeper difficulty tiers let it out sooner.
      return { ...next, simaEvent: { ...base, remainingMs: atLeast(difficulty, 'hard') ? def.hunter.delayMs * 0.7 : def.hunter.delayMs } };
    case 'merchant':
    default:
      return { ...next, simaEvent: base };
  }
}

const players = (state: WorldState): PlayerState[] => [state.player, ...state.remotes.map((r) => r.player)].filter((p) => p.hp > 0);

const someoneIn = (state: WorldState, rect: Rect): boolean => players(state).some((p) => insideRect(p.pos, rect));

const someoneAt = (state: WorldState, pos: Vec2, radius: number): boolean => players(state).some((p) => distance(p.pos, pos) <= radius);

const finish = (state: WorldState, event: SimaEventState, outcome: SimaOutcome): WorldState => ({ ...state, simaEvent: { ...event, done: true, outcome } });

/** The Sima's hunter cannot be felled (data/sima.ts). */
export const isUnkillable = (enemy: Pick<EnemyState, 'species'>): boolean => enemy.species === 'eclipse-hunter';

/**
 * Host (and solo): runs the floor's event for one step. Touching the chest,
 * the crystal; waking the monster house; hatching the nest; sealing the
 * wave room and sending its waves; springing the ambush; letting the hunter
 * out. The shrine and the merchant wait for the player (`nearSimaEvent`).
 */
export function updateSimaEvent(state: WorldState, dtMs: number, def: SimaEvents, pool: readonly { species: SpeciesId; weights: readonly number[] }[]): WorldState {
  const event = state.simaEvent;
  if (!event || event.done) return state;
  const inRoom = (e: EnemyState) => e.wakeRoom !== undefined && e.wakeRoom.x === event.rect.x && e.wakeRoom.y === event.rect.y;
  switch (event.kind) {
    case 'vault': {
      const guarded = state.enemies.some((e) => e.alive && inRoom(e));
      return !guarded && someoneAt(state, event.pos, def.touchRadius) ? finish(state, event, 'opened') : state;
    }
    case 'monsterHouse': {
      const sleepers = state.enemies.filter(inRoom);
      const woke = event.woke || sleepers.some((e) => e.alive && e.ai.mode !== 'asleep');
      if (woke && sleepers.every((e) => !e.alive)) return finish(state, { ...event, woke }, 'cleared');
      return woke === (event.woke ?? false) ? state : { ...state, simaEvent: { ...event, woke } };
    }
    case 'crystal': {
      if (someoneAt(state, event.pos, def.touchRadius)) return finish(state, event, 'taken');
      const remainingMs = (event.remainingMs ?? 0) - dtMs;
      return remainingMs <= 0 ? finish({ ...state }, { ...event, remainingMs: 0 }, 'faded') : { ...state, simaEvent: { ...event, remainingMs } };
    }
    case 'nest': {
      const nest = state.enemies.find((e) => e.id === event.nestId);
      if (!nest || !nest.alive) return finish(state, event, 'destroyed');
      const woke = event.woke || someoneIn(state, event.rect) || nest.hp < nest.maxHp;
      if (!woke) return state;
      const brood = (event.ids ?? []).filter((id) => state.enemies.some((e) => e.id === id && e.alive));
      let remainingMs = (event.remainingMs ?? def.nest.spawnEveryMs) - dtMs;
      let next = state;
      if (remainingMs <= 0) {
        remainingMs = def.nest.spawnEveryMs;
        if (brood.length < def.nest.maxAlive) {
          const kinds = def.nest.brood;
          const species = kinds[(event.ids?.length ?? 0) % kinds.length]!;
          // The brood pays nothing (`spent`), so a nest is never a farm.
          const hatched = spawnAwake(next, species, { x: nest.pos.x + (brood.length - 1) * 18, y: nest.pos.y + 22 }, { spent: true });
          next = hatched.world;
          brood.push(hatched.id);
        }
      }
      return { ...next, simaEvent: { ...event, woke: true, remainingMs, ids: [...new Set([...(event.ids ?? []), ...brood])] } };
    }
    case 'waves': {
      const wave = event.wave ?? 0;
      if (wave === 0) {
        if (!someoneIn(state, event.rect)) return state;
        return spawnWave(sealed(state, event, true), def, pool, 1);
      }
      const standing = state.enemies.some((e) => e.alive && (event.ids ?? []).includes(e.id));
      if (standing) return waveStall(state, event, dtMs);
      if (wave >= simaWaves(def, worldDifficulty(state))) {
        const open = sealed(state, event, false);
        return finish(open, open.simaEvent!, 'cleared');
      }
      const remainingMs = (event.remainingMs ?? def.waves.pauseMs) - dtMs;
      if (remainingMs > 0) return { ...state, simaEvent: { ...event, remainingMs } };
      return spawnWave(state, def, pool, wave + 1);
    }
    case 'ambush': {
      if (!event.woke) return someoneIn(state, event.rect) ? { ...state, simaEvent: { ...event, woke: true, remainingMs: def.ambush.tellMs } } : state;
      const remainingMs = (event.remainingMs ?? 0) - dtMs;
      if (remainingMs > 0) return { ...state, simaEvent: { ...event, remainingMs } };
      let next = state;
      (event.spots ?? []).forEach((spot, i) => (next = spawnAwake(next, event.species?.[i] ?? 'poochyena', spot).world));
      return finish(next, { ...event, remainingMs: 0 }, 'sprung');
    }
    case 'hunter': {
      const remainingMs = (event.remainingMs ?? 0) - dtMs;
      if (remainingMs > 0) return { ...state, simaEvent: { ...event, remainingMs } };
      const loosed = spawnAwake(state, def.hunter.species, event.pos);
      return finish(loosed.world, { ...event, remainingMs: 0 }, 'loosed');
    }
    default:
      return state;
  }
}

/**
 * Waves: closes or opens the room's doors (the grid changes on every peer;
 * guests follow the `sealed` flag). On closing, an enemy (walker or floater) standing in a
 * doorway is first moved into the room, never left inside the new wall.
 */
function sealed(state: WorldState, event: SimaEventState, closed: boolean): WorldState {
  const grid = state.arena.tiles;
  if (!grid || !event.doors) return { ...state, simaEvent: { ...event, sealed: closed } };
  const tiles = withDoors(grid, event.doors, closed);
  const arena = { ...state.arena, tiles };
  const enemies = closed ? state.enemies.map((e) => (e.alive && inDoorway(grid, event.doors!, e) ? intoRoom(arena, event.rect, e) : e)) : state.enemies;
  return { ...state, arena, enemies, simaEvent: { ...event, sealed: closed } };
}

/** The enemy's circle touches one of the door tiles. */
function inDoorway(grid: TileGrid, doors: readonly number[], enemy: EnemyState): boolean {
  return doors.some((i) => {
    const x = (i % grid.cols) * TILE;
    const y = Math.floor(i / grid.cols) * TILE;
    const dx = enemy.pos.x - Math.max(x, Math.min(enemy.pos.x, x + TILE));
    const dy = enemy.pos.y - Math.max(y, Math.min(enemy.pos.y, y + TILE));
    return Math.hypot(dx, dy) < enemy.radius;
  });
}

/** The nearest floor tile of the room (the sealed grid), the enemy's circle confined there. */
function intoRoom(arena: WorldState['arena'], rect: Rect, enemy: EnemyState): EnemyState {
  const grid = arena.tiles!;
  const x0 = Math.round(rect.x / TILE);
  const y0 = Math.round(rect.y / TILE);
  const x1 = x0 + Math.round(rect.width / TILE);
  const y1 = y0 + Math.round(rect.height / TILE);
  const to = nearestTile(grid, tileOf(enemy.pos), (x, y) => x >= x0 && y >= y0 && x < x1 && y < y1 && !isWall(grid, x, y));
  return to ? { ...enemy, pos: confineCircle(arena, tileCenter(to), enemy.radius), knockback: { x: 0, y: 0 } } : enemy;
}

/**
 * Waves failsafe: a sealed room where, with a player inside, the wave's
 * enemies have lost no HP for `TUNING.bounds.waveStallMs` ends: those left die
 * unpaid (`spent`) and the doors open. Whatever stranded them
 * (odd/tasks/out-of-bounds-fix.md), the room never locks a run. The players'
 * HP is left out on purpose: the Sima's collapse keeps nibbling at it, and a
 * wave enemy that can hurt you but never be hurt is the very case to end.
 */
function waveStall(state: WorldState, event: SimaEventState, dtMs: number): WorldState {
  const ids = event.ids ?? [];
  const hp = state.enemies.reduce((sum, e) => (e.alive && ids.includes(e.id) ? sum + e.hp : sum), 0);
  const stallMs = someoneIn(state, event.rect) && event.stallHp === hp ? (event.stallMs ?? 0) + dtMs : 0;
  if (stallMs < TUNING.bounds.waveStallMs) return { ...state, simaEvent: { ...event, stallMs, stallHp: hp } };
  const { stallMs: _ms, stallHp: _hp, ...rest } = event;
  const enemies = state.enemies.map((e) => (e.alive && ids.includes(e.id) ? { ...e, hp: 0, alive: false, spent: true } : e));
  const open = sealed({ ...state, enemies }, rest, false);
  return finish(open, open.simaEvent!, 'cleared');
}

function spawnWave(state: WorldState, def: SimaEvents, pool: readonly { species: SpeciesId; weights: readonly number[] }[], wave: number): WorldState {
  const event = state.simaEvent!;
  const count = simaWaveSize(def, wave);
  const draw = draws(deriveSeed(Math.round(event.pos.x * 31 + event.pos.y), wave + SPAWN_SALT));
  const room = { x: event.rect.x / TILE, y: event.rect.y / TILE, width: event.rect.width / TILE, height: event.rect.height / TILE };
  const tiles = roomTiles(room, draw).filter((t) => players(state).every((p) => distance(tileCenter(t), p.pos) > TILE * 2.5));
  let next = state;
  const ids: string[] = [];
  for (const tile of tiles.slice(0, count)) {
    const spawned = spawnAwake(next, pickSpecies(pool, draw()), tileCenter(tile));
    next = spawned.world;
    ids.push(spawned.id);
  }
  return { ...next, simaEvent: { ...event, wave, ids, remainingMs: def.waves.pauseMs } };
}

/** The local player stands at the shrine or the merchant (they open a choice); never once done. */
export const nearSimaEvent = (state: WorldState, def: SimaEvents, kind: SimaEventKind): boolean =>
  state.simaEvent?.kind === kind && !state.simaEvent.done && state.player.hp > 0 && distance(state.player.pos, state.simaEvent.pos) <= def.touchRadius;

/** The pact of a shrine at a difficulty: the curse bites harder on nightmare. */
export function pactEffects(pact: SimaPact, difficulty: Difficulty, def: SimaEvents): Omit<SimaPactState, 'id' | 'floorsLeft'> {
  const harsh = atLeast(difficulty, 'nightmare') ? def.shrine.nightmareCurse : 1;
  const curse = (v: number | undefined) => 1 + ((v ?? 1) - 1) * harsh;
  const both = (k: keyof PactEffect) => (pact.blessing[k] ?? 1) * curse(pact.curse[k]);
  return { playerDamage: pact.blessing.playerDamage ?? 1, enemySpeed: both('enemySpeed'), enemyDamage: both('enemyDamage') };
}

/** Accepting the shrine's pact: it lasts `floors` floors (this one included); a heal or time comes at once (`bonusMs` for the run clock). */
export function acceptPact(world: WorldState, def: SimaEvents, difficulty: Difficulty): { world: WorldState; bonusMs: number } {
  const event = world.simaEvent;
  const pact = def.shrine.pacts.find((p) => p.id === event?.pact);
  if (!event || event.kind !== 'shrine' || event.done || !pact) return { world, bonusMs: 0 };
  const heal = pact.blessing.healShare ?? 0;
  const player = heal > 0 ? { ...world.player, hp: Math.min(world.player.maxHp, world.player.hp + heal * world.player.maxHp) } : world.player;
  const simaPact: SimaPactState = { id: pact.id, floorsLeft: def.shrine.floors, ...pactEffects(pact, difficulty, def) };
  return { world: { ...world, player, simaPact, simaEvent: { ...event, done: true, outcome: 'accepted' } }, bonusMs: pact.blessing.timeMs ?? 0 };
}

export const declinePact = (world: WorldState): WorldState =>
  world.simaEvent?.kind === 'shrine' && !world.simaEvent.done ? { ...world, simaEvent: { ...world.simaEvent, done: true, outcome: 'declined' } } : world;

/** Going down a floor: the pact has one floor less; it is gone after its last. */
export function descendPact(world: WorldState): WorldState {
  if (!world.simaPact) return world;
  const floorsLeft = world.simaPact.floorsLeft - 1;
  return { ...world, simaPact: floorsLeft > 0 ? { ...world.simaPact, floorsLeft } : undefined };
}

/** Pact multipliers in force (1 without a pact). */
export const pactPlayerDamage = (state: Pick<WorldState, 'simaPact'>): number => state.simaPact?.playerDamage ?? 1;
export const pactEnemySpeed = (state: Pick<WorldState, 'simaPact'>): number => state.simaPact?.enemySpeed ?? 1;
export const pactEnemyDamage = (state: Pick<WorldState, 'simaPact'>): number => state.simaPact?.enemyDamage ?? 1;

/** Time an event pays to the run clock once done (the crystal touched, the wave room cleared). */
export function eventBonusMs(event: SimaEventState | undefined, def: SimaEvents): number {
  if (!event?.done) return 0;
  if (event.kind === 'crystal' && event.outcome === 'taken') return def.crystal.bonusMs;
  if (event.kind === 'waves' && event.outcome === 'cleared') return def.waves.bonusMs;
  return 0;
}

/** Events whose end offers each player a pick of held items (the vault's chest, a cleared wave room). */
export const rewardsItems = (event: SimaEventState | undefined): boolean =>
  event?.done === true && ((event.kind === 'vault' && event.outcome === 'opened') || (event.kind === 'waves' && event.outcome === 'cleared'));

/** That pick: seeded per floor and player, apart from the floor's own offer. */
export const rewardOffer = (seed: number, floor: number, playerId: string, owned: readonly ItemId[]): ItemId[] => offerItems(seed, floor + REWARD_SALT, playerId, owned);

/** The merchant echo's held item on this floor, for this player. */
export const merchantItem = (seed: number, floor: number, playerId: string, owned: readonly ItemId[]): ItemId | null => offerItems(seed, floor + MERCHANT_SALT, playerId, owned)[0] ?? null;

/** An Oran Berry from the merchant: heals a share of max HP. */
export const eatBought = (player: PlayerState, share: number): PlayerState => ({ ...player, hp: Math.min(player.maxHp, player.hp + share * player.maxHp) });

/** Host: the event and pact progress a guest needs. */
export function simaSync(state: WorldState): SimaSync | undefined {
  const e = state.simaEvent;
  if (!e && !state.simaPact) return undefined;
  return {
    ...(e ? { e: { done: e.done, ...(e.outcome ? { outcome: e.outcome } : {}), ...(e.remainingMs !== undefined ? { remainingMs: e.remainingMs } : {}), ...(e.woke ? { woke: true } : {}), ...(e.wave !== undefined ? { wave: e.wave } : {}), ...(e.sealed !== undefined ? { sealed: e.sealed } : {}) } } : {}),
    p: state.simaPact ?? null,
  };
}

/** Guest: takes the host's event progress and pact (its own event was placed from the same seed); the wave room's doors follow. */
export function applySimaSync(state: WorldState, sync: SimaSync | undefined): WorldState {
  if (!sync) return state.simaPact ? { ...state, simaPact: undefined } : state;
  let next: WorldState = { ...state, simaPact: sync.p ?? undefined };
  const event = next.simaEvent;
  if (event && sync.e) {
    const merged: SimaEventState = { ...event, ...sync.e };
    if ((sync.e.sealed ?? false) !== (event.sealed ?? false) && event.doors && next.arena.tiles) {
      next = { ...next, arena: { ...next.arena, tiles: withDoors(next.arena.tiles, event.doors, sync.e.sealed === true) } };
    }
    next = { ...next, simaEvent: merged };
  }
  return next;
}

/** Pokémonedas left after the merchant: the run's total less what was spent (never below 0). */
export const spendCoins = (coins: CoinBreakdown, spent: number): CoinBreakdown => (spent > 0 ? { ...coins, total: Math.max(0, coins.total - spent) } : coins);

/** One event taken in a run, for the end screen. */
export interface SimaRecord {
  floor: number;
  kind: SimaEventKind;
  outcome: SimaOutcome;
}
