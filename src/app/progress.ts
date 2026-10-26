import type { KeyValueStore } from '../adapters/storage';
import { settleAchievements } from '../core/achievements';
import { utcDateKey } from '../core/endless';
import type { RunReport } from '../core/run-report';
import type { AchievementDef } from '../data/achievements';
import { loadSave, writeSave, type SaveData } from './save';

/**
 * Long-term progress at the save (odd/tasks/achievements-missions.md): a run
 * end or a change of the collection (a pull, an evolution) settles the
 * achievements it earns into the stored save. Each peer of a shared run
 * settles its own report on its own save.
 */
export interface Settled {
  save: SaveData;
  unlocked: AchievementDef[];
}

function settle(store: KeyValueStore, report: RunReport | null, nowMs: number): Settled {
  const before = loadSave(store);
  const { save, unlocked } = settleAchievements(before, report, utcDateKey(nowMs));
  if (save !== before) writeSave(store, save);
  return { save: loadSave(store), unlocked };
}

/** A run ended: its achievements. */
export const recordRun = (store: KeyValueStore, report: RunReport, nowMs: number): Settled => settle(store, report, nowMs);

/** The collection changed (a pull, an evolution): the achievements the save alone earns. */
export const recordSave = (store: KeyValueStore, nowMs: number): Settled => settle(store, null, nowMs);
