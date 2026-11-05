import type { KeyValueStore } from '../adapters/storage';
import type { CoinTally } from '../core/coins';
import type { KillsByType } from '../core/run-report';
import type { RunState } from '../core/run';
import type { SimaRecord } from '../core/sima-events';
import type { TrialState } from '../core/shrine';
import type { WorldState } from '../core/state';
import { step } from '../core/step';
import { FIXED_DT_MS } from '../core/timestep';
import { isWall } from '../core/tiles';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { dungeonById, floorsOf, isDungeonId, type DungeonId } from '../data/dungeons';
import { ITEMS } from '../data/items';
import { MOVES, type MoveId } from '../data/moves';
import { isPlayable, type SpeciesId } from '../data/species';
import { ACCOUNT_KEY } from './account';
import { WORLD, type WorldMapId } from '../data/world';
import { buildTownGrid } from '../town/map';

/**
 * Reload-proof play (owner: "si actualizas la página debería pausarte el menú,
 * pero seguir in game"). A solo run, or the player's spot in the town, is kept
 * in one versioned local record so a reload (or a killed tab) comes back to the
 * same floor and position with the pause menu open. See docs/gdd.md, "Recargar
 * la página sin perder la partida".
 *
 * Reading goes JSON -> `parseResume` (version, owner, shape, one real engine
 * step), so a missing, old, foreign, hostile or half-written record reads as
 * nothing and the player lands on the title as before. It is device-local on
 * purpose: it is not part of the profile, never syncs and never leaves the tab.
 */
export const RESUME_KEY = 'mazmorra-sombria.resume';
export const RESUME_VERSION = 1;

/** Where a shrine trial returns to when it ends. */
export type TrialFrom = 'title' | 'town' | 'room';

/** What `play()` needs to relaunch a solo run exactly as it was started. */
export interface RunLaunch {
  /** The dungeon the player picked (a Senda road is reached through it: `RunState.dungeon` is the road). */
  dungeon: DungeonId;
  seed: number;
  difficulty: Difficulty;
  /** A shrine trial: its request, where it returns to and the pick that fights it. */
  trial?: {
    request: { kind: 'boss' | 'gauntlet' | 'herald'; id: string; stops: TrialState['stops']; difficulty: Difficulty };
    from: TrialFrom;
    pick: { species: SpeciesId; loadout: readonly (MoveId | null)[] };
  };
}

/** The run's own state: everything `startGame` keeps between ticks that the simulation and the end screen read. */
export interface RunPart {
  run: RunState;
  world: WorldState;
  /** The floor as it was entered, for "Reiniciar planta". */
  floorStart: WorldState;
  tally: CoinTally;
  floorStartTally: CoinTally;
  kills: KillsByType;
  floorStartKills: KillsByType;
  floorHit: boolean;
  restartsUsed: number;
  simaSpent: number;
  floorStartSpent: number;
  bossPicks: readonly number[];
  simaLog: readonly SimaRecord[];
  memoriesRead: readonly number[];
  bossesMourned: readonly number[];
  lowHpSaid: boolean;
  merchantBerries: number;
  merchantSold: boolean;
  shrineTimePaid: boolean;
  eventRewarded: boolean;
  bonfire: { run: RunState; world: WorldState; tally: CoinTally; spent: number } | null;
  bonfireUsed: number;
  trial: TrialState | null;
  trialHit: boolean;
  /** Real (pause-aware) play time, for the pause menu's clock. */
  realMs: number;
  /** The minimap's fog of war as one '0'/'1' per tile (presentation only); absent when the floor has none. */
  minimap?: string;
}

interface Base {
  version: typeof RESUME_VERSION;
  /** Whose profile this was written under (`resumeOwner`): another account never gets it. */
  owner: string;
  /** The build that wrote it (`APP_VERSION`): a new release may change the world's shape, so its runs do not cross over. */
  build: string;
  /** Names the run (or town visit) that wrote it, so another tab never clears this tab's record. */
  runId: string;
  savedAt: number;
  /** Restores that crashed before a healthy save: one is enough to drop it (`attemptsAfter`). */
  attempts: number;
}

export type ResumeRecord = (Base & { kind: 'town'; at: WorldMapId; tile: { x: number; y: number } }) | (Base & { kind: 'run'; launch: RunLaunch; part: RunPart });

/** The record owner: the signed-in account, else this device. */
export const resumeOwner = (userId: string | null | undefined): string => userId || 'local';

/** One more failed restore, or none once a restored session lived to save healthily. */
export const attemptsAfter = (previous: number, crashed: boolean): number => (crashed ? previous + 1 : 0);

/** The minimap's fog of war as text: one '0' or '1' per tile. */
export const packMinimap = (seen: Uint8Array): string => Array.from(seen, (v) => (v === 1 ? '1' : '0')).join('');

