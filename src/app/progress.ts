import type { KeyValueStore } from '../adapters/storage';
import { settleAchievements } from '../core/achievements';
import { utcDateKey } from '../core/endless';
import { acceptMission, advanceMissions, claimMission, EMPTY_MISSIONS, payMissionReward, pruneMissions, type MissionReward, type MissionState } from '../core/missions';
import type { RunReport } from '../core/run-report';
import type { AchievementDef } from '../data/achievements';
import { DIFFICULTIES, type Difficulty } from '../data/difficulty';
import { DUNGEONS } from '../data/dungeons';
import { settlePast, type PastProgress } from '../core/past-progress';
import { readBoard, type ScoreEntry } from '../town/leaderboard';
import { readRecords, tierRecord, type Records } from '../town/records';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * Long-term progress at the save (odd/tasks/achievements-missions.md): a run
 * end advances the accepted missions and settles the achievements it earns;
 * a change of the collection (a pull, an evolution, a mission's reward)
 * settles the achievements the save alone earns. Each peer of a shared run
 * records its own report on its own save.
 */
export interface Settled {
  save: SaveData;
  unlocked: AchievementDef[];
}

/** The save's missions as of `nowMs` (a past day's and week's gone). */
export const missionsAt = (save: SaveData, nowMs: number): MissionState => pruneMissions(save.missions ?? EMPTY_MISSIONS, nowMs);

const withMissions = (save: SaveData, missions: MissionState): SaveData => {
  const { missions: _old, ...rest } = save;
  return missions.accepted.length > 0 || missions.claimed.length > 0 ? { ...rest, missions } : rest;
};

function settle(store: KeyValueStore, report: RunReport | null, nowMs: number): Settled {
  const before = loadSave(store);
  const missions = report ? advanceMissions(missionsAt(before, nowMs), report) : null;
  const { save, unlocked } = settleAchievements(missions ? withMissions(before, missions) : before, report, utcDateKey(nowMs));
  if (save !== before) writeSave(store, save);
  return { save: loadSave(store), unlocked };
}

/** A run ended: its missions' progress and its achievements. */
export const recordRun = (store: KeyValueStore, report: RunReport, nowMs: number): Settled => settle(store, report, nowMs);

/** The collection changed (a pull, an evolution): the achievements the save alone earns. */
export const recordSave = (store: KeyValueStore, nowMs: number): Settled => settle(store, null, nowMs);

/** Accepts a mission of the board at `nowMs`; the stored save, or null when it cannot be taken (nothing written). */
export function acceptAt(store: KeyValueStore, id: string, nowMs: number): SaveData | null {
  const save = loadSave(store);
  const missions = acceptMission(missionsAt(save, nowMs), id, nowMs);
  if (!missions) return null;
  writeSave(store, withMissions(save, missions));
  return loadSave(store);
}

/** Claims a completed mission and pays its reward (and any achievement it reaches); null when it is not complete (nothing written). */
export function claimAt(store: KeyValueStore, id: string, nowMs: number): (Settled & { reward: MissionReward }) | null {
  const save = loadSave(store);
  const claimed = claimMission(missionsAt(save, nowMs), id);
  if (!claimed) return null;
  writeSave(store, payMissionReward(withMissions(save, claimed.state), claimed.reward));
  return { ...recordSave(store, nowMs), reward: claimed.reward };
}

const ENDLESS = new Set<string>(DUNGEONS.filter((d) => d.endless).map((d) => d.id));

/**
 * What the device's history proves for the retroactive achievements
 * (core/past-progress.ts): per dungeon, the highest tier a run of it was won
 * on (a record from before tiers counts as easy, town/records.ts
 * `tierRecord`); per endless dungeon, the deepest floor of the records and of
 * the Sima leaderboard (its entries are the endless dungeon's).
 */
export function pastProgress(records: Records, board: readonly ScoreEntry[]): PastProgress {
  const cleared: Partial<Record<string, Difficulty>> = {};
  const deepest: Partial<Record<string, number>> = {};
  for (const [id, record] of Object.entries(records.dungeons)) {
    if (ENDLESS.has(id)) {
      if (record.bestFloor > 0) deepest[id] = record.bestFloor;
      continue;
    }
    const won = DIFFICULTIES.filter((d) => (tierRecord(record, d)?.clears ?? 0) > 0);
    // A guardian that fell on some tier the tiers no longer show still counts as an easy clear.
    const best = won[won.length - 1] ?? (record.cleared ? 'easy' : undefined);
    if (best) cleared[id] = best;
  }
  const sima = board.reduce((deep, e) => Math.max(deep, e.floor), 0);
  if (sima > 0) for (const id of ENDLESS) deepest[id] = Math.max(deepest[id] ?? 0, sima);
  return { cleared, deepest };
}

/**
 * On load: unlocks, once and silently, every achievement the save, the
 * records and the leaderboard already prove (progress made before
 * achievements existed) and pays their rewards; nothing is written when
 * nothing changes, so it runs on every start.
 */
export function recordPast(store: KeyValueStore, nowMs: number): Settled {
  const before = loadSave(store);
  const { save, unlocked } = settlePast(before, pastProgress(readRecords(store), readBoard(store)), utcDateKey(nowMs));
  if (save === before) return { save: before, unlocked };
  writeSave(store, save);
  return { save: loadSave(store), unlocked };
}
