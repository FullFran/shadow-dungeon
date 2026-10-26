import { describe, expect, it } from 'vitest';
import { nextSpectate, spectateTarget, type Watchable } from '../../src/app/spectate';

/** A fainted player watches a standing teammate (odd/tasks/coop-flow.md T6). */
const team = (...standing: boolean[]): Watchable[] => standing.map((s, i) => ({ id: `p${i + 2}`, standing: s }));

describe('spectate', () => {
  it('watches the first standing teammate, and keeps watching it while it stands', () => {
    expect(spectateTarget(team(false, true, true), null)).toBe('p3');
    expect(spectateTarget(team(true, true, true), 'p4')).toBe('p4');
  });

  it('moves on when the one watched falls, and watches nobody when nobody stands', () => {
    expect(spectateTarget(team(true, false, true), 'p3')).toBe('p2');
    expect(spectateTarget(team(false, false), 'p2')).toBeNull();
    expect(spectateTarget([], null)).toBeNull();
  });

  it('cycles through the standing teammates only, wrapping round', () => {
    const t = team(true, false, true);
    expect(nextSpectate(t, 'p2')).toBe('p4');
    expect(nextSpectate(t, 'p4')).toBe('p2');
    expect(nextSpectate(t, null)).toBe('p2');
    expect(nextSpectate(team(true), 'p2')).toBe('p2');
    expect(nextSpectate(team(false), 'p2')).toBeNull();
  });
});
