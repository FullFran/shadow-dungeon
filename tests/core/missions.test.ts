import { describe, expect, it } from 'vitest';
import { lineOf } from '../../src/core/evolution';
import {
  acceptMission,
  advanceMissions,
  claimMission,
  dailyMissions,
  enemyTypes,
  missionBoard,
  missionById,
  missionProgress,
  payMissionReward,
  pruneMissions,
  weekKey,
  weeklyMission,
  type Mission,
  type MissionState,
} from '../../src/core/missions';
import type { RunReport } from '../../src/core/run-report';
import { utcDateKey } from '../../src/core/endless';
import { clearableDungeons } from '../../src/data/achievements';
import { atLeast, difficultyRank } from '../../src/data/difficulty';
import { DUNGEONS, floorsOf } from '../../src/data/dungeons';
import { MISSIONS } from '../../src/data/missions';
import { PLAYER_EVOLUTIONS } from '../../src/data/player-evolutions';
import { PLAYABLE_SPECIES, SPECIES } from '../../src/data/species';

/** Missions (odd/tasks/achievements-missions.md T3): a daily board seeded by the UTC day, one weekly, progress from run reports. */
const DAY = 86_400_000;
const NOW = Date.UTC(2026, 9, 26, 15); // a Monday
const days = (n: number) => Array.from({ length: n }, (_, i) => utcDateKey(Date.UTC(2026, 0, 1) + i * DAY));
const everyMission = (): Mission[] => days(400).flatMap((d) => [...dailyMissions(d), weeklyMission(d)]);

const report = (over: Partial<RunReport> = {}): RunReport => ({
  dungeon: 'crypt-of-the-sword-king',
  outcome: 'victory',
  floor: 5,
  difficulty: 'nightmare',
  species: 'mimikyu',
  coop: false,
  kills: {},
  guardianNoHit: false,
  ...over,
});

describe('the daily board', () => {
  it('is the same for the same UTC day and changes between days', () => {
    expect(dailyMissions('2026-10-26')).toEqual(dailyMissions('2026-10-26'));
    const boards = new Set(days(30).map((d) => JSON.stringify(dailyMissions(d).map((m) => m.goal))));
    expect(boards.size).toBeGreaterThan(25);
  });

  it(`holds ${MISSIONS.dailyMin} to ${MISSIONS.dailyMax} missions with distinct goals and ids of their day`, () => {
    for (const d of days(60)) {
      const board = dailyMissions(d);
      expect(board.length).toBeGreaterThanOrEqual(MISSIONS.dailyMin);
      expect(board.length).toBeLessThanOrEqual(MISSIONS.dailyMax);
      expect(new Set(board.map((m) => JSON.stringify(m.goal))).size).toBe(board.length);
      board.forEach((m, i) => expect(m.id).toBe(`d:${d}:${i}`));
    }
  });

  it('adds one weekly mission keyed by the Monday of the UTC week', () => {
    expect(weekKey(NOW)).toBe('2026-10-26');
    expect(weekKey(NOW + 6 * DAY)).toBe('2026-10-26');
    expect(weekKey(NOW + 7 * DAY)).toBe('2026-11-02');
    const board = missionBoard(NOW);
    expect(board.at(-1)).toEqual(weeklyMission('2026-10-26'));
    expect(board.at(-1)!.period).toBe('weekly');
    expect(board.slice(0, -1)).toEqual(dailyMissions('2026-10-26'));
  });

  it('every mission is found again from its id; anything else is null', () => {
    for (const m of everyMission().slice(0, 300)) expect(missionById(m.id)).toEqual(m);
    for (const bad of ['', 'd:2026-10-26:99', 'x:2026-10-26:0', 'd:20261026:0', 'w:2026-10-26:1', '__proto__']) expect(missionById(bad), bad).toBeNull();
  });
});

describe('missions reach all the content', () => {
  const all = everyMission();

  it('every main dungeon is a floor goal and every winnable dungeon (challenges too) a clear goal', () => {
    for (const d of DUNGEONS) expect(all.some((m) => m.goal.kind === 'floor' && m.goal.dungeon === d.id), d.id).toBe(true);
    for (const d of clearableDungeons()) expect(all.some((m) => m.goal.kind === 'clear' && m.goal.dungeon === d.id), d.id).toBe(true);
  });

  it('every playable line is a species goal and every enemy type of the dungeons a defeat goal', () => {
    for (const line of new Set(PLAYABLE_SPECIES.map(lineOf))) expect(all.some((m) => m.goal.kind === 'species' && m.goal.line === line), line).toBe(true);
    const types = new Set(DUNGEONS.flatMap((d) => d.spawns.pool.flatMap((e) => [e.species, ...(e.escort ? [e.escort.species] : [])])).flatMap((s) => SPECIES[s].types));
    expect(new Set(enemyTypes())).toEqual(types);
    for (const type of types) expect(all.some((m) => m.goal.kind === 'defeat' && m.goal.type === type), type).toBe(true);
  });

  it('floor goals stay inside their dungeon', () => {
    for (const m of all) if (m.goal.kind === 'floor') {
      const d = DUNGEONS.find((x) => x.id === (m.goal as { dungeon: string }).dungeon)!;
      expect(m.goal.floor).toBeGreaterThanOrEqual(2);
      expect(m.goal.floor).toBeLessThanOrEqual(Math.min(floorsOf(d), 20));
    }
  });
});