/** The fog of war back, only when it fits a grid of `cols` x `rows` (a different floor starts blank). */
export function unpackMinimap(text: string | undefined, cols: number, rows: number): Uint8Array | null {
  if (typeof text !== 'string' || text.length !== cols * rows || !/^[01]*$/.test(text)) return null;
  return Uint8Array.from(text, (c) => (c === '1' ? 1 : 0));
}

export const encodeResume = (record: ResumeRecord): string => JSON.stringify(record);

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const count = (v: unknown): v is number => num(v) && v >= 0;
const whole = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const vecOk = (v: unknown): boolean => isRecord(v) && num(v.x) && num(v.y);
const numbers = (v: unknown): v is number[] => Array.isArray(v) && v.every(num);
const FLOOR_KINDS = ['normal', 'collapse', 'fog', 'flood', 'gas'];
const TRIAL_ROLES = ['midboss', 'guardian', 'herald'];
const FROMS: readonly TrialFrom[] = ['title', 'town', 'room'];
const moveOk = (m: unknown): boolean => m === null || (typeof m === 'string' && Object.hasOwn(MOVES, m));

function playerOk(p: unknown): boolean {
  if (!isRecord(p)) return false;
  // A player already down never comes back: a reload cannot undo a defeat.
  if (!isPlayable(p.species) || !num(p.hp) || p.hp <= 0 || !num(p.maxHp) || p.maxHp <= 0 || !vecOk(p.pos) || !vecOk(p.facing)) return false;
  if (!num(p.stamina) || !whole(p.level) || p.level < 1 || !num(p.xp)) return false;
  if (!Array.isArray(p.loadout) || !p.loadout.every(moveOk) || !Array.isArray(p.slotsHeld) || !Array.isArray(p.types)) return false;
  return Array.isArray(p.items) && p.items.every((i) => typeof i === 'string' && Object.hasOwn(ITEMS, i));
}

function arenaOk(a: unknown): boolean {
  if (!isRecord(a) || !num(a.width) || a.width <= 0 || !num(a.height) || a.height <= 0) return false;
  if (a.tiles !== undefined) {
    const t = a.tiles;
    if (!isRecord(t) || !whole(t.cols) || !whole(t.rows) || t.cols <= 0 || t.rows <= 0 || !numbers(t.tiles) || t.tiles.length !== t.cols * t.rows) return false;
  }
  return a.obstacles === undefined || Array.isArray(a.obstacles);
}

/** The shape the simulation reads without crashing; one real step (`steps`) is the last judge. */
function worldOk(w: unknown): boolean {
  if (!isRecord(w) || !count(w.tick) || !num(w.timeMs) || !num(w.rng) || !count(w.nextId) || !num(w.depth) || typeof w.localId !== 'string') return false;
  // A shared run is never restored: only a lone host (solo) world qualifies.
  if (w.role !== 'host' || !Array.isArray(w.remotes) || w.remotes.length > 0 || (w.party !== undefined && (!num(w.party) || w.party > 1))) return false;
  if (w.difficulty !== undefined && !DIFFICULTIES.some((d) => d === w.difficulty)) return false;
  if (!Array.isArray(w.appliedClaims) || !Array.isArray(w.credited) || !Array.isArray(w.berries) || !Array.isArray(w.events) || !num(w.slowMoMs) || !isRecord(w.lock)) return false;
  if (!arenaOk(w.arena) || !playerOk(w.player)) return false;
  if (!Array.isArray(w.enemies) || !w.enemies.every((e) => isRecord(e) && typeof e.id === 'string' && vecOk(e.pos) && num(e.hp) && num(e.maxHp) && typeof e.alive === 'boolean' && isRecord(e.ai) && vecOk(e.knockback))) return false;
  return Array.isArray(w.projectiles) && w.projectiles.every((p) => isRecord(p) && typeof p.id === 'string' && vecOk(p.pos) && vecOk(p.vel));
}

/** True when the engine takes one tick of this world without throwing (the corrupt-but-well-shaped case). */
function steps(world: WorldState): boolean {
  try {
    const next = step(
      world,
      { move: { x: 0, y: 0 }, aim: world.player.pos, aimPointer: false, roll: false, slots: world.player.loadout.map(() => false), slotMouse: world.player.loadout.map(() => false), lock: false, click: false, wheel: 0, view: { x: 0, y: 0, width: 512, height: 320 } },
      FIXED_DT_MS,
    );
    return num(next.player.hp) && num(next.player.pos.x) && num(next.player.pos.y);
  } catch {
    return false;
  }
}

