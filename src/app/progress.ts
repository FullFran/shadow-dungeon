import type { KeyValueStore } from '../adapters/storage';
import { settleAchievements } from '../core/achievements';
import { utcDateKey } from '../core/endless';
import { acceptMission, advanceMissions, claimMission, EMPTY_MISSIONS, payMissionReward, pruneMissions, type MissionReward, type MissionState } from '../core/missions';
import type { RunReport } from '../core/run-report';
import type { AchievementDef } from '../data/achievements';
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
