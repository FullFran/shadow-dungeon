import { clearableDungeons } from '../data/achievements';
import { atLeast, DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { DUNGEONS, floorsOf, type DungeonId } from '../data/dungeons';
import { MISSIONS, type MissionKind } from '../data/missions';
import { PLAYER_EVOLUTIONS, type MaterialTier } from '../data/player-evolutions';
import { PLAYABLE_SPECIES, SPECIES, type SpeciesId } from '../data/species';
import { POKEMON_TYPES, type PokemonType } from '../data/types';
import type { Collection } from './collection';
import { utcDateKey } from './endless';
import { lineOf } from './evolution';
import { deriveSeed, nextRandom } from './rng';
import type { RunReport } from './run-report';

/**
 * Missions (data/missions.ts), pure. The daily board is a function of the
 * UTC day only, so every player sees the same one; one weekly mission is a
 * function of the UTC week (its Monday). A mission's id carries its period
 * and place on the board (`d:2026-10-26:2`, `w:2026-10-26:0`), so the save
 * keeps only ids and progress: the mission is generated again from its id,
 * and it expires when its day or week is over. Progress comes from each
 * peer's own run report; a mission counts a run only on its tier or above.
 */
export type MissionGoal =
  /** Reach `floor` of `dungeon` (any outcome). */
  | { kind: 'floor'; dungeon: DungeonId; floor: number }
  /** Win `dungeon`. */
  | { kind: 'clear'; dungeon: DungeonId }
  /** Defeat `count` enemies of `type` (over any runs). */
  | { kind: 'defeat'; type: PokemonType; count: number }
  /** Reach floor 2 or deeper with any form of `line`. */
  | { kind: 'species'; line: SpeciesId };

export interface MissionReward {
  coins: number;
  materials?: { line: SpeciesId; tier: MaterialTier; count: number };
}

export interface Mission {
  id: string;
  period: 'daily' | 'weekly';
  goal: MissionGoal;
  /** The lowest tier a run must be on to count. */
  tier: Difficulty;
  /** Progress needed (the defeat count, else 1). */
  target: number;
  reward: MissionReward;
}

/** What the save keeps: the accepted missions with their progress, and the ones already claimed this period. */
export interface MissionState {
  accepted: readonly { id: string; progress: number }[];
  claimed: readonly string[];
}

export const EMPTY_MISSIONS: MissionState = { accepted: [], claimed: [] };

/** Every enemy type of the main dungeons' generated floors, in type-table order. */
export function enemyTypes(): PokemonType[] {
  const species = DUNGEONS.flatMap((d) => d.spawns.pool.flatMap((e) => [e.species, ...(e.escort ? [e.escort.species] : [])]));
  const types = new Set(species.flatMap((s) => SPECIES[s].types));
  return POKEMON_TYPES.filter((t) => types.has(t));
}

/** Every line a player can play (the starters and each gacha line's first form). */
const playableLines = (): SpeciesId[] => [...new Set(PLAYABLE_SPECIES.map(lineOf))];

/** Every line with evolution materials. */
const materialLines = (): SpeciesId[] => [...new Set(PLAYER_EVOLUTIONS.map((e) => lineOf(e.from)))];

const DAY_MS = 86_400_000;
const BOARD_SALT = 0x6a0b;

/** The UTC Monday (YYYY-MM-DD) of the week of `nowMs`. */
export function weekKey(nowMs: number): string {
  const day = Math.floor(nowMs / DAY_MS);
  // Day 0 (1970-01-01) was a Thursday: (day + 3) % 7 is 0 on Mondays.
  return utcDateKey((day - ((((day + 3) % 7) + 7) % 7)) * DAY_MS);
}

/** A random stream from a period key and salt. */
function stream(key: string, salt: number): () => number {
  let state = deriveSeed(Number.parseInt(key.replace(/\D/g, ''), 10) | 0, BOARD_SALT + salt);
  return () => {
    const r = nextRandom(state);
    state = r.state;
    return r.value;
  };
}

const pick = <T>(list: readonly T[], r: number): T => list[Math.min(list.length - 1, Math.floor(r * list.length))]!;

function weighted<K extends string>(weights: Readonly<Record<K, number>>, keys: readonly K[], r: number): K {
  const total = keys.reduce((sum, k) => sum + weights[k], 0);
  let at = r * total;
  for (const k of keys) {
    at -= weights[k];
    if (at < 0) return k;
  }
  return keys[keys.length - 1]!;
}

function goalOf(kind: MissionKind, next: () => number, scale: number): MissionGoal {
  switch (kind) {
    case 'floor': {
      const dungeon = pick(DUNGEONS, next());
      if (dungeon.endless) {
        const { step, max } = MISSIONS.simaFloors;
        return { kind, dungeon: dungeon.id, floor: step * (1 + Math.floor(next() * (max / step))) };
      }
      const floors = floorsOf(dungeon);
      return { kind, dungeon: dungeon.id, floor: 2 + Math.floor(next() * (floors - 1)) };
    }
    case 'clear':
      return { kind, dungeon: pick(clearableDungeons(), next()).id };
    case 'defeat': {
      const { min, max } = MISSIONS.defeatCount;
      return { kind, type: pick(enemyTypes(), next()), count: scale * (min + Math.floor(next() * (max - min + 1))) };
    }
    case 'species':
      return { kind, line: pick(playableLines(), next()) };
  }
}

const roundTo5 = (n: number): number => Math.max(5, Math.round(n / 5) * 5);

function missionAt(id: string, period: Mission['period'], next: () => number): Mission {
  const weekly = period === 'weekly';
  const kinds = weekly ? MISSIONS.weekly.kinds : (Object.keys(MISSIONS.kindWeights) as MissionKind[]);
  const kind = weighted(MISSIONS.kindWeights, kinds, next());
  const tiers = weekly ? DIFFICULTIES.filter((d) => d !== 'easy') : DIFFICULTIES;
  const tier = weighted(MISSIONS.tierWeights, tiers, next());
  const scale = weekly ? MISSIONS.weekly.scale : 1;
  const goal = goalOf(kind, next, scale);
  const target = goal.kind === 'defeat' ? goal.count : 1;
  const base = goal.kind === 'defeat' ? (MISSIONS.coins.defeat * goal.count) / 10 : MISSIONS.coins[kind] * scale;
  const coins = roundTo5(base * MISSIONS.tierPay[tier]);
  const paysMaterials = tier !== 'easy' && (weekly || next() < MISSIONS.materials.chance);
  const materials = paysMaterials
    ? { line: pick(materialLines(), next()), tier: (tier === 'nightmare' ? 'hard' : tier) as MaterialTier, count: weekly ? MISSIONS.materials.weeklyCount : MISSIONS.materials.count }
    : undefined;
  return { id, period, goal, tier, target, reward: { coins, ...(materials ? { materials } : {}) } };
}

const sameGoal = (a: MissionGoal, b: MissionGoal): boolean => JSON.stringify(a) === JSON.stringify(b);

/** The daily board of a UTC day (YYYY-MM-DD): its missions, with distinct goals. */
export function dailyMissions(dateKey: string): Mission[] {
  const next = stream(dateKey, 0);
  const count = MISSIONS.dailyMin + Math.floor(next() * (MISSIONS.dailyMax - MISSIONS.dailyMin + 1));
  const board: Mission[] = [];
  for (let i = 0; i < count; i++) {
    let mission = missionAt(`d:${dateKey}:${i}`, 'daily', next);
    // A repeated goal is drawn again (a few tries; the pools are far larger than the board).
    for (let tries = 0; tries < 8 && board.some((m) => sameGoal(m.goal, mission.goal)); tries++) mission = missionAt(`d:${dateKey}:${i}`, 'daily', next);
    board.push(mission);
  }
  return board;
}

/** The weekly mission of the week starting on `mondayKey`. */
export const weeklyMission = (mondayKey: string): Mission => missionAt(`w:${mondayKey}:0`, 'weekly', stream(mondayKey, 1));

/** The board on screen at `nowMs`: today's missions, then this week's. */
export const missionBoard = (nowMs: number): Mission[] => [...dailyMissions(utcDateKey(nowMs)), weeklyMission(weekKey(nowMs))];

const ID = /^(d|w):(\d{4}-\d{2}-\d{2}):(\d+)$/;

/** The mission an id names (generated again), or null. */
export function missionById(id: string): Mission | null {
  const match = ID.exec(id);
  if (!match) return null;
  const [, period, key, index] = match;
  if (period === 'w') return index === '0' ? weeklyMission(key!) : null;
  return dailyMissions(key!)[Number(index)] ?? null;
}

/** How much one run adds to `mission` (0 below its tier). */
export function missionProgress(mission: Mission, report: RunReport): number {
  if (!atLeast(report.difficulty, mission.tier)) return 0;
  const goal = mission.goal;
  switch (goal.kind) {
    case 'floor':
      return report.dungeon === goal.dungeon && report.floor >= goal.floor ? 1 : 0;
    case 'clear':
      return report.outcome === 'victory' && report.dungeon === goal.dungeon ? 1 : 0;
    case 'defeat':
      return report.kills[goal.type] ?? 0;
    case 'species':
      return lineOf(report.species) === goal.line && report.floor >= 2 ? 1 : 0;
  }
}

/** Keeps only the missions of the board at `nowMs` (a past day's or week's are gone). */
export function pruneMissions(state: MissionState, nowMs: number): MissionState {
  const live = new Set(missionBoard(nowMs).map((m) => m.id));
  return { accepted: state.accepted.filter((a) => live.has(a.id)), claimed: state.claimed.filter((id) => live.has(id)) };
}

/** Accepts a mission of the current board; null when it is not there, already taken or claimed, or the limit is reached. */
export function acceptMission(state: MissionState, id: string, nowMs: number): MissionState | null {
  if (!missionBoard(nowMs).some((m) => m.id === id)) return null;
  if (state.accepted.some((a) => a.id === id) || state.claimed.includes(id) || state.accepted.length >= MISSIONS.maxAccepted) return null;
  return { ...state, accepted: [...state.accepted, { id, progress: 0 }] };
}

/** The accepted missions after a run (each up to its target). */
export function advanceMissions(state: MissionState, report: RunReport): MissionState {
  const accepted = state.accepted.map((a) => {
    const mission = missionById(a.id);
    return mission ? { id: a.id, progress: Math.min(mission.target, a.progress + missionProgress(mission, report)) } : a;
  });
  return accepted.some((a, i) => a.progress !== state.accepted[i]!.progress) ? { ...state, accepted } : state;
}

/** Claims a completed mission: its reward, and the state with it moved to the claimed ones; null when it is not complete. */
export function claimMission(state: MissionState, id: string): { state: MissionState; reward: MissionReward } | null {
  const mission = missionById(id);
  const held = state.accepted.find((a) => a.id === id);
  if (!mission || !held || held.progress < mission.target) return null;
  return { state: { accepted: state.accepted.filter((a) => a.id !== id), claimed: [...state.claimed, id] }, reward: mission.reward };
}

/** A reward paid into a collection: the Pokémonedas (and the lifetime count), and the materials of its line and tier. */
export function payMissionReward<C extends Collection & { earned?: number }>(collection: C, reward: MissionReward): C {
  const paid = { ...collection, coins: collection.coins + reward.coins, earned: (collection.earned ?? 0) + reward.coins };
  const mat = reward.materials;
  if (!mat) return paid;
  const have = collection.materials?.[mat.line] ?? {};
  return { ...paid, materials: { ...collection.materials, [mat.line]: { ...have, [mat.tier]: (have[mat.tier] ?? 0) + mat.count } } };
}

/** Where a mission of the board stands for a player: open to take, taken (with progress), complete to claim, or claimed. */
export type MissionStatus = 'open' | 'accepted' | 'done' | 'claimed';

export function missionStatus(state: MissionState, mission: Mission): MissionStatus {
  if (state.claimed.includes(mission.id)) return 'claimed';
  const held = state.accepted.find((a) => a.id === mission.id);
  if (!held) return 'open';
  return held.progress >= mission.target ? 'done' : 'accepted';
}

/** Progress of a taken mission (0 when not taken). */
export const missionProgressOf = (state: MissionState, mission: Mission): number => state.accepted.find((a) => a.id === mission.id)?.progress ?? 0;