function runOk(r: unknown): boolean {
  if (!isRecord(r) || !num(r.seed) || !isDungeonId(r.dungeon) || !whole(r.floor) || r.floor < 1 || r.floor > floorsOf(dungeonById(r.dungeon))) return false;
  if (typeof r.kind !== 'string' || !FLOOR_KINDS.includes(r.kind)) return false;
  if (r.escape !== null && !(isRecord(r.escape) && num(r.escape.floor) && num(r.escape.ms))) return false;
  if (r.offer !== null && !(Array.isArray(r.offer) && r.offer.every((i) => typeof i === 'string' && Object.hasOwn(ITEMS, i)))) return false;
  return (r.clockMs === undefined || num(r.clockMs)) && (r.graceMs === undefined || num(r.graceMs));
}

function tallyOk(t: unknown): boolean {
  return isRecord(t) && numbers(t.floors) && numbers(t.enemies) && numbers(t.escapes) && count(t.midbosses) && count(t.playedMs) && (t.captures === undefined || count(t.captures));
}

const killsOk = (k: unknown): boolean => isRecord(k) && Object.values(k).every(count);

function stopsOk(stops: unknown): boolean {
  return (
    Array.isArray(stops) &&
    stops.length > 0 &&
    stops.every((s) => isRecord(s) && typeof s.boss === 'string' && isDungeonId(s.dungeon) && whole(s.floor) && s.floor >= 1 && typeof s.role === 'string' && TRIAL_ROLES.includes(s.role) && (s.heraldSeed === undefined || num(s.heraldSeed)))
  );
}

function trialOk(t: unknown): boolean {
  return isRecord(t) && stopsOk(t.stops) && whole(t.index) && t.index >= 0 && t.index < (t.stops as unknown[]).length && (t.pauseMs === null || num(t.pauseMs));
}

function launchOk(l: unknown): boolean {
  if (!isRecord(l) || !isDungeonId(l.dungeon) || !num(l.seed) || !DIFFICULTIES.some((d) => d === l.difficulty)) return false;
  if (l.trial === undefined) return true;
  const t = l.trial;
  if (!isRecord(t) || !FROMS.some((f) => f === t.from) || !isRecord(t.request) || !isRecord(t.pick)) return false;
  const r = t.request;
  if (!['boss', 'gauntlet', 'herald'].includes(String(r.kind)) || typeof r.id !== 'string' || !stopsOk(r.stops) || !DIFFICULTIES.some((d) => d === r.difficulty)) return false;
  return isPlayable(t.pick.species) && Array.isArray(t.pick.loadout) && t.pick.loadout.every(moveOk);
}

function partOk(part: unknown, launch: RunLaunch): part is RunPart {
  if (!isRecord(part) || !runOk(part.run) || !worldOk(part.world) || !worldOk(part.floorStart)) return false;
  if (!steps(part.world as unknown as WorldState)) return false;
  if (!tallyOk(part.tally) || !tallyOk(part.floorStartTally) || !killsOk(part.kills) || !killsOk(part.floorStartKills)) return false;
  if (typeof part.floorHit !== 'boolean' || !count(part.restartsUsed) || !count(part.simaSpent) || !count(part.floorStartSpent) || !count(part.bonfireUsed) || !count(part.merchantBerries) || !count(part.realMs)) return false;
  if (typeof part.merchantSold !== 'boolean' || typeof part.shrineTimePaid !== 'boolean' || typeof part.eventRewarded !== 'boolean' || typeof part.lowHpSaid !== 'boolean' || typeof part.trialHit !== 'boolean') return false;
  if (!numbers(part.bossPicks) || !numbers(part.memoriesRead) || !numbers(part.bossesMourned)) return false;
  if (!Array.isArray(part.simaLog) || !part.simaLog.every((r) => isRecord(r) && num(r.floor) && typeof r.kind === 'string' && typeof r.outcome === 'string')) return false;
  if (part.minimap !== undefined && typeof part.minimap !== 'string') return false;
  const b = part.bonfire;
  if (b !== null && !(isRecord(b) && runOk(b.run) && worldOk(b.world) && tallyOk(b.tally) && count(b.spent))) return false;
  // A trial run and its launch go together: one without the other would play the wrong arena.
  return part.trial === null ? launch.trial === undefined : trialOk(part.trial) && launch.trial !== undefined;
}

function townOk(raw: Record<string, unknown>): boolean {
  if (typeof raw.at !== 'string' || !Object.hasOwn(WORLD, raw.at) || !isRecord(raw.tile)) return false;
  const { x, y } = raw.tile;
  if (!whole(x) || !whole(y)) return false;
  // The tile must be one a walker can stand on (not outside the map, not a wall or a prop).
  return !isWall(buildTownGrid(WORLD[raw.at as WorldMapId]), x, y);
}

