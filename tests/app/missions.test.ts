import { describe, expect, it } from 'vitest';
import { memoryStore } from '../../src/adapters/storage';
import { acceptAt, claimAt, missionsAt, recordRun } from '../../src/app/progress';
import { EMPTY_SAVE, loadSave, writeSave } from '../../src/app/save';
import { missionBoard, type Mission } from '../../src/core/missions';
import type { RunReport } from '../../src/core/run-report';

/** The notice board's missions at the save (odd/tasks/achievements-missions.md T3). */
const NOW = Date.UTC(2026, 9, 26, 15);
const DAY = 86_400_000;

/** A nightmare run that completes `m` whatever its goal. */
const completing = (m: Mission): RunReport => ({
  dungeon: m.goal.kind === 'floor' || m.goal.kind === 'clear' ? m.goal.dungeon : 'crypt-of-the-sword-king',
  outcome: 'victory',
  floor: 99,
  difficulty: 'nightmare',
  species: m.goal.kind === 'species' ? m.goal.line : 'mimikyu',
  coop: false,
  kills: m.goal.kind === 'defeat' ? { [m.goal.type]: 999 } : {},
  guardianNoHit: false,
});

describe('missions at the save', () => {
  it('accept, progress from a run end, then claim pays the reward once', () => {
    const store = memoryStore();
    writeSave(store, { ...EMPTY_SAVE, coins: 0 });
    const m = missionBoard(NOW)[0]!;
    expect(acceptAt(store, m.id, NOW)!.missions!.accepted).toEqual([{ id: m.id, progress: 0 }]);
    expect(claimAt(store, m.id, NOW)).toBeNull();
    recordRun(store, completing(m), NOW);
    expect(missionsAt(loadSave(store), NOW).accepted).toEqual([{ id: m.id, progress: m.target }]);
    const before = loadSave(store).coins;
    const claimed = claimAt(store, m.id, NOW)!;
    expect(claimed.reward).toEqual(m.reward);
    expect(loadSave(store).coins).toBe(before + m.reward.coins + claimed.unlocked.reduce((sum, d) => sum + d.reward, 0));
    if (m.reward.materials) expect(loadSave(store).materials?.[m.reward.materials.line]?.[m.reward.materials.tier]).toBe(m.reward.materials.count);
    expect(loadSave(store).missions!.claimed).toEqual([m.id]);
    expect(claimAt(store, m.id, NOW)).toBeNull();
    expect(acceptAt(store, m.id, NOW)).toBeNull();
  });

  it('a past day\'s missions are gone the next day and give way to new ones', () => {
    const store = memoryStore();
    const m = missionBoard(NOW)[0]!;
    acceptAt(store, m.id, NOW);
    expect(missionsAt(loadSave(store), NOW + DAY).accepted).toEqual([]);
    recordRun(store, completing(m), NOW + DAY);
    expect(loadSave(store).missions).toBeUndefined();
    expect(acceptAt(store, missionBoard(NOW + DAY)[0]!.id, NOW + DAY)).not.toBeNull();
  });
});