describe('mission rewards', () => {
  const all = everyMission();

  it('pay Pokémonedas; materials only from Normal up, of a tier at most the mission\'s and never Pesadilla', () => {
    const lines = new Set(PLAYER_EVOLUTIONS.map((e) => lineOf(e.from)));
    let withMaterials = 0;
    for (const m of all) {
      expect(Number.isInteger(m.reward.coins) && m.reward.coins > 0, m.id).toBe(true);
      const mat = m.reward.materials;
      if (!mat) continue;
      withMaterials++;
      expect(mat.tier, m.id).not.toBe('nightmare');
      expect(m.tier, m.id).not.toBe('easy');
      expect(difficultyRank(mat.tier) <= difficultyRank(m.tier), m.id).toBe(true);
      expect(lines.has(mat.line), m.id).toBe(true);
      expect(mat.count).toBeGreaterThan(0);
    }
    expect(withMaterials).toBeGreaterThan(0);
    for (const line of lines) expect(all.some((m) => m.reward.materials?.line === line), line).toBe(true);
  });

  it('weekly missions ask a tier from Normal up and always pay materials', () => {
    for (const m of all.filter((x) => x.period === 'weekly')) {
      expect(atLeast(m.tier, 'normal'), m.id).toBe(true);
      expect(m.reward.materials, m.id).toBeDefined();
    }
  });

  it('a reward pays its coins into the balance and lifetime count, and its materials into the line', () => {
    const paid = payMissionReward({ coins: 10, earned: 10, materials: { abra: { normal: 1 } } }, { coins: 50, materials: { line: 'abra', tier: 'normal', count: 2 } });
    expect(paid).toEqual({ coins: 60, earned: 60, materials: { abra: { normal: 3 } } });
  });
});

describe('progress, accepting and claiming', () => {
  const board = missionBoard(NOW);
  const empty: MissionState = { accepted: [], claimed: [] };

  it('accepts missions of the current board, at most the limit, once each', () => {
    let state = empty;
    for (const m of board.slice(0, MISSIONS.maxAccepted)) state = acceptMission(state, m.id, NOW)!;
    expect(state.accepted).toHaveLength(MISSIONS.maxAccepted);
    expect(acceptMission(state, board[MISSIONS.maxAccepted]!.id, NOW)).toBeNull();
    expect(acceptMission(empty, board[0]!.id, NOW + DAY)).toBeNull();
    const one = acceptMission(empty, board[0]!.id, NOW)!;
    expect(acceptMission(one, board[0]!.id, NOW)).toBeNull();
  });

  it('counts a run only on the mission\'s tier or above', () => {
    const m: Mission = { id: 'x', period: 'daily', goal: { kind: 'clear', dungeon: 'misty-forest' }, tier: 'hard', target: 1, reward: { coins: 10 } };
    expect(missionProgress(m, report({ dungeon: 'misty-forest', difficulty: 'normal' }))).toBe(0);
    expect(missionProgress(m, report({ dungeon: 'misty-forest', difficulty: 'nightmare' }))).toBe(1);
    expect(missionProgress(m, report({ dungeon: 'misty-forest', outcome: 'defeat' }))).toBe(0);
    const defeat: Mission = { ...m, goal: { kind: 'defeat', type: 'ghost', count: 12 }, tier: 'easy', target: 12 };
    expect(missionProgress(defeat, report({ kills: { ghost: 5, dark: 3 } }))).toBe(5);
    const floor: Mission = { ...m, goal: { kind: 'floor', dungeon: 'eclipse-chasm', floor: 10 }, tier: 'easy' };
    expect(missionProgress(floor, report({ dungeon: 'eclipse-chasm', outcome: 'eclipse', floor: 12 }))).toBe(1);
    expect(missionProgress(floor, report({ dungeon: 'eclipse-chasm', outcome: 'eclipse', floor: 9 }))).toBe(0);
    const species: Mission = { ...m, goal: { kind: 'species', line: 'abra' }, tier: 'easy' };
    expect(missionProgress(species, report({ species: 'alakazam', outcome: 'defeat', floor: 2 }))).toBe(1);
    expect(missionProgress(species, report({ species: 'alakazam', outcome: 'defeat', floor: 1 }))).toBe(0);
  });

  it('advances accepted missions up to their target, then claims each once', () => {
    const m = board.find((x) => x.goal.kind === 'defeat') ?? board[0]!;
    let state = acceptMission(empty, m.id, NOW)!;
    const full: RunReport = report({ dungeon: m.goal.kind === 'floor' || m.goal.kind === 'clear' ? m.goal.dungeon : 'crypt-of-the-sword-king', floor: 99, species: m.goal.kind === 'species' ? m.goal.line : 'mimikyu', kills: m.goal.kind === 'defeat' ? { [m.goal.type]: 999 } : {} });
    expect(claimMission(state, m.id)).toBeNull();
    state = advanceMissions(state, full);
    expect(state.accepted[0]!.progress).toBe(m.target);
    const claimed = claimMission(state, m.id)!;
    expect(claimed.reward).toEqual(m.reward);
    expect(claimed.state.accepted).toEqual([]);
    expect(claimed.state.claimed).toEqual([m.id]);
    expect(claimMission(claimed.state, m.id)).toBeNull();
    expect(acceptMission(claimed.state, m.id, NOW)).toBeNull();
  });

  it('drops missions of past days and weeks', () => {
    const daily = board[0]!;
    const weekly = board.at(-1)!;
    const state: MissionState = { accepted: [{ id: daily.id, progress: 0 }, { id: weekly.id, progress: 0 }], claimed: [daily.id] };
    expect(pruneMissions(state, NOW)).toEqual(state);
    expect(pruneMissions(state, NOW + DAY)).toEqual({ accepted: [{ id: weekly.id, progress: 0 }], claimed: [] });
    expect(pruneMissions(state, NOW + 7 * DAY)).toEqual({ accepted: [], claimed: [] });
  });
});
