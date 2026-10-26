import { describe, expect, it } from 'vitest';
import { runReport, tallyKills } from '../../src/core/run-report';

/** The run-end report that achievements and missions read (odd/tasks/achievements-missions.md T1). */
const enemy = (id: string, types: string[]) => ({ id, types }) as never;

describe('run report', () => {
  it('counts every type of each newly credited enemy once', () => {
    const enemies = [enemy('a', ['ghost', 'grass']), enemy('b', ['dark']), enemy('c', ['ghost'])];
    const kills = tallyKills({}, { credited: ['a'] }, { credited: ['a', 'b', 'c'], enemies });
    expect(kills).toEqual({ dark: 1, ghost: 1 });
    expect(tallyKills(kills, { credited: ['a', 'b', 'c'] }, { credited: ['a', 'b', 'c'], enemies })).toBe(kills);
  });

  it('builds a report from a run summary, defaulting what an older summary lacks', () => {
    const r = runReport({ dungeon: 'misty-forest', floor: 8, difficulty: 'hard' }, 'victory', 'zorua');
    expect(r).toEqual({ dungeon: 'misty-forest', outcome: 'victory', floor: 8, difficulty: 'hard', species: 'zorua', coop: false, kills: {}, guardianNoHit: false });
    expect(runReport({ dungeon: 'misty-forest', floor: 8, difficulty: 'hard', kills: { ghost: 3 }, guardianNoHit: true, coop: true }, 'victory', 'zorua')).toMatchObject({ kills: { ghost: 3 }, guardianNoHit: true, coop: true });
  });
});