/** Parses a stored record for `owner`; null for anything missing, broken, old, foreign, shared, down or unplayable. */
export function parseResume(text: string | null, owner: string, build: string): ResumeRecord | null {
  if (text === null) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(raw) || raw.version !== RESUME_VERSION || raw.owner !== owner || raw.build !== build || typeof raw.runId !== 'string' || !num(raw.savedAt)) return null;
  // One restore that crashed is enough: the record is dropped instead of crashing again on every reload.
  if (!count(raw.attempts) || raw.attempts >= 1) return null;
  const base = { version: RESUME_VERSION, owner, build, runId: raw.runId, savedAt: raw.savedAt, attempts: raw.attempts } as const;
  if (raw.kind === 'town') return townOk(raw) ? { ...base, kind: 'town', at: raw.at as WorldMapId, tile: raw.tile as { x: number; y: number } } : null;
  if (raw.kind !== 'run' || !launchOk(raw.launch)) return null;
  const launch = raw.launch as unknown as RunLaunch;
  return partOk(raw.part, launch) ? { ...base, kind: 'run', launch, part: raw.part } : null;
}

function removeKey(store: KeyValueStore): void {
  try {
    if (store.remove) store.remove(RESUME_KEY);
    else store.set(RESUME_KEY, '');
  } catch {
    // Nothing to remove.
  }
}

/** The stored record for `owner`, or null. A record that cannot be used is deleted so it is not tried twice. */
export function readResume(store: KeyValueStore, owner: string, build: string): ResumeRecord | null {
  let text: string | null;
  try {
    text = store.get(RESUME_KEY);
  } catch {
    return null;
  }
  if (text === null || text === '') return null;
  const record = parseResume(text, owner, build);
  if (!record) removeKey(store);
  return record;
}

export function writeResume(store: KeyValueStore, record: ResumeRecord): void {
  try {
    store.set(RESUME_KEY, encodeResume(record));
  } catch {
    // Not persisted (quota, private mode): the reload then lands on the title as it always did.
  }
}

/** Removes the record, but only the one `runId` wrote (without an id: whatever is there). */
export function clearResume(store: KeyValueStore, runId?: string): void {
  if (runId !== undefined) {
    try {
      const text = store.get(RESUME_KEY);
      if (text === null) return;
      let id: unknown;
      try {
        id = (JSON.parse(text) as { runId?: unknown } | null)?.runId;
      } catch {
        id = undefined;
      }
      if (id !== runId) return;
    } catch {
      return;
    }
  }
  removeKey(store);
}

export interface ResumeWriter {
  readonly runId: string;
  save(part: RunPart, crashed?: boolean): void;
  /** The player is down (a wipe waiting at a bonfire): the record goes, so a reload cannot undo the blow; a later save brings it back. */
  suspend(): void;
  /** The run ended (victory, defeat, abandon): clears the record and refuses every later save. */
  end(): void;
}

export function createResumeWriter(store: KeyValueStore, who: { owner: string; build: string }, launch: RunLaunch, runId: string, attempts: number, now: () => number): ResumeWriter {
  let ended = false;
  let written = false;
  let tries = attempts;
  return {
    runId,
    save(part, crashed = false) {
      if (ended) return;
      tries = attemptsAfter(tries, crashed);
      written = true;
      writeResume(store, { version: RESUME_VERSION, owner: who.owner, build: who.build, runId, savedAt: now(), attempts: tries, kind: 'run', launch, part });
    },
    suspend() {
      if (ended || !written) return;
      written = false;
      clearResume(store, runId);
    },
    end() {
      ended = true;
      written = false;
      clearResume(store, runId);
    },
  };
}

/** The owner of a record written now: the stored session's account (read straight from the store, before the account module has started), else this device. */
export function storedOwner(store: KeyValueStore): string {
  try {
    const raw: unknown = JSON.parse(store.get(ACCOUNT_KEY) || 'null');
    return resumeOwner(isRecord(raw) && typeof raw.userId === 'string' ? raw.userId : null);
  } catch {
    return resumeOwner(null);
  }
}

/** A name for one run or town visit (`ResumeRecord.runId`). */
export const newRunId = (): string => `r${Date.now().toString(36)}${Math.floor(Math.random() * 36 ** 4).toString(36)}`;

/** A town record for the walker's spot, or null when it cannot be restored (a wall, outside the map). */
export function townRecord(who: { owner: string; build: string }, runId: string, place: { at: WorldMapId; tile: { x: number; y: number } }, now: number): ResumeRecord | null {
  const record: ResumeRecord = { version: RESUME_VERSION, owner: who.owner, build: who.build, runId, savedAt: now, attempts: 0, kind: 'town', at: place.at, tile: place.tile };
  return townOk(record as unknown as Record<string, unknown>) ? record : null;
}
